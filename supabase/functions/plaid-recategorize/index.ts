import Anthropic from 'npm:@anthropic-ai/sdk@^0.40.0';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const MAX_BATCH = 50;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type PlaidTxnInput = {
  transaction_id: string;
  name?: string;
  merchant_name?: string | null;
  amount: number;
  date: string;
  personal_finance_category?: {
    primary?: string;
    detailed?: string;
    confidence_level?: string;
  } | null;
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
    const body = await req.json();
    const transactions: PlaidTxnInput[] = body?.transactions;

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return json({ error: 'Missing or empty transactions array' }, 400);
    }
    if (transactions.length > MAX_BATCH) {
      return json({ error: `Max ${MAX_BATCH} transactions per call. Batch on the caller.` }, 400);
    }

    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      // ~170 tokens per classified txn × MAX_BATCH (50) = ~8.5k tokens of
      // output. 16k gives ~2x headroom for verbose merchant names.
      max_tokens: 16000,
      system: [
        { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
      ],
      messages: [
        { role: 'user', content: buildUserMessage(transactions) },
      ],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    console.log(
      `plaid-recategorize: input=${transactions.length} txns, response_text_len=${text.length}, ` +
      `stop=${response.stop_reason}, model=${response.model}`,
    );

    const classifications = parseClassifications(text, transactions);

    return json({
      classifications,
      usage: response.usage,
    });
  } catch (e) {
    console.error('plaid-recategorize error:', e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function buildUserMessage(transactions: PlaidTxnInput[]): string {
  const trimmed = transactions.map((t) => ({
    transaction_id: t.transaction_id,
    name: t.name ?? null,
    merchant_name: t.merchant_name ?? null,
    amount: t.amount,
    date: t.date,
    plaid_primary: t.personal_finance_category?.primary ?? null,
    plaid_detailed: t.personal_finance_category?.detailed ?? null,
  }));
  return `Classify each transaction. Return a JSON array, same length, same order.\n\n${JSON.stringify(trimmed, null, 2)}`;
}

function parseClassifications(text: string, inputs: PlaidTxnInput[]): Classification[] {
  // Tolerate a leading code fence even though the prompt forbids it.
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');

  let parsed: unknown = null;

  // 1. Try to extract a top-level JSON array.
  const arrStart = stripped.indexOf('[');
  const arrEnd = stripped.lastIndexOf(']');
  if (arrStart !== -1 && arrEnd !== -1 && arrEnd > arrStart) {
    try {
      parsed = JSON.parse(stripped.slice(arrStart, arrEnd + 1));
    } catch {
      parsed = null;
    }
  }

  // 2. Fallback: model wrapped the array in an object like
  //    { "classifications": [...] }.
  if (!Array.isArray(parsed)) {
    const objStart = stripped.indexOf('{');
    const objEnd = stripped.lastIndexOf('}');
    if (objStart !== -1 && objEnd !== -1 && objEnd > objStart) {
      try {
        const obj = JSON.parse(stripped.slice(objStart, objEnd + 1)) as Record<string, unknown>;
        for (const key of ['classifications', 'results', 'transactions', 'data', 'output']) {
          if (Array.isArray(obj?.[key])) { parsed = obj[key]; break; }
        }
      } catch {
        /* fall through */
      }
    }
  }

  if (!Array.isArray(parsed)) {
    console.error('plaid-recategorize: no JSON array found. raw output:', text.slice(0, 1500));
    throw new Error('Model did not return a JSON array');
  }

  if (parsed.length !== inputs.length) {
    console.error(
      `plaid-recategorize: count mismatch (got ${parsed.length}, expected ${inputs.length}). raw output:`,
      text.slice(0, 1500),
    );
    throw new Error(`Classification count mismatch: got ${parsed.length}, expected ${inputs.length}`);
  }
  return parsed as Classification[];
}

const SYSTEM_PROMPT = `You classify financial transactions for Able, a per-deposit budgeting app for entrepreneurs with variable income.

Output ONLY a JSON array. One object per input transaction, in the SAME ORDER. No prose. No markdown fences.

# Schema (per transaction)
{
  "id": "<copy from input.transaction_id, exact>",
  "category": "income" | "bill" | "debt_payment" | "tax_payment" | "transfer" | "discretionary",
  "label": "<short user-facing name, max 40 chars>",
  "confidence": 0.0 to 1.0,
  "is_recurring_likely": true | false
}

# Categories (these map to actual Able product features)

- **income**: money received for work. 1099 deposits, payroll, client payments, Stripe / Square / PayPal payouts. Plaid INCOME_* primary, or any inflow from a business / employer source. In Plaid's sign convention, inflows have a negative amount.
- **bill**: a recurring outflow that belongs in Able's Bills list. Rent, utilities, internet, phone, insurance premiums, recurring software (Adobe, Notion, Figma), streaming, gym memberships, mortgage payments (the whole payment, classified as bill not debt_payment for simplicity).
- **debt_payment**: outflow to a creditor where the user is paying down a balance. Credit card payments, auto loan payments, student loan payments, personal loans. Plaid LOAN_PAYMENTS_* family. Mortgage is a bill, not a debt_payment.
- **tax_payment**: outflow to IRS, EFTPS, state DOR, quarterly estimates, sales tax remittances. Plaid GOVERNMENT_AND_NON_PROFIT_TAX_PAYMENT, or merchant_name / name containing "IRS", "EFTPS", "FRANCHISE TAX BD", or a state tax authority.
- **transfer**: between the user's own accounts. Plaid TRANSFER_* family, plus Venmo / Zelle / Cash App / Apple Cash where the description suggests self-transfer or brokerage funding. NOT client payments through Venmo.
- **discretionary**: everything else. Groceries, gas, dining, ATM, shopping, one-off purchases.

# Decision rules

1. Plaid's plaid_detailed field is the strongest signal. Use it first.
2. **Bill vs discretionary on GENERAL_SERVICES / GENERAL_MERCHANDISE**: if merchant_name looks recurring (Netflix, Spotify, Adobe, Verizon, T-Mobile, ConEd, gym chains), classify as bill with is_recurring_likely=true. If one-off (Amazon, Target, local store), classify as discretionary.
3. **Income vs transfer on inflows**: client / business sources are income. Self-funded transfers (own bank to own bank, brokerage transfers, Venmo from yourself) are transfer.
3a. **Venmo / Zelle / Cash App outflows to a named person who is not the user** (e.g. "VENMO TO MOM", "ZELLE TO J SMITH"): classify as **discretionary**, NOT transfer. Personal payments and gifts are spending, not internal transfers. "Transfer" is reserved for movement between the user's own accounts.
4. **Mortgages are bills.** Even though Plaid puts them in LOAN_PAYMENTS_MORTGAGE, classify as bill so they show up correctly in Able's Bills list.
5. When ambiguous, lower the confidence (≤ 0.6) and pick the safer category (discretionary over bill, transfer over income).
6. is_recurring_likely is true only when the merchant pattern itself suggests recurrence (Netflix, rent, insurance), not just based on a single transaction.

# Label rules

- Short product or merchant name. Max 40 chars.
- "Verizon phone" not "VERIZON WIRELESS PAYMENT 0001234".
- Income: "Stripe payout", "Acme Corp invoice", "PayPal from Client X".
- Tax: "IRS quarterly", "State income tax", "Tax payment".
- Debt: "Chase CC payment", "Sallie Mae loan".
- NEVER use em-dashes in labels. Use hyphens, periods, or commas.
- NEVER use emojis.

# Output

Return ONLY the JSON array. Same length as input. Same order. No surrounding prose, no markdown fences, no explanation.`;
