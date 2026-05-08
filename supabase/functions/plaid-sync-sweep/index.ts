// plaid-sync-sweep
// Backstop for missed Plaid webhooks. A scheduled sweep that triggers
// plaid-sync for every active item that hasn't synced recently. The
// cursor-based design of plaid-sync makes this safe to call repeatedly:
// a no-op when there's nothing new for that item.
//
// Trigger: pg_cron, every 15 minutes. See the SQL in the deploy
// notes for the schedule entry.
//
// Auth: requires the service role bearer (same key Edge Functions get
// auto-injected as SUPABASE_SERVICE_ROLE_KEY). The cron passes this
// from a Postgres-side setting.

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const INTERNAL_SECRET = Deno.env.get('INTERNAL_FUNCTION_SECRET') ?? '';

const STALE_AFTER_MIN = 60;     // items quieter than this get a re-sync
const MAX_ITEMS_PER_RUN = 50;   // sanity cap so a backlog can't fanout-bomb

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  const bearerToken = authHeader.replace(/^Bearer\s+/i, '');
  if (!bearerToken || bearerToken !== SERVICE_ROLE) {
    return json({ error: 'Unauthorized' }, 401);
  }

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const staleAt = new Date(Date.now() - STALE_AFTER_MIN * 60 * 1000).toISOString();

    // PostgREST can't easily compare two columns (last_webhook_at >
    // last_sync_at), so cast a wider net by age and let plaid-sync's
    // cursor decide if there's actually work.
    const { data: items, error: queryErr } = await admin
      .from('plaid_items')
      .select('id, last_sync_at, last_webhook_at, status')
      .or(`last_sync_at.is.null,last_sync_at.lt.${staleAt}`)
      .not('status', 'in', '("error","revoked","pending_disconnect","pending_expiration")')
      .order('last_sync_at', { ascending: true, nullsFirst: true })
      .limit(MAX_ITEMS_PER_RUN);

    if (queryErr) {
      console.error('plaid-sync-sweep: query failed:', queryErr);
      return json({ error: queryErr.message }, 500);
    }

    const itemIds = (items ?? []).map((i) => i.id as string);
    console.log(`plaid-sync-sweep: ${itemIds.length} item(s) need sync`);

    if (itemIds.length === 0) {
      return json({ scanned: 0, triggered: 0 });
    }

    // Fire all plaid-sync calls in parallel; defer via EdgeRuntime.waitUntil
    // so we return a summary fast and the syncs run in background.
    const work = Promise.allSettled(itemIds.map(triggerSyncFor)).then((results) => {
      const ok = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.length - ok;
      const failures = results
        .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
        .map((r) => String(r.reason));
      console.log(`plaid-sync-sweep: done — ${ok} ok, ${failed} failed`);
      if (failures.length) console.error('plaid-sync-sweep failures:', failures);
    });

    const er = (globalThis as unknown as {
      EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void };
    }).EdgeRuntime;
    if (er?.waitUntil) er.waitUntil(work);

    return json({ scanned: itemIds.length, triggered: itemIds.length });
  } catch (e) {
    console.error('plaid-sync-sweep error:', e);
    return json({ error: (e as Error).message }, 500);
  }
});

async function triggerSyncFor(plaidItemRowId: string): Promise<void> {
  const url = `${SUPABASE_URL}/functions/v1/plaid-sync`;
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SERVICE_ROLE}`,
      'x-internal-auth': INTERNAL_SECRET,
    },
    body: JSON.stringify({ plaid_item_row_id: plaidItemRowId }),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`${plaidItemRowId}: ${r.status} ${t}`);
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
