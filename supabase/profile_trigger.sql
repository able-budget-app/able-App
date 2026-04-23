-- ══════════════════════════════════════════════════════════════════════
-- Auto-create a public.profiles row for every new auth.users signup
-- ══════════════════════════════════════════════════════════════════════
-- Context: we removed client-side INSERT policy on public.profiles to
-- prevent a signed-in user from inserting or updating their own
-- subscription_status. Without this trigger, new signups would land in
-- auth.users but never get a matching profiles row.
--
-- security definer: lets the trigger bypass RLS to insert as the table
-- owner. search_path hardening per Supabase recommendation.
-- ══════════════════════════════════════════════════════════════════════

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: make sure every existing auth user has a profile row.
insert into public.profiles (id)
select u.id
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;
