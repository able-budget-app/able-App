import { createClient } from 'npm:@supabase/supabase-js@2'

// Single source of truth for both CORS origin reflection and the redirect-URL
// allowlist Stripe will send users back to. Capacitor/able schemes are valid
// CORS origins (the iOS WebView sends them) but invalid redirect targets
// (Stripe redirects are server-side https) — _isAllowedRedirect() applies
// the stricter HTTPS-only filter.
const _ALLOWED_ORIGINS = new Set([
  'https://becomeable.app',
  'https://www.becomeable.app',
  'capacitor://localhost',
  'able://localhost',
]);
function _allowOrigin(origin: string | null): string {
  if (!origin) return 'https://becomeable.app';
  if (_ALLOWED_ORIGINS.has(origin)) return origin;
  if (/^https:\/\/deploy-preview-\d+--becomeable\.netlify\.app$/.test(origin)) return origin;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  return 'https://becomeable.app';
}
function corsHeaders(req: Request) {
  return {
  'Access-Control-Allow-Origin': _allowOrigin(req.headers.get('Origin')),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
  };
}
// Stripe redirects are server-to-browser https navigations; capacitor:// and
// able:// schemes can't receive them. Capacitor's checkout flow points Stripe
// at becomeable.app/checkout-return.html which then deeplinks into the app.
function _isAllowedRedirect(u: unknown): boolean {
  if (typeof u !== 'string') return false;
  if (u.startsWith('https://becomeable.app/') || u === 'https://becomeable.app') return true;
  if (u.startsWith('https://www.becomeable.app/') || u === 'https://www.becomeable.app') return true;
  if (/^https:\/\/deploy-preview-\d+--becomeable\.netlify\.app(\/|$)/.test(u)) return true;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(u)) return true;
  return false;
}

// Resolve the Supabase service-role-equivalent secret. Prefer the new
// SUPABASE_SECRET_KEYS env (sb_secret_* format) over the deprecated legacy
// SUPABASE_SERVICE_ROLE_KEY JWT. Falls back to the legacy env during
// migration so functions keep working until the dashboard
// "Disable JWT-based API keys" button is pressed.
function _getServiceKey(): string {
  const newKeys = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (newKeys) {
    try {
      const parsed = JSON.parse(newKeys);
      if (parsed && typeof parsed.default === 'string') return parsed.default;
    } catch { /* fall through to legacy */ }
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })

  try {
    // 1. Authenticate the caller
    const authHeader = req.headers.get('Authorization') ?? ''
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_ROLE = _getServiceKey()
    const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY')!

    const userClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userRes, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userRes.user) {
      return json(req, { error: 'Unauthorized' }, 401)
    }
    const userId = userRes.user.id
    const email = userRes.user.email ?? ''

    // 2. Only trust priceId + return/cancel URLs from the body
    const { priceId, returnUrl, cancelUrl, ref_token } = await req.json()
    if (typeof priceId !== 'string' || !priceId.startsWith('price_')) {
      return json(req, { error: 'Invalid priceId' }, 400)
    }

    // Constrain redirect URLs to known origins (open redirect guard).
    if (!_isAllowedRedirect(returnUrl) || !_isAllowedRedirect(cancelUrl)) {
      return json(req, { error: 'Invalid redirect URL' }, 400)
    }

    // 3. Look up the price to decide subscription vs payment
    const priceRes = await fetch(`https://api.stripe.com/v1/prices/${priceId}`, {
      headers: { Authorization: `Bearer ${STRIPE_SECRET}` },
    })
    const price = await priceRes.json()
    if (price.error) return json(req, { error: price.error.message }, 400)
    const mode = price.type === 'recurring' ? 'subscription' : 'payment'

    // 4. Build the Checkout session.
    //
    // Inject Stripe's {CHECKOUT_SESSION_ID} template into success_url so the
    // browser comes back with the real session_id and can call
    // verify-checkout-session — bypasses the webhook delivery race for the
    // immediate post-checkout transition. Append `&session_id={CHECKOUT_SESSION_ID}`
    // (or `?` if returnUrl has no query yet).
    const successUrlWithSession = returnUrl + (returnUrl.includes('?') ? '&' : '?') + 'session_id={CHECKOUT_SESSION_ID}'
    const params = new URLSearchParams({
      customer_email: email,
      mode,
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      success_url: successUrlWithSession,
      cancel_url: cancelUrl,
      'metadata[supabase_uid]': userId,
      allow_promotion_codes: 'true',
    })

    if (mode === 'subscription') {
      params.set('subscription_data[trial_period_days]', '30')
      params.set('payment_method_collection', 'always')
      // carry the user id onto the subscription object too, so webhook
      // subscription.* events can link back without needing the session
      params.set('subscription_data[metadata][supabase_uid]', userId)
    } else {
      params.set('invoice_creation[enabled]', 'true')
    }

    // Charset-validate ref_token. The Stripe webhook hands this back to
    // PostgREST as `eq.<value>` — invalid chars (&, ,, /) could append spurious
    // query params. Restricting to URL-safe alphanumerics + underscore/hyphen
    // matches how `crypto.randomUUID().slice()` style tokens look in practice.
    if (typeof ref_token === 'string' && /^[A-Za-z0-9_-]{1,50}$/.test(ref_token)) {
      params.set('metadata[ref_token]', ref_token)
      if (mode === 'subscription') {
        params.set('subscription_data[metadata][ref_token]', ref_token)
      }
    }

    const sessionRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    })
    const session = await sessionRes.json()
    if (!session.url) {
      throw new Error(session.error?.message || 'No session URL')
    }

    return json(req, { session_url: session.url })
  } catch (error) {
    return json(req, { error: (error as Error).message }, 400)
  }
})

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  })
}
