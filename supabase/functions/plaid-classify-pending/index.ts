// plaid-classify-pending
// Sweeps unclassified plaid_transactions for the user and runs them through
// plaid-recategorize in batches. Writes the Able classification back to each
// transaction row.
//
// POST body: { max_batches?: number }   // default 1, max 10
//
// Returns: { classified, batches, total_unclassified_before, remaining }
//
// Behavior:
//   - Authenticates as the calling user via JWT.
//   - Pulls up to (BATCH_SIZE * max_batches) unclassified rows ordered by date desc.
//   - Slices into BATCH_SIZE chunks, processes them in waves of PARALLELISM
//     concurrent batches (mirrors plaid-classify-batch's perf path while
//     keeping user-JWT auth). Each batch = one plaid-recategorize call +
//     parallel DB updates.
//   - Returns counts. Caller can re-invoke if `remaining > 0`.

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const BATCH_SIZE = 50;                  // matches plaid-recategorize MAX_BATCH
const PARALLELISM = 4;                  // batches in flight concurrently
const DEFAULT_MAX_BATCHES = 1;          // 50 txns per invocation by default
const HARD_MAX_BATCHES = 10;            // 500 txns; safely under 150s gateway

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Body = {
  max_batches?: number;
};

type PendingTxn = {
  id: string;
  plaid_transaction_id: string;
  name: string | null;
  merchant_name: string | null;
  amount: number;
  date: string;
  personal_finance_category_primary: string | null;
  personal_finance_category_detailed: string | null;
};

type Classification = {
  id: string;
  category: 'income' | 'bill' | 'debt_payment' | 'tax_payment' | 'transfer' | 'discretionary';
  label: string;
  confidence: number;
  is_recurring_likely: boolean;
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
    const maxBatches = Math.min(
      Math.max(1, body.max_batches ?? DEFAULT_MAX_BATCHES),
      HARD_MAX_BATCHES,
    );
    const limit = BATCH_SIZE * maxBatches;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Daily classify cap. Each batch is up to 16k Haiku tokens; 10 batches
    // per call. Normal user hits 1500-3000 transactions during onboarding +
    // maybe a few hundred deep-dive. 8000/day is generous for legit use,
    // bounds an attacker who removes+re-adds the bank to spam classification.
    const DAILY_CLASSIFY_CAP = 8000;
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const { count: classifiedToday } = await admin
      .from('plaid_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('able_classified_at', midnight.toISOString());
    if ((classifiedToday ?? 0) >= DAILY_CLASSIFY_CAP) {
      return json({
        error: `Daily classify cap reached (${DAILY_CLASSIFY_CAP}). Resets at midnight.`,
        classified: 0,
        remaining: 0,
      }, 429);
    }

    const { data: pending, error: pendErr, count: pendCount } = await admin
      .from('plaid_transactions')
      .select(
        'id, plaid_transaction_id, name, merchant_name, amount, date, personal_finance_category_primary, personal_finance_category_detailed',
        { count: 'exact' },
      )
      .eq('user_id', userId)
      .is('able_category', null)
      .order('date', { ascending: false })
      .limit(limit);

    if (pendErr) return json({ error: pendErr.message }, 500);
    const rows = (pending ?? []) as PendingTxn[];
    if (rows.length === 0) {
      return json({
        classified: 0,
        batches: 0,
        total_unclassified_before: 0,
        remaining: 0,
      });
    }

    const t0 = Date.now();
    console.log(`plaid-classify-pending: starting, ${rows.length} txns to process (max_batches=${maxBatches})`);

    // Slice into BATCH_SIZE chunks.
    const chunks: PendingTxn[][] = [];
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      chunks.push(rows.slice(i, i + BATCH_SIZE));
    }

    let classified = 0;
    let batches = 0;

    const processOne = async (batch: PendingTxn[], batchIdx: number): Promise<void> => {
      const tBatch = Date.now();
      try {
        const classifications = await classifyBatch(batch);
        console.log(`plaid-classify-pending: batch ${batchIdx} (${batch.length} txns) llm in ${Date.now() - tBatch}ms`);

        const byPlaidId = new Map<string, Classification>();
        for (const c of classifications) byPlaidId.set(c.id, c);

        const now = new Date().toISOString();
        const tDb = Date.now();
        const updates = batch
          .map((row) => {
            const c = byPlaidId.get(row.plaid_transaction_id);
            if (!c) return null;
            return admin
              .from('plaid_transactions')
              .update({
                able_category: c.category,
                able_label: c.label,
                able_confidence: c.confidence,
                able_is_recurring_likely: c.is_recurring_likely,
                able_classified_at: now,
              })
              .eq('id', row.id)
              .then(({ error }) => {
                if (error) {
                  console.error(`update classification failed for ${row.id}:`, error);
                  return false;
                }
                return true;
              });
          })
          .filter((p): p is NonNullable<typeof p> => p !== null);
        const results = await Promise.all(updates);
        const okCount = results.filter(Boolean).length;
        classified += okCount;
        batches++;
        console.log(`plaid-classify-pending: batch ${batchIdx} db (${results.length}) in ${Date.now() - tDb}ms, ${okCount} ok`);
      } catch (e) {
        console.error(`plaid-classify-pending: batch ${batchIdx} failed:`, e);
      }
    };

    // Drain chunks in waves of PARALLELISM.
    for (let i = 0; i < chunks.length; i += PARALLELISM) {
      const wave = chunks.slice(i, i + PARALLELISM);
      await Promise.all(wave.map((batch, j) => processOne(batch, i + j)));
    }

    const remaining = Math.max(0, (pendCount ?? rows.length) - classified);
    console.log(`plaid-classify-pending: done in ${Date.now() - t0}ms, classified=${classified}, batches=${batches}, remaining=${remaining}`);

    return json({
      classified,
      batches,
      total_unclassified_before: pendCount ?? rows.length,
      remaining,
    });
  } catch (e) {
    console.error('plaid-classify-pending error:', e);
    return json({ error: (e as Error).message }, 500);
  }
});

async function classifyBatch(batch: PendingTxn[]): Promise<Classification[]> {
  const transactions = batch.map((t) => ({
    transaction_id: t.plaid_transaction_id,
    name: t.name ?? '',
    merchant_name: t.merchant_name,
    amount: t.amount,
    date: t.date,
    personal_finance_category: {
      primary: t.personal_finance_category_primary ?? null,
      detailed: t.personal_finance_category_detailed ?? null,
    },
  }));

  const resp = await fetch(`${SUPABASE_URL}/functions/v1/plaid-recategorize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE}`,
    },
    body: JSON.stringify({ transactions }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`plaid-recategorize ${resp.status}: ${text}`);
  }
  const body = await resp.json();
  if (!Array.isArray(body.classifications)) {
    throw new Error('plaid-recategorize returned no classifications array');
  }
  return body.classifications as Classification[];
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
