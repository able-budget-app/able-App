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
    if (userErr || !userRes.user) {
      return json({ error: 'Unauthorized' }, 401)
    }
    const userId = userRes.user.id
    const email = userRes.user.email ?? ''

    // 2. Only trust priceId + return/cancel URLs from the body
    const { priceId, returnUrl, cancelUrl, ref_token } = await req.json()
    if (typeof priceId !== 'string' || !priceId.startsWith('price_')) {
      return json({ error: 'Invalid priceId' }, 400)
    }

    // Constrain redirect URLs to known origins (open redirect guard)
    const urlOk = (u: unknown) =>
      typeof u === 'string' && ALLOWED_ORIGINS.some((o) => u.startsWith(o))
    if (!urlOk(returnUrl) || !urlOk(cancelUrl)) {
      return json({ error: 'Invalid redirect URL' }, 400)
    }

    // 3. Look up the price to decide subscription vs payment
    const priceRes = await fetch(`https://api.stripe.com/v1/prices/${priceId}`, {
      headers: { Authorization: `Bearer ${STRIPE_SECRET}` },
    })
    const price = await priceRes.json()
    if (price.error) return json({ error: price.error.message }, 400)
    const mode = price.type === 'recurring' ? 'subscription' : 'payment'

    // 4. Build the Checkout session
    const params = new URLSearchParams({
      customer_email: email,
      mode,
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      success_url: returnUrl,
      cancel_url: cancelUrl,
      'metadata[supabase_uid]': userId,
      allow_promotion_codes: 'true',
    })

    if (mode === 'subscription') {
      params.set('subscription_data[trial_period_days]', '7')
      params.set('payment_method_collection', 'always')
      // carry the user id onto the subscription object too, so webhook
      // subscription.* events can link back without needing the session
      params.set('subscription_data[metadata][supabase_uid]', userId)
    } else {
      params.set('invoice_creation[enabled]', 'true')
    }

    if (typeof ref_token === 'string' && ref_token.length > 0 && ref_token.length < 50) {
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

    return json({ session_url: session.url })
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
