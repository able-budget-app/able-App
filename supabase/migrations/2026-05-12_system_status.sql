-- System status banner. Single-row table; banner shows when is_active=true.
-- Manual toggle via Supabase SQL editor when Plaid / Stripe / Supabase
-- are degraded. Auto-polling external status pages is out of scope.
--
-- Run once in Supabase SQL Editor. Safe to re-run.

create table if not exists public.system_status (
  id smallint primary key default 1,
  is_active boolean not null default false,
  severity text not null default 'info' check (severity in ('info', 'warn', 'down')),
  message text not null default '',
  updated_at timestamptz not null default now(),
  constraint system_status_single_row check (id = 1)
);

alter table public.system_status enable row level security;

drop policy if exists "anyone can read system status" on public.system_status;
create policy "anyone can read system status" on public.system_status
  for select to anon, authenticated using (true);

insert into public.system_status (id) values (1) on conflict (id) do nothing;

-- ─── How to toggle ───────────────────────────────────────────────────
--
-- Activate a banner:
--   update public.system_status
--   set is_active = true,
--       severity  = 'warn',                                -- 'info' | 'warn' | 'down'
--       message   = 'Plaid is reporting a partial outage. Bank syncs may be delayed.',
--       updated_at = now()
--   where id = 1;
--
-- Clear the banner:
--   update public.system_status set is_active = false, updated_at = now() where id = 1;
--
-- The app fetches this row on load and again every 5 minutes. Users will
-- see the banner within 5 min of toggle without a page refresh.
