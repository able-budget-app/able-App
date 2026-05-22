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
  accountsBalanceGet,
  type TransactionsSyncRes,
  type PlaidTransaction,
  type PlaidAccount,
} from '../_shared/plaid.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
// Resolve the Supabase service-role-equivalent secret. Prefer the new
// SUPABASE_SECRET_KEYS env (sb_secret_* format) over the deprecated legacy
// SUPABASE_SERVICE_ROLE_KEY JWT. Falls back to the legacy env during
// migration so functions keep working until the dashboard
// "Disable JWT-based API keys" button is pressed.
function _getServiceKey(): string {
  const newKeys = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (newKeys) {
    try {
      const parsed = JSON.parse(newKeys);
      if (parsed && typeof parsed.default === 'string') return parsed.default;
    } catch { /* fall through to legacy */ }
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
}

const SERVICE_ROLE = _getServiceKey();
const INTERNAL_SECRET = Deno.env.get('INTERNAL_FUNCTION_SECRET') ?? '';
const MAX_PAGES = 50; // hard cap. Each page is up to 500 txns. 25k limit.

// Per-user in-memory rate limit on user-initiated syncs. Plaid charges per
// /transactions/sync call; normal flow is webhook-driven (service-role,
// uncapped) with the user "Refresh" button as fallback. 6/hour + 20/day
// covers a heavy manual user and caps a console-loop attack. Per-isolate
// (resets on cold start) — webhooks and internal sweeps bypass this.
const HOURLY_CAP = 6;
const DAILY_CAP = 20;
const _callLog = new Map<string, number[]>(); // userId -> call timestamps (ms)
function _checkRateLimit(userId: string): { ok: true } | { ok: false; reason: string } {
  const now = Date.now();
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;
  const log = (_callLog.get(userId) || []).filter((t) => now - t < day);
  if (log.filter((t) => now - t < hour).length >= HOURLY_CAP) {
    return { ok: false, reason: `Hourly sync cap reached (${HOURLY_CAP}). Your bank pushes updates automatically — try again in a bit.` };
  }
  if (log.length >= DAILY_CAP) {
    return { ok: false, reason: `Daily sync cap reached (${DAILY_CAP}). Resets in a few hours.` };
  }
  log.push(now);
  _callLog.set(userId, log);
  return { ok: true };
}

const _ALLOWED_ORIGINS = new Set([
  'https://becomeable.app',
  'https://www.becomeable.app',
  'capacitor://localhost',
  'able://localhost',
]);
function _allowOrigin(origin: string | null): string {
  if (!origin) return 'https://becomeable.app';
  if (_ALLOWED_ORIGINS.has(origin)) return origin;
  if (/^https:\/\/deploy-preview-\d+--becomeable\.netlify\.app$/.test(origin)) return origin;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  return 'https://becomeable.app';
}
function corsHeaders(req: Request) {
  return {
  'Access-Control-Allow-Origin': _allowOrigin(req.headers.get('Origin')),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
  };
}

type Body = { plaid_item_row_id: string; force_balance_refresh?: boolean };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'POST only' }, 405);

  try {
    // Three callers:
    //   1. Logged-in user (JWT in Authorization) — from the client app.
    //   2. Internal Edge Function (webhook, sweep) — sends x-internal-auth.
    //      Cross-region inter-function calls have their Authorization header
    //      mutated by the Supabase gateway, which broke the original
    //      service-role-bearer compare and silently 401'd the
    //      webhook→sync chain (commit ac94d34 has the full backstory).
    //      x-internal-auth survives the gateway intact.
    //   3. Direct service-role curl (testing, manual backfill) — bearer
    //      equals SUPABASE_SERVICE_ROLE_KEY. Doesn't go through the
    //      gateway, so the bearer compare still works for this path.
    const authHeader = req.headers.get('Authorization') ?? '';
    const bearerToken = authHeader.replace(/^Bearer\s+/i, '');
    const internalHeader = req.headers.get('x-internal-auth') ?? '';
    const isInternalCall = !!INTERNAL_SECRET && internalHeader === INTERNAL_SECRET;
    const isServiceCall = isInternalCall || (!!bearerToken && bearerToken === SERVICE_ROLE);

    const body: Body = await req.json();
    if (!body?.plaid_item_row_id) {
      return json(req, { error: 'plaid_item_row_id required' }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: item, error: itemErr } = await admin
      .from('plaid_items')
      .select('id, user_id, access_token, transactions_cursor, lookback_months')
      .eq('id', body.plaid_item_row_id)
      .single();
    if (itemErr || !item) return json(req, { error: 'Item not found' }, 404);

    if (!isServiceCall) {
      const userClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userRes, error: userErr } = await userClient.auth.getUser();
      if (userErr || !userRes.user) return json(req, { error: 'Unauthorized' }, 401);
      if (item.user_id !== userRes.user.id) return json(req, { error: 'Forbidden' }, 403);
      const limit = _checkRateLimit(userRes.user.id);
      if (!limit.ok) return json(req, { error: limit.reason }, 429);
    }
    const userId = item.user_id;

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
      console.log(`plaid-sync: item=${item.id} page ${page} fetched in ${Date.now() - tPage}ms (added=${resp.added.length}, modified=${resp.modified.length}, removed=${resp.removed.length}, has_more=${resp.has_more}, status=${resp.transactions_update_status})`);

      // Refresh balances from this page's accounts list.
      const tAcc = Date.now();
      await upsertAccounts(admin, item.id, userId, resp.accounts, accountMap);
      console.log(`plaid-sync: item=${item.id} page ${page} accounts upsert in ${Date.now() - tAcc}ms`);

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
        console.log(`plaid-sync: item=${item.id} page ${page} inserted ${rows.length} added txns in ${Date.now() - tIns}ms`);
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
    console.log(`plaid-sync: item=${item.id} done in ${Date.now() - tStart}ms, total added=${totalAdded}, modified=${totalModified}, removed=${totalRemoved}, status=${lastStatus}`);

    // When fresh activity arrived, force a live balance pull. Plaid's
    // /transactions/sync returns accounts[].balances from its most recent
    // *balance* poll cycle, which on OAuth banks (Chase et al) runs on a
    // separate schedule from the transaction poll. So a single payload can
    // contain fresh txns + a stale cached balance. /accounts/balance/get
    // bypasses the cache and asks the institution live, which fixes the
    // mismatch the user sees on the hero card.
    //
    // Billed per call by Plaid ("Balance" product), so we only fire when
    // we actually have new/modified txns to justify it. Failures are
    // swallowed — the sync still succeeded and the stale balance is
    // better than no balance.
    if (totalAdded > 0 || totalModified > 0 || body.force_balance_refresh) {
      await refreshLiveBalances(admin, item.id, item.access_token);
      if (totalAdded > 0 || totalModified > 0) scheduleBackgroundClassify(item.id);
    }

    return json(req, {
      added: totalAdded,
      modified: totalModified,
      removed: totalRemoved,
      cursor,
      status: lastStatus ?? null,
      has_more: lastHasMore,
    });
  } catch (e) {
    console.error('plaid-sync error:', e);
    return json(req, { error: 'Internal server error' }, 500);
  }
});

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  });
}

// Fire plaid-classify-batch in the background so newly-synced transactions
// get the able_category overlay applied within a minute or two without
// blocking this handler's response.
function scheduleBackgroundClassify(plaidItemRowId: string): void {
  const url = `${SUPABASE_URL}/functions/v1/plaid-classify-batch`;
  const work = fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SERVICE_ROLE}`,
      'x-internal-auth': INTERNAL_SECRET,
    },
    body: JSON.stringify({ plaid_item_row_id: plaidItemRowId }),
  })
    .then(async (r) => {
      const text = await r.text().catch(() => '');
      if (!r.ok) {
        console.error(`sync→classify failed for item ${plaidItemRowId} (${r.status}): ${text}`);
      } else {
        console.log(`sync→classify ok for item ${plaidItemRowId}: ${text}`);
      }
    })
    .catch((e) => console.error(`sync→classify threw for item ${plaidItemRowId}:`, e));

  const er = (globalThis as unknown as {
    EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void };
  }).EdgeRuntime;
  if (er?.waitUntil) er.waitUntil(work);
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

// Force a live balance pull from the institution and overwrite the cached
// balance on plaid_accounts. See call site for rationale.
async function refreshLiveBalances(
  admin: SupabaseClient,
  plaidItemRowId: string,
  accessToken: string,
): Promise<void> {
  const t0 = Date.now();
  try {
    // Force a live institution pull: Plaid returns its cache by default, even
    // from /accounts/balance/get. Passing min_last_updated_datetime tells Plaid
    // "don't give me a snapshot older than 1 hour" — for institutions that
    // support real-time balance (most major US banks via Plaid Balance), this
    // forces a fresh pull. Older institutions fall back to cached, no error.
    const minFresh = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const resp = await accountsBalanceGet(accessToken, undefined, minFresh);
    let updated = 0;
    for (const a of resp.accounts) {
      const { error } = await admin
        .from('plaid_accounts')
        .update({
          current_balance: a.balances.current,
          available_balance: a.balances.available,
          last_balance_at: new Date().toISOString(),
        })
        .eq('plaid_item_id', plaidItemRowId)
        .eq('plaid_account_id', a.account_id);
      if (error) {
        console.error(`balance refresh: update failed for account ${a.account_id}:`, error);
      } else {
        updated++;
      }
    }
    console.log(`plaid-sync: item=${plaidItemRowId} live balance refresh — ${updated}/${resp.accounts.length} accounts updated in ${Date.now() - t0}ms`);
  } catch (e) {
    // Common cases: PRODUCT_NOT_READY, INVALID_PRODUCT (Balance not enabled
    // on the Plaid account), ITEM_LOGIN_REQUIRED, rate limit. All non-fatal
    // — keep the cached balance and move on.
    console.warn(`plaid-sync: item=${plaidItemRowId} live balance refresh failed in ${Date.now() - t0}ms:`, e instanceof Error ? e.message : e);
  }
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
