# Deploy youtube-flip-cron

## 1. Create the function in Supabase Dashboard

Functions → Create new function → name: `youtube-flip-cron`

Paste contents of `index.ts`. Click Deploy.

**Important:** in the function's settings, toggle **"Verify JWT"** to **OFF** (gateway-level auth; we use Bearer CRON_SECRET inside the function).

## 2. Set function secrets

Dashboard → Edge Functions → Manage Secrets. Add these 4 new secrets
(existing `CRON_SECRET` and `INTERNAL_FUNCTION_SECRET` already exist):

```
YT_SHEET_ID                  = <copy from local .env>
GOOGLE_OAUTH_CLIENT_ID       = <copy from local .env>
GOOGLE_OAUTH_CLIENT_SECRET   = <copy from local .env>
GOOGLE_OAUTH_REFRESH_TOKEN   = <copy from local .env>
```

> Real values are in `~/Desktop/Able/.env` (gitignored). Do not paste them into committed files.

## 3. Schedule via pg_cron

SQL Editor → run:

```sql
SELECT cron.schedule(
  'youtube-flip-cron',
  '0 11 * * 2,4',                  -- Tue + Thu, 11:00 UTC (= 7am EDT / 6am EST)
  $$
  SELECT net.http_post(
    url := 'https://<your-project-ref>.supabase.co/functions/v1/youtube-flip-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret', true)
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Replace `<your-project-ref>` with the actual ref. (Or just hardcode the
full URL — same format as email-cron-daily uses.)

If `app.settings.cron_secret` isn't a known setting, paste the literal
secret value into the Authorization header instead. Or follow the same
pattern email-cron-daily uses — check `pg_cron` jobs list:

```sql
SELECT jobid, schedule, command FROM cron.job;
```

The existing email-cron-daily job (jobid 3) is the template.

## 4. Smoke test before going live

From your laptop:

```sh
curl -X POST https://<your-project-ref>.supabase.co/functions/v1/youtube-flip-cron \
  -H "x-internal-auth: <value of INTERNAL_FUNCTION_SECRET>" \
  -H "Content-Type: application/json"
```

Should return `{ ok: true, today: '2026-05-20', candidates: 0, flipped: 0 }`
because everything due has already been flipped from the laptop-side
catch-up. (If you want to force a flip to test, manually set
`youtube_privacy` back to `unlisted` on one row, then re-curl.)

## 5. Verify schedule

```sql
SELECT jobid, schedule, command FROM cron.job WHERE jobname = 'youtube-flip-cron';
```
