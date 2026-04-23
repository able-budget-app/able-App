-- ══════════════════════════════════════════════════════════════════════
-- Able RLS policies
-- ══════════════════════════════════════════════════════════════════════
-- Run this in the Supabase SQL editor.
--
-- Scope: four tables accessed by the browser client with the anon key.
--   - user_data         (PK = user id)            read/write own row
--   - profiles          (PK = user id)            read own row; writes only via service_role
--   - lesson_progress   (user_id, lesson_id)       read/write own rows
--   - coach_messages    (user_id, role, content)   read own rows; writes only via service_role
--
-- The coach-chat Edge Function uses SERVICE_ROLE, which bypasses RLS.
-- So these policies govern the browser client only.
--
-- Idempotent: DROP POLICY IF EXISTS before each CREATE so re-running is safe.
-- ══════════════════════════════════════════════════════════════════════


-- ─── user_data ────────────────────────────────────────────────────────
alter table public.user_data enable row level security;

drop policy if exists "user_data: user sees own row"      on public.user_data;
drop policy if exists "user_data: user inserts own row"   on public.user_data;
drop policy if exists "user_data: user updates own row"   on public.user_data;
drop policy if exists "user_data: user deletes own row"   on public.user_data;

create policy "user_data: user sees own row"
  on public.user_data for select
  using (id = auth.uid());

create policy "user_data: user inserts own row"
  on public.user_data for insert
  with check (id = auth.uid());

create policy "user_data: user updates own row"
  on public.user_data for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "user_data: user deletes own row"
  on public.user_data for delete
  using (id = auth.uid());


-- ─── profiles ─────────────────────────────────────────────────────────
-- Users can read their own profile (subscription_status etc).
-- Writes happen only via Stripe webhook using service_role, which bypasses RLS.
-- So we intentionally do NOT create INSERT/UPDATE policies for the client.
alter table public.profiles enable row level security;

drop policy if exists "profiles: user sees own profile" on public.profiles;

create policy "profiles: user sees own profile"
  on public.profiles for select
  using (id = auth.uid());


-- ─── lesson_progress ──────────────────────────────────────────────────
alter table public.lesson_progress enable row level security;

drop policy if exists "lesson_progress: user sees own rows"    on public.lesson_progress;
drop policy if exists "lesson_progress: user inserts own rows" on public.lesson_progress;
drop policy if exists "lesson_progress: user updates own rows" on public.lesson_progress;
drop policy if exists "lesson_progress: user deletes own rows" on public.lesson_progress;

create policy "lesson_progress: user sees own rows"
  on public.lesson_progress for select
  using (user_id = auth.uid());

create policy "lesson_progress: user inserts own rows"
  on public.lesson_progress for insert
  with check (user_id = auth.uid());

create policy "lesson_progress: user updates own rows"
  on public.lesson_progress for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "lesson_progress: user deletes own rows"
  on public.lesson_progress for delete
  using (user_id = auth.uid());


-- ─── coach_messages ───────────────────────────────────────────────────
-- Client only needs SELECT (to render history). Writes go through the
-- coach-chat Edge Function using service_role, which bypasses RLS.
alter table public.coach_messages enable row level security;

drop policy if exists "coach_messages: user sees own messages" on public.coach_messages;

create policy "coach_messages: user sees own messages"
  on public.coach_messages for select
  using (user_id = auth.uid());


-- ══════════════════════════════════════════════════════════════════════
-- Verification — run these after applying to confirm everything is set
-- ══════════════════════════════════════════════════════════════════════

-- 1. Confirm RLS is enabled on all four tables
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('user_data', 'profiles', 'lesson_progress', 'coach_messages')
order by tablename;

-- 2. List every policy on these tables
select schemaname, tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('user_data', 'profiles', 'lesson_progress', 'coach_messages')
order by tablename, policyname;
