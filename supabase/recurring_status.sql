-- P2 #21: Recurring auto-retry. Plaid often returns no recurring streams
-- on a fresh Item (PRODUCT_NOT_READY) and only finishes computing them
-- minutes-to-hours later, signaled via the RECURRING_TRANSACTIONS_UPDATE
-- webhook. The analyzer fallback shipped in commit 21f8500 reduces the
-- urgency, but we still want to refine the plan once Plaid catches up.
--
-- This adds enough state on plaid_items to:
--   1. Track whether recurring streams have ever landed for this item.
--   2. Power a non-intrusive "Your plan can be refined" banner on home
--      when streams arrive after a plan was already drafted.
--   3. Hold poll-attempt counters for a future bounded client poller.
--
-- Run in the Supabase SQL editor before deploying the updated
-- plaid-webhook + plaid-recurring-refresh.

alter table public.plaid_items
  add column if not exists recurring_status text,
  add column if not exists recurring_attempt_count integer not null default 0,
  add column if not exists recurring_last_attempt_at timestamptz,
  add column if not exists recurring_next_attempt_at timestamptz;

-- Default state for existing items: 'unknown' so the cron/poller can
-- decide whether they qualify for a refresh attempt without breaking
-- the (status='pending'|'fresh'|'applied'|'stale') value space below.
update public.plaid_items
   set recurring_status = 'unknown'
 where recurring_status is null;

-- Status semantics:
--   pending   = we've called Plaid but no streams are available yet
--   fresh     = streams landed but the analyzer hasn't refined the plan
--   applied   = the user accepted the refined plan (or auto-merged)
--   stale     = streams haven't refreshed in a long time; refresh-eligible
--   unknown   = pre-existing item, no signal yet
