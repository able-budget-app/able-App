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

const BATCH_SIZE = 50;                  // matches plaid-recategorize MAX_BATCH
const PARALLELISM = 4;                  // batches in flight concurrently
const DEFAULT_MAX_BATCHES = 4;          // 200 txns per invocation, ~10s wall-clock
const HARD_MAX_BATCHES = 10;            // 500 txns; safely under Supabase's 150s gateway timeout

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  const bearerToken = authHeader.replace(/^Bearer\s+/i, '');
  if (!bearerToken || bearerToken !== SERVICE_ROLE) {
    return json({ error: 'Unauthorized' }, 401);
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
      if (accErr) return json({ error: accErr.message }, 500);
      const accountIds = (accts ?? []).map((a) => a.id as string);
      if (accountIds.length === 0) {
        return json({ classified: 0, batches: 0, scanned: 0 });
      }
      query = query.in('plaid_account_id', accountIds);
    } else if (body.user_id) {
      query = query.eq('user_id', body.user_id);
    }

    const { data: txns, error: txnErr } = await query
      .order('date', { ascending: false })
      .limit(limit);
    if (txnErr) return json({ error: txnErr.message }, 500);

    const rows = (txns ?? []) as unknown as TxnRow[];
    console.log(`plaid-classify-batch: ${rows.length} unclassified row(s) to process (max ${limit})`);

    if (rows.length === 0) {
      return json({ classified: 0, batches: 0, scanned: 0 });
    }

    // Pull every override for the users whose rows we're about to classify,
    // in one query. Match in-memory and split rows into "override-hit"
    // (skip LLM) and "needs LLM" buckets. The override path is faster AND
    // cheaper since each hit is a manual user label that should be
    // authoritative going forward.
    const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
    const overridesByUser = await fetchOverridesByUser(admin, userIds);
    const overrideHits: { row: TxnRow; override: Override }[] = [];
    const llmRows: TxnRow[] = [];
    for (const row of rows) {
      const userOverrides = overridesByUser.get(row.user_id) ?? [];
      const hit = pickOverride(row, userOverrides);
      if (hit) overrideHits.push({ row, override: hit });
      else llmRows.push(row);
    }
    console.log(
      `plaid-classify-batch: override hits=${overrideHits.length}, ` +
      `LLM rows=${llmRows.length}`,
    );

    let classified = 0;
    let classifiedViaOverride = 0;
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

    if (llmRows.length === 0) {
      console.log(
        `plaid-classify-batch: done — classified=${classified} ` +
        `(via_override=${classifiedViaOverride}, via_llm=0), ` +
        `batches=0, failures=${failures.length}`,
      );
      return json({
        classified,
        classified_via_override: classifiedViaOverride,
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
      `(via_override=${classifiedViaOverride}, via_llm=${classifiedViaLlm}), ` +
      `batches=${batches}, failures=${failures.length}`,
    );

    return json({
      classified,
      classified_via_override: classifiedViaOverride,
      classified_via_llm: classifiedViaLlm,
      batches,
      scanned: rows.length,
      failures,
    });
  } catch (e) {
    console.error('plaid-classify-batch error:', e);
    return json({ error: (e as Error).message }, 500);
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
function pickOverride(row: TxnRow, overrides: Override[]): Override | null {
  if (overrides.length === 0) return null;
  const merchantKey = (row.merchant_name ?? '').toLowerCase().trim();
  const nameLower = (row.name ?? '').toLowerCase();
  const isInflow = (row.amount ?? 0) < 0;
  const direction = isInflow ? 'inflow' : 'outflow';

  const candidates = overrides.filter((o) => {
    if (o.match_value.length === 0) return false;
    if (o.direction !== 'both' && o.direction !== direction) return false;
    if (o.match_kind === 'merchant') {
      return merchantKey.length > 0 && merchantKey === o.match_value;
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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
