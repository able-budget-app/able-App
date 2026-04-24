# Able edge functions

Source of truth for every edge function that runs on Supabase. The dashboard code editor is read-only in your head — **don't edit there**. Edit here, deploy via CLI.

## Layout

```
supabase/functions/
  _shared/
    cors.ts                 # CORS helpers used by every public function
  create-checkout/
    index.ts
  stripe-webhook/
    index.ts
  create-portal-session/
    index.ts
  send-referral-invite/
    index.ts
  email-cron-daily/
    index.ts
```

## One-time setup

```bash
supabase login
supabase link --project-ref <your-project-ref>
```

## Day-to-day

Edit the function, then:

```bash
scripts/deploy-functions.sh create-checkout
# or to redeploy everything:
scripts/deploy-functions.sh
```

The script runs `deno check` before deploying — this catches syntax errors locally instead of surfacing as a runtime boot failure on Supabase. The 2026-04 outage was caused by a duplicate `const urlOk` that slipped through dashboard editing; `deno check` would have rejected it.

## Local sanity

```bash
deno check supabase/functions/create-checkout/index.ts
```

Or serve locally (requires `supabase start`):

```bash
supabase functions serve create-checkout
```

## Guardrails

- **PR check** — `.github/workflows/functions-check.yml` runs `deno check` on every PR touching `supabase/functions/**`.
- **Health check** — `.github/workflows/functions-healthcheck.yml` pings `create-checkout` every 5 minutes and opens a GitHub issue on 5xx/timeout. Needs two repo secrets: `SUPABASE_URL` and `SUPABASE_ANON_KEY`.

## If something breaks

1. Check Supabase dashboard → Edge Functions → the failing one → **Logs**.
2. Look for `worker boot error` (syntax/type error) vs a regular runtime error.
3. Boot errors mean the deployed code is broken; fix the file, redeploy.
4. Runtime errors mean the code ran but threw; check env vars (Stripe keys, service role key) and the log stack.
