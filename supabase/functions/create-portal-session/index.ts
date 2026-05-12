import { createClient } from 'npm:@supabase/supabase-js@2'

const _ALLOWED_ORIGINS = new Set([
  'https://becomeable.app',
  'https://www.becomeable.app',
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
}const ALLOWED_ORIGINS = [
  'https://becomeable.app',
  'https://www.becomeable.app',
  'https://becomeable.netlify.app',
  'http://localhost:3000',
  'http://localhost:5173',
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })

  try {
    // 1. Authenticate the caller
    const authHeader = req.headers.get('Authorization') ?? ''
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY')!

    const userClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userRes, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userRes.user) return json(req, { error: 'Unauthorized' }, 401)
    const userId = userRes.user.id

    // 2. Validate return URL
    const { returnUrl } = await req.json()
    if (typeof returnUrl !== 'string' || !ALLOWED_ORIGINS.some((o) => returnUrl.startsWith(o))) {
      return json(req, { error: 'Invalid returnUrl' }, 400)
    }

    // 3. Look up the user's Stripe customer id
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE)
    const { data: profile, error: pErr } = await admin
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single()
    if (pErr || !profile?.stripe_customer_id) {
      return json(req, { error: 'No subscription to manage yet.' }, 404)
    }

    // 4. Create a Stripe billing portal session
    const params = new URLSearchParams({
      customer: profile.stripe_customer_id,
      return_url: returnUrl,
    })
    const portalRes = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    })
    const portal = await portalRes.json()
    if (!portal.url) {
      throw new Error(portal.error?.message || 'No portal URL')
    }

    return json(req, { portal_url: portal.url })
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
