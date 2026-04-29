import Anthropic from 'npm:@anthropic-ai/sdk@^0.40.0';

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

type AnalyzerInput = {
  categorized_transactions: CategorizedTxn[];
  recurring_streams: {
    inflow_streams: RecurringStream[];
    outflow_streams: RecurringStream[];
  };
  profile: {
    name?: string;
    business?: string;
    income_payment_structure?: string;
  };
  lookback_months: 6 | 12 | 24;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  try {
    const input = (await req.json()) as AnalyzerInput;
    const validation = validateInput(input);
    if (validation) return json({ error: validation }, 400);

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

    return json({
      plan,
      input_summary: {
        transaction_count: input.categorized_transactions.length,
        inflow_streams_count: input.recurring_streams.inflow_streams.length,
        outflow_streams_count: input.recurring_streams.outflow_streams.length,
        lookback_months: input.lookback_months,
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

function validateInput(input: AnalyzerInput): string | null {
  if (!input || typeof input !== 'object') return 'Missing body';
  if (!Array.isArray(input.categorized_transactions)) return 'categorized_transactions must be an array';
  if (!input.recurring_streams) return 'recurring_streams required';
  if (!Array.isArray(input.recurring_streams.inflow_streams) || !Array.isArray(input.recurring_streams.outflow_streams)) {
    return 'recurring_streams.inflow_streams and outflow_streams required';
  }
  if (![6, 12, 24].includes(input.lookback_months)) {
    return 'lookback_months must be 6, 12, or 24';
  }
  return null;
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

  // Top tax payments (full detail) so the model can derive the rate cleanly.
  const topTaxPayments = byCategory.tax_payment
    .slice()
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 12)
    .map(slimTxn);

  // Top income deposits (full detail) so the model can sense variability.
  const topIncomeDeposits = byCategory.income
    .slice()
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
    .slice(0, 12)
    .map(slimTxn);

  // Lumpy non-recurring outflows >$200 — might be debt payoffs, lump-sum tax, etc.
  const lumpyOutflows = txns
    .filter((t) => t.amount > 200 && !t.classification.is_recurring_likely
      && (t.classification.category === 'debt_payment' || t.classification.category === 'tax_payment' || t.classification.category === 'bill'))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 15)
    .map(slimTxn);

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
    top_income_deposits: topIncomeDeposits,
    top_tax_payments: topTaxPayments,
    lumpy_outflows: lumpyOutflows,
  };
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

   The four MUST sum to 100 or less. Aim for exactly 100 unless a deliberate underfill is justified in the reasoning.

4. **Tax allocation**:
   - If tax_payments are visible: derive suggested_pct from totals.tax_paid / totals.gross_income, rounded to nearest whole %. Confidence "high" if ≥ 4 quarters of evidence, "medium" if 2-3 quarters, "low" if 0-1.
   - If no tax_payments visible AND profile suggests business income: suggest 22% with confidence "low" and explain in evidence_summary that no historical payments were found.
   - If profile suggests W-2 only: suggest 0 with confidence "high" and note "Employer withholds at source."
   - Never suggest > 35.

5. **Bills selection**:
   - Source from outflow_streams with status MATURE or EARLY_DETECTION and is_active=true. Skip TOMBSTONED.
   - Mortgage payments are bills, not debts.
   - Frequency mapping: Plaid MONTHLY → "monthly", WEEKLY → "weekly", BIWEEKLY → "biweekly", ANNUALLY → "annual", SEMI_MONTHLY/UNKNOWN → "monthly" (most common case).
   - due_day_of_month: derive from predicted_next_date or last_date. Null if you can't tell.

6. **Debts selection**:
   - Outflow streams matching credit cards, auto loans, student loans, personal loans (Plaid LOAN_PAYMENTS_*).
   - min_payment = average_amount (assume the user has been paying close to minimum unless amounts are wildly variable).
   - rate_estimate: only fill if highly confident (e.g., merchant indicates a known issuer). Otherwise null.
   - balance_estimate: only fill if you can derive from history (e.g., visible payoff trajectory). Otherwise null.

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
