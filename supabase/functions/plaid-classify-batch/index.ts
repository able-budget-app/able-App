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

import { createClient } from 'npm:@supabase/supabase-js@2';

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
  plaid_transaction_id: string;
  name: string | null;
  merchant_name: string | null;
  amount: number;
  date: string;
  personal_finance_category_primary: string | null;
  personal_finance_category_detailed: string | null;
  personal_finance_category_confidence: string | null;
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
        'id, plaid_transaction_id, name, merchant_name, amount, date, ' +
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

    let classified = 0;
    let batches = 0;
    const failures: string[] = [];

    // Slice the rows into BATCH_SIZE chunks, then process them in waves of
    // PARALLELISM concurrent batches. Each batch is one LLM call + one
    // bulk update, so this keeps wall-clock low even on backfills.
    const chunks: TxnRow[][] = [];
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      chunks.push(rows.slice(i, i + BATCH_SIZE));
    }

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
      `plaid-classify-batch: done — classified=${classified}, batches=${batches}, failures=${failures.length}`,
    );

    return json({ classified, batches, scanned: rows.length, failures });
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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
