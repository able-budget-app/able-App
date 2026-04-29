// plaid-sync
// Pulls transactions for a Plaid item via /transactions/sync (cursor-based),
// persists added/modified/removed rows, and updates the item's cursor.
//
// POST body:
//   { plaid_item_row_id: string }
//
// Returns: { added, modified, removed, cursor, status, has_more }
//
// Behavior:
//   - Reads access_token + transactions_cursor from plaid_items.
//   - Loops /transactions/sync until has_more === false (caps iterations to
//     prevent runaway calls — caller can re-invoke if needed).
//   - Upserts plaid_accounts.balances on every page (Plaid returns accounts
//     with each response).
//   - Inserts new plaid_transactions rows. UPDATE on conflict so re-syncs
//     overwrite stale fields.
//   - Marks initial_sync_complete / historical_sync_complete based on
//     transactions_update_status.
//
// NOT done in this function (separate calls):
//   - Re-categorization (call plaid-recategorize on unclassified txns)
//   - Recurring refresh (call plaid-recurring-refresh)

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import {
  transactionsSync,
  type TransactionsSyncRes,
  type PlaidTransaction,
  type PlaidAccount,
} from '../_shared/plaid.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MAX_PAGES = 50; // hard cap. Each page is up to 500 txns. 25k limit.

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
      .select('id, user_id, access_token, transactions_cursor, lookback_months')
      .eq('id', body.plaid_item_row_id)
      .single();
    if (itemErr || !item) return json({ error: 'Item not found' }, 404);
    if (item.user_id !== userId) return json({ error: 'Forbidden' }, 403);

    // Build a quick lookup of Plaid account_id → plaid_accounts.id (our PK).
    const { data: accountRows } = await admin
      .from('plaid_accounts')
      .select('id, plaid_account_id')
      .eq('plaid_item_id', item.id);
    const accountMap = new Map<string, string>();
    for (const a of accountRows ?? []) accountMap.set(a.plaid_account_id, a.id);

    const dayMap: Record<number, number> = { 6: 180, 12: 365, 24: 730 };
    const daysRequested = dayMap[item.lookback_months as number] ?? 180;

    let cursor: string | undefined = item.transactions_cursor ?? undefined;
    let totalAdded = 0;
    let totalModified = 0;
    let totalRemoved = 0;
    let lastStatus: TransactionsSyncRes['transactions_update_status'] | undefined;
    let lastHasMore = true;

    const tStart = Date.now();
    console.log(`plaid-sync: starting, item=${item.id}, days_requested=${daysRequested}, cursor=${cursor ? 'present' : 'fresh'}`);

    for (let page = 0; page < MAX_PAGES && lastHasMore; page++) {
      const tPage = Date.now();
      // Cap each Plaid call at 40s. /transactions/sync on a fresh Item can
      // hang while Plaid's HISTORICAL_UPDATE is still pending; we'd rather
      // surface a clean error than get EarlyDrop'd by Supabase's wall clock.
      const resp = await Promise.race([
        transactionsSync({
          access_token: item.access_token,
          cursor,
          count: 500,
          options: {
            include_personal_finance_category: true,
            ...(cursor ? {} : { days_requested: daysRequested }),
          },
        }),
        new Promise<TransactionsSyncRes>((_, reject) => setTimeout(
          () => reject(new Error(`Plaid /transactions/sync timeout after 40s on page ${page}`)),
          40000,
        )),
      ]);
      console.log(`plaid-sync: page ${page} fetched in ${Date.now() - tPage}ms (added=${resp.added.length}, modified=${resp.modified.length}, removed=${resp.removed.length}, has_more=${resp.has_more}, status=${resp.transactions_update_status})`);

      // Refresh balances from this page's accounts list.
      const tAcc = Date.now();
      await upsertAccounts(admin, item.id, userId, resp.accounts, accountMap);
      console.log(`plaid-sync: page ${page} accounts upsert in ${Date.now() - tAcc}ms`);

      // Persist transactions.
      if (resp.added.length) {
        const tIns = Date.now();
        const rows = resp.added
          .map((t) => buildTxnRow(userId, accountMap, t))
          .filter((r): r is NonNullable<typeof r> => r !== null);
        if (rows.length) {
          const { error } = await admin
            .from('plaid_transactions')
            .upsert(rows, { onConflict: 'plaid_transaction_id' });
          if (error) console.error('insert added txns failed:', error);
        }
        totalAdded += resp.added.length;
        console.log(`plaid-sync: page ${page} inserted ${rows.length} added txns in ${Date.now() - tIns}ms`);
      }

      if (resp.modified.length) {
        const rows = resp.modified
          .map((t) => buildTxnRow(userId, accountMap, t))
          .filter((r): r is NonNullable<typeof r> => r !== null);
        if (rows.length) {
          const { error } = await admin
            .from('plaid_transactions')
            .upsert(rows, { onConflict: 'plaid_transaction_id' });
          if (error) console.error('update modified txns failed:', error);
        }
        totalModified += resp.modified.length;
      }

      if (resp.removed.length) {
        const ids = resp.removed.map((r) => r.transaction_id);
        const { error } = await admin
          .from('plaid_transactions')
          .delete()
          .in('plaid_transaction_id', ids);
        if (error) console.error('delete removed txns failed:', error);
        totalRemoved += resp.removed.length;
      }

      cursor = resp.next_cursor;
      lastStatus = resp.transactions_update_status;
      lastHasMore = resp.has_more;
    }

    const updatePayload: Record<string, unknown> = {
      transactions_cursor: cursor,
      last_sync_at: new Date().toISOString(),
    };
    if (lastStatus === 'INITIAL_UPDATE_COMPLETE' || lastStatus === 'HISTORICAL_UPDATE_COMPLETE') {
      updatePayload.initial_sync_complete = true;
    }
    if (lastStatus === 'HISTORICAL_UPDATE_COMPLETE') {
      updatePayload.historical_sync_complete = true;
    }
    await admin.from('plaid_items').update(updatePayload).eq('id', item.id);
    console.log(`plaid-sync: done in ${Date.now() - tStart}ms, total added=${totalAdded}, modified=${totalModified}, removed=${totalRemoved}, status=${lastStatus}`);

    return json({
      added: totalAdded,
      modified: totalModified,
      removed: totalRemoved,
      cursor,
      status: lastStatus ?? null,
      has_more: lastHasMore,
    });
  } catch (e) {
    console.error('plaid-sync error:', e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function upsertAccounts(
  admin: SupabaseClient,
  plaidItemId: string,
  userId: string,
  accounts: PlaidAccount[],
  accountMap: Map<string, string>,
) {
  if (!accounts.length) return;
  const rows = accounts.map((a) => ({
    user_id: userId,
    plaid_item_id: plaidItemId,
    plaid_account_id: a.account_id,
    name: a.name,
    official_name: a.official_name,
    mask: a.mask,
    type: a.type,
    subtype: a.subtype,
    current_balance: a.balances.current,
    available_balance: a.balances.available,
    iso_currency_code: a.balances.iso_currency_code ?? 'USD',
    last_balance_at: new Date().toISOString(),
  }));
  const { data, error } = await admin
    .from('plaid_accounts')
    .upsert(rows, { onConflict: 'plaid_account_id' })
    .select('id, plaid_account_id');
  if (error) {
    console.error('upsert accounts failed:', error);
    return;
  }
  for (const r of data ?? []) accountMap.set(r.plaid_account_id, r.id);
}

function buildTxnRow(
  userId: string,
  accountMap: Map<string, string>,
  t: PlaidTransaction,
) {
  const acctId = accountMap.get(t.account_id);
  if (!acctId) {
    console.warn(`No plaid_accounts row for account_id ${t.account_id}; skipping txn ${t.transaction_id}`);
    return null;
  }
  return {
    user_id: userId,
    plaid_account_id: acctId,
    plaid_transaction_id: t.transaction_id,
    name: t.name,
    merchant_name: t.merchant_name,
    amount: t.amount,
    iso_currency_code: t.iso_currency_code ?? 'USD',
    date: t.date,
    authorized_date: t.authorized_date,
    pending: t.pending,
    personal_finance_category_primary: t.personal_finance_category?.primary ?? null,
    personal_finance_category_detailed: t.personal_finance_category?.detailed ?? null,
    personal_finance_category_confidence: t.personal_finance_category?.confidence_level ?? null,
  };
}
