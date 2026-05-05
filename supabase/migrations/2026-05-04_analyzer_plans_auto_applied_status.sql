-- Add 'auto_applied' to analyzer_plans.status CHECK constraint.
--
-- Why: analyzer-apply-plan with pending_review:true sets status to
-- 'auto_applied', but the original CHECK constraint omitted that value.
-- Postgres rejected every auto-apply update silently (Supabase JS client
-- returns the error in the response object instead of throwing, and the
-- function wasn't checking it). Plan status stayed 'pending' on every
-- onboarding run; user_data writes still succeeded so the symptom was
-- just "REVIEW pills don't behave like they should + plan never marked
-- as applied."
--
-- Run in Supabase SQL Editor (one-shot — safe to re-run, idempotent).

alter table public.analyzer_plans
  drop constraint if exists analyzer_plans_status_check;

alter table public.analyzer_plans
  add constraint analyzer_plans_status_check
  check (status in (
    'pending',
    'presenting',
    'accepted',
    'auto_applied',
    'partially_applied',
    'fully_applied',
    'rejected',
    'superseded'
  ));
