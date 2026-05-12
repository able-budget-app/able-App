// Daily operator digest -> Paul's inbox. Counts last 24h: signups, trials,
// conversions, Plaid items, errors (via PostHog API if POSTHOG_API_KEY is set).
// Triggered by pg_cron. Mirrors email-cron-daily's CRON_SECRET auth pattern.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;

function _getServiceKey(): string {
  const newKeys = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (newKeys) {
    try {
      const parsed = JSON.parse(newKeys);
      if (parsed && typeof parsed.default === 'string') return parsed.default;
    } catch { /* fall through */ }
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
}
const SERVICE_ROLE = _getServiceKey();

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const CRON_SECRET = Deno.env.get('CRON_SECRET')!;
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'Able <hello@becomeable.app>';
const DIGEST_TO = Deno.env.get('OPERATOR_DIGEST_TO') || 'hello@becomeable.app';
const POSTHOG_API_KEY = Deno.env.get('POSTHOG_API_KEY') ?? '';
const POSTHOG_PROJECT_ID = Deno.env.get('POSTHOG_PROJECT_ID') ?? '';
const POSTHOG_HOST = Deno.env.get('POSTHOG_HOST') || 'https://us.posthog.com';

const sbHeaders = {
  Authorization: `Bearer ${SERVICE_ROLE}`,
  apikey: SERVICE_ROLE,
  'Content-Type': 'application/json',
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('POST only', { status: 405 });
  const auth = req.headers.get('Authorization') ?? '';
  if (auth !== `Bearer ${CRON_SECRET}`) return new Response('Unauthorized', { status: 401 });

  try {
    const now = new Date();
    const since = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();

    const [signups, trialing, active, plaidItems, errors, activeToday] = await Promise.all([
      _countAuthUsers(since),
      _countProfilesByStatus('trialing'),
      _countProfilesByStatus('active'),
      _countTable('plaid_items', since),
      _topErrors(),
      _countTable('user_data', since, 'last_active'),
    ]);

    const totalUsers = await _countAuthUsersAll();

    const subject = `Able digest · ${signups} new · ${active} active`;
    const html = _buildEmail({
      now,
      signups,
      trialing,
      active,
      totalUsers,
      plaidItems,
      activeToday,
      errors,
    });

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM_EMAIL, to: DIGEST_TO, subject, html }),
    });
    if (!resendRes.ok) {
      const body = await resendRes.text();
      console.error('Resend send failed:', resendRes.status, body);
      return new Response(JSON.stringify({ error: 'resend_failed', status: resendRes.status }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ ok: true, signups, trialing, active }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('operator-digest-daily error:', e);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

async function _countAuthUsers(sinceIso: string): Promise<number> {
  // No created_at filter on auth.admin.listUsers - paginate and count manually.
  // Volume is low; one page (perPage=1000) is enough until we cross ~1k users.
  const url = `${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`;
  const res = await fetch(url, { headers: sbHeaders });
  if (!res.ok) return 0;
  const json = await res.json().catch(() => ({}));
  const users = Array.isArray(json?.users) ? json.users : [];
  return users.filter((u: any) => u?.created_at && u.created_at >= sinceIso).length;
}

async function _countAuthUsersAll(): Promise<number> {
  const url = `${SUPABASE_URL}/auth/v1/admin/users?per_page=1`;
  const res = await fetch(url, { headers: sbHeaders });
  if (!res.ok) return 0;
  // Supabase returns `total` in some versions; fall back to user count if absent.
  const total = res.headers.get('X-Total-Count');
  if (total) return Number(total) || 0;
  const json = await res.json().catch(() => ({}));
  return Number(json?.total) || (Array.isArray(json?.users) ? json.users.length : 0);
}

async function _countProfilesByStatus(status: string): Promise<number> {
  const url = `${SUPABASE_URL}/rest/v1/profiles?subscription_status=eq.${status}&select=id`;
  const res = await fetch(url, { headers: { ...sbHeaders, Prefer: 'count=exact', Range: '0-0' } });
  if (!res.ok) return 0;
  const range = res.headers.get('Content-Range') || '';
  const total = range.split('/').pop();
  return Number(total) || 0;
}

async function _countTable(table: string, sinceIso: string, column = 'created_at'): Promise<number> {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${column}=gte.${encodeURIComponent(sinceIso)}&select=id`;
  const res = await fetch(url, { headers: { ...sbHeaders, Prefer: 'count=exact', Range: '0-0' } });
  if (!res.ok) return 0;
  const range = res.headers.get('Content-Range') || '';
  const total = range.split('/').pop();
  return Number(total) || 0;
}

interface ErrorRow { name: string; count: number; }
async function _topErrors(): Promise<{ rows: ErrorRow[]; available: boolean }> {
  if (!POSTHOG_API_KEY || !POSTHOG_PROJECT_ID) {
    return { rows: [], available: false };
  }
  // HogQL: top 10 $exception events in last 24h, grouped by message.
  const query = `SELECT properties.$exception_message AS name, count() AS c
    FROM events
    WHERE event = '$exception' AND timestamp > now() - INTERVAL 24 HOUR
    GROUP BY name
    ORDER BY c DESC
    LIMIT 10`;
  const url = `${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query/`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${POSTHOG_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
  });
  if (!res.ok) {
    console.warn('PostHog query failed:', res.status, await res.text().catch(() => ''));
    return { rows: [], available: false };
  }
  const json = await res.json().catch(() => ({}));
  const results = Array.isArray(json?.results) ? json.results : [];
  const rows: ErrorRow[] = results.map((r: any) => ({
    name: String(r?.[0] ?? 'unknown'),
    count: Number(r?.[1] ?? 0),
  }));
  return { rows, available: true };
}

function _escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function _buildEmail(p: {
  now: Date;
  signups: number;
  trialing: number;
  active: number;
  totalUsers: number;
  plaidItems: number;
  activeToday: number;
  errors: { rows: ErrorRow[]; available: boolean };
}): string {
  const date = p.now.toISOString().slice(0, 10);
  const statsRow = (label: string, value: string | number, sub = '') => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #e8efe9;">
        <div style="font-size:12px;color:#557064;font-weight:700;text-transform:uppercase;letter-spacing:.06em;">${_escapeHtml(label)}</div>
        ${sub ? `<div style="font-size:11px;color:#8ca898;font-weight:600;margin-top:2px;">${_escapeHtml(sub)}</div>` : ''}
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #e8efe9;text-align:right;font-size:20px;font-weight:900;color:#111c16;letter-spacing:-.01em;">${_escapeHtml(String(value))}</td>
    </tr>`;

  let errorsHtml = '';
  if (!p.errors.available) {
    errorsHtml = `<div style="font-size:12px;color:#8ca898;font-weight:600;line-height:1.6;">Set POSTHOG_API_KEY + POSTHOG_PROJECT_ID env to surface error counts here.</div>`;
  } else if (p.errors.rows.length === 0) {
    errorsHtml = `<div style="font-size:13px;color:#2a7a4a;font-weight:700;">No exceptions captured in the last 24h. </div>`;
  } else {
    errorsHtml = p.errors.rows.map(r => `
      <div style="display:flex;justify-content:space-between;gap:14px;padding:8px 0;border-bottom:1px solid #f0f4f1;">
        <div style="font-size:12px;color:#111c16;font-weight:600;line-height:1.4;flex:1;word-break:break-word;">${_escapeHtml(r.name)}</div>
        <div style="font-size:13px;color:#557064;font-weight:800;white-space:nowrap;">${r.count}</div>
      </div>`).join('');
  }

  return `<!doctype html><html><body style="margin:0;padding:0;background:#f0f7f2;font-family:Helvetica,Arial,sans-serif;color:#111c16;">
<div style="max-width:560px;margin:0 auto;padding:28px 24px;">
  <div style="font-weight:900;font-size:18px;letter-spacing:-.02em;color:#2a7a4a;margin-bottom:6px;">Able · daily digest</div>
  <div style="font-size:12px;color:#557064;font-weight:600;margin-bottom:20px;">${date}</div>
  <div style="background:#ffffff;border-radius:14px;padding:20px 24px;box-shadow:0 2px 8px rgba(0,0,0,.05);">
    <div style="font-size:13px;font-weight:800;color:#111c16;margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em;">Last 24 hours</div>
    <table style="width:100%;border-collapse:collapse;">
      ${statsRow('New signups', p.signups)}
      ${statsRow('Plaid items connected', p.plaidItems)}
      ${statsRow('Active users', p.activeToday, 'user_data.last_active in last 24h')}
    </table>
  </div>
  <div style="background:#ffffff;border-radius:14px;padding:20px 24px;box-shadow:0 2px 8px rgba(0,0,0,.05);margin-top:14px;">
    <div style="font-size:13px;font-weight:800;color:#111c16;margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em;">Right now</div>
    <table style="width:100%;border-collapse:collapse;">
      ${statsRow('Trialing', p.trialing)}
      ${statsRow('Paid (active)', p.active)}
      ${statsRow('Total users', p.totalUsers)}
    </table>
  </div>
  <div style="background:#ffffff;border-radius:14px;padding:20px 24px;box-shadow:0 2px 8px rgba(0,0,0,.05);margin-top:14px;">
    <div style="font-size:13px;font-weight:800;color:#111c16;margin-bottom:12px;text-transform:uppercase;letter-spacing:.05em;">Errors (top 10, last 24h)</div>
    ${errorsHtml}
  </div>
  <div style="text-align:center;margin-top:16px;font-size:11px;color:#8ca898;font-weight:600;line-height:1.6;">Sent by operator-digest-daily. Adjust the cron in Supabase if 7am PT isn't right.</div>
</div>
</body></html>`;
}
