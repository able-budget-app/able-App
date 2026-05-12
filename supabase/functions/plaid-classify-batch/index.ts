// plaid-classify-batch
// Reads unclassified plaid_transactions, batches them, calls plaid-recategorize
// for each batch, and writes the Able overlay (able_category, able_label,
// able_confidence, able_is_recurring_likely, able_classified_at) back.
//
// Triggered:
//   - At the end of plaid-sync (fire-and-forget) for the just-synced item.
//   - Manually via curl with higher max_batches for backfill.
//
// Body: {
//   plaid_item_row_id?: string,   // restrict to one item (preferred)
//   user_id?: string,             // restrict to one user
//   max_batches?: number,         // default 5 (= 250 txns per invocation)
// }
//
// Auth: requires service role bearer.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const INTERNAL_SECRET = Deno.env.get('INTERNAL_FUNCTION_SECRET') ?? '';

const BATCH_SIZE = 50;                  // matches plaid-recategorize MAX_BATCH
const PARALLELISM = 4;                  // batches in flight concurrently
const DEFAULT_MAX_BATCHES = 4;          // 200 txns per invocation, ~10s wall-clock
const HARD_MAX_BATCHES = 10;            // 500 txns; safely under Supabase's 150s gateway timeout

const _ALLOWED_ORIGINS = new Set([
  'https://becomeable.app',
  'https://www.becomeable.app',
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

type Body = {
  plaid_item_row_id?: string;
  user_id?: string;
  max_batches?: number;
};

type Classification = {
  id: string;
  category: 'income' | 'bill' | 'debt_payment' | 'tax_payment' | 'transfer' | 'discretionary';
  label: string;
  confidence: number;
  is_recurring_likely: boolean;
};

type TxnRow = {
  id: string;
  user_id: string;
  plaid_transaction_id: string;
  name: string | null;
  merchant_name: string | null;
  amount: number;
  date: string;
  personal_finance_category_primary: string | null;
  personal_finance_category_detailed: string | null;
  personal_finance_category_confidence: string | null;
};

type Override = {
  match_kind: 'merchant' | 'name_substring';
  match_value: string;       // already lowercased + trimmed when read
  direction: 'inflow' | 'outflow' | 'both';
  able_category: Classification['category'];
  able_label: string | null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'POST only' }, 405);

  // Internal-only gate. Invoked by plaid-sync (post-sync auto-classify) and
  // by direct service-role curl (manual backfills). Uses a custom shared
  // secret rather than SUPABASE_SERVICE_ROLE_KEY because Supabase mutates
  // the Authorization header on cross-region inter-function calls — see
  // commit ac94d34 for the full backstory.
  if (!INTERNAL_SECRET) {
    console.error('plaid-classify-batch: INTERNAL_FUNCTION_SECRET unset');
    return json(req, { error: 'not configured' }, 503);
  }
  const got = req.headers.get('x-internal-auth') ?? '';
  if (got !== INTERNAL_SECRET) {
    return json(req, { error: 'Unauthorized' }, 401);
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const maxBatches = Math.min(
      Math.max(1, body.max_batches ?? DEFAULT_MAX_BATCHES),
      HARD_MAX_BATCHES,
    );
    const limit = BATCH_SIZE * maxBatches;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Build the unclassified-rows query. Restrict by item or user when given.
    let query = admin
      .from('plaid_transactions')
      .select(
        'id, user_id, plaid_transaction_id, name, merchant_name, amount, date, ' +
          'personal_finance_category_primary, personal_finance_category_detailed, ' +
          'personal_finance_category_confidence',
      )
      .is('able_classified_at', null);

    if (body.plaid_item_row_id) {
      // plaid_transactions joins to plaid_accounts to get item-level scope.
      const { data: accts, error: accErr } = await admin
        .from('plaid_accounts')
        .select('id')
        .eq('plaid_item_id', body.plaid_item_row_id);
      if (accErr) return json(req, { error: accErr.message }, 500);
      const accountIds = (accts ?? []).map((a) => a.id as string);
      if (accountIds.length === 0) {
        return json(req, { classified: 0, batches: 0, scanned: 0 });
      }
      query = query.in('plaid_account_id', accountIds);
    } else if (body.user_id) {
      query = query.eq('user_id', body.user_id);
    }

    const { data: txns, error: txnErr } = await query
      .order('date', { ascending: false })
      .limit(limit);
    if (txnErr) return json(req, { error: txnErr.message }, 500);

    const rows = (txns ?? []) as unknown as TxnRow[];
    console.log(`plaid-classify-batch: ${rows.length} unclassified row(s) to process (max ${limit})`);

    if (rows.length === 0) {
      return json(req, { classified: 0, batches: 0, scanned: 0 });
    }

    // Pull every override for the users whose rows we're about to classify,
    // in one query. Match in-memory and split rows into "override-hit"
    // (skip LLM) and "needs LLM" buckets. The override path is faster AND
    // cheaper since each hit is a manual user label that should be
    // authoritative going forward.
    const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
    const overridesByUser = await fetchOverridesByUser(admin, userIds);
    const overrideHits: { row: TxnRow; override: Override }[] = [];
    const heuristicHits: { row: TxnRow; result: HeuristicHit }[] = [];
    const llmRows: TxnRow[] = [];
    for (const row of rows) {
      const userOverrides = overridesByUser.get(row.user_id) ?? [];
      const hit = pickOverride(row, userOverrides);
      if (hit) { overrideHits.push({ row, override: hit }); continue; }
      // Plaid PFC + direction is enough to confidently classify a wide
      // class of transactions (rent, utilities, loans, transfers, taxes).
      // Skip the LLM for those — same backend cost as override hits.
      const heuristic = pickPfcHeuristic(row);
      if (heuristic) { heuristicHits.push({ row, result: heuristic }); continue; }
      llmRows.push(row);
    }
    console.log(
      `plaid-classify-batch: override hits=${overrideHits.length}, ` +
      `PFC heuristic hits=${heuristicHits.length}, ` +
      `LLM rows=${llmRows.length}`,
    );

    let classified = 0;
    let classifiedViaOverride = 0;
    let classifiedViaHeuristic = 0;
    let batches = 0;
    const failures: string[] = [];

    // Apply override hits first. No LLM call — we already know the
    // category. One update per row, fanned out concurrently.
    if (overrideHits.length > 0) {
      const now = new Date().toISOString();
      const results = await Promise.allSettled(
        overrideHits.map(({ row, override }) =>
          admin
            .from('plaid_transactions')
            .update({
              able_category: override.able_category,
              able_label: override.able_label
                ?? row.merchant_name
                ?? row.name
                ?? override.match_value,
              able_confidence: 1.0,
              able_is_recurring_likely: false,
              able_classified_at: now,
            })
            .eq('id', row.id),
        ),
      );
      for (const r of results) {
        if (r.status === 'fulfilled' && !r.value.error) {
          classified++;
          classifiedViaOverride++;
        } else if (r.status === 'rejected') {
          console.error('override update threw:', r.reason);
          failures.push(`override update threw: ${String(r.reason)}`);
        } else if (r.status === 'fulfilled' && r.value.error) {
          console.error('override update failed:', r.value.error);
          failures.push(`override update failed: ${r.value.error.message}`);
        }
      }
    }

    // Apply PFC-heuristic hits. Same shape as override path: direct UPDATE,
    // no LLM call. Confidence 0.85 — high but below the override 1.0 so a
    // user who disagrees can still teach Able with an inbox label.
    if (heuristicHits.length > 0) {
      const now = new Date().toISOString();
      const results = await Promise.allSettled(
        heuristicHits.map(({ row, result }) =>
          admin
            .from('plaid_transactions')
            .update({
              able_category: result.category,
              able_label: row.merchant_name ?? row.name ?? result.label,
              able_confidence: 0.85,
              able_is_recurring_likely: result.is_recurring_likely,
              able_classified_at: now,
            })
            .eq('id', row.id),
        ),
      );
      for (const r of results) {
        if (r.status === 'fulfilled' && !r.value.error) {
          classified++;
          classifiedViaHeuristic++;
        } else if (r.status === 'rejected') {
          console.error('heuristic update threw:', r.reason);
          failures.push(`heuristic update threw: ${String(r.reason)}`);
        } else if (r.status === 'fulfilled' && r.value.error) {
          console.error('heuristic update failed:', r.value.error);
          failures.push(`heuristic update failed: ${r.value.error.message}`);
        }
      }
    }

    if (llmRows.length === 0) {
      console.log(
        `plaid-classify-batch: done — classified=${classified} ` +
        `(via_override=${classifiedViaOverride}, via_heuristic=${classifiedViaHeuristic}, via_llm=0), ` +
        `batches=0, failures=${failures.length}`,
      );
      return json(req, {
        classified,
        classified_via_override: classifiedViaOverride,
        classified_via_heuristic: classifiedViaHeuristic,
        classified_via_llm: 0,
        batches: 0,
        scanned: rows.length,
        failures,
      });
    }

    // Slice the LLM-bound rows into BATCH_SIZE chunks, then process them
    // in waves of PARALLELISM concurrent batches. Each batch is one LLM
    // call + one bulk update, so this keeps wall-clock low even on
    // backfills.
    const chunks: TxnRow[][] = [];
    for (let i = 0; i < llmRows.length; i += BATCH_SIZE) {
      chunks.push(llmRows.slice(i, i + BATCH_SIZE));
    }

    let classifiedViaLlm = 0;

    const processOne = async (batch: TxnRow[], batchIdx: number): Promise<void> => {
      try {
        const classifications = await callRecategorize(batch);
        if (classifications.length !== batch.length) {
          throw new Error(
            `count mismatch: got ${classifications.length}, expected ${batch.length}`,
          );
        }
        const now = new Date().toISOString();
        // One UPDATE per row, but issued concurrently to fan out the I/O.
        const updateResults = await Promise.allSettled(
          classifications.map((c) =>
            admin
              .from('plaid_transactions')
              .update({
                able_category: c.category,
                able_label: c.label,
                able_confidence: c.confidence,
                able_is_recurring_likely: c.is_recurring_likely,
                able_classified_at: now,
              })
              .eq('plaid_transaction_id', c.id),
          ),
        );
        let okCount = 0;
        for (const r of updateResults) {
          if (r.status === 'fulfilled' && !r.value.error) okCount++;
          else if (r.status === 'rejected') {
            console.error(`update threw in batch ${batchIdx}:`, r.reason);
          } else if (r.status === 'fulfilled' && r.value.error) {
            console.error(`update failed in batch ${batchIdx}:`, r.value.error);
          }
        }
        classified += okCount;
        classifiedViaLlm += okCount;
        batches++;
      } catch (e) {
        const msg = (e as Error).message ?? String(e);
        failures.push(`batch ${batchIdx}: ${msg}`);
        console.error(`plaid-classify-batch: batch ${batchIdx} failed:`, msg);
      }
    };

    // Drain chunks in waves of PARALLELISM.
    for (let i = 0; i < chunks.length; i += PARALLELISM) {
      const wave = chunks.slice(i, i + PARALLELISM);
      await Promise.all(wave.map((batch, j) => processOne(batch, i + j)));
    }

    console.log(
      `plaid-classify-batch: done — classified=${classified} ` +
      `(via_override=${classifiedViaOverride}, via_heuristic=${classifiedViaHeuristic}, via_llm=${classifiedViaLlm}), ` +
      `batches=${batches}, failures=${failures.length}`,
    );

    return json(req, {
      classified,
      classified_via_override: classifiedViaOverride,
      classified_via_heuristic: classifiedViaHeuristic,
      classified_via_llm: classifiedViaLlm,
      batches,
      scanned: rows.length,
      failures,
    });
  } catch (e) {
    console.error('plaid-classify-batch error:', e);
    return json(req, { error: (e as Error).message }, 500);
  }
});

async function callRecategorize(rows: TxnRow[]): Promise<Classification[]> {
  const transactions = rows.map((t) => ({
    transaction_id: t.plaid_transaction_id,
    name: t.name,
    merchant_name: t.merchant_name,
    amount: t.amount,
    date: t.date,
    personal_finance_category: {
      primary: t.personal_finance_category_primary ?? undefined,
      detailed: t.personal_finance_category_detailed ?? undefined,
      confidence_level: t.personal_finance_category_confidence ?? undefined,
    },
  }));

  const r = await fetch(`${SUPABASE_URL}/functions/v1/plaid-recategorize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SERVICE_ROLE}`,
      'x-internal-auth': INTERNAL_SECRET,
    },
    body: JSON.stringify({ transactions }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`plaid-recategorize ${r.status}: ${text}`);
  const parsed = JSON.parse(text) as { classifications?: Classification[] };
  if (!Array.isArray(parsed.classifications)) {
    throw new Error('plaid-recategorize: missing classifications array');
  }
  return parsed.classifications;
}

// Fetch every override owned by the given users, in one round-trip.
// Returns Map<user_id, Override[]>. match_value is normalized
// (lowercased + trimmed) at read time so the runtime compare is direct.
async function fetchOverridesByUser(
  admin: SupabaseClient,
  userIds: string[],
): Promise<Map<string, Override[]>> {
  if (userIds.length === 0) return new Map();
  const { data, error } = await admin
    .from('user_classification_overrides')
    .select('user_id, match_kind, match_value, direction, able_category, able_label')
    .in('user_id', userIds);
  if (error) {
    console.error('fetchOverridesByUser failed:', error);
    return new Map();
  }
  const map = new Map<string, Override[]>();
  for (const row of (data ?? []) as Array<{
    user_id: string;
    match_kind: 'merchant' | 'name_substring';
    match_value: string;
    direction: 'inflow' | 'outflow' | 'both';
    able_category: Classification['category'];
    able_label: string | null;
  }>) {
    const list = map.get(row.user_id) ?? [];
    list.push({
      match_kind: row.match_kind,
      match_value: (row.match_value ?? '').toLowerCase().trim(),
      direction: row.direction,
      able_category: row.able_category,
      able_label: row.able_label,
    });
    map.set(row.user_id, list);
  }
  return map;
}

// Pick the most-specific override that applies to this transaction, if any.
// Specificity order: merchant kind > name_substring kind; within the same
// kind, longer match_value wins. Direction filter respects the txn's sign:
// inflows (amount < 0) accept 'inflow' or 'both'; outflows accept 'outflow'
// or 'both'. Empty match_value never matches anything.
//
// Matching is loose for both kinds (P2 #17): Plaid sometimes puts a clean
// merchant_name on a row, sometimes only fills `name` with a raw descriptor
// like "DD DRIVER PMT" or "STRIPE PAYOUT". To stop classification confidence
// flickering across days for the same merchant, override matching now:
//   - substring-checks the merchant value against BOTH merchant_name and name
//   - normalizes both sides by stripping common corporate suffixes (Inc, LLC,
//     Co, Corp) before comparing, so "Doordash" and "Doordash Inc" are equal.
function _normalizeMerchantText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,]/g, '')
    .replace(/\b(inc|llc|ltd|corp|corporation|co)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
function pickOverride(row: TxnRow, overrides: Override[]): Override | null {
  if (overrides.length === 0) return null;
  const merchantKey = _normalizeMerchantText(row.merchant_name ?? '');
  const nameLower = (row.name ?? '').toLowerCase();
  const nameNormalized = _normalizeMerchantText(row.name ?? '');
  const isInflow = (row.amount ?? 0) < 0;
  const direction = isInflow ? 'inflow' : 'outflow';

  const candidates = overrides.filter((o) => {
    if (o.match_value.length === 0) return false;
    if (o.direction !== 'both' && o.direction !== direction) return false;
    const v = _normalizeMerchantText(o.match_value);
    if (v.length === 0) return false;
    if (o.match_kind === 'merchant') {
      // Loose merchant match: substring in either direction against
      // merchant_name OR the raw name. Catches Plaid descriptor variants
      // ("Doordash" / "Doordash, Inc" / "DOORDASH INC TRANSFER") that
      // refer to the same merchant.
      if (merchantKey.length > 0 && (merchantKey.includes(v) || v.includes(merchantKey))) return true;
      if (nameNormalized.length > 0 && nameNormalized.includes(v)) return true;
      return false;
    }
    return nameLower.includes(o.match_value);
  });

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    if (a.match_kind !== b.match_kind) {
      return a.match_kind === 'merchant' ? -1 : 1;
    }
    return b.match_value.length - a.match_value.length;
  });
  return candidates[0];
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  });
}

// ─────────────────────────────────────────────────────────────────────
// Plaid PFC heuristic
// ─────────────────────────────────────────────────────────────────────
// For a wide class of transactions, Plaid's personal_finance_category is
// good enough that an LLM call is wasted spend. This map covers the
// confident cases — rent, utilities, loan payments, transfers, taxes,
// straightforward income types. Anything ambiguous (food, entertainment,
// general merchandise, personal care, medical, etc.) falls through to
// the LLM where context matters.
//
// Direction guards: INCOME_* only auto-classifies on inflows (amount<0),
// LOAN_PAYMENTS_* on outflows (amount>0). Transfers either direction.
// Heuristic confidence lands at 0.85 — high but below override 1.0 so a
// user who disagrees can teach Able with an inbox label.
type HeuristicHit = {
  category: Classification['category'];
  label: string;
  is_recurring_likely: boolean;
};

const PFC_BILL_DETAIL = new Set([
  'RENT_AND_UTILITIES_RENT',
  'RENT_AND_UTILITIES_INTERNET_AND_CABLE',
  'RENT_AND_UTILITIES_TELEPHONE',
  'RENT_AND_UTILITIES_GAS_AND_ELECTRICITY',
  'RENT_AND_UTILITIES_WATER',
  'RENT_AND_UTILITIES_OTHER_UTILITIES',
  'RENT_AND_UTILITIES_SEWAGE_AND_WASTE_MANAGEMENT',
  'LOAN_PAYMENTS_MORTGAGE_PAYMENT',
  'BANK_FEES_INTEREST_CHARGE',
  'BANK_FEES_OVERDRAFT_FEES',
  'BANK_FEES_INSUFFICIENT_FUNDS',
]);

const PFC_DEBT_DETAIL = new Set([
  'LOAN_PAYMENTS_CAR_PAYMENT',
  'LOAN_PAYMENTS_CREDIT_CARD_PAYMENT',
  'LOAN_PAYMENTS_PERSONAL_LOAN_PAYMENT',
  'LOAN_PAYMENTS_STUDENT_LOAN_PAYMENT',
  'LOAN_PAYMENTS_OTHER_PAYMENT',
]);

const PFC_INCOME_DETAIL = new Set([
  'INCOME_WAGES',
  'INCOME_RETIREMENT_PENSION',
  'INCOME_DIVIDENDS',
  'INCOME_INTEREST_EARNED',
  'INCOME_TAX_REFUND',
  'INCOME_UNEMPLOYMENT',
]);

const PFC_TRANSFER_DETAIL = new Set([
  'TRANSFER_IN_DEPOSIT',
  'TRANSFER_OUT_WITHDRAWAL',
  'TRANSFER_IN_ACCOUNT_TRANSFER',
  'TRANSFER_OUT_ACCOUNT_TRANSFER',
  'TRANSFER_IN_SAVINGS',
  'TRANSFER_OUT_SAVINGS',
  'TRANSFER_IN_INVESTMENT_AND_RETIREMENT_FUNDS',
  'TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS',
  'TRANSFER_OUT_OTHER',
]);

const PFC_TAX_DETAIL = new Set([
  'GOVERNMENT_AND_NON_PROFIT_TAX_PAYMENT',
]);

// Pattern hits for the inflow side of a credit-card payment. When the user
// pays $268 from Chase checking to Chase Visa, Plaid tags the OUTFLOW with
// LOAN_PAYMENTS_CREDIT_CARD_PAYMENT (caught by PFC_DEBT_DETAIL above), but
// the matching INFLOW on the CC account often arrives with a generic
// "PAYMENT THANK YOU" / "PAYMENT - WEB" / "AUTOPAY" descriptor and no
// strong PFC signal. The LLM previously fell through to rule 4b's bare-
// processor tier and tagged these as low-confidence income, polluting the
// user's income view. (P1 #4 fix.)
const CC_PAYMENT_INFLOW_PATTERNS = [
  /\bpayment\s+thank\s+you\b/i,
  /\bautopay\b/i,
  /\bauto[-\s]?pay\b/i,
  /\bonline\s+pay(ment)?\b/i,
  /\bweb\s+pay(ment)?\b/i,
  /\bmobile\s+pay(ment)?\b/i,
  /\bach\s+pay(ment)?\b/i,
  /\bpayment\s*-\s*(web|mobile|online)\b/i,
];

function _looksLikeCcPaymentInflow(row: TxnRow): boolean {
  if ((row.amount ?? 0) >= 0) return false; // not an inflow
  const blob = `${row.merchant_name ?? ''} ${row.name ?? ''}`.trim();
  if (!blob) return false;
  return CC_PAYMENT_INFLOW_PATTERNS.some((re) => re.test(blob));
}

function pickPfcHeuristic(row: TxnRow): HeuristicHit | null {
  // Pattern check runs FIRST, before PFC heuristics, because the inflow
  // side of CC payments is a description-only signal — Plaid's PFC isn't
  // reliable here.
  if (_looksLikeCcPaymentInflow(row)) {
    return {
      category: 'transfer',
      label: row.merchant_name ?? row.name ?? 'Credit card payment',
      is_recurring_likely: false,
    };
  }

  const detail = row.personal_finance_category_detailed;
  if (!detail) return null;
  const conf = (row.personal_finance_category_confidence ?? '').toUpperCase();
  // Plaid PFC confidence: VERY_HIGH | HIGH | MEDIUM | LOW | UNKNOWN.
  // Only trust HIGH+ for the heuristic — LOW/UNKNOWN goes to the LLM.
  if (conf !== 'HIGH' && conf !== 'VERY_HIGH') return null;
  const isInflow = (row.amount ?? 0) < 0;
  const isOutflow = (row.amount ?? 0) > 0;
  const baseLabel = row.merchant_name ?? row.name ?? detail;

  if (PFC_BILL_DETAIL.has(detail) && isOutflow) {
    return { category: 'bill', label: baseLabel, is_recurring_likely: true };
  }
  if (PFC_DEBT_DETAIL.has(detail) && isOutflow) {
    return { category: 'debt_payment', label: baseLabel, is_recurring_likely: true };
  }
  // The matching credit-side of LOAN_PAYMENTS_CREDIT_CARD_PAYMENT (when
  // Plaid tags it on the CC account) is the cardholder paying down their
  // balance — also a transfer, not income.
  if (PFC_DEBT_DETAIL.has(detail) && isInflow) {
    return { category: 'transfer', label: baseLabel, is_recurring_likely: false };
  }
  if (PFC_INCOME_DETAIL.has(detail) && isInflow) {
    return { category: 'income', label: baseLabel, is_recurring_likely: detail === 'INCOME_WAGES' || detail === 'INCOME_RETIREMENT_PENSION' };
  }
  if (PFC_TRANSFER_DETAIL.has(detail)) {
    return { category: 'transfer', label: baseLabel, is_recurring_likely: false };
  }
  if (PFC_TAX_DETAIL.has(detail) && isOutflow) {
    return { category: 'tax_payment', label: baseLabel, is_recurring_likely: false };
  }
  return null;
}
