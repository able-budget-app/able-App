// plaid-set-item-status
// Tiny user-driven endpoint to update plaid_items.recurring_status from
// the browser. Direct client-side UPDATEs on plaid_items are blocked by
// RLS (read-only for users), so the new-bank review modal needs this
// server-side path to flip status to 'applied' after the user reviews
// the candidates surfaced from plaid_recurring_streams + plaid_credit_debts.
//
// POST body:
//   { plaid_item_row_id: string, status: 'fresh'|'pending'|'applied' }
//
// Auth: user JWT. Verifies the calling user owns the plaid_items row
// before performing the UPDATE.

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const VALID_STATUSES = new Set(['fresh', 'pending', 'applied']);

type Body = {
  plaid_item_row_id?: string;
  status?: string;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes.user) return json({ error: 'Unauthorized' }, 401);
    const userId = userRes.user.id;

    const body = (await req.json().catch(() => ({}))) as Body;
    const itemId = body.plaid_item_row_id;
    const status = body.status;
    if (!itemId || typeof itemId !== 'string') {
      return json({ error: 'plaid_item_row_id required' }, 400);
    }
    if (!status || !VALID_STATUSES.has(status)) {
      return json({ error: `status must be one of: ${[...VALID_STATUSES].join(', ')}` }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Verify ownership before update.
    const { data: item, error: itemErr } = await admin
      .from('plaid_items')
      .select('id, user_id')
      .eq('id', itemId)
      .single();
    if (itemErr || !item) return json({ error: 'Item not found' }, 404);
    if (item.user_id !== userId) return json({ error: 'Forbidden' }, 403);

    const { error: updErr } = await admin
      .from('plaid_items')
      .update({ recurring_status: status })
      .eq('id', itemId);
    if (updErr) return json({ error: updErr.message }, 500);

    return json({ ok: true, plaid_item_row_id: itemId, recurring_status: status });
  } catch (e) {
    console.error('plaid-set-item-status error:', e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
