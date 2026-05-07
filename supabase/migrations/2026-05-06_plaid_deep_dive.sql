-- Records when the post-onboarding deep-dive completed for a Plaid item.
--
-- Why: the onboarding pipeline classifies up to 2500 transactions for fast
-- time-to-first-plan. Anything beyond that sits with `able_category: null`
-- forever, so `plaid-detect-recurring` runs against a partial picture.
-- The deep-dive runs server-side after onboarding completes: classifies the
-- remainder, re-detects recurring streams, re-runs credit-debt detection,
-- and appends new bills/sources/debts as `pending_review` so the user sees
-- "we found more." It NEVER touches existing rows — strictly append-only,
-- and never re-runs the LLM analyzer (no Sonnet cost; only Haiku classify).
--
-- This column is the idempotency guard. The deep-dive checks it and no-ops
-- if already set, so reloads / app reopens / re-onboards can't double-fire.
--
-- Idempotent: safe to re-run.

alter table public.plaid_items
  add column if not exists deep_dive_completed_at timestamptz;

alter table public.plaid_items
  add column if not exists deep_dive_summary jsonb;

-- deep_dive_summary shape:
--   {
--     "new_bills": <int>,
--     "new_debts": <int>,
--     "new_sources": <int>,
--     "dormant_bills": <int>,
--     "classified_remaining": <int>,    -- how many txns the deep classify ate through
--     "ran_at": "<iso timestamp>"
--   }
-- Used by the email summary + the in-app "what we found" banner so we can
-- render the totals without recomputing from scratch.

create index if not exists plaid_items_deep_dive_pending_idx
  on public.plaid_items (user_id)
  where deep_dive_completed_at is null;
