// plaid-recategorize — service-role only. Called by plaid-classify-batch
// and plaid-classify-pending; never called directly by the browser.
// Without the service-role gate this is an open credit-drain endpoint.

import Anthropic from 'npm:@anthropic-ai/sdk@^0.40.0';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const INTERNAL_SECRET = Deno.env.get('INTERNAL_FUNCTION_SECRET') ?? '';
const MAX_BATCH = 50;

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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'POST only' }, 405);

  try {
    // Internal-only gate. Invoked by plaid-classify-batch and
    // plaid-classify-pending; never by the browser. Uses a custom shared
    // secret rather than SUPABASE_SERVICE_ROLE_KEY because Supabase's
    // runtime mutates the Authorization header on inter-function calls,
    // which made the service-role bearer compare unreliable.
    if (!INTERNAL_SECRET) {
      console.error('plaid-recategorize: INTERNAL_FUNCTION_SECRET unset');
      return json(req, { error: 'not configured' }, 503);
    }
    const got = req.headers.get('x-internal-auth') ?? '';
    if (got !== INTERNAL_SECRET) {
      return json(req, { error: 'Forbidden' }, 403);
    }

    const body = await req.json();
    const transactions: PlaidTxnInput[] = body?.transactions;

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return json(req, { error: 'Missing or empty transactions array' }, 400);
    }
    if (transactions.length > MAX_BATCH) {
      return json(req, { error: `Max ${MAX_BATCH} transactions per call. Batch on the caller.` }, 400);
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

    return json(req, {
      classifications,
      usage: response.usage,
    });
  } catch (e) {
    console.error('plaid-recategorize error:', e);
    return json(req, { error: 'Internal server error' }, 500);
  }
});

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
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

0. **CHECK THE SIGN FIRST. This is binding and overrides every other rule below.**
   - amount < 0 = **INFLOW** (money INTO the user's account — they received it)
   - amount > 0 = **OUTFLOW** (money OUT of the user's account — they spent it)

   For inflows, the merchant_name tells you WHO sent the money, NOT what was purchased. An inflow from Airbnb is a host payout (the user is the host); it is NOT a lodging expense. An inflow from Stripe is a client payment; it is NOT a software charge. **Plaid's plaid_detailed field describes the merchant's category, not the direction of the transaction — it is misleading for inflows.** For any inflow (amount < 0), apply rules 4 / 4b first. Rules 2 and 3 (which talk about purchases, bills, and travel) apply ONLY to outflows.

1. For outflows, Plaid's plaid_detailed field is the strongest signal. Use it first. (For inflows, use rule 0 + rule 4 / 4b.)

2. **A bill is a RECURRING SUBSCRIPTION OR UTILITY, not a single purchase.** If you would put the merchant on a budget under "monthly fixed costs," it's a bill. If it's something the user might or might not buy this month, it's discretionary. Default to discretionary when in doubt. (Outflows only — see rule 0.)

   Bill examples:
   - Rent / mortgage payments
   - Utilities (electric, gas, water, internet, phone, trash)
   - Insurance premiums (auto, home, health, life)
   - Streaming and SaaS subscriptions with steady monthly amounts (Netflix, Spotify, Adobe, Notion, Figma, Dropbox)
   - Recurring gym / climbing / studio memberships when the merchant clearly sells memberships
   - Storage units, car payments routed as bill
   - HOA fees, recurring loan auto-debits

   Discretionary (NOT bill) — these all look like single purchases even though the merchant is named:
   - Airlines, hotels, ride-share, Airbnb stays / VRBO bookings (TRAVEL_TRANSPORTATION) — **only when amount > 0 (outflow). Airbnb / VRBO inflows are host payouts; see rule 4b.**
   - Bike shops, hardware stores, electronics retailers (GENERAL_MERCHANDISE_*)
   - Restaurants, takeout, groceries, coffee, bars
   - Gas stations
   - Apparel, online shopping (Amazon, Target, Etsy)
   - Big one-off purchases at any merchant (e.g. a $2,000 charge at a furniture store)

3. **Use the amount + merchant pattern to break ties.**
   - Plaid GENERAL_MERCHANDISE_*, GENERAL_SERVICES_*, TRAVEL_*, FOOD_AND_DRINK_*, ENTERTAINMENT_*, PERSONAL_CARE_* default to **discretionary**. Only flip to bill if the merchant_name explicitly matches a recurring-software / utility / subscription pattern from the list above.
   - Plaid RENT_AND_UTILITIES_*, INSURANCE_* default to **bill**.
   - Plaid LOAN_PAYMENTS_MORTGAGE → bill. Other LOAN_PAYMENTS_* → debt_payment.

4. **Income vs transfer on inflows**: client / business sources are income. Self-funded transfers (own bank to own bank, brokerage transfers, Venmo from yourself) are transfer.

4a. **Venmo / Zelle / Cash App outflows to a named person who is not the user** (e.g. "VENMO TO MOM", "ZELLE TO J SMITH"): classify as **discretionary**, NOT transfer. Personal payments and gifts are spending, not internal transfers. "Transfer" is reserved for movement between the user's own accounts.

4ab. **Credit-card payment inflows are transfers, not income.** Before applying rule 4b, check the description: when amount is NEGATIVE (inflow) AND the merchant_name or name matches a generic credit-card-payment pattern, classify as **transfer** with confidence 0.85. These are the user paying down their own credit card from another account they own — never income.

   Generic CC-payment patterns:
   - "Payment Thank You" / "Payment Thank You-Mobile" / "Payment Thank You-Web"
   - "PAYMENT - WEB" / "PAYMENT - MOBILE" / "PAYMENT - ONLINE"
   - "AUTOPAY" / "AUTO-PAY" / "AUTOMATIC PAYMENT"
   - "ONLINE PAYMENT" / "WEB PAYMENT" / "MOBILE PAYMENT"
   - "ACH PAYMENT" / "ACH CREDIT PAYMENT" with no business name attached

   These descriptions are credit-card-issuer boilerplate for the credit side of a payment. Do NOT route to rule 4b's "bare processor" tier — that would tag them as low-confidence income and pollute the user's income inbox.

4b. **Marketplace / processor payouts on inflows are income, not discretionary or transfer.** When amount is NEGATIVE (inflow / credit) AND merchant_name or name matches a marketplace or payment processor, default to **income** — the user is the host / seller / payee, not the customer:
   - Airbnb, VRBO, Vrbo, Booking.com host payouts → income (host payout). The Airbnb-as-discretionary rule under rule 2 applies ONLY to OUTFLOWS (positive amount = the user paying for a stay).
   - Stripe, Square, Shopify, Toast, Clover payouts → income (client payment / sales).
   - Etsy, eBay, Upwork, Fiverr, Gumroad, Substack, Patreon payouts → income.
   - Amazon Payments, Google Pay, Apple Pay business payouts → income.

   **Venmo / Zelle / Cash App / PayPal inflows are the harder case** because they carry both client payments and personal money. Use these tiers:
   - **From a clearly-business source** (e.g. "PAYPAL TRANSFER ACME LLC", "VENMO ACME CO", "ZELLE FROM ACME INC") → income (high confidence 0.85+).
   - **From a description suggesting an internal move** (e.g. "ZELLE FROM SELF", "TRANSFER FROM CHECKING", anything referencing the user's own bank or "OWN ACCOUNT") → transfer (confidence 0.6-0.7).
   - **Bare "Venmo" / "Cash App" / "Zelle" with no name or detail at all** → **income with low confidence (0.55)**. Able's user base is entrepreneurs and freelancers whose business income often arrives via these processors with stripped descriptions; defaulting to income surfaces it for review in the user's income view rather than burying it under transfers.
   - **From a named individual that looks personal** (a first + last name with no business suffix like LLC / Inc / Corp / Co, e.g. "ZELLE FROM JANE M SMITH", "VENMO FROM J DOE") → transfer (confidence 0.6). These are typically family transfers, splitting expenses, or gifts. Note: the prompt does NOT receive the current user's name, so this rule is based purely on the shape of the sender field — a personal-looking name pattern is the signal.

   Only override to a different category if the description strongly suggests a refund (e.g. "REFUND", "RETURN", "REVERSAL"), in which case choose **discretionary** with confidence ≤ 0.6 and a label like "Refund — <merchant>".

5. **Mortgages are bills.** Even though Plaid puts them in LOAN_PAYMENTS_MORTGAGE, classify as bill so they show up correctly in Able's Bills list.

6. When ambiguous, lower the confidence (≤ 0.6) and pick the safer category. The "safer" defaults are:
   - **discretionary over bill** — far better to miss a bill (user will add it manually) than to bury a one-off purchase in the bills list.
   - **income over transfer for inflows from peer-to-peer processors (Venmo, Cash App, Zelle, PayPal) with stripped or generic descriptions** — Able's user base is entrepreneurs whose business deposits often arrive without a clear sender name. Burying these as transfers makes the user's actual income invisible. Surfacing them as income (with low confidence) lets the user re-categorize the rare self-transfer in their income review.
   - For inflows from a clearly-named individual (especially family / spouse / friend), transfer is still the safer default unless context suggests payment for services.

7. is_recurring_likely is true only when the merchant pattern itself suggests recurrence (Netflix, rent, insurance), not just based on a single transaction.

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
