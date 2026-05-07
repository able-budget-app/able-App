// plaid-detect-credit-debts
// Builds canonical per-card debt rows in plaid_credit_debts. Sources true
// APR + min_payment from Plaid's /liabilities/get when the item has the
// liabilities product enabled; falls back to balance-only 'estimate' rows
// when the institution doesn't support liabilities (or the item was
// linked before liabilities was added to the products list).
//
// POST body:
//   { plaid_item_row_id?: string }   // optional — null = all of user's items
//
// Returns: { rows_written: number, items_processed: number, debug? }
//
// Pipeline placement: runs AFTER plaid-detect-recurring (so we can
// mask-match outflow streams for evidence_stream_id) and BEFORE
// plaid-analyze (which now reads from this table instead of building
// debts inline).
//
// Gateway: "Verify JWT" must be OFF. Two callers — the user (JWT in
// Authorization) or service-role internal (the onboarding pipeline).

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ─── Plaid HTTP client (inlined from _shared/plaid.ts so this file
// deploys self-contained from the Supabase dashboard — relative imports
// fail in dashboard-paste mode). Mirrors plaid-link-token's pattern. ───

const PLAID_ENV = Deno.env.get('PLAID_ENV') ?? 'sandbox';
const PLAID_HOSTS: Record<string, string> = {
  sandbox: 'https://sandbox.plaid.com',
  development: 'https://development.plaid.com',
  production: 'https://production.plaid.com',
};
const PLAID_HOST = PLAID_HOSTS[PLAID_ENV] ?? PLAID_HOSTS.sandbox;

type PlaidError = {
  error_type: string;
  error_code: string;
  error_message: string;
  display_message?: string | null;
  request_id?: string;
};

class PlaidApiError extends Error {
  status: number;
  plaid: PlaidError;
  constructor(status: number, plaid: PlaidError) {
    super(`Plaid ${plaid.error_code}: ${plaid.error_message}`);
    this.status = status;
    this.plaid = plaid;
  }
}

async function plaidApi<TReq extends Record<string, unknown>, TRes>(
  path: string,
  body: TReq,
): Promise<TRes> {
  const clientId = Deno.env.get('PLAID_CLIENT_ID');
  const secret = Deno.env.get('PLAID_SECRET');
  if (!clientId || !secret) {
    throw new Error('PLAID_CLIENT_ID and PLAID_SECRET must be set');
  }
  const res = await fetch(`${PLAID_HOST}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, secret, ...body }),
  });
  const text = await res.text();
  let json: unknown = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
  if (!res.ok) {
    const err = (json ?? {
      error_type: 'API_ERROR',
      error_code: 'UNKNOWN',
      error_message: text || `HTTP ${res.status}`,
    }) as PlaidError;
    throw new PlaidApiError(res.status, err);
  }
  return json as TRes;
}

type CreditLiability = {
  account_id: string;
  aprs: Array<{
    apr_percentage: number;
    apr_type: 'purchase_apr' | 'balance_transfer_apr' | 'cash_apr' | 'special';
    balance_subject_to_apr: number | null;
    interest_charge_amount: number | null;
  }>;
  is_overdue: boolean | null;
  last_payment_amount: number | null;
  last_payment_date: string | null;
  last_statement_balance: number | null;
  last_statement_issue_date: string | null;
  minimum_payment_amount: number | null;
  next_payment_due_date: string | null;
};

type LiabilitiesGetRes = {
  liabilities: {
    credit: CreditLiability[] | null;
    mortgage: unknown[] | null;
    student: unknown[] | null;
  };
  request_id: string;
};

const liabilitiesGet = (access_token: string) =>
  plaidApi<{ access_token: string }, LiabilitiesGetRes>(
    '/liabilities/get',
    { access_token },
  );

// ─── End inlined Plaid client ─────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Body = { plaid_item_row_id?: string; debug?: boolean };

type CreditAccountRow = {
  id: string;                      // plaid_accounts.id (uuid)
  plaid_account_id: string;        // Plaid's external id (text)
  plaid_item_id: string;
  name: string | null;
  official_name: string | null;
  mask: string | null;
  current_balance: number | null;
  subtype: string | null;
};

type OutflowStreamRow = {
  stream_id: string;
  description: string | null;
  merchant_name: string | null;
  last_amount: number | null;
  average_amount: number | null;
  predicted_next_date: string | null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const bearerToken = authHeader.replace(/^Bearer\s+/i, '');
    const isServiceCall = !!bearerToken && bearerToken === SERVICE_ROLE;

    const body: Body = req.headers.get('content-length') === '0' ? {} : await req.json().catch(() => ({}));

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Resolve userId. Service-role calls must include plaid_item_row_id
    // (we look up user_id from the row). User calls auth via JWT.
    let userId: string;
    if (isServiceCall) {
      if (!body.plaid_item_row_id) {
        return json({ error: 'plaid_item_row_id required for service calls' }, 400);
      }
      const { data: row, error } = await admin
        .from('plaid_items')
        .select('user_id')
        .eq('id', body.plaid_item_row_id)
        .single();
      if (error || !row) return json({ error: 'Item not found' }, 404);
      userId = row.user_id as string;
    } else {
      const userClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userRes, error: userErr } = await userClient.auth.getUser();
      if (userErr || !userRes.user) return json({ error: 'Unauthorized' }, 401);
      userId = userRes.user.id;
      // If the user passed an item_row_id, verify they own it.
      if (body.plaid_item_row_id) {
        const { data: row } = await admin
          .from('plaid_items')
          .select('user_id')
          .eq('id', body.plaid_item_row_id)
          .single();
        if (!row || row.user_id !== userId) return json({ error: 'Forbidden' }, 403);
      }
    }

    // Fetch the items in scope.
    let itemsQuery = admin
      .from('plaid_items')
      .select('id, access_token')
      .eq('user_id', userId);
    if (body.plaid_item_row_id) itemsQuery = itemsQuery.eq('id', body.plaid_item_row_id);
    const { data: items, error: itemsErr } = await itemsQuery;
    if (itemsErr) return json({ error: itemsErr.message }, 500);
    if (!items || items.length === 0) {
      return json({ rows_written: 0, items_processed: 0 });
    }

    let rowsWritten = 0;
    const debugItems: unknown[] = [];

    for (const item of items) {
      const result = await processItem(admin, userId, item.id, item.access_token, body.debug);
      rowsWritten += result.rows_written;
      if (body.debug) debugItems.push(result.debug);
    }

    const resp: Record<string, unknown> = {
      rows_written: rowsWritten,
      items_processed: items.length,
    };
    if (body.debug) resp.debug = debugItems;
    return json(resp);
  } catch (err) {
    console.error('plaid-detect-credit-debts error:', err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

async function processItem(
  admin: SupabaseClient,
  userId: string,
  plaidItemId: string,
  accessToken: string,
  debug?: boolean,
): Promise<{ rows_written: number; debug?: unknown }> {
  // 1. All credit/line-of-credit accounts on this item with positive balance.
  const { data: accountRows } = await admin
    .from('plaid_accounts')
    .select('id, plaid_account_id, plaid_item_id, name, official_name, mask, current_balance, subtype')
    .eq('plaid_item_id', plaidItemId)
    .in('subtype', ['credit card', 'line of credit']);
  const creditAccounts: CreditAccountRow[] = (accountRows ?? []).filter(
    (a) => (a.current_balance ?? 0) > 0,
  );

  // Always wipe stale rows for this item before writing. Cards that paid
  // off or were closed disappear from the table cleanly.
  await admin
    .from('plaid_credit_debts')
    .delete()
    .eq('plaid_item_id', plaidItemId);

  if (creditAccounts.length === 0) {
    return { rows_written: 0, debug: debug ? { reason: 'no_credit_accounts' } : undefined };
  }

  // 2. Outflow streams for mask-matching evidence_stream_id.
  const { data: streamRows } = await admin
    .from('plaid_recurring_streams')
    .select('stream_id, description, merchant_name, last_amount, average_amount, predicted_next_date')
    .eq('plaid_item_id', plaidItemId)
    .eq('direction', 'outflow')
    .eq('is_active', true);
  const outflowStreams: OutflowStreamRow[] = streamRows ?? [];

  // 3. Try /liabilities/get. Index by Plaid's external account_id.
  let liabilitiesByAccount = new Map<string, CreditLiability>();
  let liabilitiesError: string | null = null;
  try {
    const liabResp = await liabilitiesGet(accessToken);
    for (const c of liabResp.liabilities.credit ?? []) {
      liabilitiesByAccount.set(c.account_id, c);
    }
  } catch (err) {
    // INVALID_PRODUCT means the item wasn't enrolled in liabilities at
    // link time. Existing items pre-PR(a) all hit this path. Fall back
    // to estimate-mode rows so the user still sees their cards.
    if (err instanceof PlaidApiError) {
      liabilitiesError = `${err.plaid.error_code}: ${err.plaid.error_message}`;
      console.log(`plaid-detect-credit-debts: liabilities skipped on item ${plaidItemId}: ${liabilitiesError}`);
    } else {
      throw err;
    }
  }

  // 4. Build one row per card.
  const claimedStreamIds = new Set<string>();
  const rowsToInsert: Record<string, unknown>[] = [];
  for (const card of creditAccounts) {
    const baseName = card.official_name ?? card.name ?? 'Credit card';
    const name = card.mask ? `${baseName} ending ${card.mask}` : baseName;
    const liability = liabilitiesByAccount.get(card.plaid_account_id);
    const matchedStream = matchStreamByMask(card.mask, outflowStreams, claimedStreamIds);
    if (matchedStream) claimedStreamIds.add(matchedStream.stream_id);

    let purchase_apr: number | null = null;
    let last_statement_balance: number | null = null;
    let next_payment_due_date: string | null = null;
    let min_payment: number;
    let source: 'liabilities' | 'estimate';

    if (liability) {
      source = 'liabilities';
      const purchaseAPR = liability.aprs.find((a) => a.apr_type === 'purchase_apr');
      // Plaid returns apr_percentage as 0-100 (e.g. 26.24). Convert to
      // the 0-1 decimal the analyzer prompt + UI expect.
      purchase_apr = purchaseAPR?.apr_percentage != null
        ? Math.round(purchaseAPR.apr_percentage) / 100
        : null;
      last_statement_balance = liability.last_statement_balance;
      next_payment_due_date = liability.next_payment_due_date;
      // Prefer Plaid's reported min_payment_amount; fall back to autopay
      // mask match, then 2.5%-of-balance rule. Treat 0 as missing —
      // Chase (and others) return 0 instead of null when the statement
      // hasn't posted yet or the card is on autopay, which would
      // otherwise produce a $1 minimum on a $8k balance.
      const reportedMin = liability.minimum_payment_amount;
      if (reportedMin != null && reportedMin > 0) {
        min_payment = Math.max(1, Math.round(reportedMin));
      } else if (matchedStream) {
        const matched = matchedStream.last_amount ?? matchedStream.average_amount ?? 0;
        min_payment = Math.max(25, Math.round(matched));
      } else {
        min_payment = Math.max(25, Math.round((card.current_balance ?? 0) * 0.025));
      }
    } else {
      source = 'estimate';
      // No liabilities data. Don't fabricate an APR — leave null. The
      // old current_balance-denominator estimator was wrong by ~7% on
      // revolving users (P1-2026-05-06 #1) so we deliberately stop
      // emitting it. Min_payment via autopay match or 2.5% rule.
      if (matchedStream) {
        const matched = matchedStream.last_amount ?? matchedStream.average_amount ?? 0;
        min_payment = Math.max(1, Math.round(matched));
      } else {
        min_payment = Math.max(25, Math.round((card.current_balance ?? 0) * 0.025));
      }
    }

    // due_day_of_month: prefer liabilities' next_payment_due_date, fall
    // back to the matched autopay stream's predicted_next_date.
    let due_day_of_month: number | null = null;
    const dueDateSource = next_payment_due_date ?? matchedStream?.predicted_next_date ?? null;
    if (dueDateSource) {
      const day = new Date(dueDateSource + 'T00:00:00Z').getUTCDate();
      if (day >= 1 && day <= 31) due_day_of_month = day;
    }

    rowsToInsert.push({
      user_id: userId,
      plaid_item_id: plaidItemId,
      plaid_account_id: card.id,
      name,
      mask: card.mask,
      current_balance: card.current_balance,
      purchase_apr,
      min_payment,
      last_statement_balance,
      next_payment_due_date,
      due_day_of_month,
      source,
      evidence_stream_id: matchedStream?.stream_id ?? null,
      last_seen_at: new Date().toISOString(),
    });
  }

  if (rowsToInsert.length > 0) {
    const { error: insertErr } = await admin
      .from('plaid_credit_debts')
      .insert(rowsToInsert);
    if (insertErr) {
      console.error(`plaid-detect-credit-debts insert failed for item ${plaidItemId}:`, insertErr);
      throw new Error(insertErr.message);
    }
  }

  return {
    rows_written: rowsToInsert.length,
    debug: debug
      ? { liabilitiesError, accounts_seen: creditAccounts.length, liabilities_seen: liabilitiesByAccount.size }
      : undefined,
  };
}

// Match an outflow stream by 3+-char mask suffix in its descriptor or
// merchant_name. Same regex shape as buildCreditDebts in plaid-analyze.
function matchStreamByMask(
  mask: string | null,
  streams: OutflowStreamRow[],
  alreadyClaimed: Set<string>,
): OutflowStreamRow | null {
  if (!mask || mask.length < 3) return null;
  const maskRegex = new RegExp(`(?:^|\\D)${escapeRegex(mask)}(?:\\D|$)`);
  for (const s of streams) {
    if (alreadyClaimed.has(s.stream_id)) continue;
    const haystack = `${s.description ?? ''} ${s.merchant_name ?? ''}`;
    if (maskRegex.test(haystack)) return s;
  }
  return null;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}
