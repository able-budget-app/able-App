-- ══════════════════════════════════════════════════════════════════════
-- Able Plaid + Analyzer schema
-- ══════════════════════════════════════════════════════════════════════
-- Run this in the Supabase SQL editor after `rls_policies.sql` is in place.
--
-- Five tables:
--   plaid_items              one row per linked institution
--   plaid_accounts           accounts inside an item (checking, savings, CC)
--   plaid_transactions       raw Plaid txn + Able classification
--   plaid_recurring_streams  cached output of /transactions/recurring/get
--   analyzer_plans           Floor-First plan proposals + lifecycle status
--
-- All tables are per-user. Browser uses anon key (RLS-scoped).
-- Edge functions use SERVICE_ROLE (bypasses RLS).
--
-- Idempotent: safe to re-run. Uses CREATE TABLE IF NOT EXISTS.
-- ══════════════════════════════════════════════════════════════════════


-- ─── plaid_items ──────────────────────────────────────────────────────
-- One per institution the user has linked.
-- access_token is what we use to call Plaid on behalf of the user.
-- transactions_cursor is the /transactions/sync pagination state.
create table if not exists public.plaid_items (
  id                            uuid primary key default gen_random_uuid(),
  user_id                       uuid not null references auth.users(id) on delete cascade,
  plaid_item_id                 text not null unique,
  access_token                  text not null,
  institution_id                text,
  institution_name              text,
  transactions_cursor           text,
  status                        text not null default 'active'
                                  check (status in ('active','error','pending_expiration','pending_disconnect','revoked')),
  error_code                    text,
  error_message                 text,
  consent_expiration_at         timestamptz,
  last_sync_at                  timestamptz,
  last_recurring_refresh_at     timestamptz,
  last_webhook_at               timestamptz,
  initial_sync_complete         boolean not null default false,
  historical_sync_complete      boolean not null default false,
  lookback_months               integer not null default 6
                                  check (lookback_months in (6,12,24)),
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now()
);

create index if not exists plaid_items_user_id_idx on public.plaid_items (user_id);


-- ─── plaid_accounts ───────────────────────────────────────────────────
-- Accounts inside a plaid_item. Checking, savings, credit cards.
-- current_balance / available_balance are CACHED values from /accounts/get.
-- Per D1.8: no on-demand /accounts/balance/get calls in v1. These refresh
-- only when SYNC_UPDATES_AVAILABLE webhook fires.
create table if not exists public.plaid_accounts (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users(id) on delete cascade,
  plaid_item_id            uuid not null references public.plaid_items(id) on delete cascade,
  plaid_account_id         text not null unique,
  name                     text,
  official_name            text,
  mask                     text,
  type                     text,
  subtype                  text,
  current_balance          numeric,
  available_balance        numeric,
  iso_currency_code        text default 'USD',
  last_balance_at          timestamptz,
  is_primary_spending      boolean not null default false,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists plaid_accounts_user_id_idx on public.plaid_accounts (user_id);
create index if not exists plaid_accounts_item_idx on public.plaid_accounts (plaid_item_id);


-- ─── plaid_transactions ──────────────────────────────────────────────
-- Raw Plaid transactions + Able's overlay classification.
-- Plaid sign convention: amount > 0 means outflow (money left the account).
-- Able classification populated by plaid-recategorize edge function.
create table if not exists public.plaid_transactions (
  id                                       uuid primary key default gen_random_uuid(),
  user_id                                  uuid not null references auth.users(id) on delete cascade,
  plaid_account_id                         uuid not null references public.plaid_accounts(id) on delete cascade,
  plaid_transaction_id                     text not null unique,
  name                                     text,
  merchant_name                            text,
  amount                                   numeric not null,
  iso_currency_code                        text default 'USD',
  date                                     date not null,
  authorized_date                          date,
  pending                                  boolean not null default false,
  personal_finance_category_primary        text,
  personal_finance_category_detailed       text,
  personal_finance_category_confidence     text,
  -- Able overlay
  able_category                            text
                                             check (able_category in ('income','bill','debt_payment','tax_payment','transfer','discretionary')),
  able_label                               text,
  able_confidence                          numeric,
  able_is_recurring_likely                 boolean,
  able_classified_at                       timestamptz,
  -- Linked Able artifacts (populated when user accepts an Analyzer plan
  -- or manually links a transaction to a bill/debt/income source).
  linked_bill_id                           text,
  linked_debt_id                           text,
  linked_income_source_id                  text,
  created_at                               timestamptz not null default now(),
  updated_at                               timestamptz not null default now()
);

create index if not exists plaid_transactions_user_date_idx
  on public.plaid_transactions (user_id, date desc);
create index if not exists plaid_transactions_account_idx
  on public.plaid_transactions (plaid_account_id);
create index if not exists plaid_transactions_unclassified_idx
  on public.plaid_transactions (user_id) where able_category is null;


-- ─── plaid_recurring_streams ─────────────────────────────────────────
-- Cached output of /transactions/recurring/get. The Analyzer reads this.
create table if not exists public.plaid_recurring_streams (
  id                            uuid primary key default gen_random_uuid(),
  user_id                       uuid not null references auth.users(id) on delete cascade,
  plaid_item_id                 uuid not null references public.plaid_items(id) on delete cascade,
  stream_id                     text not null,
  direction                     text not null check (direction in ('inflow','outflow')),
  merchant_name                 text,
  description                   text,
  personal_finance_category_detailed text,
  frequency                     text
                                  check (frequency in ('WEEKLY','BIWEEKLY','SEMI_MONTHLY','MONTHLY','ANNUALLY','UNKNOWN')),
  status                        text
                                  check (status in ('MATURE','EARLY_DETECTION','TOMBSTONED','UNKNOWN')),
  is_active                     boolean,
  is_user_modified              boolean,
  average_amount                numeric,
  last_amount                   numeric,
  iso_currency_code             text default 'USD',
  predicted_next_date           date,
  first_date                    date,
  last_date                     date,
  last_user_modified_at         timestamptz,
  transaction_ids               text[],
  last_refreshed_at             timestamptz not null default now(),
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now(),
  unique (plaid_item_id, stream_id)
);

create index if not exists plaid_recurring_streams_user_idx
  on public.plaid_recurring_streams (user_id);
create index if not exists plaid_recurring_streams_active_idx
  on public.plaid_recurring_streams (user_id, direction, is_active);


-- ─── analyzer_plans ──────────────────────────────────────────────────
-- Floor-First plan proposals from plaid-analyze. Lifecycle:
--   pending          plan generated, awaiting Coach presentation
--   presenting       Coach is walking the user through it now
--   accepted         user said yes to the whole thing
--   partially_applied  user accepted some sections, rejected/edited others
--   fully_applied    all accepted sections have been written into the app
--   rejected         user said no to everything
--   superseded       a newer plan was generated (after a re-sync etc.)
--
-- plaid_item_id is nullable on delete: if the user disconnects the item,
-- the historical plan stays as a record.
create table if not exists public.analyzer_plans (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  plaid_item_id       uuid references public.plaid_items(id) on delete set null,
  lookback_months     integer not null check (lookback_months in (6,12,24)),
  plan_json           jsonb not null,
  coach_summary       text,
  status              text not null default 'pending'
                        check (status in ('pending','presenting','accepted','partially_applied','fully_applied','rejected','superseded')),
  presented_at        timestamptz,
  accepted_at         timestamptz,
  applied_at          timestamptz,
  rejected_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists analyzer_plans_user_idx on public.analyzer_plans (user_id);
create index if not exists analyzer_plans_pending_idx
  on public.analyzer_plans (user_id) where status in ('pending','presenting');


-- ─── updated_at triggers ─────────────────────────────────────────────
-- Keep updated_at fresh on every UPDATE.
create or replace function public.touch_updated_at()
  returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists plaid_items_touch_updated_at on public.plaid_items;
create trigger plaid_items_touch_updated_at
  before update on public.plaid_items
  for each row execute function public.touch_updated_at();

drop trigger if exists plaid_accounts_touch_updated_at on public.plaid_accounts;
create trigger plaid_accounts_touch_updated_at
  before update on public.plaid_accounts
  for each row execute function public.touch_updated_at();

drop trigger if exists plaid_transactions_touch_updated_at on public.plaid_transactions;
create trigger plaid_transactions_touch_updated_at
  before update on public.plaid_transactions
  for each row execute function public.touch_updated_at();

drop trigger if exists plaid_recurring_streams_touch_updated_at on public.plaid_recurring_streams;
create trigger plaid_recurring_streams_touch_updated_at
  before update on public.plaid_recurring_streams
  for each row execute function public.touch_updated_at();

drop trigger if exists analyzer_plans_touch_updated_at on public.analyzer_plans;
create trigger analyzer_plans_touch_updated_at
  before update on public.analyzer_plans
  for each row execute function public.touch_updated_at();


-- ═══════════════════════════════════════════════════════════════════════
-- RLS policies
-- ═══════════════════════════════════════════════════════════════════════
-- Browser reads its own data. Writes go through edge functions on
-- service_role, which bypasses RLS. So we grant SELECT to the user, and
-- only minimal write paths (mostly nothing — Plaid data flow is one-way
-- from edge to DB to client).
-- ═══════════════════════════════════════════════════════════════════════

-- ─── plaid_items ──────────────────────────────────────────────────────
alter table public.plaid_items enable row level security;
drop policy if exists "plaid_items: user sees own rows" on public.plaid_items;
create policy "plaid_items: user sees own rows"
  on public.plaid_items for select
  using (user_id = auth.uid());


-- ─── plaid_accounts ───────────────────────────────────────────────────
-- Allow update on is_primary_spending so the user can mark their main
-- spending account from the UI without round-tripping through an edge
-- function. All other writes go through service_role.
alter table public.plaid_accounts enable row level security;
drop policy if exists "plaid_accounts: user sees own rows" on public.plaid_accounts;
drop policy if exists "plaid_accounts: user updates is_primary"
  on public.plaid_accounts;

create policy "plaid_accounts: user sees own rows"
  on public.plaid_accounts for select
  using (user_id = auth.uid());

create policy "plaid_accounts: user updates is_primary"
  on public.plaid_accounts for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());


-- ─── plaid_transactions ──────────────────────────────────────────────
-- Allow user to update their own classification overrides (able_category,
-- able_label, linked_bill_id, etc). All other fields written by edge fn.
alter table public.plaid_transactions enable row level security;
drop policy if exists "plaid_transactions: user sees own rows" on public.plaid_transactions;
drop policy if exists "plaid_transactions: user updates own overrides" on public.plaid_transactions;

create policy "plaid_transactions: user sees own rows"
  on public.plaid_transactions for select
  using (user_id = auth.uid());

create policy "plaid_transactions: user updates own overrides"
  on public.plaid_transactions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());


-- ─── plaid_recurring_streams ─────────────────────────────────────────
-- Read-only from the browser. Writes via edge function.
alter table public.plaid_recurring_streams enable row level security;
drop policy if exists "plaid_recurring_streams: user sees own rows"
  on public.plaid_recurring_streams;

create policy "plaid_recurring_streams: user sees own rows"
  on public.plaid_recurring_streams for select
  using (user_id = auth.uid());


-- ─── analyzer_plans ──────────────────────────────────────────────────
-- Browser reads. Status transitions (accept/reject) go through edge
-- functions so they can apply downstream effects atomically.
alter table public.analyzer_plans enable row level security;
drop policy if exists "analyzer_plans: user sees own rows" on public.analyzer_plans;

create policy "analyzer_plans: user sees own rows"
  on public.analyzer_plans for select
  using (user_id = auth.uid());
