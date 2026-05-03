-- P2 #14: Web push subscriptions. Each row represents one browser/device
-- that has opted in to receive push notifications from Able. A user can
-- have multiple subscriptions (laptop + phone Chrome + iPad Safari).
--
-- send-push Edge Function looks up all rows for a target user and posts
-- to each subscription's endpoint with VAPID-signed payloads.
--
-- Run in the Supabase SQL editor before deploying send-push.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  -- Track failures so the cron can prune dead subs (Chrome returns 410 Gone
  -- on unsubscribed endpoints).
  failure_count integer not null default 0,
  unique (user_id, endpoint)
);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);

-- RLS: a user can read/insert/delete their own rows. send-push uses
-- service_role and bypasses RLS for the cross-user reads it needs.
alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subs: user sees own"   on public.push_subscriptions;
drop policy if exists "push_subs: user inserts own" on public.push_subscriptions;
drop policy if exists "push_subs: user deletes own" on public.push_subscriptions;

create policy "push_subs: user sees own"
  on public.push_subscriptions for select
  using (user_id = auth.uid());

create policy "push_subs: user inserts own"
  on public.push_subscriptions for insert
  with check (user_id = auth.uid());

create policy "push_subs: user deletes own"
  on public.push_subscriptions for delete
  using (user_id = auth.uid());
