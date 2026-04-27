import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const CRON_SECRET = Deno.env.get('CRON_SECRET')!;
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'Able <onboarding@resend.dev>';
const APP_URL = (Deno.env.get('APP_URL') || 'https://becomeable.app').trim().replace(/\/$/, '');

Deno.serve(async (req) => {
  const auth = req.headers.get('Authorization') ?? '';
  if (auth !== `Bearer ${CRON_SECRET}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const results = {
    dormancy: 0, weekly: 0, bill_due: 0, low_buffer: 0, monthly_wrap: 0,
    cart_24h: 0, cart_3d: 0, cart_7d: 0,
    trial_day_5: 0, trial_day_7: 0, trial_ended_no_convert: 0,
    skipped: 0, errors: 0,
  };

  try {
    const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const authUsers = authData?.users ?? [];

    const { data: profiles } = await admin.from('profiles').select('id, subscription_status, trial_end_at');
    const profilesMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    let { data: userDataRows } = await admin
      .from('user_data')
      .select('id, last_active, email_prefs, unsubscribe_token, bills, buffer, history');
    let userDataMap = new Map((userDataRows ?? []).map((u: any) => [u.id, u]));

    // Ensure every auth user has a user_data row so they all have an unsubscribe_token
    const missingIds = authUsers.filter((u: any) => !userDataMap.has(u.id)).map((u: any) => ({ id: u.id }));
    if (missingIds.length > 0) {
      await admin.from('user_data').upsert(missingIds, { onConflict: 'id', ignoreDuplicates: true });
      const refresh = await admin.from('user_data')
        .select('id, last_active, email_prefs, unsubscribe_token, bills, buffer, history');
      if (refresh.data) userDataMap = new Map(refresh.data.map((u: any) => [u.id, u]));
    }

    const thirtyDaysAgoMs = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const { data: recentSends } = await admin
      .from('email_sends')
      .select('user_id, type, sent_at')
      .gte('sent_at', new Date(thirtyDaysAgoMs).toISOString());
    const sentMap = new Map<string, Map<string, number>>();
    for (const s of (recentSends ?? [])) {
      if (!sentMap.has(s.user_id)) sentMap.set(s.user_id, new Map());
      const t = new Date(s.sent_at).getTime();
      const userSends = sentMap.get(s.user_id)!;
      if (!userSends.has(s.type) || userSends.get(s.type)! < t) userSends.set(s.type, t);
    }
    const sentSince = (uid: string, type: string, since: number) => {
      const m = sentMap.get(uid); if (!m) return false;
      const last = m.get(type); return last !== undefined && last >= since;
    };
    const sentEver = (uid: string, type: string) => sentMap.get(uid)?.has(type) ?? false;

    const now = new Date();
    const nowMs = now.getTime();
    const fiveDaysAgoMs = nowMs - 5 * 24 * 60 * 60 * 1000;
    const sevenDaysAgoMs = nowMs - 7 * 24 * 60 * 60 * 1000;
    const fourteenDaysAgoMs = nowMs - 14 * 24 * 60 * 60 * 1000;
    const twentyEightDaysAgoMs = nowMs - 28 * 24 * 60 * 60 * 1000;
    const todayStart = new Date(); todayStart.setUTCHours(0, 0, 0, 0);
    const todayStartMs = todayStart.getTime();
    const isMonday = now.getUTCDay() === 1;
    const isFirstOfMonth = now.getUTCDate() === 1;
    const tomorrow = new Date(); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const tomorrowDay = tomorrow.getUTCDate();

    const paidStatuses = new Set(['active', 'trialing', 'lifetime']);

    for (const authUser of authUsers) {
      const userId = authUser.id;
      const email = authUser.email;
      if (!email) { results.skipped++; continue; }

      const userData: any = userDataMap.get(userId);
      const profile: any = profilesMap.get(userId);
      const prefs: any = userData?.email_prefs ?? {};
      const hasPaid = profile && paidStatuses.has(profile.subscription_status);

      // Abandoned cart sequence (non-payers only)
      if (!hasPaid && userData?.unsubscribe_token) {
        const ageHours = (nowMs - new Date(authUser.created_at).getTime()) / 3_600_000;
        if (ageHours >= 24 && ageHours < 72 && !sentEver(userId, 'cart_24h')) {
          const ok = await sendCart(admin, email, userData, '24h');
          if (ok) results.cart_24h++; else results.errors++;
        } else if (ageHours >= 72 && ageHours < 168 && !sentEver(userId, 'cart_3d')) {
          const ok = await sendCart(admin, email, userData, '3d');
          if (ok) results.cart_3d++; else results.errors++;
        } else if (ageHours >= 168 && ageHours < 240 && !sentEver(userId, 'cart_7d')) {
          const ok = await sendCart(admin, email, userData, '7d');
          if (ok) results.cart_7d++; else results.errors++;
        }
      }

      if (profile?.trial_end_at) {
        const trialEndMs = new Date(profile.trial_end_at).getTime();
        const hoursUntilEnd = (trialEndMs - nowMs) / 3_600_000;

        if (profile.subscription_status === 'trialing') {
          if (hoursUntilEnd >= 36 && hoursUntilEnd <= 60 && !sentEver(userId, 'trial_day_5_nudge')) {
            const ok = await sendTrialDay5(admin, email, userData);
            if (ok) results.trial_day_5++; else results.errors++;
          }
          if (hoursUntilEnd >= 12 && hoursUntilEnd <= 36 && !sentEver(userId, 'trial_day_7_last_call')) {
            const ok = await sendTrialDay7(admin, email, userData);
            if (ok) results.trial_day_7++; else results.errors++;
          }
        } else if (profile.subscription_status === 'inactive' && trialEndMs < nowMs && trialEndMs > nowMs - 7 * 24 * 3_600_000) {
          if (!sentEver(userId, 'trial_ended_no_convert')) {
            const ok = await sendTrialEndedNoConvert(admin, email, userData);
            if (ok) results.trial_ended_no_convert++; else results.errors++;
          }
        }
      }

      if (!userData) continue;
      const lastActive = userData.last_active ? new Date(userData.last_active).getTime() : 0;

      // Dormancy
      if (prefs.dormancy !== false && lastActive && lastActive < fiveDaysAgoMs && !sentSince(userId, 'dormancy', sevenDaysAgoMs)) {
        const ok = await sendDormancy(admin, email, userData);
        if (ok) results.dormancy++; else results.errors++;
      }

      // Weekly summary (Mondays, paid users only)
      if (isMonday && hasPaid && prefs.weekly !== false && !sentSince(userId, 'weekly', sevenDaysAgoMs)) {
        const ok = await sendWeekly(admin, email, userData);
        if (ok) results.weekly++; else results.errors++;
      }

      // Bill due tomorrow
      const billsDueTomorrow = ((userData.bills ?? []) as any[]).filter(b =>
        !b.paid && b.due && b.due !== 'ongoing' && (b.freq || 'monthly') === 'monthly' && parseInt(b.due) === tomorrowDay
      );
      if (billsDueTomorrow.length > 0 && prefs.bill_reminder !== false && !sentSince(userId, 'bill_due_tomorrow', todayStartMs)) {
        const ok = await sendBillDue(admin, email, userData, billsDueTomorrow);
        if (ok) results.bill_due++; else results.errors++;
      }

      // Low buffer warning
      const monthlyBills = ((userData.bills ?? []) as any[]).reduce((s: number, b: any) => s + (b.amount || 0), 0);
      const buffer = parseFloat(userData.buffer) || 0;
      if (monthlyBills > 0 && buffer < monthlyBills * 0.5 && prefs.low_buffer !== false && !sentSince(userId, 'low_buffer', fourteenDaysAgoMs)) {
        const ok = await sendLowBuffer(admin, email, userData, buffer, monthlyBills);
        if (ok) results.low_buffer++; else results.errors++;
      }

      // Monthly wrap (1st of month, paid users only)
      if (isFirstOfMonth && hasPaid && prefs.monthly_wrap !== false && !sentSince(userId, 'monthly_wrap', twentyEightDaysAgoMs)) {
        const ok = await sendMonthlyWrap(admin, email, userData);
        if (ok) results.monthly_wrap++; else results.errors++;
      }
    }

    return json(results);
  } catch (e) {
    console.error('email-cron-daily error:', e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

async function sendViaResend(admin: any, to: string, subject: string, html: string, type: string, userId: string): Promise<boolean> {
  // Claim-first pattern. INSERT a row with status='sending' BEFORE calling
  // Resend. The UNIQUE index on (user_id, type, sent_day) means a concurrent
  // cron run that races us hits 23505 unique_violation on insert and bails —
  // structurally preventing double-sends. After Resend returns, UPDATE the
  // row with the final status + resend_id.
  const claim = await admin
    .from('email_sends')
    .insert({ user_id: userId, type, status: 'sending', resend_id: null })
    .select('id')
    .single();
  if (claim.error) {
    // 23505 = unique_violation. Another worker already claimed this slot, so
    // the email is going / went via that path. Return true so the caller's
    // counters don't bump 'errors' for this benign no-op.
    const msg = claim.error.message || '';
    if (claim.error.code === '23505' || /duplicate key|unique constraint/i.test(msg)) {
      return true;
    }
    console.error('Resend claim error:', claim.error);
    return false;
  }
  const claimId = claim.data?.id;
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
    });
    const body = await resp.json().catch(() => ({}));
    if (claimId) {
      await admin.from('email_sends')
        .update({ status: resp.ok ? 'sent' : 'error', resend_id: body?.id ?? null })
        .eq('id', claimId);
    }
    return resp.ok;
  } catch (e) {
    console.error('Resend error:', e);
    if (claimId) {
      await admin.from('email_sends').update({ status: 'error' }).eq('id', claimId);
    }
    return false;
  }
}

const unsubUrl = (token: string) => `${SUPABASE_URL}/functions/v1/unsubscribe?token=${encodeURIComponent(token)}`;

// Hand-drawn underline SVG matching the marketing site's nav-logo treatment. Encoded as
// a data URI so it inlines into an <img>; degrades cleanly in clients that strip data URIs.
const LOGO_UNDERLINE = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 4.2' preserveAspectRatio='none'><path d='M3 2.6 Q2 2.4 3 2.15 Q58 1.75 115 0.15 Q119 1 119 2 Q119 3 115 3.9 Q58 3.55 3 2.65 Q2 2.45 3 2.6 Z' fill='%232a7a4a'/></svg>`;

function layout(inner: string, unsub: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f7f2;font-family:Helvetica,Arial,sans-serif;color:#111c16;-webkit-font-smoothing:antialiased;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f0f7f2;"><tr><td align="center" style="padding:36px 16px 32px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:520px;">
  <tr><td align="center" style="padding-bottom:22px;">
    <div style="display:inline-block;text-align:center;">
      <div style="font-weight:900;font-size:30px;letter-spacing:-.03em;color:#111c16;line-height:1;">Able</div>
      <img src="${LOGO_UNDERLINE}" alt="" width="80" height="6" style="display:block;margin:4px auto 0;width:80px;height:6px;border:0;">
    </div>
    <div style="margin-top:12px;font-size:11px;color:#2a7a4a;font-weight:800;letter-spacing:.18em;text-transform:uppercase;">Built for inconsistent income</div>
  </td></tr>
  <tr><td style="background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 2px 12px rgba(42,122,74,.08);">
    <div style="height:4px;background:#2a7a4a;background-image:linear-gradient(90deg,#2a7a4a,#3d9e78);"></div>
    <div style="padding:28px 24px;">${inner}</div>
  </td></tr>
  <tr><td align="center" style="padding-top:20px;font-size:12px;color:#8ca898;line-height:1.6;">
    <a href="${APP_URL}/app.html" style="color:#2a7a4a;font-weight:700;text-decoration:none;">Open Able</a>
    &middot;
    <a href="${unsub}" style="color:#8ca898;text-decoration:underline;">Unsubscribe</a>
    <div style="margin-top:8px;font-size:11px;color:#a8baad;">becomeable.app</div>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

const cta = `<a href="${APP_URL}/app.html" style="display:inline-block;background:#2a7a4a;color:#ffffff;padding:14px 28px;border-radius:14px;font-weight:800;text-decoration:none;font-size:15px;margin-top:18px;letter-spacing:-.01em;box-shadow:0 4px 16px rgba(42,122,74,.3);">Open Able</a>`;

function row(label: string, val: string): string {
  return `<div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #eaf5ee;"><span style="color:#4a5c52;font-weight:600;font-size:14px;">${label}</span><span style="color:#111c16;font-weight:800;font-size:14px;">${val}</span></div>`;
}

async function sendDormancy(admin: any, email: string, user: any) {
  const bills = Array.isArray(user.bills) ? user.bills : [];
  const unpaidCount = bills.filter((b: any) => !b.paid).length;
  const buffer = parseFloat(user.buffer) || 0;
  const inner = `<div style="font-size:24px;font-weight:900;letter-spacing:-.03em;line-height:1.15;color:#111c16;margin-bottom:12px;">A quick check-in.</div>
    <div style="font-size:15px;line-height:1.6;color:#4a5c52;font-weight:500;margin-bottom:8px;">
      Money is energy. When we stop looking at it, it starts looking somewhere else.
      ${unpaidCount > 0 ? `You have <strong style="color:#111c16;">${unpaidCount} bill${unpaidCount === 1 ? '' : 's'}</strong> to handle soon.` : `You're current on bills. Good work.`}
      ${buffer > 0 ? ` Your buffer sits at <strong style="color:#111c16;">$${Math.round(buffer).toLocaleString()}</strong>.` : ``}
    </div>${cta}`;
  return sendViaResend(admin, email, `A quick check-in on your money`, layout(inner, unsubUrl(user.unsubscribe_token)), 'dormancy', user.id);
}

async function sendWeekly(admin: any, email: string, user: any) {
  const history = Array.isArray(user.history) ? user.history : [];
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = history.filter((h: any) => new Date(h.date).getTime() >= cutoff);
  const totalIn = recent.reduce((s: number, h: any) => s + (h.amount || 0), 0);
  const debtPaid = recent.reduce((s: number, h: any) => s + (h.debtExtra || 0), 0);
  const bufAdded = recent.reduce((s: number, h: any) => s + (h.bufContrib || 0), 0);
  const buffer = parseFloat(user.buffer) || 0;
  const rows = [
    row('Income logged', '$' + Math.round(totalIn).toLocaleString()),
    ...(debtPaid > 0 ? [row('Extra to debt', '$' + Math.round(debtPaid).toLocaleString())] : []),
    ...(bufAdded > 0 ? [row('Added to buffer', '$' + Math.round(bufAdded).toLocaleString())] : []),
    row('Buffer now', '$' + Math.round(buffer).toLocaleString()),
  ].join('');
  const inner = `<div style="font-size:24px;font-weight:900;letter-spacing:-.03em;line-height:1.15;color:#111c16;margin-bottom:12px;">Your week in Able.</div>
    <div style="font-size:14px;color:#4a5c52;font-weight:500;margin-bottom:20px;">Last 7 days at a glance.</div>
    ${rows}${cta}`;
  return sendViaResend(admin, email, `Your week in Able`, layout(inner, unsubUrl(user.unsubscribe_token)), 'weekly', user.id);
}

async function sendBillDue(admin: any, email: string, user: any, bills: any[]) {
  const total = bills.reduce((s: number, b: any) => s + (b.amount || 0), 0);
  const list = bills.map((b: any) => `<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #eaf5ee;"><span style="color:#111c16;font-weight:700;font-size:14px;">${escapeHtml(b.name)}</span><span style="color:#111c16;font-weight:800;font-size:14px;">$${Math.round(b.amount).toLocaleString()}</span></div>`).join('');
  const inner = `<div style="font-size:24px;font-weight:900;letter-spacing:-.03em;line-height:1.15;color:#111c16;margin-bottom:12px;">Heads up, not a panic.</div>
    <div style="font-size:15px;line-height:1.6;color:#4a5c52;font-weight:500;margin-bottom:14px;">You have ${bills.length} bill${bills.length === 1 ? '' : 's'} due tomorrow. If you've already allocated, no action needed.</div>
    ${list}
    <div style="display:flex;justify-content:space-between;padding:14px 0 4px;font-size:14px;font-weight:800;color:#111c16;"><span>Total</span><span>$${Math.round(total).toLocaleString()}</span></div>${cta}`;
  return sendViaResend(admin, email, `${bills.length} bill${bills.length === 1 ? '' : 's'} due tomorrow`, layout(inner, unsubUrl(user.unsubscribe_token)), 'bill_due_tomorrow', user.id);
}

async function sendLowBuffer(admin: any, email: string, user: any, buffer: number, monthlyBills: number) {
  const pct = Math.round((buffer / monthlyBills) * 100);
  const inner = `<div style="font-size:24px;font-weight:900;letter-spacing:-.03em;line-height:1.15;color:#111c16;margin-bottom:12px;">A gentle nudge.</div>
    <div style="font-size:15px;line-height:1.6;color:#4a5c52;font-weight:500;margin-bottom:8px;">
      Your buffer sits at <strong style="color:#111c16;">$${Math.round(buffer).toLocaleString()}</strong>, about <strong style="color:#111c16;">${pct}%</strong> of one month of bills.
    </div>
    <div style="font-size:15px;line-height:1.6;color:#4a5c52;font-weight:500;margin-bottom:8px;">
      This isn't a crisis. Money flows in waves, and slow periods are part of the cycle. It just means: be intentional with the next few decisions. Slow expenses where you can. More is on its way.
    </div>${cta}`;
  return sendViaResend(admin, email, `Your buffer is running low`, layout(inner, unsubUrl(user.unsubscribe_token)), 'low_buffer', user.id);
}

async function sendMonthlyWrap(admin: any, email: string, user: any) {
  const lastMonth = new Date(); lastMonth.setUTCMonth(lastMonth.getUTCMonth() - 1);
  const monthName = lastMonth.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
  const monthStartMs = new Date(Date.UTC(lastMonth.getUTCFullYear(), lastMonth.getUTCMonth(), 1)).getTime();
  const monthEndMs = new Date(Date.UTC(lastMonth.getUTCFullYear(), lastMonth.getUTCMonth() + 1, 1)).getTime();
  const history = Array.isArray(user.history) ? user.history : [];
  const inMonth = history.filter((h: any) => {
    const t = new Date(h.date).getTime();
    return t >= monthStartMs && t < monthEndMs;
  });
  const totalIn = inMonth.reduce((s: number, h: any) => s + (h.amount || 0), 0);
  const debtPaid = inMonth.reduce((s: number, h: any) => s + (h.debtExtra || 0), 0);
  const bufAdded = inMonth.reduce((s: number, h: any) => s + (h.bufContrib || 0), 0);
  const buffer = parseFloat(user.buffer) || 0;
  const rows = [
    row('Income logged', '$' + Math.round(totalIn).toLocaleString()),
    ...(debtPaid > 0 ? [row('Extra to debt', '$' + Math.round(debtPaid).toLocaleString())] : []),
    ...(bufAdded > 0 ? [row('Added to buffer', '$' + Math.round(bufAdded).toLocaleString())] : []),
    row('Buffer now', '$' + Math.round(buffer).toLocaleString()),
  ].join('');
  const inner = `<div style="font-size:24px;font-weight:900;letter-spacing:-.03em;line-height:1.15;color:#111c16;margin-bottom:12px;">${monthName} in Able.</div>
    <div style="font-size:14px;color:#4a5c52;font-weight:500;margin-bottom:20px;">Last month at a glance. Each month is a data point, not a verdict.</div>
    ${rows}${cta}`;
  return sendViaResend(admin, email, `${monthName} in Able`, layout(inner, unsubUrl(user.unsubscribe_token)), 'monthly_wrap', user.id);
}

async function sendCart(admin: any, email: string, user: any, stage: '24h' | '3d' | '7d') {
  const copy: Record<string, { subject: string; title: string; body: string }> = {
    '24h': {
      subject: 'Picking up where you left off',
      title: 'Picking up where you left off.',
      body: `You started setting up Able yesterday but didn't finish. No rush, your 7-day free trial is still here, and your account remembers everything you entered. Finishing takes about 2 minutes. We'll be here when you're ready.`,
    },
    '3d': {
      subject: 'Your free trial is still waiting',
      title: 'Your free trial is still waiting.',
      body: `It's been a few days since you signed up. We get it, money is energy, and sometimes we look away from it because there's something hard to look at. That's exactly what Able is built for: making the looking-at-it part feel less like a fight. Your 7-day trial hasn't started yet. It only begins when you finish setting up.`,
    },
    '7d': {
      subject: 'Last note from Able',
      title: 'Last note from us.',
      body: `We won't keep nudging. If now's not the right moment, that's OK, your account stays here whenever you want to come back. This is the last email in this sequence. No more reminders unless you start using Able.`,
    },
  };
  const c = copy[stage];
  const inner = `<div style="font-size:24px;font-weight:900;letter-spacing:-.03em;line-height:1.15;color:#111c16;margin-bottom:12px;">${c.title}</div>
    <div style="font-size:15px;line-height:1.6;color:#4a5c52;font-weight:500;margin-bottom:8px;">${c.body}</div>${cta}`;
  return sendViaResend(admin, email, c.subject, layout(inner, unsubUrl(user.unsubscribe_token)), `cart_${stage}`, user.id);
}

function escapeHtml(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function sendTrialDay5(admin: any, email: string, user: any) {
  const inner = `<div style="font-size:24px;font-weight:900;letter-spacing:-.03em;line-height:1.15;color:#111c16;margin-bottom:12px;">Your Able trial ends in 2 days.</div><div style="font-size:15px;line-height:1.6;color:#4a5c52;font-weight:500;margin-bottom:12px;">Quick heads up. In two days, your card gets charged for the plan you selected.</div><div style="font-size:15px;line-height:1.6;color:#4a5c52;font-weight:500;margin-bottom:12px;">If Able has clicked for you, no action needed. Subscription just starts on day 8.</div><div style="font-size:15px;line-height:1.6;color:#4a5c52;font-weight:500;margin-bottom:12px;">If it has not clicked yet, now is the window. Log any real income and see where it goes. That moment is the whole app. If it does not land, cancel from Settings before day 8.</div>${cta}`;
  return sendViaResend(admin, email, 'Your Able trial ends in 2 days', layout(inner, unsubUrl(user.unsubscribe_token)), 'trial_day_5_nudge', user.id);
}

async function sendTrialDay7(admin: any, email: string, user: any) {
  const inner = `<div style="font-size:24px;font-weight:900;letter-spacing:-.03em;line-height:1.15;color:#111c16;margin-bottom:12px;">Tomorrow: your Able subscription starts.</div><div style="font-size:15px;line-height:1.6;color:#4a5c52;font-weight:500;margin-bottom:12px;">Your 7-day trial ends tomorrow. Your card will be charged for the plan you selected.</div><div style="font-size:15px;line-height:1.6;color:#4a5c52;font-weight:500;margin-bottom:12px;">To continue, do nothing. The subscription starts automatically.</div><div style="font-size:15px;line-height:1.6;color:#4a5c52;font-weight:500;margin-bottom:12px;">To cancel, do it now in Settings. Two taps.</div>${cta}`;
  return sendViaResend(admin, email, 'Tomorrow: your Able subscription starts', layout(inner, unsubUrl(user.unsubscribe_token)), 'trial_day_7_last_call', user.id);
}

async function sendTrialEndedNoConvert(admin: any, email: string, user: any) {
  const inner = `<div style="font-size:24px;font-weight:900;letter-spacing:-.03em;line-height:1.15;color:#111c16;margin-bottom:12px;">Your trial ended. Tell me why.</div><div style="font-size:15px;line-height:1.6;color:#4a5c52;font-weight:500;margin-bottom:12px;">Your Able trial ended and your subscription did not continue. No charge, no hard feelings.</div><div style="font-size:15px;line-height:1.6;color:#4a5c52;font-weight:500;margin-bottom:12px;">One honest answer would genuinely help me: <strong style="color:#111c16;">what was missing for you?</strong> Expensive. Confusing. Not the right shape. Forgot. Whatever is true.</div><div style="font-size:15px;line-height:1.6;color:#4a5c52;font-weight:500;margin-bottom:12px;">Hit reply. I read everything. No follow-up drip, just this one.</div>${cta}`;
  return sendViaResend(admin, email, 'Your trial ended. Tell me why.', layout(inner, unsubUrl(user.unsubscribe_token)), 'trial_ended_no_convert', user.id);
}
