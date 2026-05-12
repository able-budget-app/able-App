import { createClient } from 'npm:@supabase/supabase-js@2'

const _ALLOWED_ORIGINS = new Set([
  'https://becomeable.app',
  'https://www.becomeable.app',
])
function _allowOrigin(origin: string | null): string {
  if (!origin) return 'https://becomeable.app'
  if (_ALLOWED_ORIGINS.has(origin)) return origin
  if (/^https:\/\/deploy-preview-\d+--becomeable\.netlify\.app$/.test(origin)) return origin
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin
  return 'https://becomeable.app'
}
function corsHeaders(req: Request) {
  return {
    'Access-Control-Allow-Origin': _allowOrigin(req.headers.get('Origin')),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

function _getServiceKey(): string {
  const newKeys = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (newKeys) {
    try {
      const parsed = JSON.parse(newKeys)
      if (parsed && typeof parsed.default === 'string') return parsed.default
    } catch { /* fall through to legacy */ }
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
}

// In-memory rate limit. Isolates may recycle, which only relaxes the limit -
// acceptable for a low-volume feedback surface.
const RATE_LIMIT_PER_MIN = 3
const _rateState = new Map<string, number[]>()
function _rateLimited(userId: string): boolean {
  const now = Date.now()
  const windowStart = now - 60_000
  const arr = (_rateState.get(userId) || []).filter(t => t > windowStart)
  if (arr.length >= RATE_LIMIT_PER_MIN) return true
  arr.push(now)
  _rateState.set(userId, arr)
  return false
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return json(req, { error: 'POST only' }, 405)

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_ROLE = _getServiceKey()
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
    const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'Able <hello@becomeable.app>'
    const SUPPORT_EMAIL = Deno.env.get('SUPPORT_EMAIL') || 'hello@becomeable.app'

    const userClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userRes, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userRes.user) return json(req, { error: 'Unauthorized' }, 401)
    const userId = userRes.user.id
    const userEmail = (userRes.user.email ?? '').toLowerCase()

    if (_rateLimited(userId)) {
      return json(req, { error: 'Too many submissions. Try again in a minute.' }, 429)
    }

    const body = await req.json().catch(() => ({}))
    const message = String(body.message ?? '').trim()
    const pageUrl = String(body.page_url ?? '').slice(0, 500)
    const viewport = String(body.viewport ?? '').slice(0, 50)
    const userAgent = String(body.user_agent ?? '').slice(0, 500)

    if (!message || message.length < 5) {
      return json(req, { error: 'Please tell us a bit more.' }, 400)
    }
    if (message.length > 5000) {
      return json(req, { error: 'Message is too long (5000 char limit).' }, 400)
    }

    const safeMessage = _escapeHtml(message)
    const safePageUrl = _escapeHtml(pageUrl)
    const safeViewport = _escapeHtml(viewport)
    const safeUserAgent = _escapeHtml(userAgent)
    const safeEmail = _escapeHtml(userEmail)
    const safeUserId = _escapeHtml(userId)
    const snippet = message.slice(0, 60).replace(/\n+/g, ' ')

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: SUPPORT_EMAIL,
        reply_to: userEmail || undefined,
        subject: `[Able feedback] ${snippet}`,
        html: _buildFeedbackEmail({
          message: safeMessage,
          pageUrl: safePageUrl,
          viewport: safeViewport,
          userAgent: safeUserAgent,
          email: safeEmail,
          userId: safeUserId,
        }),
      }),
    })

    if (!resendRes.ok) {
      const resendBody = await resendRes.json().catch(() => ({}))
      console.error('Resend send failed:', resendBody)
      return json(req, { error: 'Could not send feedback right now. Please email hello@becomeable.app.' }, 502)
    }
    return json(req, { ok: true })
  } catch (e) {
    console.error('submit-feedback error:', e)
    return json(req, { error: 'Internal server error' }, 500)
  }
})

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  })
}

function _escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function _buildFeedbackEmail(p: {
  message: string; pageUrl: string; viewport: string; userAgent: string; email: string; userId: string;
}): string {
  const messageHtml = p.message.replace(/\n/g, '<br>')
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f0f7f2;font-family:Helvetica,Arial,sans-serif;color:#111c16;">
<div style="max-width:560px;margin:0 auto;padding:28px 24px;">
  <div style="font-weight:900;font-size:18px;letter-spacing:-.02em;color:#2a7a4a;margin-bottom:18px;">Able · feedback</div>
  <div style="background:#ffffff;border-radius:14px;padding:22px 24px;box-shadow:0 2px 8px rgba(0,0,0,.05);">
    <div style="font-size:15px;line-height:1.6;color:#111c16;font-weight:500;white-space:pre-wrap;">${messageHtml}</div>
  </div>
  <div style="margin-top:18px;background:#ffffff;border-radius:14px;padding:18px 22px;font-size:12px;color:#4a5c52;font-weight:600;line-height:1.7;">
    <div><strong style="color:#111c16;">From:</strong> ${p.email}</div>
    <div><strong style="color:#111c16;">User ID:</strong> ${p.userId}</div>
    <div><strong style="color:#111c16;">Page:</strong> ${p.pageUrl}</div>
    <div><strong style="color:#111c16;">Viewport:</strong> ${p.viewport}</div>
    <div style="margin-top:8px;color:#8ca898;font-size:11px;word-break:break-all;">${p.userAgent}</div>
  </div>
</div>
</body></html>`
}
