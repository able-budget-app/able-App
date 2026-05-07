-- Adds plaid_credit_debts: canonical per-card debt rows sourced from
-- Plaid's /liabilities/get (preferred) or estimated from plaid_accounts +
-- transactions when liabilities is unavailable.
--
-- Why: the in-analyzer buildCreditDebts preprocessor was unreliable for
-- APR (uses current_balance as denominator instead of average daily
-- balance — undershoots ~7% on revolving users; verified 2026-05-06 on
-- Paul's two Chase cards: estimator returned 19.82%/15.58%, actual
-- 26.24%/22.74%). Plaid liabilities returns true APRs + min_payment +
-- last_statement_balance + next_payment_due_date deterministically.
--
-- This table also unblocks the add-bank-delta path (P1-2026-05-06 #2):
-- credit-card detection now lives outside plaid-analyze so the same
-- function can be called for "what new cards did this item bring."
--
-- Idempotent: safe to re-run.

create table if not exists public.plaid_credit_debts (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users(id) on delete cascade,
  plaid_item_id            uuid not null references public.plaid_items(id) on delete cascade,
  plaid_account_id         uuid not null references public.plaid_accounts(id) on delete cascade,
  -- Display name including mask, e.g. "Chase Sapphire ending 0714".
  name                     text,
  mask                     text,
  -- current_balance copied from plaid_accounts at detection time.
  current_balance          numeric,
  -- Purchase APR as a decimal (e.g. 0.2624 for 26.24%). Null when source
  -- = 'estimate' (we deliberately stopped emitting bad APR estimates).
  purchase_apr             numeric,
  min_payment              numeric,
  -- Liabilities-only fields. Null when source = 'estimate'.
  last_statement_balance   numeric,
  next_payment_due_date    date,
  -- Derived from next_payment_due_date or matched autopay stream's
  -- predicted_next_date. Range 1-31. Kept for the analyzer prompt's
  -- existing pre_built_credit_debts shape.
  due_day_of_month         smallint check (due_day_of_month is null or (due_day_of_month between 1 and 31)),
  -- 'liabilities' = real APR + min_payment from /liabilities/get.
  -- 'estimate'    = institution doesn't support liabilities; balance only.
  source                   text not null check (source in ('liabilities', 'estimate')),
  -- Plaid stream_id from plaid_recurring_streams when an autopay outflow
  -- mask-matches this card (3-digit suffix). Lets the Coach surface
  -- "you autopay this from <account>" later.
  evidence_stream_id       text,
  last_seen_at             timestamptz not null default now(),
  created_at               timestamptz not null default now(),
  -- One row per card (not per (user, card) — plaid_account_id is already
  -- globally unique via plaid_accounts.plaid_account_id text uniqueness).
  unique (plaid_account_id)
);

create index if not exists plaid_credit_debts_user_id_idx
  on public.plaid_credit_debts (user_id);
create index if not exists plaid_credit_debts_item_idx
  on public.plaid_credit_debts (plaid_item_id);

-- RLS: read-only for users (writes happen via service-role from
-- plaid-detect-credit-debts). Mirrors plaid_recurring_streams pattern.
alter table public.plaid_credit_debts enable row level security;
drop policy if exists "plaid_credit_debts: user sees own rows" on public.plaid_credit_debts;

create policy "plaid_credit_debts: user sees own rows"
  on public.plaid_credit_debts for select
  using (user_id = auth.uid());
