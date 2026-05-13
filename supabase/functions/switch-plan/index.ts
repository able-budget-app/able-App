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
}// Mirror app.html's PRICE_ANNUAL constant. If you ever rotate the annual
// price in Stripe, update both places (and archive the old price).
const PRICE_ANNUAL = 'price_1TPyPZDBmPAhrdxkAwiyRC6U'

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
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

    const SERVICE_ROLE = _getServiceKey()
    const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY')!

    const authHeader = req.headers.get('Authorization') ?? ''
    const userClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userRes, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userRes.user) return json(req, { error: 'Unauthorized' }, 401)
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
    if (profileErr) return json(req, { error: profileErr.message }, 500)
    if (!profile?.stripe_subscription_id) {
      return json(req, { status: 'no_subscription' }, 200)
    }

    const subId = profile.stripe_subscription_id as string

    // Fetch the subscription from Stripe to read the current price + item id
    const subRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, {
      headers: { Authorization: `Bearer ${STRIPE_SECRET}` },
    })
    const sub = await subRes.json()
    if (sub.error) return json(req, { error: sub.error.message }, 400)

    // Ownership guard: subscription metadata.supabase_uid was set in
    // create-checkout. If it's missing (legacy/grandfathered) we fall back to
    // the profiles.stripe_subscription_id linkage, which is already an
    // authenticated lookup.
    if (sub.metadata?.supabase_uid && sub.metadata.supabase_uid !== userId) {
      return json(req, { error: 'Forbidden' }, 403)
    }

    const item = sub.items?.data?.[0]
    if (!item) return json(req, { error: 'No subscription item on file' }, 400)

    const currentPriceId: string | null = item.price?.id ?? null
    const currentInterval: string | null = item.price?.recurring?.interval ?? null
    const currentAmount: number | null = typeof item.price?.unit_amount === 'number' ? item.price.unit_amount : null

    if (isPreview) {
      return json(req, {
        status: 'ok',
        current_price_id: currentPriceId,
        current_interval: currentInterval,
        current_amount: currentAmount,
        subscription_status: sub.status,
        cancel_at_period_end: sub.cancel_at_period_end === true,
      })
    }

    if (action !== 'switch_to_annual') {
      return json(req, { error: 'Unsupported action' }, 400)
    }

    // Already on annual — idempotent no-op
    if (currentInterval === 'year' || currentPriceId === PRICE_ANNUAL) {
      return json(req, { status: 'already_annual' }, 200)
    }
    if (currentInterval !== 'month') {
      return json(req, { error: 'Only monthly subscriptions can switch to annual' }, 400)
    }

    // Perform the switch. Behavior depends on whether the sub is in trial:
    //
    // - Active (post-trial): prorate against the saved card and reset
    //   billing_cycle_anchor to now, so the user gets a fresh full year
    //   from today instead of riding out the monthly anchor (which would
    //   charge the full annual price within days and then again 12 months
    //   later — confusing).
    // - Trialing: just swap the price. Stripe rejects billing_cycle_anchor
    //   and always_invoice during a trial (no charges happen yet, so there
    //   is nothing to prorate or invoice). The new annual price kicks in
    //   when the trial converts.
    const isTrialing = sub.status === 'trialing'
    const updateParams = new URLSearchParams({
      'items[0][id]': item.id,
      'items[0][price]': PRICE_ANNUAL,
    })
    if (isTrialing) {
      updateParams.set('proration_behavior', 'none')
    } else {
      updateParams.set('proration_behavior', 'always_invoice')
      updateParams.set('billing_cycle_anchor', 'now')
    }
    const updateRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: updateParams,
    })
    const updated = await updateRes.json()
    if (updated.error) return json(req, { error: updated.error.message }, 400)

    return json(req, {
      status: 'switched',
      new_price_id: PRICE_ANNUAL,
      latest_invoice: typeof updated.latest_invoice === 'string' ? updated.latest_invoice : updated.latest_invoice?.id ?? null,
      current_period_end: updated.current_period_end ?? null,
    })
  } catch (error) {
    return json(req, { error: (error as Error).message }, 500)
  }
})
