# Plaid edge function test fixtures

Synthetic Plaid responses for testing the `plaid-recategorize` and `plaid-analyze` edge functions end-to-end without real Plaid credentials.

## The persona

Sarah, freelance brand designer in NYC. 6 months of history (Nov 2025 - Apr 2026):

- **Income:** Acme Corp retainer ($3,500/mo on the 15th), J Smith client retainer ($1,200/mo via Zelle on the 9th), Stripe payouts (highly variable: $380-$1,850), one-off K Wong project ($4,500 in Feb).
- **Bills:** Rent ($2,400), Verizon ($145), Adobe ($60), Netflix ($15.49), Geico ($122.50), Con Edison utility (~$92).
- **Debts:** Chase CC autopay ($78-$145).
- **Tax:** Two EFTPS quarterlies ($1,300 + $1,400) and one NY state ($320).

The fixture deliberately includes ambiguous cases so the LLM is tested on real classification work:

- `ZELLE FROM J SMITH CLIENT` is in Plaid's `TRANSFER_IN` family but is actually income (rule 3 in the recategorize prompt).
- `VENMO TO MOM` is `TRANSFER_OUT` but should be discretionary, not transfer.
- `ADOBE` is in `GENERAL_SERVICES_OTHER` but is a recurring software bill.

## Fixtures

- `recategorize-input.json` - 15 raw Plaid transactions for the classifier.
- `analyze-input.json` - 6 months of categorized history + Plaid recurring streams + user profile, ready for the Analyzer.

## Running

### Locally (recommended for prompt iteration)

```bash
# 1. In one terminal, run the function server.
#    Make sure ANTHROPIC_API_KEY is set in supabase/functions/.env
supabase functions serve plaid-recategorize --env-file supabase/functions/.env

# 2. In another terminal, run the test.
./scripts/plaid-fixtures/test-recategorize.sh
```

### Against deployed function

```bash
FN_URL=https://<your-project>.supabase.co/functions/v1/plaid-recategorize \
SUPABASE_ANON_KEY=<your-anon-key> \
  ./scripts/plaid-fixtures/test-recategorize.sh
```

Same pattern for `test-analyze.sh`.

## What to look for in the output

### plaid-recategorize

Each transaction should come back classified with the right category. The interesting checks:

| transaction_id | expected category | tests rule |
|---|---|---|
| `txn_001` (Stripe) | income | Plaid INCOME_OTHER_INCOME → income |
| `txn_004` (Adobe) | bill | GENERAL_SERVICES_OTHER + recurring merchant → bill |
| `txn_006` (EFTPS) | tax_payment | GOVERNMENT_AND_NON_PROFIT_TAX_PAYMENT → tax |
| `txn_008` (Venmo to Mom) | discretionary | TRANSFER_OUT but not self-transfer |
| `txn_009` (TFR to savings) | transfer | self-transfer between own accounts |
| `txn_014` (Zelle from client) | income | TRANSFER_IN but actually client payment |

### plaid-analyze

The plan should:

- Identify 3 income sources (Acme, J Smith Zelle, Stripe). Stripe should be flagged variable.
- Propose 6 bills (Rent, Verizon, Adobe, Netflix, Geico, Con Edison) with correct due days.
- Propose 1 debt (Chase CC).
- Suggest **tax_pct around 18-22%** based on: total_tax = $3,020, total_gross_income ≈ $42,000, so observed effective rate ≈ 7.2%. Note: this is BELOW typical because only 2 of 4 quarterlies are visible in the 6mo window. Confidence should be "medium" or "low" with caveat.
- Income variability score should be **6-8**. Stripe ranges $380-$1,850 (~5x), monthly gross ranges roughly $5,300 to $10,800 (~2x).
- Surplus split should weight buffer_pct higher (20-30) to reflect variability.

If those numbers are off, the prompt needs tuning.
