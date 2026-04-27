-- ══════════════════════════════════════════════════════════════════════
-- email_sends: prevent concurrent cron runs from sending the same email twice
-- ══════════════════════════════════════════════════════════════════════
-- The application-level sentSince() check in functions/email-cron-daily
-- prevents same-flow duplicates. This index pairs with the claim-first
-- pattern in sendViaResend: each send INSERTs a "sending" row first and
-- only calls Resend if the insert succeeds. The UNIQUE constraint on
-- (user_id, type, sent_day) makes a duplicate claim from a concurrent
-- worker fail with 23505 — that worker bails, no second Resend call.
--
-- Run this in the Supabase SQL editor before repasting the updated
-- email-cron-daily function (the function depends on the constraint).
-- ══════════════════════════════════════════════════════════════════════

-- 1. Generated `sent_day` derived from sent_at (UTC date). Backfills for
--    all existing rows automatically when the column is created.
alter table public.email_sends
  add column if not exists sent_day date
    generated always as ((sent_at at time zone 'UTC')::date) stored;

-- 2. Unique on (user_id, type, sent_day). Blocks a second insert for the
--    same user+type within the same UTC day.
drop index if exists email_sends_user_type_day_uniq;
create unique index email_sends_user_type_day_uniq
  on public.email_sends (user_id, type, sent_day);

-- Notes:
-- - Pre-existing rows: the generated column backfills, but pre-existing
--   duplicate rows for the same (user_id, type, sent_day) will block
--   index creation. If this errors out, run:
--     select user_id, type, sent_day, count(*)
--     from public.email_sends
--     group by user_id, type, sent_day having count(*) > 1;
--   ...and clean up the dupes (keep the row with status='sent', delete
--   any 'error' duplicates) before re-running this script.
-- - If the application ever needs to log multiple same-type sends per day
--   (e.g. system messages, manual resends), use a separate audit table —
--   DO NOT loosen this index.
