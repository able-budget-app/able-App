-- Extends push_subscriptions for native iOS APNs tokens.
-- Run once in the Supabase SQL editor.
--
-- Schema after migration:
--   platform = 'web' | 'ios' | 'android' (default 'web' for existing rows)
--   For 'web': endpoint = push URL, p256dh + auth = subscription keys
--   For 'ios': endpoint = APNs hex device token, p256dh + auth = NULL
-- Unique (user_id, endpoint) still holds — APNs tokens are device-unique.

alter table public.push_subscriptions
  alter column p256dh drop not null,
  alter column auth   drop not null,
  add column if not exists platform text not null default 'web'
    check (platform in ('web', 'ios', 'android'));

create index if not exists push_subscriptions_platform_idx
  on public.push_subscriptions (user_id, platform);
