-- Adds email_status to user_data so resend-webhook can flag hard-bounced
-- and complained recipients, and email-cron-daily can stop pinging them.
--
-- Run in the Supabase SQL editor before deploying resend-webhook + the
-- updated email-cron-daily.

alter table public.user_data
  add column if not exists email_status text,
  add column if not exists email_status_updated_at timestamptz;

-- Default to 'active' for any existing row that doesn't already have a status.
update public.user_data
   set email_status = 'active'
 where email_status is null;

-- Index for the cron's "skip non-active" filter. Cheap, low cardinality
-- (most users will be 'active', some 'bounced' or 'complained').
create index if not exists user_data_email_status_idx
  on public.user_data (email_status);
