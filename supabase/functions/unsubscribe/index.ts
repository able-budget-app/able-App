// Public Edge Function — accessed via GET from links inside marketing emails.
// Deploy with "Verify JWT" toggled OFF.
//
// Contract:
//   GET /functions/v1/unsubscribe?token=<unsubscribe_token>
//   GET /functions/v1/unsubscribe?token=<unsubscribe_token>&type=<pref_key>
//
// Without `type`, all marketing prefs are flipped to false (one-click full unsub).
// With `type`, only that single pref is flipped (granular per-email-link unsub).
// Always returns HTML, never JSON — these URLs render in browsers.

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APP_URL = (Deno.env.get('APP_URL') || 'https://becomeable.app').trim().replace(/\/$/, '');

const PREF_KEYS = ['dormancy', 'weekly', 'bill_reminder', 'low_buffer', 'monthly_wrap'] as const;
type PrefKey = typeof PREF_KEYS[number];
const ALL_OFF: Record<PrefKey, false> = {
  dormancy: false, weekly: false, bill_reminder: false, low_buffer: false, monthly_wrap: false,
};

const PREF_LABELS: Record<PrefKey, string> = {
  dormancy: 'check-in nudges',
  weekly: 'the weekly summary',
  bill_reminder: 'bill-due reminders',
  low_buffer: 'low-buffer alerts',
  monthly_wrap: 'the monthly wrap',
};

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const token = (url.searchParams.get('token') ?? '').trim();
  const typeParam = (url.searchParams.get('type') ?? '').trim();
  const isSingleType = (PREF_KEYS as readonly string[]).includes(typeParam);

  if (!token) return html(invalidPage(), 400);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data, error } = await admin
    .from('user_data')
    .select('id, email_prefs')
    .eq('unsubscribe_token', token)
    .maybeSingle();

  if (error || !data) return html(invalidPage(), 404);

  const current = (data.email_prefs as Record<string, unknown>) ?? {};
  const next = isSingleType
    ? { ...current, [typeParam]: false }
    : { ...current, ...ALL_OFF };

  const upd = await admin.from('user_data').update({ email_prefs: next }).eq('id', data.id);
  if (upd.error) return html(errorPage(), 500);

  return html(successPage(isSingleType ? (typeParam as PrefKey) : null));
});

// ─── HTML helpers ────────────────────────────────────────────────────────

function html(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

const LOGO_UNDERLINE = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 4.2' preserveAspectRatio='none'><path d='M3 2.6 Q2 2.4 3 2.15 Q58 1.75 115 0.15 Q119 1 119 2 Q119 3 115 3.9 Q58 3.55 3 2.65 Q2 2.45 3 2.6 Z' fill='%232a7a4a'/></svg>`;

function shell(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${title} · Able</title>
<style>
  body{margin:0;padding:0;background:#f0f7f2;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;color:#111c16;-webkit-font-smoothing:antialiased;}
  .wrap{max-width:520px;margin:0 auto;padding:36px 16px 32px;}
  .logo{text-align:center;margin-bottom:22px;}
  .logo .name{font-weight:900;font-size:30px;letter-spacing:-.03em;color:#111c16;line-height:1;}
  .logo img{display:block;margin:4px auto 0;width:80px;height:6px;border:0;}
  .logo .eyebrow{margin-top:12px;font-size:11px;color:#2a7a4a;font-weight:800;letter-spacing:.18em;text-transform:uppercase;}
  .card{background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 2px 12px rgba(42,122,74,.08);}
  .stripe{height:4px;background:#2a7a4a;background-image:linear-gradient(90deg,#2a7a4a,#3d9e78);}
  .pad{padding:28px 24px;}
  h1{font-size:24px;font-weight:900;letter-spacing:-.03em;line-height:1.15;margin:0 0 12px;color:#111c16;}
  p{font-size:15px;line-height:1.6;color:#4a5c52;font-weight:500;margin:0 0 12px;}
  a.btn{display:inline-block;background:#2a7a4a;color:#ffffff;padding:14px 28px;border-radius:14px;font-weight:800;text-decoration:none;font-size:15px;margin-top:18px;letter-spacing:-.01em;box-shadow:0 4px 16px rgba(42,122,74,.3);}
  a.link{color:#2a7a4a;font-weight:700;text-decoration:none;}
  .foot{margin-top:20px;text-align:center;font-size:12px;color:#8ca898;line-height:1.6;}
  .foot a{color:#2a7a4a;font-weight:700;text-decoration:none;}
</style>
</head><body>
<div class="wrap">
  <div class="logo">
    <div class="name">Able</div>
    <img src="${LOGO_UNDERLINE}" alt="">
    <div class="eyebrow">Built for inconsistent income</div>
  </div>
  <div class="card">
    <div class="stripe"></div>
    <div class="pad">${body}</div>
  </div>
  <div class="foot"><a href="${APP_URL}/app.html">Open Able</a><div style="margin-top:8px;font-size:11px;color:#a8baad;">becomeable.app</div></div>
</div>
</body></html>`;
}

function successPage(singleType: PrefKey | null): string {
  if (singleType) {
    return shell('Updated', `
      <h1>You're off ${PREF_LABELS[singleType]}.</h1>
      <p>You'll still receive other email types from Able. Manage every preference inside the app under Settings &rsaquo; Email reminders.</p>
      <a class="btn" href="${APP_URL}/app.html">Open Able</a>
    `);
  }
  return shell('Unsubscribed', `
    <h1>You're unsubscribed.</h1>
    <p>You won't receive marketing or reminder emails from Able anymore. Account-related notices (receipts, password resets) still go out — those aren't optional.</p>
    <p>Changed your mind? Re-enable any email type anytime under Settings &rsaquo; Email reminders.</p>
    <a class="btn" href="${APP_URL}/app.html">Open Able</a>
  `);
}

function invalidPage(): string {
  return shell('Link not valid', `
    <h1>This unsubscribe link isn't valid.</h1>
    <p>The link may have expired or been mistyped. To stop emails, sign in and turn off notifications under Settings &rsaquo; Email reminders, or reply to any Able email and we'll handle it manually.</p>
    <a class="btn" href="${APP_URL}/app.html">Open Able</a>
  `);
}

function errorPage(): string {
  return shell('Something went wrong', `
    <h1>Something went wrong.</h1>
    <p>We couldn't update your preferences right now. Reply to any Able email or sign in and turn off notifications under Settings &rsaquo; Email reminders, and we'll make sure it's handled.</p>
    <a class="btn" href="${APP_URL}/app.html">Open Able</a>
  `);
}
