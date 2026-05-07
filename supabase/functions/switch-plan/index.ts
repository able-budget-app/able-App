// Switch the user's subscription from monthly to annual without redirecting
// to Stripe Checkout. Uses subscriptions.update with
// proration_behavior='always_invoice' so the prorated difference is billed
// to the saved card immediately, no Checkout redirect.
//
// Two modes via request body:
//   { preview: true }  → returns current price/interval for UI gating
//   { action: 'switch_to_annual' } → performs the upgrade
//
// Auth: caller's JWT must match subscription.metadata.supabase_uid (set at
// checkout time in create-checkout). Stripe rejects forged subscription IDs
// (404), so the lookup itself is also a guard.
//
// Webhook (customer.subscription.updated) is the source of truth for
// profiles.subscription_status, so we don't redundantly upsert here.

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Mirror app.html's PRICE_ANNUAL constant. If you ever rotate the annual
// price in Stripe, update both places (and archive the old price).
const PRICE_ANNUAL = 'price_1TPyPZDBmPAhrdxkAwiyRC6U'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY')!

    const authHeader = req.headers.get('Authorization') ?? ''
    const userClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userRes, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userRes.user) return json({ error: 'Unauthorized' }, 401)
    const userId = userRes.user.id

    const body = await req.json().catch(() => ({}))
    const isPreview = body.preview === true
    const action = typeof body.action === 'string' ? body.action : null

    // Pull the user's stored subscription id
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE)
    const { data: profile, error: profileErr } = await admin
      .from('profiles')
      .select('stripe_subscription_id, subscription_status')
      .eq('id', userId)
      .single()
    if (profileErr) return json({ error: profileErr.message }, 500)
    if (!profile?.stripe_subscription_id) {
      return json({ status: 'no_subscription' }, 200)
    }

    const subId = profile.stripe_subscription_id as string

    // Fetch the subscription from Stripe to read the current price + item id
    const subRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, {
      headers: { Authorization: `Bearer ${STRIPE_SECRET}` },
    })
    const sub = await subRes.json()
    if (sub.error) return json({ error: sub.error.message }, 400)

    // Ownership guard: subscription metadata.supabase_uid was set in
    // create-checkout. If it's missing (legacy/grandfathered) we fall back to
    // the profiles.stripe_subscription_id linkage, which is already an
    // authenticated lookup.
    if (sub.metadata?.supabase_uid && sub.metadata.supabase_uid !== userId) {
      return json({ error: 'Forbidden' }, 403)
    }

    const item = sub.items?.data?.[0]
    if (!item) return json({ error: 'No subscription item on file' }, 400)

    const currentPriceId: string | null = item.price?.id ?? null
    const currentInterval: string | null = item.price?.recurring?.interval ?? null
    const currentAmount: number | null = typeof item.price?.unit_amount === 'number' ? item.price.unit_amount : null

    if (isPreview) {
      return json({
        status: 'ok',
        current_price_id: currentPriceId,
        current_interval: currentInterval,
        current_amount: currentAmount,
        subscription_status: sub.status,
        cancel_at_period_end: sub.cancel_at_period_end === true,
      })
    }

    if (action !== 'switch_to_annual') {
      return json({ error: 'Unsupported action' }, 400)
    }

    // Already on annual — idempotent no-op
    if (currentInterval === 'year' || currentPriceId === PRICE_ANNUAL) {
      return json({ status: 'already_annual' }, 200)
    }
    if (currentInterval !== 'month') {
      return json({ error: 'Only monthly subscriptions can switch to annual' }, 400)
    }

    // Perform the switch. always_invoice generates a proration invoice
    // immediately and attempts to charge the default payment method.
    // billing_cycle_anchor=now resets the cycle to today, so the user gets a
    // fresh full year from the switch instead of riding out the monthly
    // anchor (which would charge the full annual price 25-ish days from
    // now and then again 12 months later — confusing).
    const updateParams = new URLSearchParams({
      'items[0][id]': item.id,
      'items[0][price]': PRICE_ANNUAL,
      proration_behavior: 'always_invoice',
      billing_cycle_anchor: 'now',
    })
    const updateRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: updateParams,
    })
    const updated = await updateRes.json()
    if (updated.error) return json({ error: updated.error.message }, 400)

    return json({
      status: 'switched',
      new_price_id: PRICE_ANNUAL,
      latest_invoice: typeof updated.latest_invoice === 'string' ? updated.latest_invoice : updated.latest_invoice?.id ?? null,
      current_period_end: updated.current_period_end ?? null,
    })
  } catch (error) {
    return json({ error: (error as Error).message }, 500)
  }
})
