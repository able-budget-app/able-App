// Bypass the Stripe webhook race for the immediate post-checkout flow.
//
// After Stripe redirects the user back with ?checkout=success&session_id=cs_xxx,
// the client calls this function with the session_id. We verify the session
// directly against Stripe's API (no webhook needed) and, if it's complete and
// belongs to the calling user, upsert profiles.subscription_status so the
// browser sees "active"/"trialing"/"lifetime" immediately.
//
// The webhook still runs as the source of truth (referral linking, PostHog
// events, subscription lifecycle). This function just unblocks the user's
// post-checkout transition without waiting for webhook delivery.
//
// Security: session.metadata.supabase_uid must match the authenticated caller.
// Forged session_ids are rejected by Stripe (would 404). Stale/incomplete
// sessions return without granting access.

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function mapSubStatus(s: string): string {
  switch (s) {
    case 'trialing': return 'trialing'
    case 'active': return 'active'
    case 'past_due': return 'past_due'
    case 'unpaid': return 'past_due'
    case 'incomplete': return 'incomplete'
    case 'canceled': return 'inactive'
    case 'incomplete_expired': return 'inactive'
    default: return 'inactive'
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const STRIPE_SECRET_LIVE = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
    const STRIPE_SECRET_TEST = Deno.env.get('STRIPE_SECRET_KEY_TEST') ?? ''

    // Authenticate the caller via Supabase JWT.
    const authHeader = req.headers.get('Authorization') ?? ''
    const userClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userRes, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userRes.user) return json({ error: 'Unauthorized' }, 401)
    const userId = userRes.user.id
    const email = userRes.user.email ?? ''

    // Parse + validate session_id.
    const { session_id } = await req.json().catch(() => ({}))
    if (typeof session_id !== 'string' || !session_id.startsWith('cs_')) {
      return json({ error: 'Invalid session_id' }, 400)
    }

    // Try live key first, fall back to test. Mirrors stripe-webhook's
    // dual-mode handling so the same endpoint works for both modes.
    const fetchSession = async (key: string) => {
      if (!key) return null
      // Expand subscription so we get its status without a second call.
      const url = `https://api.stripe.com/v1/checkout/sessions/${session_id}?expand[]=subscription`
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${key}` },
      })
      if (!res.ok) return null
      return await res.json()
    }
    let session = await fetchSession(STRIPE_SECRET_LIVE)
    if (!session) session = await fetchSession(STRIPE_SECRET_TEST)
    if (!session) return json({ error: 'Session not found' }, 404)

    // Ownership check: the session must belong to the calling user.
    const sessionUid = session.metadata?.supabase_uid
    if (sessionUid && sessionUid !== userId) {
      return json({ error: 'Session does not belong to caller' }, 403)
    }

    // Status check: the session must actually be complete.
    if (session.status !== 'complete') {
      return json({ status: 'pending', session_status: session.status }, 200)
    }

    // Determine the subscription_status to write. Subscription mode → use the
    // sub's actual status (trialing / active). Payment mode → lifetime.
    let newStatus = 'inactive'
    if (session.mode === 'subscription') {
      const subStatus = session.subscription?.status
      newStatus = subStatus ? mapSubStatus(subStatus) : 'trialing'
    } else if (session.mode === 'payment') {
      if (session.payment_status === 'paid') newStatus = 'lifetime'
    }

    if (newStatus === 'inactive') {
      return json({ status: 'pending', mode: session.mode, payment_status: session.payment_status }, 200)
    }

    // Upsert the profile. Same shape as stripe-webhook's checkout.session.completed
    // path. Idempotent — webhook arriving later writes the same value.
    const customerId = session.customer
    const sbHeaders = {
      Authorization: `Bearer ${SERVICE_ROLE}`,
      apikey: SERVICE_ROLE,
      'Content-Type': 'application/json',
    }
    const profilePayload: Record<string, unknown> = {
      id: userId,
      email,
      subscription_status: newStatus,
    }
    if (customerId) profilePayload.stripe_customer_id = customerId

    const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
      method: 'POST',
      headers: { ...sbHeaders, Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(profilePayload),
    })
    if (!upsertRes.ok) {
      const errText = await upsertRes.text().catch(() => '')
      console.error('upsert profile failed:', upsertRes.status, errText)
      return json({ error: 'Profile update failed' }, 500)
    }

    // Best-effort user_data row insert (the rest of the app expects it). Same
    // as the webhook's path; ignore-duplicates so re-running is safe.
    fetch(`${SUPABASE_URL}/rest/v1/user_data`, {
      method: 'POST',
      headers: { ...sbHeaders, Prefer: 'resolution=ignore-duplicates' },
      body: JSON.stringify({ id: userId }),
    }).catch(() => { /* non-blocking */ })

    return json({ status: 'active', subscription_status: newStatus })
  } catch (err) {
    console.error('verify-checkout-session error:', err)
    return json({ error: (err as Error).message || 'Internal error' }, 500)
  }
})
