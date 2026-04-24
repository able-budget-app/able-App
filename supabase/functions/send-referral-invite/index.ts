import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
    const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'Able <hello@becomeable.app>'
    const APP_URL = (Deno.env.get('APP_URL') || 'https://becomeable.app').trim().replace(/\/$/, '')

    const userClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userRes, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userRes.user) return json({ error: 'Unauthorized' }, 401)
    const userId = userRes.user.id
    const userEmail = (userRes.user.email ?? '').toLowerCase()

    // Eligibility gate: only paid/lifetime users can refer.
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE)
    const { data: profile } = await admin
      .from('profiles')
      .select('subscription_status')
      .eq('id', userId)
      .single()
    if (!profile || !['active', 'lifetime'].includes(profile.subscription_status)) {
      return json({ error: 'The referral program opens after your trial converts.' }, 403)
    }

    const body = await req.json()
    const name = (body.name ?? '').toString().trim()
    const email = (body.email ?? '').toString().trim().toLowerCase()
    if (!name || name.length > 100) return json({ error: 'Please enter a name.' }, 400)
    if (!email || !EMAIL_RE.test(email) || email.length > 200) {
      return json({ error: 'Please enter a valid email address.' }, 400)
    }
    if (email === userEmail) {
      return json({ error: 'You cannot refer yourself.' }, 400)
    }

    const { data: ref, error: insertErr } = await admin
      .from('referrals')
      .insert({ referrer_id: userId, referred_name: name, referred_email: email })
      .select('id, ref_token')
      .single()
    if (insertErr || !ref) {
      return json({ error: 'Could not save referral. Try again.' }, 500)
    }

    const inviteUrl = `${APP_URL}/?ref=${ref.ref_token}`

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: email,
        subject: `${name}, a friend invited you to try Able`,
        html: buildInviteEmail({ name, inviteUrl }),
      }),
    })

    const resendBody = await resendRes.json().catch(() => ({}))
    if (!resendRes.ok) {
      console.error('Resend send failed:', resendBody)
      return json({
        ok: true,
        ref_token: ref.ref_token,
        warning: 'Referral saved but invite email failed to send.',
      })
    }

    return json({ ok: true, ref_token: ref.ref_token })
  } catch (e) {
    console.error('send-referral-invite error:', e)
    return json({ error: (e as Error).message }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function buildInviteEmail({ name, inviteUrl }: { name: string; inviteUrl: string }) {
  const safeName = String(name).replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f0f7f2;font-family:Helvetica,Arial,sans-serif;color:#111c16;"><div style="max-width:520px;margin:0 auto;padding:32px 24px;"><div style="font-weight:900;font-size:20px;letter-spacing:-.02em;color:#2a7a4a;margin-bottom:24px;">Able</div><div style="background:#ffffff;border-radius:18px;padding:28px 24px;box-shadow:0 2px 8px rgba(0,0,0,.05);"><div style="font-size:22px;font-weight:800;letter-spacing:-.01em;margin-bottom:10px;">${safeName}, a friend invited you.</div><div style="font-size:15px;line-height:1.6;color:#4a5c52;font-weight:500;margin-bottom:12px;">Someone you know uses Able and thought it might help you too.</div><div style="font-size:15px;line-height:1.6;color:#4a5c52;font-weight:500;margin-bottom:12px;">Able is a budgeting app built for inconsistent income. Freelancers, creators, business owners. When money comes in, Able tells you exactly where it should go before it leaks.</div><div style="font-size:15px;line-height:1.6;color:#4a5c52;font-weight:500;margin-bottom:18px;">7 days free. Card required so the trial can start cleanly. Cancel anytime before day 8 and you pay nothing.</div><a href="${inviteUrl}" style="display:inline-block;background:#2a7a4a;color:#ffffff;padding:14px 28px;border-radius:12px;font-weight:800;text-decoration:none;font-size:14px;">Try Able free for 7 days</a></div><div style="text-align:center;margin-top:20px;font-size:12px;color:#8ca898;line-height:1.6;">If you did not expect this, you can ignore it. No follow-up.</div></div></body></html>`
}
