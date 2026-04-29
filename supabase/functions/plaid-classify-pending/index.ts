// plaid-classify-pending
// Sweeps unclassified plaid_transactions for the user and runs them through
// plaid-recategorize in batches. Writes the Able classification back to each
// transaction row.
//
// POST body: {} (no params required — operates on the authed user's data)
//
// Returns: { classified, batches, total_unclassified_before, remaining }
//
// Behavior:
//   - Pulls up to MAX_PER_RUN unclassified rows ordered by date desc.
//   - Batches them in groups of BATCH_SIZE.
//   - For each batch, POSTs to plaid-recategorize using SERVICE_ROLE auth.
//   - Updates each transaction with the classification result.
//   - Returns counts. Caller can re-invoke if `remaining > 0`.

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const BATCH_SIZE = 50;
const MAX_PER_RUN = 500; // hard cap so we don't blow the function timeout

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: pending, error: pendErr, count: pendCount } = await admin
      .from('plaid_transactions')
      .select(
        'id, plaid_transaction_id, name, merchant_name, amount, date, personal_finance_category_primary, personal_finance_category_detailed',
        { count: 'exact' },
      )
      .eq('user_id', userId)
      .is('able_category', null)
      .order('date', { ascending: false })
      .limit(MAX_PER_RUN);

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

    let classified = 0;
    let batches = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const classifications = await classifyBatch(batch);
      batches++;

      // Build a lookup by plaid_transaction_id since the recategorize fn echoes
      // the transaction_id we sent (which is the Plaid id, not our row id).
      const byPlaidId = new Map<string, Classification>();
      for (const c of classifications) byPlaidId.set(c.id, c);

      const now = new Date().toISOString();
      for (const row of batch) {
        const c = byPlaidId.get(row.plaid_transaction_id);
        if (!c) continue;
        const { error } = await admin
          .from('plaid_transactions')
          .update({
            able_category: c.category,
            able_label: c.label,
            able_confidence: c.confidence,
            able_is_recurring_likely: c.is_recurring_likely,
            able_classified_at: now,
          })
          .eq('id', row.id);
        if (error) {
          console.error(`update classification failed for ${row.id}:`, error);
        } else {
          classified++;
        }
      }
    }

    const remaining = Math.max(0, (pendCount ?? rows.length) - classified);

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
