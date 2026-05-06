// plaid-analyze
// Builds a Floor-First Budgeting plan from a Plaid item's classified history.
//
// POST body:
//   { plaid_item_row_id: string,
//     profile_hint?: { name?: string, business?: string, income_payment_structure?: string } }
//
// Returns:
//   { plan_id, plan, input_summary, usage }
//
// Behavior:
//   - Loads plaid_items row (lookback_months) for the authed user.
//   - Loads classified plaid_transactions for accounts inside that item.
//   - Loads plaid_recurring_streams for that item.
//   - Aggregates into a compact payload, calls Sonnet 4.6 once.
//   - Parses the JSON plan from the response.
//   - Inserts a row into analyzer_plans with status='pending' and returns plan_id.
//
// The Coach (7c) reads the row by plan_id and walks the user through it.

import { createClient } from 'npm:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk@^0.40.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Category = 'income' | 'bill' | 'debt_payment' | 'tax_payment' | 'transfer' | 'discretionary';

type CategorizedTxn = {
  transaction_id: string;
  name?: string;
  merchant_name?: string | null;
  amount: number;
  date: string;
  classification: {
    category: Category;
    label: string;
    confidence: number;
    is_recurring_likely: boolean;
  };
};

type RecurringStream = {
  stream_id: string;
  description?: string;
  merchant_name?: string | null;
  category?: string[];
  personal_finance_category?: { primary?: string; detailed?: string } | null;
  average_amount: { amount: number; iso_currency_code?: string };
  last_amount?: { amount: number };
  frequency: 'WEEKLY' | 'BIWEEKLY' | 'SEMI_MONTHLY' | 'MONTHLY' | 'ANNUALLY' | 'UNKNOWN';
  status?: 'MATURE' | 'EARLY_DETECTION' | 'TOMBSTONED' | 'UNKNOWN';
  is_active?: boolean;
  predicted_next_date?: string | null;
  first_date?: string;
  last_date?: string;
  transaction_ids?: string[];
};

type CreditAccount = {
  name: string | null;
  official_name: string | null;
  mask: string | null;
  subtype: string | null;
  current_balance: number | null;
};

type AnalyzerInput = {
  categorized_transactions: CategorizedTxn[];
  recurring_streams: {
    inflow_streams: RecurringStream[];
    outflow_streams: RecurringStream[];
  };
  // Credit/line-of-credit accounts on the connected item. The truthful
  // source for credit-card debts: each card has its own row with mask
  // and current_balance. Outflow streams from checking collapse multi-
  // card payments to the same issuer into one stream.
  credit_accounts: CreditAccount[];
  profile: {
    name?: string;
    business?: string;
    income_payment_structure?: string;
  };
  lookback_months: 6 | 12 | 24;
};

type Body = {
  plaid_item_row_id: string;
  profile_hint?: AnalyzerInput['profile'];
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

    const body = (await req.json()) as Body;
    if (!body?.plaid_item_row_id) {
      return json({ error: 'plaid_item_row_id required' }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: item, error: itemErr } = await admin
      .from('plaid_items')
      .select('id, user_id, lookback_months')
      .eq('id', body.plaid_item_row_id)
      .single();
    if (itemErr || !item) return json({ error: 'Item not found' }, 404);
    if (item.user_id !== userId) return json({ error: 'Forbidden' }, 403);

    const lookback = item.lookback_months as 6 | 12 | 24;

    // Accounts inside this item — used to scope transactions, and the
    // credit/line-of-credit ones get passed to the LLM as the truth
    // source for credit-card debts.
    const { data: accounts, error: acctErr } = await admin
      .from('plaid_accounts')
      .select('id, name, official_name, mask, type, subtype, current_balance')
      .eq('plaid_item_id', item.id);
    if (acctErr) return json({ error: 'Failed to load accounts: ' + acctErr.message }, 500);
    const accountIds = (accounts ?? []).map((a) => a.id);
    if (accountIds.length === 0) {
      return json({ error: 'No accounts found for this item' }, 400);
    }
    const credit_accounts: CreditAccount[] = (accounts ?? [])
      .filter((a) => a.subtype === 'credit card' || a.subtype === 'line of credit')
      .map((a) => ({
        name: a.name ?? null,
        official_name: a.official_name ?? null,
        mask: a.mask ?? null,
        subtype: a.subtype ?? null,
        current_balance: a.current_balance != null ? Number(a.current_balance) : null,
      }));

    // Classified transactions for those accounts.
    const { data: txnRows, error: txnErr } = await admin
      .from('plaid_transactions')
      .select(
        'plaid_transaction_id, name, merchant_name, amount, date, able_category, able_label, able_confidence, able_is_recurring_likely',
      )
      .eq('user_id', userId)
      .in('plaid_account_id', accountIds)
      .not('able_category', 'is', null)
      .order('date', { ascending: false });
    if (txnErr) return json({ error: 'Failed to load transactions: ' + txnErr.message }, 500);

    const categorized_transactions: CategorizedTxn[] = (txnRows ?? []).map((r) => ({
      transaction_id: r.plaid_transaction_id,
      name: r.name ?? undefined,
      merchant_name: r.merchant_name,
      amount: Number(r.amount),
      date: r.date,
      classification: {
        category: r.able_category as Category,
        label: r.able_label ?? '',
        confidence: Number(r.able_confidence ?? 0),
        is_recurring_likely: !!r.able_is_recurring_likely,
      },
    }));

    if (categorized_transactions.length === 0) {
      return json({ error: 'No classified transactions yet — run plaid-classify-pending first' }, 400);
    }

    // Recurring streams for this item.
    const { data: streamRows, error: streamErr } = await admin
      .from('plaid_recurring_streams')
      .select(
        'stream_id, direction, merchant_name, description, personal_finance_category_detailed, frequency, status, is_active, average_amount, last_amount, iso_currency_code, predicted_next_date, first_date, last_date, transaction_ids',
      )
      .eq('plaid_item_id', item.id);
    if (streamErr) return json({ error: 'Failed to load recurring streams: ' + streamErr.message }, 500);

    const inflow_streams: RecurringStream[] = [];
    const outflow_streams: RecurringStream[] = [];
    for (const s of streamRows ?? []) {
      const stream: RecurringStream = {
        stream_id: s.stream_id,
        merchant_name: s.merchant_name,
        description: s.description ?? undefined,
        personal_finance_category: { detailed: s.personal_finance_category_detailed ?? undefined },
        average_amount: { amount: Number(s.average_amount ?? 0), iso_currency_code: s.iso_currency_code ?? 'USD' },
        last_amount: s.last_amount != null ? { amount: Number(s.last_amount) } : undefined,
        frequency: s.frequency ?? 'UNKNOWN',
        status: s.status ?? undefined,
        is_active: s.is_active ?? undefined,
        predicted_next_date: s.predicted_next_date ?? undefined,
        first_date: s.first_date ?? undefined,
        last_date: s.last_date ?? undefined,
        transaction_ids: s.transaction_ids ?? undefined,
      };
      if (s.direction === 'inflow') inflow_streams.push(stream);
      else outflow_streams.push(stream);
    }

    const input: AnalyzerInput = {
      categorized_transactions,
      recurring_streams: { inflow_streams, outflow_streams },
      credit_accounts,
      profile: body.profile_hint ?? {},
      lookback_months: lookback,
    };

    const aggregated = aggregate(input);

    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: [
        { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
      ],
      messages: [
        { role: 'user', content: buildUserMessage(aggregated, input.profile, input.lookback_months) },
      ],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    const plan = parsePlan(text);

    // Round the surplus split to multiples of 5 and force the four
    // buckets to sum to exactly 100. The model is inconsistent here
    // (e.g. 0/11/44/44 = 99) and the user-facing review shows these
    // numbers verbatim, so they should look intentional.
    if (plan && plan.surplus_split) {
      plan.surplus_split = normalizeSurplusSplit(plan.surplus_split);
    }

    // Persist. Mark any prior pending/presenting plans for this user as superseded.
    await admin
      .from('analyzer_plans')
      .update({ status: 'superseded' })
      .eq('user_id', userId)
      .in('status', ['pending', 'presenting']);

    const summaryForCoach = typeof plan?.summary_for_coach === 'string' ? plan.summary_for_coach : null;

    const { data: planRow, error: planErr } = await admin
      .from('analyzer_plans')
      .insert({
        user_id: userId,
        plaid_item_id: item.id,
        lookback_months: lookback,
        plan_json: plan,
        coach_summary: summaryForCoach,
        status: 'pending',
      })
      .select('id')
      .single();
    if (planErr) return json({ error: 'Failed to persist plan: ' + planErr.message }, 500);

    return json({
      plan_id: planRow.id,
      plan,
      summary_for_coach: summaryForCoach,
      input_summary: {
        transaction_count: categorized_transactions.length,
        inflow_streams_count: inflow_streams.length,
        outflow_streams_count: outflow_streams.length,
        lookback_months: lookback,
      },
      usage: response.usage,
    });
  } catch (e) {
    console.error('plaid-analyze error:', e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Aggregate raw transactions into a compact payload for the LLM.
// Goal: keep the prompt under ~15k input tokens regardless of lookback.
function aggregate(input: AnalyzerInput) {
  const txns = input.categorized_transactions;

  const byCategory: Record<Category, CategorizedTxn[]> = {
    income: [],
    bill: [],
    debt_payment: [],
    tax_payment: [],
    transfer: [],
    discretionary: [],
  };
  for (const t of txns) byCategory[t.classification.category].push(t);

  const monthBucket = (date: string) => date.slice(0, 7); // YYYY-MM

  const monthlyIncome: Record<string, number> = {};
  for (const t of byCategory.income) {
    const m = monthBucket(t.date);
    monthlyIncome[m] = (monthlyIncome[m] ?? 0) + Math.abs(t.amount);
  }
  const monthlyTax: Record<string, number> = {};
  for (const t of byCategory.tax_payment) {
    const m = monthBucket(t.date);
    monthlyTax[m] = (monthlyTax[m] ?? 0) + t.amount;
  }
  const monthlyBills: Record<string, number> = {};
  for (const t of byCategory.bill) {
    const m = monthBucket(t.date);
    monthlyBills[m] = (monthlyBills[m] ?? 0) + t.amount;
  }
  const monthlyDebt: Record<string, number> = {};
  for (const t of byCategory.debt_payment) {
    const m = monthBucket(t.date);
    monthlyDebt[m] = (monthlyDebt[m] ?? 0) + t.amount;
  }

  const monthlyGross = Object.values(monthlyIncome);
  const totalIncome = sum(monthlyGross);
  const totalTax = sum(Object.values(monthlyTax));
  const incomeVariability = computeVariability(monthlyGross);

  const topTaxPayments = byCategory.tax_payment
    .slice()
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 12)
    .map(slimTxn);

  const topIncomeDeposits = byCategory.income
    .slice()
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
    .slice(0, 12)
    .map(slimTxn);

  const lumpyOutflows = txns
    .filter((t) => t.amount > 200 && !t.classification.is_recurring_likely
      && (t.classification.category === 'debt_payment' || t.classification.category === 'tax_payment' || t.classification.category === 'bill'))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 15)
    .map(slimTxn);

  // Fallback for fresh Plaid connections where /transactions/recurring/get
  // returns PRODUCT_NOT_READY (can take minutes to hours after first sync).
  // Without this, the LLM sees an empty outflow_streams array, follows
  // "Source from outflow_streams" literally, and emits aggregate "(unresolved)
  // recurring bills $X" placeholders instead of itemized rows. We compute
  // recurring candidates directly from already-classified bill + debt_payment
  // transactions so the LLM has named merchants to work with even when
  // streams are absent.
  const detected_recurring_outflows = detectRecurringFromTxns([
    ...byCategory.bill,
    ...byCategory.debt_payment,
  ]);

  return {
    monthly_summary: {
      months_observed: Object.keys(monthlyIncome).sort(),
      gross_income_by_month: monthlyIncome,
      tax_payments_by_month: monthlyTax,
      bill_outflows_by_month: monthlyBills,
      debt_outflows_by_month: monthlyDebt,
    },
    totals: {
      gross_income: round(totalIncome),
      tax_paid: round(totalTax),
      effective_tax_rate_observed: totalIncome > 0 ? round(totalTax / totalIncome, 4) : null,
      bills_total: round(sum(Object.values(monthlyBills))),
      debt_total: round(sum(Object.values(monthlyDebt))),
    },
    income_variability_signal: {
      coefficient_of_variation: incomeVariability.cv,
      min_month: incomeVariability.min,
      max_month: incomeVariability.max,
      ratio_max_over_min: incomeVariability.ratio,
    },
    inflow_streams: input.recurring_streams.inflow_streams.map(slimStream),
    outflow_streams: input.recurring_streams.outflow_streams.map(slimStream),
    detected_recurring_outflows,
    credit_accounts: input.credit_accounts,
    top_income_deposits: topIncomeDeposits,
    top_tax_payments: topTaxPayments,
    lumpy_outflows: lumpyOutflows,
  };
}

// Detects recurring merchants by grouping transactions by merchant_name,
// requiring 2+ occurrences within a 90-day window at consistent amounts,
// and inferring frequency from the modal date spacing. Returns a structured
// list the LLM can use as a fallback when plaid_recurring_streams is empty.
function detectRecurringFromTxns(txns: CategorizedTxn[]) {
  if (!txns.length) return [];

  const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();
  const groups = new Map<string, CategorizedTxn[]>();
  for (const t of txns) {
    const key = norm(t.merchant_name) || norm(t.name);
    if (!key) continue;
    const arr = groups.get(key) ?? [];
    arr.push(t);
    groups.set(key, arr);
  }

  const today = new Date();
  const ninetyDaysAgo = new Date(today.getTime() - 90 * 86400000);

  type Candidate = {
    detected_merchant: string;
    category: 'bill' | 'debt_payment';
    average_amount: number;
    occurrence_count: number;
    date_range: { first: string; last: string };
    frequency_estimate: string;
    inferred_due_day: number | null;
    confidence: 'high' | 'medium' | 'low';
    evidence_transaction_ids: string[];
  };

  const out: Candidate[] = [];

  for (const [, raw] of groups) {
    if (raw.length < 2) continue;

    // Look at the recent window for amount consistency. We use 90 days as the
    // recurrence-detection window; older history is fine to use when computing
    // the first/last range below.
    const recent = raw.filter((t) => new Date(t.date) >= ninetyDaysAgo);
    if (recent.length < 2) continue;

    const amounts = recent.map((t) => Math.abs(t.amount));
    const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    if (avg < 0.5) continue;

    // Drop outliers more than ±20% off the mean. Subscription prices change
    // occasionally but day-to-day amounts are stable.
    const consistent = recent.filter((t) => {
      const a = Math.abs(t.amount);
      return Math.abs(a - avg) / avg <= 0.20;
    });
    if (consistent.length < 2) continue;

    const sorted = consistent.slice().sort((a, b) => a.date.localeCompare(b.date));
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const ms = new Date(sorted[i].date).getTime() - new Date(sorted[i - 1].date).getTime();
      gaps.push(Math.round(ms / 86400000));
    }
    const medianGap = gaps.length ? gaps.slice().sort((a, b) => a - b)[Math.floor(gaps.length / 2)] : 30;

    let frequency_estimate = 'UNKNOWN';
    if (medianGap >= 5 && medianGap <= 9) frequency_estimate = 'WEEKLY';
    else if (medianGap >= 12 && medianGap <= 16) frequency_estimate = 'BIWEEKLY';
    else if (medianGap >= 27 && medianGap <= 33) frequency_estimate = 'MONTHLY';
    else if (medianGap >= 350 && medianGap <= 380) frequency_estimate = 'ANNUALLY';

    // Modal day-of-month for due_day_of_month inference (monthly cadence only).
    let inferred_due_day: number | null = null;
    if (frequency_estimate === 'MONTHLY') {
      const dayCounts = new Map<number, number>();
      for (const t of consistent) {
        const d = new Date(t.date).getUTCDate();
        dayCounts.set(d, (dayCounts.get(d) ?? 0) + 1);
      }
      let bestDay = 0, bestCount = 0;
      for (const [d, c] of dayCounts) {
        if (c > bestCount) { bestDay = d; bestCount = c; }
      }
      if (bestDay >= 1 && bestDay <= 31) inferred_due_day = bestDay;
    }

    // Majority category — most groups will be all-bill or all-debt_payment,
    // but mixed groups can happen when a merchant changes role.
    const billCount = consistent.filter((t) => t.classification.category === 'bill').length;
    const category: 'bill' | 'debt_payment' = billCount >= consistent.length / 2 ? 'bill' : 'debt_payment';

    let confidence: 'high' | 'medium' | 'low' = 'low';
    if (consistent.length >= 3 && frequency_estimate !== 'UNKNOWN') confidence = 'high';
    else if (consistent.length >= 2 && frequency_estimate !== 'UNKNOWN') confidence = 'medium';

    const merchantName = consistent[0].merchant_name || consistent[0].name || 'Unknown';

    out.push({
      detected_merchant: merchantName,
      category,
      average_amount: round(avg),
      occurrence_count: consistent.length,
      date_range: { first: sorted[0].date, last: sorted[sorted.length - 1].date },
      frequency_estimate,
      inferred_due_day,
      confidence,
      evidence_transaction_ids: consistent.map((t) => t.transaction_id),
    });
  }

  // Largest monthly impact first; cap to keep payload bounded.
  const monthlyValue = (c: Candidate) => {
    switch (c.frequency_estimate) {
      case 'WEEKLY':   return c.average_amount * 52 / 12;
      case 'BIWEEKLY': return c.average_amount * 26 / 12;
      case 'MONTHLY':  return c.average_amount;
      case 'ANNUALLY': return c.average_amount / 12;
      default:         return c.average_amount;
    }
  };
  return out.sort((a, b) => monthlyValue(b) - monthlyValue(a)).slice(0, 30);
}

function slimTxn(t: CategorizedTxn) {
  return {
    transaction_id: t.transaction_id,
    date: t.date,
    amount: t.amount,
    label: t.classification.label,
    merchant: t.merchant_name ?? null,
    category: t.classification.category,
  };
}

function slimStream(s: RecurringStream) {
  return {
    stream_id: s.stream_id,
    merchant: s.merchant_name ?? null,
    description: s.description ?? null,
    frequency: s.frequency,
    status: s.status ?? null,
    is_active: s.is_active ?? null,
    average_amount: s.average_amount?.amount,
    last_amount: s.last_amount?.amount ?? null,
    predicted_next_date: s.predicted_next_date ?? null,
    plaid_detailed: s.personal_finance_category?.detailed ?? null,
  };
}

function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}

function round(n: number, digits = 2): number {
  const factor = Math.pow(10, digits);
  return Math.round(n * factor) / factor;
}

function computeVariability(monthlyValues: number[]) {
  if (monthlyValues.length < 2) {
    return { cv: 0, min: 0, max: 0, ratio: 1 };
  }
  const mean = sum(monthlyValues) / monthlyValues.length;
  if (mean === 0) return { cv: 0, min: 0, max: 0, ratio: 1 };
  const variance = monthlyValues.reduce((acc, v) => acc + (v - mean) ** 2, 0) / monthlyValues.length;
  const sd = Math.sqrt(variance);
  const min = Math.min(...monthlyValues);
  const max = Math.max(...monthlyValues);
  return {
    cv: round(sd / mean, 3),
    min: round(min),
    max: round(max),
    ratio: min > 0 ? round(max / min, 2) : null,
  };
}

function buildUserMessage(aggregated: ReturnType<typeof aggregate>, profile: AnalyzerInput['profile'], lookback: number): string {
  return `Propose a Floor-First Budgeting plan for this user. Return ONLY the JSON plan.

# User profile
${JSON.stringify(profile, null, 2)}

# Lookback window
${lookback} months

# Aggregated history
${JSON.stringify(aggregated, null, 2)}`;
}

function parsePlan(text: string) {
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error('Model did not return a JSON object');
  }
  return JSON.parse(stripped.slice(start, end + 1));
}

// Round the four split buckets to multiples of 5 and ensure they sum to
// exactly 100. Adjustments land on the largest bucket so smaller
// categories keep the proportion the model intended.
function normalizeSurplusSplit(split: Record<string, unknown>): Record<string, unknown> {
  const keys = ['owner_pct', 'debt_pct', 'reserve_pct', 'free_pct'] as const;
  const rounded: Record<string, number> = {};
  for (const k of keys) {
    let v = Number(split[k]);
    if (!Number.isFinite(v) || v < 0) v = 0;
    if (v > 100) v = 100;
    rounded[k] = Math.round(v / 5) * 5;
  }
  let sum = keys.reduce((s, k) => s + rounded[k], 0);

  // Sanity fallback: if the model produced something nonsensical,
  // use Floor-First defaults rather than try to repair.
  if (sum < 50 || sum > 130) {
    return { ...split, owner_pct: 10, debt_pct: 20, reserve_pct: 15, free_pct: 55 };
  }

  let safety = 40;
  while (sum !== 100 && safety-- > 0) {
    const largest = keys.reduce((acc, k) => (rounded[k] > rounded[acc] ? k : acc), keys[0]);
    if (sum < 100) {
      rounded[largest] += 5;
      sum += 5;
    } else {
      rounded[largest] = Math.max(0, rounded[largest] - 5);
      sum -= 5;
    }
  }

  return { ...split, ...rounded };
}

const SYSTEM_PROMPT = `You are the Analyzer for Able, a per-deposit budgeting app for entrepreneurs with variable income.

After Plaid connects, you propose a complete Floor-First Budgeting plan based on the user's actual transaction history. The Coach presents your proposal to the user for confirmation. Every section must include evidence (transaction IDs or stream IDs) so the user can verify what you're seeing.

# Floor-First Budgeting (the methodology)

1. Know your floor. Bills + tax = the amount you can't miss.
2. Every deposit fills the floor first. Not month by month. Deposit by deposit.
3. Build your reserve before you spend. Slow months get paid by the reserve, not by next month's panic.
4. One month ahead = Able. When next month's floor is already reserved, you've arrived.
5. Score reality, not the plan.

# How Able is built (these constraints are non-negotiable)

**Bills list:** every recurring obligation with a name, amount, due day of month, frequency. Reserved against per-bill from each deposit.

**Debts list:** balances with a min payment, due day, and (optional) APR. Paid highest-interest first.

**Off-the-top fixed allocations:** taxes are NOT in the surplus split. They are taken off the top of every deposit BEFORE anything else happens. You propose a single tax_pct here.

**Surplus split** (after bills and fixed allocations, of what's left):
- owner_pct: pay yourself (owner draw)
- debt_pct: extra debt payoff above the minimums
- reserve_pct: build the reserve (the savings cushion for slow months — manually pulled from in v1; "buffer" / bufPct in app code)
- free_pct: yours to spend freely

These four percentages must sum to 100 or less. Anything unallocated rolls to debt.

**The reserve is not auto-routing.** It accumulates from reserve_pct of every deposit. The user manually transfers from reserve to operating when slow months hit. The Coach prompts this. Your proposal sizes the reserve so the user has runway, but the app does not auto-route.

# Output schema

Return ONLY this JSON object. No prose. No markdown fences.

{
  "income_sources": [
    {
      "name": "<short label>",
      "frequency": "WEEKLY" | "BIWEEKLY" | "SEMI_MONTHLY" | "MONTHLY" | "ANNUALLY" | "IRREGULAR",
      "average_amount": <number>,
      "last_3_amounts": [<number>, <number>, <number>],
      "evidence_stream_id": "<stream_id or null>",
      "evidence_transaction_ids": ["<id>", "<id>"]
    }
  ],
  "bills": [
    {
      "name": "<short label>",
      "amount": <number>,
      "due_day_of_month": <integer 1-31 or null>,
      "frequency": "monthly" | "weekly" | "biweekly" | "annual",
      "evidence_stream_id": "<stream_id or null>"
    }
  ],
  "debts": [
    {
      "name": "<short label>",
      "min_payment": <number>,
      "due_day_of_month": <integer 1-31 or null>,
      "rate_estimate": <number 0-1 or null>,
      "balance_estimate": <number or null>,
      "evidence_stream_id": "<stream_id or null>"
    }
  ],
  "tax_allocation": {
    "suggested_pct": <integer 0-50>,
    "evidence_summary": "<one sentence: amount paid over lookback / gross income, implied effective rate, any caveats>",
    "evidence_transaction_ids": ["<id>", "<id>"],
    "confidence": "high" | "medium" | "low"
  },
  "surplus_split": {
    "owner_pct": <integer>,
    "debt_pct": <integer>,
    "reserve_pct": <integer>,
    "free_pct": <integer>,
    "reasoning": "<one sentence>"
  },
  "income_variability_score": <integer 1-10>,
  "summary_for_coach": "<3-5 sentences in Able's voice>"
}

# Rules

1. **Floor first.** Floor = bills + tax_pct of every deposit. Reserve % rises with income variability so the user has runway through slow months. **Debt minimums are NOT part of the floor** in the methodology — they're a separate obligation. Do not include debt minimums in any "floor" total. (See rule 8 for how to surface them in the summary when debts exist.)

2. **Income variability score**:
   - 1-3 = steady. Coefficient of variation < 0.15, or W-2-like, or one big monthly retainer.
   - 4-6 = moderate. CV 0.15-0.40, multiple recurring sources, predictable but variable.
   - 7-10 = high. CV > 0.40, ratio of max/min month > 3, no consistent cadence.

3. **Surplus split defaults**, then adjust for variability:
   - owner_pct: 10
   - debt_pct: 20 if any debts present, 5 otherwise
   - reserve_pct: 15 (raise to 25-30 if variability ≥ 6, lower to 10 if variability ≤ 3). This is "bufPct" in app code; the API speaks the user-facing word.
   - free_pct: whatever brings the sum to ≤ 100

   **All four percentages MUST be multiples of 5 (0, 5, 10, 15, 20, 25, ...) and the four MUST sum to exactly 100.** No 11s, 44s, or other irregular numbers. Pick clean, presentable values.

4. **Tax allocation**:
   - If tax_payments are visible: derive suggested_pct from totals.tax_paid / totals.gross_income, rounded to nearest whole %. Confidence "high" if ≥ 4 quarters of evidence, "medium" if 2-3 quarters, "low" if 0-1.
   - If no tax_payments visible AND profile suggests business income: suggest 22% with confidence "low" and explain in evidence_summary that no historical payments were found.
   - **W-2 detection requires BOTH (a) consistent amounts (coefficient of variation < 0.15) AND (b) consistent cadence (regular biweekly/semi-monthly/monthly).** A merchant name containing "PAYROLL", "WAGES", or similar terminology is NOT sufficient on its own. Healthcare staffing agencies (Aya Healthcare, Locumstory, Cross Country, NurseFly, etc.), nursing locum platforms, and other 1099 contractor agencies routinely deposit payments labeled like "AYA HC PAYROLL" — but issue 1099-NECs at year end. If wages-tagged deposits have CV > 0.15 OR irregular cadence, treat as 1099/business income and suggest 22% with confidence "medium" (note in evidence_summary: "wages-style memos but variable amounts — treating as 1099").
   - If profile suggests W-2 only AND deposits meet both consistency criteria above: suggest 0 with confidence "high" and note "Employer withholds at source."
   - Never suggest > 35.

5. **Bills selection**:
   - **Primary source**: outflow_streams with status MATURE or EARLY_DETECTION and is_active=true. Skip TOMBSTONED.
   - **Fallback when outflow_streams is empty or sparse (fewer than 3 active streams)**: use entries from detected_recurring_outflows where category is 'bill' and confidence is 'high' or 'medium'. Plaid's recurring detection sometimes returns PRODUCT_NOT_READY for hours-to-days after a fresh bank connect, leaving outflow_streams empty even though real recurring bills exist in the transactions. The detected_recurring_outflows array is computed directly from already-classified transactions to bridge that gap. NEVER emit aggregate placeholder rows like "Recurring bills (unresolved)" — itemize what you can see.
   - Mortgage payments are bills, not debts.
   - Frequency mapping: Plaid MONTHLY → "monthly", WEEKLY → "weekly", BIWEEKLY → "biweekly", ANNUALLY → "annual", SEMI_MONTHLY/UNKNOWN → "monthly" (most common case). For detected entries, use frequency_estimate the same way.
   - due_day_of_month: derive from predicted_next_date or last_date for streams. For detected entries, use inferred_due_day. Null if you can't tell.
   - When using detected entries, set name to detected_merchant and amount to average_amount. Cite the evidence_transaction_ids array if your output schema includes evidence fields.

6. **Debts selection**:
   - **Credit cards & lines of credit — use credit_accounts as the source of truth.** When credit_accounts is non-empty, emit ONE debt entry per account in that array. Each card has its own row with name, mask, current_balance — these are direct from the bank, never collapsed. Do NOT detect credit-card debts from outflow_streams: a single checking-account "Chase $530/mo" stream can hide TWO different Chase cards being paid, and you'll miss one. credit_accounts is the only honest source.
     - name: prefer official_name if present, then name. Append " ending {mask}" so the user can tell two cards from the same issuer apart. Example: "Chase Sapphire ending 4766".
     - balance_estimate: use current_balance directly (already the live Plaid balance — pass through).
     - min_payment: try to match an outflow_stream by mask suffix in description/merchant_name (e.g., "...4766" or "AUTOPAY 4766"). If no clear match, estimate min_payment as 2.5% of current_balance, rounded to the nearest dollar (typical credit-card minimum). NEVER attribute the same outflow stream to two different cards.
     - rate_estimate: leave null unless you have strong evidence (recent INTEREST CHARGE total ÷ avg balance × 12). Coach can ask the user later.
     - due_day_of_month: derive from a matched outflow stream's predicted_next_date if you confidently matched one; otherwise null.
   - **Other debts (auto loans, student loans, personal loans):** detect from outflow streams matching Plaid LOAN_PAYMENTS_*, OR from detected_recurring_outflows entries with category='debt_payment'.
     - min_payment = average_amount (assume the user has been paying close to minimum unless amounts are wildly variable).
     - rate_estimate: only fill if highly confident (e.g., merchant indicates a known issuer). Otherwise null.
     - balance_estimate: only fill if you can derive from history (e.g., visible payoff trajectory). Otherwise null.
   - **NEVER classify "INTEREST CHARGE", "PURCHASE INTEREST CHARGE", or "FINANCE CHARGE" as a standalone debt.** Those are interest accruals on an existing card debt — emit them as APR evidence (informs rate_estimate) but never as their own debt row. Prior versions of this prompt let those slip through; do not.

7. **Income sources**:
   - Inflow streams that are active. Group by merchant when obviously the same source (multiple Stripe payouts → one "Stripe payouts" income source).
   - For irregular income (no inflow stream but lots of one-off deposits), create a single "Variable client work" entry with frequency IRREGULAR and average_amount = totals.gross_income / months_observed.

8. **summary_for_coach voice**:
   - 3 to 5 sentences.
   - No em-dashes. Use periods, commas, hyphens.
   - No emojis.
   - Lead with what you saw, then what you'd set up. End with "Tell me what to change."
   - Address the user directly ("you", "your"). Use the profile.name if present.
   - Calm, specific, plain. Match the Coach voice.
   - **"Floor-First Budgeting" is a proper noun.** Always capitalize when written. Never lowercase as "floor-first budgeting".
   - **Floor framing rules**:
     - The floor is bills + tax_pct only. Never include debt minimums in any "your floor is $X" total.
     - When the user has debts (debts array non-empty): mention the minimums in a SEPARATE clause right after the floor, framed as additional. Example: "Your floor runs $2,400 a month for bills, plus 22% off the top for taxes. You also have $105 in debt minimums on top of that." Use words like "on top of," "in addition to," "plus." Do not fold them into a single floor number.
     - This framing keeps debt minimums honest (real obligation) without making them feel like a permanent fixture of the methodology.

# Reminder

Return ONLY the JSON object. No prose, no markdown fences, no explanation.`;
