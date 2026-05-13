# Rotate CRON_SECRET (and retire the leaked legacy service_role JWT)

The `email-cron-daily` function is called by pg_cron once a day. Right now,
the cron job sends the **legacy service_role JWT** as its Bearer token —
which is the same JWT that was exposed in the Claude transcript on 2026-05-11.

The function code already accepts `Bearer ${CRON_SECRET}` (a project env var)
instead — the only thing left is to actually generate one and update the
cron job to use it.

This unblocks the final step: clicking "Disable JWT-based API keys" in the
dashboard, which neutralizes the leaked legacy JWT.

---

## Step 1 — Generate a random CRON_SECRET

In your terminal:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
```

Copy the output. It'll look like: `aB3-X9k...Pq2Z` (64 chars, URL-safe).

Or use openssl if you prefer:

```bash
openssl rand -base64 48 | tr -d '\n='
```

---

## Step 2 — Set CRON_SECRET as a Supabase project secret

1. Open the dashboard: https://supabase.com/dashboard/project/vfnozfvqgevjflwdjlyz/functions/secrets
2. Click **"+ Add new secret"** (or however the UI labels it)
3. Name: `CRON_SECRET`
4. Value: paste the random string from Step 1
5. Save

Verify it's there by refreshing the secrets list.

---

## Step 3 — Update the pg_cron job

The cron job has the legacy JWT hardcoded in its `command` field. We need to
replace it with the new `CRON_SECRET`.

**Important:** there's a known Supabase SQL editor bug where long string
literals get literal `\n` characters inserted at visual wrap points. Use
SQL-side concatenation of short literals to avoid this.

Open the SQL Editor in Supabase Dashboard:
https://supabase.com/dashboard/project/vfnozfvqgevjflwdjlyz/sql/new

First, **inspect the current command** to confirm we're updating the right row:

```sql
SELECT jobid, jobname, schedule, command
FROM cron.job
WHERE jobname = 'email-cron-daily';
```

(Should be jobid 3, schedule daily at 16:00 UTC.)

Then **update the command**. Replace `YOUR_CRON_SECRET_HERE` with the value
from Step 1:

```sql
SELECT cron.alter_job(
  job_id := 3,
  command := 'SELECT net.http_post(' ||
             'url := ''https://vfnozfvqgevjflwdjlyz.supabase.co/functions/v1/email-cron-daily'', ' ||
             'headers := ''{"Content-Type": "application/json", "Authorization": "Bearer ' ||
             'YOUR_CRON_SECRET_HERE' ||
             '"}''::jsonb' ||
             ');'
);
```

The `||` concatenation keeps each literal short enough to avoid the editor's
newline-injection bug.

**Verify** by re-running the SELECT from above. The new command should show
the CRON_SECRET value, NOT the long `eyJhbGciOiJIUzI1NiIs...` JWT.

---

## Step 4 — Test the cron path manually

Before waiting for the 16:00 UTC fire, test that the new secret works:

```bash
CRON_SECRET="YOUR_CRON_SECRET_HERE"
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -d '{"force": true, "dry_run": true}' \
  "https://vfnozfvqgevjflwdjlyz.supabase.co/functions/v1/email-cron-daily"
```

Expected: a 200 response with email-dispatch results. NOT a 401.

You can also use the existing helper: `./scripts/test-email-trigger.sh` (it
uses INTERNAL_FUNCTION_SECRET, not CRON_SECRET, so it's a backstop that
tests function logic without exercising the cron auth path).

---

## Step 5 — Once everything works, retire the leaked legacy JWT

After Steps 1-4 are green AND all 29 functions have been pasted (use
`./scripts/paste-functions.sh`):

1. Open: https://supabase.com/dashboard/project/vfnozfvqgevjflwdjlyz/settings/api-keys/legacy
2. Click **"Disable JWT-based API keys"**
3. Confirm the prompt

The leaked legacy service_role JWT now returns 401 on every call. The new
`sb_secret_*` key is the only path that resolves.

**Final test:** open the app in a private window, sign in, link Plaid,
check the Bills page, send a Coach message. Everything should work
identically. If it does, you're done — P0-2026-05-11 #1 is closed.

---

## What to do if something breaks

- **Cron starts 401'ing at 16:00 UTC the next day:** the cron row update
  didn't take. Re-run the SELECT from Step 3 and confirm the `Authorization`
  header in the command field uses the new CRON_SECRET value.

- **Functions 500 after pasting:** the new env var `SUPABASE_SECRET_KEYS`
  might not have a `.default` field. Check
  `Settings → Edge Functions → Secrets` and confirm the secret exists with
  that exact JSON shape: `{"default": "sb_secret_..."}`. The functions'
  `_getServiceKey()` helper falls back to the legacy env, so they should
  still work UNTIL Step 5.

- **App breaks after Step 5 (Disable JWT):** revert by visiting the same
  legacy page and clicking "Enable JWT-based API keys" (if available).
  If not, contact Supabase support — the new key path should keep working,
  so this would indicate a function that still has a hardcoded JWT
  somewhere. Check `git log -p --all -G 'eyJhbGci'` for any remaining
  hardcoded references.
