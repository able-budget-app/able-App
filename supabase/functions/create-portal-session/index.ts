import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const ALLOWED_ORIGINS = [
  'https://becomeable.app',
  'https://www.becomeable.app',
  'https://becomeable.netlify.app',
  'http://localhost:3000',
  'http://localhost:5173',
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

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
    if (userErr || !userRes.user) return json({ error: 'Unauthorized' }, 401)
    const userId = userRes.user.id

    // 2. Validate return URL
    const { returnUrl } = await req.json()
    if (typeof returnUrl !== 'string' || !ALLOWED_ORIGINS.some((o) => returnUrl.startsWith(o))) {
      return json({ error: 'Invalid returnUrl' }, 400)
    }

    // 3. Look up the user's Stripe customer id
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE)
    const { data: profile, error: pErr } = await admin
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single()
    if (pErr || !profile?.stripe_customer_id) {
      return json({ error: 'No subscription to manage yet.' }, 404)
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

    return json({ portal_url: portal.url })
  } catch (error) {
    return json({ error: (error as Error).message }, 400)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
