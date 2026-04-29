// plaid-recurring-refresh
// Pulls Plaid's detected recurring streams for an item and persists them.
// Plaid does the heavy detection work; this function just caches the result
// in plaid_recurring_streams for the Analyzer to read.
//
// POST body:
//   { plaid_item_row_id: string }
//
// Returns: { inflow_count, outflow_count, last_refreshed_at }
//
// Behavior:
//   - Calls /transactions/recurring/get with access_token.
//   - Upserts streams by (plaid_item_id, stream_id).
//   - Marks streams not present in this response as TOMBSTONED if they
//     were previously active (Plaid sometimes drops old streams).
//   - Updates plaid_items.last_recurring_refresh_at.
//
// Plaid recommends ≥180 days of history for clean recurring detection,
// which matches our 6-month default lookback (D1.3 / D1.4).

import { createClient } from 'npm:@supabase/supabase-js@2';
import { transactionsRecurringGet, type RecurringStream } from '../_shared/plaid.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Body = { plaid_item_row_id: string };

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

    const body: Body = await req.json();
    if (!body?.plaid_item_row_id) {
      return json({ error: 'plaid_item_row_id required' }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: item, error: itemErr } = await admin
      .from('plaid_items')
      .select('id, user_id, access_token')
      .eq('id', body.plaid_item_row_id)
      .single();
    if (itemErr || !item) return json({ error: 'Item not found' }, 404);
    if (item.user_id !== userId) return json({ error: 'Forbidden' }, 403);

    const resp = await transactionsRecurringGet(item.access_token);
    const refreshedAt = new Date().toISOString();

    const inflowRows = resp.inflow_streams.map((s) =>
      buildStreamRow(userId, item.id, s, 'inflow', refreshedAt),
    );
    const outflowRows = resp.outflow_streams.map((s) =>
      buildStreamRow(userId, item.id, s, 'outflow', refreshedAt),
    );
    const allRows = [...inflowRows, ...outflowRows];

    if (allRows.length) {
      const { error } = await admin
        .from('plaid_recurring_streams')
        .upsert(allRows, { onConflict: 'plaid_item_id,stream_id' });
      if (error) {
        console.error('upsert recurring streams failed:', error);
        return json({ error: error.message }, 500);
      }
    }

    // Mark streams not in this refresh as inactive (Plaid drops them).
    const presentStreamIds = allRows.map((r) => r.stream_id);
    if (presentStreamIds.length) {
      const { error } = await admin
        .from('plaid_recurring_streams')
        .update({ is_active: false, status: 'TOMBSTONED', last_refreshed_at: refreshedAt })
        .eq('plaid_item_id', item.id)
        .not('stream_id', 'in', `(${presentStreamIds.map((s) => `"${s}"`).join(',')})`);
      if (error) console.error('tombstone missing streams failed:', error);
    }

    await admin
      .from('plaid_items')
      .update({ last_recurring_refresh_at: refreshedAt })
      .eq('id', item.id);

    return json({
      inflow_count: inflowRows.length,
      outflow_count: outflowRows.length,
      last_refreshed_at: refreshedAt,
    });
  } catch (e) {
    console.error('plaid-recurring-refresh error:', e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function buildStreamRow(
  userId: string,
  plaidItemId: string,
  s: RecurringStream,
  direction: 'inflow' | 'outflow',
  refreshedAt: string,
) {
  return {
    user_id: userId,
    plaid_item_id: plaidItemId,
    stream_id: s.stream_id,
    direction,
    merchant_name: s.merchant_name,
    description: s.description,
    personal_finance_category_detailed: s.personal_finance_category?.detailed ?? null,
    frequency: s.frequency,
    status: s.status,
    is_active: s.is_active,
    is_user_modified: s.is_user_modified,
    average_amount: s.average_amount?.amount ?? null,
    last_amount: s.last_amount?.amount ?? null,
    iso_currency_code: s.average_amount?.iso_currency_code ?? 'USD',
    predicted_next_date: s.predicted_next_date,
    first_date: s.first_date,
    last_date: s.last_date,
    last_user_modified_at: s.last_user_modified_datetime,
    transaction_ids: s.transaction_ids,
    last_refreshed_at: refreshedAt,
  };
}
