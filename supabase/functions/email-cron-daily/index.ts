import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
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

const SERVICE_ROLE = _getServiceKey();
const INTERNAL_SECRET = Deno.env.get('INTERNAL_FUNCTION_SECRET') ?? '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const CRON_SECRET = Deno.env.get('CRON_SECRET')!;
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'Able <onboarding@resend.dev>';
const APP_URL = (Deno.env.get('APP_URL') || 'https://becomeable.app').trim().replace(/\/$/, '');

const IS_PREVIEW = Deno.args.includes('--preview');

if (!IS_PREVIEW) Deno.serve(async (req) => {
  // Two auth paths:
  //   1. pg_cron — sends Bearer ${CRON_SECRET} via the daily schedule.
  //   2. Manual test — INTERNAL_FUNCTION_SECRET via x-internal-auth, used
  //      by scripts/test-email-trigger.sh. Both are project-level secrets;
  //      this is a backstop for testing without rotating CRON_SECRET (which
  //      would require also updating the pg_cron job).
  const auth = req.headers.get('Authorization') ?? '';
  const internalHeader = req.headers.get('x-internal-auth') ?? '';
  const isCron = auth === `Bearer ${CRON_SECRET}`;
  const isInternal = !!INTERNAL_SECRET && internalHeader === INTERNAL_SECRET;
  if (!isCron && !isInternal) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const results = {
    signup_completed: 0, trial_day_2: 0, first_income_next_day: 0,
    onboarding_day_7: 0, onboarding_day_14: 0,
    dormancy: 0, weekly: 0, bill_due: 0, low_buffer: 0, monthly_wrap: 0,
    cart_24h: 0, cart_3d: 0, cart_7d: 0,
    trial_day_5: 0, trial_day_7: 0, trial_ended_no_convert: 0,
    achievement: 0, deep_dive: 0,
    skipped: 0, errors: 0,
  };

  try {
    const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const authUsers = authData?.users ?? [];

    const { data: profiles } = await admin.from('profiles').select('id, subscription_status, trial_end_at');
    const profilesMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    let { data: userDataRows } = await admin
      .from('user_data')
      .select('id, last_active, email_prefs, unsubscribe_token, bills, buffer, history, settings, email_status');
    let userDataMap = new Map((userDataRows ?? []).map((u: any) => [u.id, u]));

    // Ensure every auth user has a user_data row so they all have an unsubscribe_token
    const missingIds = authUsers.filter((u: any) => !userDataMap.has(u.id)).map((u: any) => ({ id: u.id }));
    if (missingIds.length > 0) {
      await admin.from('user_data').upsert(missingIds, { onConflict: 'id', ignoreDuplicates: true });
      const refresh = await admin.from('user_data')
        .select('id, last_active, email_prefs, unsubscribe_token, bills, buffer, history, settings, email_status');
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

    // Plaid items with a recent deep-dive completion. Fetched once globally
    // and grouped by user. Per-item dedup means a multi-bank user gets one
    // email per item as each item's own deep-dive fires.
    const { data: deepDiveItems } = await admin
      .from('plaid_items')
      .select('id, user_id, deep_dive_completed_at, deep_dive_summary')
      .gte('deep_dive_completed_at', new Date(sevenDaysAgoMs).toISOString());
    const deepDiveByUser = new Map<string, any[]>();
    for (const item of (deepDiveItems ?? [])) {
      const sum = item.deep_dive_summary as any;
      if (!sum) continue;
      const total = (sum.new_bills || 0) + (sum.new_debts || 0) + (sum.new_sources || 0) + (sum.dormant_bills || 0);
      if (total === 0) continue; // skip items where the deep-dive found nothing new
      if (!deepDiveByUser.has(item.user_id)) deepDiveByUser.set(item.user_id, []);
      deepDiveByUser.get(item.user_id)!.push(item);
    }

    // Per-user day-window computation. The cron runs daily but each user's
    // "today" begins at THEIR local midnight, not UTC. Without this, weekly
    // digest, monthly_wrap, and bill_due_tomorrow day-shift for users
    // outside UTC. Tz is pulled from user_data.settings.timezone (auto-
    // detected by the browser via Intl.DateTimeFormat on saveUserData);
    // falls back to UTC when missing or invalid.
    function userTzWindow(tz: string): { isMonday: boolean; isFirstOfMonth: boolean; tomorrowDay: number; todayStartMs: number } {
      const safeTz = (tz && typeof tz === 'string') ? tz : 'UTC';
      let parts: Intl.DateTimeFormatPart[];
      try {
        parts = new Intl.DateTimeFormat('en-US', {
          timeZone: safeTz,
          year: 'numeric', month: '2-digit', day: '2-digit',
          weekday: 'short', hour: 'numeric', hour12: false,
        }).formatToParts(now);
      } catch {
        // Bad tz string. Re-run with UTC.
        parts = new Intl.DateTimeFormat('en-US', {
          timeZone: 'UTC',
          year: 'numeric', month: '2-digit', day: '2-digit',
          weekday: 'short', hour: 'numeric', hour12: false,
        }).formatToParts(now);
      }
      const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
      const weekdayMap: Record<string, number> = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 };
      const yyyy = Number(get('year'));
      const mm   = Number(get('month'));
      const dd   = Number(get('day'));
      const wd   = weekdayMap[get('weekday')] ?? 0;
      // todayStartMs in user's local midnight, expressed as UTC ms. Compute
      // the offset between the moment's user-local clock and UTC, then back
      // out the local-midnight wall clock.
      const localWallAsUtc = Date.UTC(yyyy, mm - 1, dd, Number(get('hour')) || 0);
      const offsetMs = localWallAsUtc - nowMs;
      const todayStartMs = Date.UTC(yyyy, mm - 1, dd) - offsetMs;
      // Tomorrow's day-of-month, computed from local midnight + 24h.
      const tomorrowMidnightUtc = todayStartMs + 24 * 60 * 60 * 1000;
      const tomorrowParts = new Intl.DateTimeFormat('en-US', {
        timeZone: safeTz, day: '2-digit',
      }).formatToParts(new Date(tomorrowMidnightUtc));
      const tomorrowDay = Number(tomorrowParts.find((p) => p.type === 'day')?.value ?? dd + 1);
      return {
        isMonday: wd === 1,
        isFirstOfMonth: dd === 1,
        tomorrowDay,
        todayStartMs,
      };
    }

    const paidStatuses = new Set(['active', 'trialing', 'lifetime']);

    for (const authUser of authUsers) {
      const userId = authUser.id;
      const email = authUser.email;
      if (!email) { results.skipped++; continue; }

      const userData: any = userDataMap.get(userId);
      const profile: any = profilesMap.get(userId);
      const prefs: any = userData?.email_prefs ?? {};
      const hasPaid = profile && paidStatuses.has(profile.subscription_status);

      // Skip users whose email Resend has flagged as hard-bounced or
      // complained. resend-webhook writes these states; we honor them here
      // so we don't keep pinging dead/angry addresses (sender-reputation
      // damage). Active and unset users continue normally.
      const emailStatus = userData?.email_status;
      if (emailStatus === 'bounced' || emailStatus === 'complained') {
        results.skipped++;
        continue;
      }

      // Day-window computed in this user's local timezone.
      const userTz = userData?.settings?.timezone || 'UTC';
      const { isMonday, isFirstOfMonth, tomorrowDay, todayStartMs } = userTzWindow(userTz);

      // Onboarding welcome series (paid users only — they completed checkout).
      // 5 emails over the first 14 days. Each is once-per-user-ever via
      // sentEver. Welcome-03 is event-based off the user's first deposit;
      // the others are calendar-from-signup. The 48h upper bound on
      // signup_completed prevents a flood when this code first deploys.
      if (hasPaid && userData?.unsubscribe_token) {
        const ageHours = (nowMs - new Date(authUser.created_at).getTime()) / 3_600_000;

        // Welcome-01: first cron after checkout, only for fresh signups.
        if (ageHours < 48 && !sentEver(userId, 'signup_completed')) {
          const ok = await sendSignupCompleted(admin, email, userData);
          if (ok) results.signup_completed++; else results.errors++;
        }

        // Welcome-02: t+48h. Window 36-72h.
        if (ageHours >= 36 && ageHours < 72 && !sentEver(userId, 'trial_day_2')) {
          const ok = await sendTrialDay2(admin, email, userData);
          if (ok) results.trial_day_2++; else results.errors++;
        }

        // Welcome-03: cron-day after first income logged. Find oldest history
        // entry; if it was logged 12-72h ago and we haven't sent yet, fire.
        // The 72h upper bound caps backfill if cron missed a run.
        if (!sentEver(userId, 'first_income_next_day')) {
          const history = Array.isArray(userData.history) ? userData.history : [];
          if (history.length > 0) {
            const firstDepositMs = history.reduce((min: number, h: any) => {
              const t = new Date(h.date).getTime();
              return Number.isFinite(t) && t < min ? t : min;
            }, Number.POSITIVE_INFINITY);
            const sinceDepositH = Number.isFinite(firstDepositMs) ? (nowMs - firstDepositMs) / 3_600_000 : 0;
            if (sinceDepositH >= 12 && sinceDepositH < 72) {
              const ok = await sendFirstIncomeNextDay(admin, email, userData);
              if (ok) results.first_income_next_day++; else results.errors++;
            }
          }
        }

        // Welcome-04: day 7 progress check. Window 6.5-7.5d.
        if (ageHours >= 156 && ageHours < 180 && !sentEver(userId, 'onboarding_day_7')) {
          const ok = await sendOnboardingDay7(admin, email, userData);
          if (ok) results.onboarding_day_7++; else results.errors++;
        }

        // Welcome-05: day 14 first review. Window 13.5-14.5d.
        if (ageHours >= 324 && ageHours < 348 && !sentEver(userId, 'onboarding_day_14')) {
          const ok = await sendOnboardingDay14(admin, email, userData);
          if (ok) results.onboarding_day_14++; else results.errors++;
        }
      }

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
            const ok = await sendTrial2DaysLeft(admin, email, userData);
            if (ok) results.trial_day_5++; else results.errors++;
          }
          if (hoursUntilEnd >= 12 && hoursUntilEnd <= 36 && !sentEver(userId, 'trial_day_7_last_call')) {
            const ok = await sendTrial24hLeft(admin, email, userData);
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
        // Also fire a web push (P2 #14) when configured. Best-effort —
        // failure here doesn't roll back the email send. send-push is a
        // no-op when the user hasn't subscribed.
        const billNames = billsDueTomorrow.map((b: any) => b.name).slice(0, 2).join(', ') + (billsDueTomorrow.length > 2 ? ` + ${billsDueTomorrow.length - 2} more` : '');
        const totalDue = billsDueTomorrow.reduce((s: number, b: any) => s + (b.amount || 0), 0);
        try {
          await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE_ROLE}`, 'x-internal-auth': INTERNAL_SECRET },
            body: JSON.stringify({
              user_id: userId,
              payload: {
                title: `Bill due tomorrow: $${Math.round(totalDue)}`,
                body: billNames,
                tag: 'bill-due-tomorrow',
                url: '/app.html#bills',
              },
            }),
          });
        } catch (e) {
          console.warn('send-push (bill_due_tomorrow) failed:', e);
        }
      }

      // Low buffer warning. Compare buffer against UNPAID bills only — including
      // paid ones inflated the threshold so the warning fired against money the
      // user had already covered.
      const monthlyBills = ((userData.bills ?? []) as any[]).filter(b => !b.paid).reduce((s: number, b: any) => s + (b.amount || 0), 0);
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

      // Gold-tier achievement unlocks. Source of truth is
      // user_data.settings.ach_dates (written by app.html _achStampNew).
      // Type=`achievement_${id}` so each gold achievement fires once per user
      // per achievement, ever. Multiple unlocks since last cron = multiple
      // emails this run, ordered by unlock time.
      if (prefs.achievement !== false) {
        const achDates: Record<string, string> = (userData?.settings?.ach_dates) || {};
        const fresh: Array<{ id: string; t: number }> = [];
        for (const [id, dateStr] of Object.entries(achDates)) {
          if (!(id in GOLD_ACHIEVEMENTS)) continue;
          const t = new Date(dateStr).getTime();
          if (!Number.isFinite(t)) continue;
          if (t < nowMs - 48 * 3_600_000) continue; // only unlocks from the last 48h
          if (sentEver(userId, `achievement_${id}`)) continue;
          fresh.push({ id, t });
        }
        fresh.sort((a, b) => a.t - b.t);
        for (const ach of fresh) {
          const ok = await sendAchievement(admin, email, userData, ach.id);
          if (ok) results.achievement++; else results.errors++;
        }
      }

      // Deep-dive summary, one email per plaid_item. The dedup type carries
      // the item id so a user with multiple banks gets one email per bank as
      // each bank's deep-dive completes.
      if (prefs.deep_dive !== false) {
        const userDdItems = deepDiveByUser.get(userId) || [];
        for (const item of userDdItems) {
          if (sentEver(userId, `deep_dive_summary_${item.id}`)) continue;
          const ok = await sendDeepDiveSummary(admin, email, userData, item);
          if (ok) results.deep_dive++; else results.errors++;
        }
      }
    }

    return json(req, results);
  } catch (e) {
    console.error('email-cron-daily error:', e);
    return json(req, { error: 'Internal server error' }, 500);
  }
});

function json(req: Request, body: unknown, status = 200) {
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

const unsubUrl = (token: string) => `${APP_URL}/u?token=${encodeURIComponent(token)}`;

// ============================================================
// Design tokens
// ============================================================

const T = {
  bg: '#f0f7f2',
  card: '#ffffff',
  rule: '#eaf5ee',
  ink: '#111c16',
  inkSoft: '#4a5c52',
  inkMuted: '#8ca898',
  inkLight: '#a8baad',
  green: '#2a7a4a',
  greenSoft: '#3d9e78',
  greenTint: '#e8f4ec',
  amber: '#b87a2a',
  amberTint: '#fdf3e3',
  terra: '#9e4f3a',
  terraTint: '#faeae3',
};

type Tone = 'green' | 'amber' | 'terra';

function toneStyle(tone: Tone): { line: string; tint: string; cta: string; eyebrow: string } {
  if (tone === 'amber') return { line: T.amber, tint: T.amberTint, cta: T.amber, eyebrow: T.amber };
  if (tone === 'terra') return { line: T.terra, tint: T.terraTint, cta: T.terra, eyebrow: T.terra };
  return { line: T.green, tint: T.greenTint, cta: T.green, eyebrow: T.green };
}

// Hand-drawn underline SVG matching the marketing-site nav-logo treatment.
const LOGO_UNDERLINE = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 4.2' preserveAspectRatio='none'><path d='M3 2.6 Q2 2.4 3 2.15 Q58 1.75 115 0.15 Q119 1 119 2 Q119 3 115 3.9 Q58 3.55 3 2.65 Q2 2.45 3 2.6 Z' fill='%232a7a4a'/></svg>`;

// ============================================================
// Component primitives
// ============================================================

function header(): string {
  return `<tr><td align="center" style="padding-bottom:22px;">
    <div style="display:inline-block;text-align:center;">
      <div style="font-weight:900;font-size:30px;letter-spacing:-.03em;color:${T.ink};line-height:1;">Able</div>
      <img src="${LOGO_UNDERLINE}" alt="" width="80" height="6" style="display:block;margin:4px auto 0;width:80px;height:6px;border:0;">
    </div>
  </td></tr>`;
}

function hero(opts: { eyebrow?: string; tone?: Tone; title: string; lede?: string }): string {
  const tone = opts.tone || 'green';
  const c = toneStyle(tone);
  const eb = opts.eyebrow
    ? `<div style="font-size:11px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:${c.eyebrow};margin-bottom:14px;">${opts.eyebrow}</div>`
    : '';
  const ld = opts.lede
    ? `<div style="font-size:15px;line-height:1.6;color:${T.inkSoft};font-weight:500;margin-top:14px;">${opts.lede}</div>`
    : '';
  return `${eb}<div style="font-size:26px;font-weight:900;letter-spacing:-.03em;line-height:1.15;color:${T.ink};">${opts.title}</div>${ld}`;
}

function heroNumber(opts: { label: string; value: string; sub?: string }): string {
  const sb = opts.sub ? `<div style="font-size:13px;color:${T.inkMuted};font-weight:600;margin-top:6px;">${opts.sub}</div>` : '';
  return `<div style="text-align:center;padding:24px 0 18px;">
    <div style="font-size:11px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:${T.inkMuted};">${opts.label}</div>
    <div style="font-size:46px;font-weight:900;letter-spacing:-.04em;line-height:1;color:${T.ink};margin-top:8px;">${opts.value}</div>
    ${sb}
  </div>`;
}

function stats(rows: Array<{ label: string; value: string; emphasis?: boolean }>): string {
  return rows.map((r, i) => {
    const isLast = i === rows.length - 1;
    const border = isLast ? '' : `border-bottom:1px solid ${T.rule};`;
    const labelWeight = r.emphasis ? '800' : '600';
    const labelColor = r.emphasis ? T.ink : T.inkSoft;
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
      <td style="padding:13px 0;${border}font-size:14px;color:${labelColor};font-weight:${labelWeight};">${r.label}</td>
      <td align="right" style="padding:13px 0;${border}font-size:14px;color:${T.ink};font-weight:800;">${r.value}</td>
    </tr></table>`;
  }).join('');
}

// Table-based bar chart. Works in every email client including Outlook desktop
// (which falls back to Word's renderer and butchers SVG / inline-block bars).
function bars(items: Array<{ label: string; value: number }>, fmt: (n: number) => string = money): string {
  if (items.length === 0) return '';
  const max = Math.max(...items.map((i) => i.value), 1);
  const rows = items.map((i) => {
    const pct = Math.max(2, Math.round((i.value / max) * 100));
    const empty = 100 - pct;
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:9px;"><tr>
      <td width="48" style="font-size:12px;color:${T.inkSoft};font-weight:700;padding-right:10px;white-space:nowrap;">${i.label}</td>
      <td>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
          <td width="${pct}%" style="background:${T.green};height:10px;border-radius:5px 0 0 5px;font-size:1px;line-height:1px;">&nbsp;</td>
          <td width="${empty}%" style="background:${T.rule};height:10px;border-radius:0 5px 5px 0;font-size:1px;line-height:1px;">&nbsp;</td>
        </tr></table>
      </td>
      <td width="80" align="right" style="font-size:12px;color:${T.ink};font-weight:800;padding-left:10px;white-space:nowrap;">${i.value > 0 ? fmt(i.value) : '—'}</td>
    </tr></table>`;
  }).join('');
  return `<div style="margin-top:18px;">${rows}</div>`;
}

function callout(opts: { tone: Tone; body: string }): string {
  const c = toneStyle(opts.tone);
  return `<div style="background:${c.tint};border-radius:12px;padding:14px 16px;margin-top:16px;font-size:14px;line-height:1.55;color:${T.inkSoft};font-weight:500;">${opts.body}</div>`;
}

function paragraph(body: string, opts: { topMargin?: number } = {}): string {
  const m = opts.topMargin ?? 14;
  return `<div style="font-size:15px;line-height:1.6;color:${T.inkSoft};font-weight:500;margin-top:${m}px;">${body}</div>`;
}

function cta(opts: { label: string; href: string; tone?: Tone }): string {
  const c = toneStyle(opts.tone || 'green');
  return `<div style="text-align:center;margin-top:24px;"><a href="${opts.href}" style="display:inline-block;background:${c.cta};color:#ffffff;padding:14px 28px;border-radius:14px;font-weight:800;text-decoration:none;font-size:15px;letter-spacing:-.01em;box-shadow:0 4px 16px rgba(42,122,74,.3);">${opts.label}</a></div>`;
}

function footer(unsub: string): string {
  return `<tr><td align="center" style="padding-top:20px;font-size:12px;color:${T.inkMuted};line-height:1.6;">
    <a href="${APP_URL}/app.html" style="color:${T.green};font-weight:700;text-decoration:none;">Open Able</a>
    &middot;
    <a href="${unsub}" style="color:${T.inkMuted};text-decoration:underline;">Unsubscribe</a>
    <div style="margin-top:8px;font-size:11px;color:${T.inkLight};">Able App &middot; 7548 E Savanna River St, Nampa, ID 83687, USA</div>
    <div style="margin-top:2px;font-size:11px;color:${T.inkLight};">becomeable.app</div>
  </td></tr>`;
}

function layout(opts: { tone: Tone; inner: string; unsub: string }): string {
  const c = toneStyle(opts.tone);
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"></head>
<body style="margin:0;padding:0;background:${T.bg};font-family:Helvetica,Arial,sans-serif;color:${T.ink};-webkit-font-smoothing:antialiased;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${T.bg};"><tr><td align="center" style="padding:36px 16px 32px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:520px;">
  ${header()}
  <tr><td style="background:${T.card};border-radius:18px;overflow:hidden;box-shadow:0 2px 12px rgba(42,122,74,.08);">
    <div style="height:4px;background:${c.line};background-image:linear-gradient(90deg,${c.line},${T.greenSoft});"></div>
    <div style="padding:28px 24px;">${opts.inner}</div>
  </td></tr>
  ${footer(opts.unsub)}
</table>
</td></tr></table>
</body></html>`;
}

// ============================================================
// Helpers
// ============================================================

function money(n: number): string {
  return '$' + Math.round(n).toLocaleString();
}

function escapeHtml(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const openAble = (tone: Tone = 'green') => cta({ label: 'Open Able', href: `${APP_URL}/app.html`, tone });

// ============================================================
// Pure builders. Return { subject, html }. Called by sender wrappers
// in production and by renderPreview() locally.
// ============================================================

// Welcome-01. Fires on the first cron after a user has completed checkout
// (paidStatuses includes 'trialing'). Confirms account, one job: log a deposit.
function buildSignupCompleted(user: any, unsub: string): { subject: string; html: string } {
  const inner = hero({
    title: "You're in.",
    lede: 'Account is ready.',
  })
    + paragraph(`Log your next deposit when it lands. Even a small one. Watching where the money goes is the whole app.`, { topMargin: 18 })
    + openAble('green');
  return {
    subject: "you're in",
    html: layout({ tone: 'green', inner, unsub }),
  };
}

// Welcome-02. Fires 36-72h after signup. Explains the 5-bucket order with a
// worked example. The order is the part most people miss: bills get covered
// before debt or spending get a piece.
function buildTrialDay2(user: any, unsub: string): { subject: string; html: string } {
  const exampleRows = [
    { label: 'Taxes', value: '$200' },
    { label: 'Bills due in your window', value: '$450' },
    { label: 'Smoothing reserve', value: '$150' },
    { label: 'Debt', value: '$100' },
    { label: 'Free spending', value: '$100' },
  ];
  const inner = hero({
    eyebrow: 'Day 2',
    title: 'The part most people miss.',
  })
    + paragraph(`Most budgeting apps split your money by category. Able splits it by purpose.`, { topMargin: 18 })
    + paragraph(`Every deposit gets sorted into five jobs, in order: taxes, bills due in your window, smoothing reserve, debt, free spending. The order matters. Bills get covered before anything else gets a piece.`, { topMargin: 10 })
    + `<div style="margin-top:18px;font-size:11px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:${T.inkMuted};">Example deposit: $1,000</div>`
    + `<div style="margin-top:8px;">${stats(exampleRows)}</div>`
    + paragraph(`Your numbers will be different. The order stays the same.`, { topMargin: 14 })
    + openAble('green');
  return {
    subject: 'the part most people miss',
    html: layout({ tone: 'green', inner, unsub }),
  };
}

// Welcome-03. Fires the cron-day after the first income is logged. Highest-
// engagement moment in the lifecycle. Celebrate briefly, reinforce the
// pattern, set the expectation that the value compounds.
function buildFirstIncomeNextDay(user: any, unsub: string): { subject: string; html: string } {
  const history = Array.isArray(user.history) ? user.history : [];
  const firstDeposit = history.length > 0
    ? history.reduce((min: any, h: any) => (new Date(h.date).getTime() < new Date(min.date).getTime() ? h : min), history[0])
    : null;
  const amount = firstDeposit?.amount ? money(firstDeposit.amount) : null;
  const lede = amount
    ? `Yesterday you logged ${amount}. That's the moment Able starts working.`
    : `Yesterday you logged your first deposit. That's the moment Able starts working.`;
  const inner = hero({ eyebrow: 'First deposit', title: 'First one in.', lede })
    + paragraph(`From here, every deposit gets sorted the same way. Taxes first. Bills due in your window next. Reserve, debt, spending after. The pattern compounds.`, { topMargin: 18 })
    + callout({ tone: 'green', body: `Two weeks of data and the smoothing curve starts to make sense. A month and the rhythm becomes visible.` })
    + cta({ label: 'Log today\'s deposit', href: `${APP_URL}/app.html`, tone: 'green' });
  return {
    subject: 'first one in',
    html: layout({ tone: 'green', inner, unsub }),
  };
}

// Welcome-04. Day 7 progress check. Adapts to whether the user has been
// active. Anti-guilt rule: a quiet week never reads as failure.
function buildOnboardingDay7(user: any, unsub: string): { subject: string; html: string } {
  const history = Array.isArray(user.history) ? user.history : [];
  const cutoffMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = history.filter((h: any) => new Date(h.date).getTime() >= cutoffMs);
  const totalIn = recent.reduce((s: number, h: any) => s + (h.amount || 0), 0);
  const debtPaid = recent.reduce((s: number, h: any) => s + (h.debtExtra || 0), 0);
  const bufAdded = recent.reduce((s: number, h: any) => s + (h.bufContrib || 0), 0);

  if (recent.length === 0) {
    // Quiet week. Anti-guilt copy.
    const inner = hero({ eyebrow: 'Week 1', title: 'Still here?' })
      + paragraph(`Setting up Able takes two minutes. Logging the first deposit takes thirty seconds. After that the app starts to feel real.`, { topMargin: 18 })
      + paragraph(`If this was a hard week, that's fine. Your account stays put.`, { topMargin: 10 })
      + openAble('green');
    return {
      subject: 'still here?',
      html: layout({ tone: 'green', inner, unsub }),
    };
  }

  const statRows: Array<{ label: string; value: string }> = [
    { label: 'Deposits logged', value: String(recent.length) },
  ];
  if (debtPaid > 0) statRows.push({ label: 'Extra to debt', value: money(debtPaid) });
  if (bufAdded > 0) statRows.push({ label: 'Added to reserve', value: money(bufAdded) });

  const inner = hero({ eyebrow: 'Week 1', title: 'A week in.' })
    + heroNumber({ label: 'Income logged', value: money(totalIn) })
    + `<div style="margin-top:18px;">${stats(statRows)}</div>`
    + paragraph(`Week one patterns matter less than week two. Keep logging.`, { topMargin: 14 })
    + openAble('green');
  return {
    subject: 'a week in',
    html: layout({ tone: 'green', inner, unsub }),
  };
}

// Welcome-05. Day 14 first review. Two weeks of data is the first horizon
// where Able's smoothing math gets meaningful. Sets up monthly_wrap which
// fires on the 1st of next month.
function buildOnboardingDay14(user: any, unsub: string): { subject: string; html: string } {
  const history = Array.isArray(user.history) ? user.history : [];
  const cutoffMs = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const recent = history.filter((h: any) => new Date(h.date).getTime() >= cutoffMs);
  const totalIn = recent.reduce((s: number, h: any) => s + (h.amount || 0), 0);
  const debtPaid = recent.reduce((s: number, h: any) => s + (h.debtExtra || 0), 0);
  const bufAdded = recent.reduce((s: number, h: any) => s + (h.bufContrib || 0), 0);
  const buffer = parseFloat(user.buffer) || 0;

  const statRows: Array<{ label: string; value: string }> = [
    { label: 'Deposits logged', value: String(recent.length) },
  ];
  if (debtPaid > 0) statRows.push({ label: 'Extra to debt', value: money(debtPaid) });
  if (bufAdded > 0) statRows.push({ label: 'Added to reserve', value: money(bufAdded) });
  statRows.push({ label: 'Reserve now', value: money(buffer) });

  const inner = hero({ eyebrow: 'Two weeks', title: 'Two weeks of data.' })
    + heroNumber({ label: 'Income logged', value: money(totalIn), sub: `${recent.length} deposit${recent.length === 1 ? '' : 's'}` })
    + `<div style="margin-top:18px;">${stats(statRows)}</div>`
    + paragraph(`This is enough for the first real pattern to show up. The smoothing curve, the bills-due rhythm, how the two line up.`, { topMargin: 14 })
    + paragraph(`Month one is almost done. The first monthly wrap will compare these two weeks to the next two.`, { topMargin: 10 })
    + openAble('green');
  return {
    subject: 'two weeks of data',
    html: layout({ tone: 'green', inner, unsub }),
  };
}

function buildDormancy(user: any, unsub: string): { subject: string; html: string } {
  const bills = Array.isArray(user.bills) ? user.bills : [];
  const unpaidCount = bills.filter((b: any) => !b.paid).length;
  const buffer = parseFloat(user.buffer) || 0;
  const lede = unpaidCount > 0
    ? `${unpaidCount} bill${unpaidCount === 1 ? '' : 's'} to handle soon. ${buffer > 0 ? `Reserve at <strong style="color:${T.ink};">${money(buffer)}</strong>.` : ''}`.trim()
    : `You're current on bills. ${buffer > 0 ? `Reserve sits at <strong style="color:${T.ink};">${money(buffer)}</strong>.` : 'Quick check-in to keep the rhythm going.'}`;
  const inner = hero({ title: 'A quick check-in.', lede })
    + openAble('green');
  return {
    subject: 'A quick check-in',
    html: layout({ tone: 'green', inner, unsub }),
  };
}

function buildWeekly(user: any, unsub: string): { subject: string; html: string } {
  const history = Array.isArray(user.history) ? user.history : [];
  const cutoffMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = history.filter((h: any) => new Date(h.date).getTime() >= cutoffMs);
  const totalIn = recent.reduce((s: number, h: any) => s + (h.amount || 0), 0);
  const debtPaid = recent.reduce((s: number, h: any) => s + (h.debtExtra || 0), 0);
  const bufAdded = recent.reduce((s: number, h: any) => s + (h.bufContrib || 0), 0);
  const buffer = parseFloat(user.buffer) || 0;

  // Per-day buckets ending today, in user-local time when known.
  const dayBuckets: Array<{ label: string; value: number }> = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const label = d.toLocaleDateString('en-US', { weekday: 'short' });
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    const v = recent
      .filter((h: any) => { const t = new Date(h.date).getTime(); return t >= dayStart && t < dayEnd; })
      .reduce((s: number, h: any) => s + (h.amount || 0), 0);
    dayBuckets.push({ label, value: v });
  }

  const statRows: Array<{ label: string; value: string }> = [];
  if (debtPaid > 0) statRows.push({ label: 'Extra to debt', value: money(debtPaid) });
  if (bufAdded > 0) statRows.push({ label: 'Added to reserve', value: money(bufAdded) });
  statRows.push({ label: 'Reserve now', value: money(buffer) });

  const inner = hero({ eyebrow: 'Last 7 days', title: 'Your week in Able.' })
    + heroNumber({ label: 'Income logged', value: money(totalIn), sub: `${recent.length} deposit${recent.length === 1 ? '' : 's'}` })
    + bars(dayBuckets)
    + `<div style="margin-top:18px;">${stats(statRows)}</div>`
    + openAble('green');
  return {
    subject: 'Your week in Able',
    html: layout({ tone: 'green', inner, unsub }),
  };
}

function buildBillDue(user: any, bills: any[], unsub: string): { subject: string; html: string } {
  const total = bills.reduce((s: number, b: any) => s + (b.amount || 0), 0);
  const billRows = bills.map((b: any) => ({ label: escapeHtml(b.name), value: money(b.amount) }));
  const totalRow = stats([{ label: 'Total', value: money(total), emphasis: true }]);
  const inner = hero({
    eyebrow: 'Heads up',
    tone: 'amber',
    title: `${bills.length} bill${bills.length === 1 ? '' : 's'} due tomorrow.`,
    lede: `If you've already allocated, no action needed.`,
  })
    + `<div style="margin-top:18px;">${stats(billRows)}</div>`
    + totalRow
    + cta({ label: 'View bills', href: `${APP_URL}/app.html#bills`, tone: 'amber' });
  return {
    subject: `${bills.length} bill${bills.length === 1 ? '' : 's'} due tomorrow`,
    html: layout({ tone: 'amber', inner, unsub }),
  };
}

function buildLowBuffer(user: any, buffer: number, monthlyBills: number, unsub: string): { subject: string; html: string } {
  const pct = Math.round((buffer / monthlyBills) * 100);
  // Coach-stress moment. The "money flows in waves" line is the only place
  // in the email set where the energy/waves framing is allowed.
  const inner = hero({ eyebrow: 'Coach', tone: 'terra', title: 'A gentle nudge.' })
    + heroNumber({ label: 'Your reserve', value: money(buffer), sub: `About ${pct}% of one month of bills` })
    + callout({ tone: 'terra', body: `Money flows in waves, and slow stretches are part of the cycle. This is the moment to be intentional with the next few decisions. Slow expenses where you can. More is on its way.` })
    + cta({ label: 'See your plan', href: `${APP_URL}/app.html`, tone: 'terra' });
  return {
    subject: 'Your reserve is running low',
    html: layout({ tone: 'terra', inner, unsub }),
  };
}

function buildMonthlyWrap(user: any, unsub: string): { subject: string; html: string } {
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

  // Per-week buckets across the month (ISO weeks anchored to month start).
  const weekBuckets: Array<{ label: string; value: number }> = [];
  const monthDays = (monthEndMs - monthStartMs) / (24 * 60 * 60 * 1000);
  const weeks = Math.ceil(monthDays / 7);
  for (let w = 0; w < weeks; w++) {
    const wStart = monthStartMs + w * 7 * 24 * 60 * 60 * 1000;
    const wEnd = Math.min(wStart + 7 * 24 * 60 * 60 * 1000, monthEndMs);
    const v = inMonth
      .filter((h: any) => { const t = new Date(h.date).getTime(); return t >= wStart && t < wEnd; })
      .reduce((s: number, h: any) => s + (h.amount || 0), 0);
    weekBuckets.push({ label: `Wk ${w + 1}`, value: v });
  }

  const statRows: Array<{ label: string; value: string }> = [];
  if (debtPaid > 0) statRows.push({ label: 'Extra to debt', value: money(debtPaid) });
  if (bufAdded > 0) statRows.push({ label: 'Added to reserve', value: money(bufAdded) });
  statRows.push({ label: 'Reserve now', value: money(buffer) });

  const inner = hero({ eyebrow: monthName, title: `${monthName} in Able.`, lede: 'Each month is a data point, not a verdict.' })
    + heroNumber({ label: 'Income this month', value: money(totalIn), sub: `${inMonth.length} deposit${inMonth.length === 1 ? '' : 's'}` })
    + bars(weekBuckets)
    + `<div style="margin-top:18px;">${stats(statRows)}</div>`
    + openAble('green');
  return {
    subject: `${monthName} in Able`,
    html: layout({ tone: 'green', inner, unsub }),
  };
}

function buildCart(user: any, stage: '24h' | '3d' | '7d', unsub: string): { subject: string; html: string } {
  const copy: Record<string, { subject: string; eyebrow?: string; title: string; lede: string; tail?: string; ctaLabel: string }> = {
    '24h': {
      subject: 'Picking up where you left off',
      eyebrow: 'Day 1',
      title: 'Picking up where you left off.',
      lede: `You started setting up Able yesterday. Your account remembers everything you entered. Two minutes finishes it.`,
      tail: '30-day free trial. Card required, no charge until day 31.',
      ctaLabel: 'Finish setup',
    },
    '3d': {
      subject: 'Your free trial is still waiting',
      eyebrow: 'Day 3',
      title: 'Your free trial is still waiting.',
      lede: `It's been a few days since signup. Your 30-day trial only starts when setup is finished.`,
      tail: 'Card required, no charge until day 31.',
      ctaLabel: 'Finish setup',
    },
    '7d': {
      subject: 'Last note from us',
      eyebrow: 'Day 7',
      title: 'Last note from us.',
      lede: `We won't keep nudging. If now isn't the right moment, that's OK. Your account stays here whenever you want to come back. This is the last email in this sequence.`,
      ctaLabel: 'Open Able',
    },
  };
  const c = copy[stage];
  const inner = hero({ eyebrow: c.eyebrow, title: c.title, lede: c.lede })
    + (c.tail ? callout({ tone: 'green', body: c.tail }) : '')
    + cta({ label: c.ctaLabel, href: `${APP_URL}/app.html`, tone: 'green' });
  return {
    subject: c.subject,
    html: layout({ tone: 'green', inner, unsub }),
  };
}

function buildTrial2DaysLeft(user: any, unsub: string): { subject: string; html: string } {
  const inner = hero({ eyebrow: 'Heads up', title: 'Your trial ends in 2 days.' })
    + heroNumber({ label: 'Days left', value: '2', sub: 'Card on file gets charged on day 31' })
    + paragraph(`If Able has clicked, no action needed. Subscription starts automatically.`, { topMargin: 18 })
    + paragraph(`If it hasn't clicked yet, this is the window. Log a real deposit and watch where it goes. That moment is the whole app. If it doesn't land, cancel from Settings before day 31.`, { topMargin: 10 })
    + openAble('green');
  return {
    subject: 'Your trial ends in 2 days',
    html: layout({ tone: 'green', inner, unsub }),
  };
}

function buildTrial24hLeft(user: any, unsub: string): { subject: string; html: string } {
  const inner = hero({ eyebrow: 'Last call', tone: 'amber', title: 'Your trial ends tomorrow.' })
    + paragraph(`To continue, do nothing. Subscription starts automatically.`, { topMargin: 18 })
    + paragraph(`To cancel, do it now in Settings. Two taps.`, { topMargin: 10 })
    + openAble('amber');
  return {
    subject: 'Your trial ends tomorrow',
    html: layout({ tone: 'amber', inner, unsub }),
  };
}

function buildTrialEndedNoConvert(user: any, unsub: string): { subject: string; html: string } {
  const inner = hero({ title: 'Your trial ended. Tell me why.', lede: `Your Able trial ended and the subscription didn't continue. No charge, no hard feelings.` })
    + callout({ tone: 'green', body: `One honest answer would help: <strong style="color:${T.ink};">what was missing?</strong> Expensive. Confusing. Wrong shape. Forgot. Whatever's true.` })
    + paragraph(`Hit reply. I read everything. No follow-up drip, just this one.`, { topMargin: 14 })
    + openAble('green');
  return {
    subject: 'Your trial ended. Tell me why.',
    html: layout({ tone: 'green', inner, unsub }),
  };
}

// Gold-tier achievements that warrant an email. Mirrors the `gold:true` set
// in app.html ACHIEVEMENTS. Names + blurbs live here so email-cron-daily
// doesn't depend on app.html parsing. Keep names in sync if app.html renames.
const GOLD_ACHIEVEMENTS: Record<string, { name: string; blurb: string }> = {
  halfway_to_able: {
    name: 'Halfway There',
    blurb: 'Your reserve covers half a month of bills. Slow stretches just got easier to ride out.',
  },
  one_month_ahead: {
    name: 'One Month Ahead',
    blurb: 'Your reserve covers a full month of bills. You built a real cushion.',
  },
  debt_free: {
    name: 'Debt Free Day',
    blurb: 'Every tracked debt is at zero. This is a different season.',
  },
  streak_12: {
    name: 'A Year Above',
    blurb: 'Twelve straight months of clearing the floor. The rhythm is yours.',
  },
  score_100: {
    name: 'Perfect Month',
    blurb: 'A full 100 on your monthly score. Every habit lined up.',
  },
  refer_ten_joined: {
    name: '10 Friends Joined',
    blurb: 'Ten people you brought to Able stuck around. Thank you.',
  },
};

function buildAchievement(user: any, achievementId: string, unsub: string): { subject: string; html: string } {
  const ach = GOLD_ACHIEVEMENTS[achievementId];
  if (!ach) {
    // Defensive: caller should never pass an unknown id, but render a generic
    // shell rather than crash the cron.
    const fallback = hero({ title: 'Achievement unlocked.', lede: 'Open Able to see what just landed.' }) + openAble('green');
    return { subject: 'Achievement unlocked', html: layout({ tone: 'green', inner: fallback, unsub }) };
  }
  const inner = hero({ eyebrow: 'Achievement unlocked', title: ach.name, lede: ach.blurb })
    + cta({ label: 'See your progress', href: `${APP_URL}/app.html#score`, tone: 'green' });
  return {
    subject: `Achievement unlocked: ${ach.name}`,
    html: layout({ tone: 'green', inner, unsub }),
  };
}

function buildDeepDiveSummary(user: any, summary: { new_bills: number; new_debts: number; new_sources: number; dormant_bills: number }, unsub: string): { subject: string; html: string } {
  const rows: Array<{ label: string; value: string }> = [];
  if (summary.new_bills > 0) rows.push({ label: 'New bills detected', value: String(summary.new_bills) });
  if (summary.new_sources > 0) rows.push({ label: 'New income sources', value: String(summary.new_sources) });
  if (summary.new_debts > 0) rows.push({ label: 'New debts detected', value: String(summary.new_debts) });
  if (summary.dormant_bills > 0) rows.push({ label: 'Bills flagged dormant', value: String(summary.dormant_bills) });

  const inner = hero({
    eyebrow: 'Deeper look',
    title: 'We took a deeper look at your account.',
    lede: 'Going back six months of bank history surfaced a few things to review. Nothing was added without your sign-off, just flagged for you to keep, edit, or remove.',
  })
    + `<div style="margin-top:18px;">${stats(rows)}</div>`
    + cta({ label: 'Review in app', href: `${APP_URL}/app.html`, tone: 'green' });
  return {
    subject: 'We took a deeper look at your account',
    html: layout({ tone: 'green', inner, unsub }),
  };
}

// ============================================================
// Sender wrappers. Build, then send.
// ============================================================

async function sendSignupCompleted(admin: any, email: string, user: any) {
  const { subject, html } = buildSignupCompleted(user, unsubUrl(user.unsubscribe_token));
  return sendViaResend(admin, email, subject, html, 'signup_completed', user.id);
}

async function sendTrialDay2(admin: any, email: string, user: any) {
  const { subject, html } = buildTrialDay2(user, unsubUrl(user.unsubscribe_token));
  return sendViaResend(admin, email, subject, html, 'trial_day_2', user.id);
}

async function sendFirstIncomeNextDay(admin: any, email: string, user: any) {
  const { subject, html } = buildFirstIncomeNextDay(user, unsubUrl(user.unsubscribe_token));
  return sendViaResend(admin, email, subject, html, 'first_income_next_day', user.id);
}

async function sendOnboardingDay7(admin: any, email: string, user: any) {
  const { subject, html } = buildOnboardingDay7(user, unsubUrl(user.unsubscribe_token));
  return sendViaResend(admin, email, subject, html, 'onboarding_day_7', user.id);
}

async function sendOnboardingDay14(admin: any, email: string, user: any) {
  const { subject, html } = buildOnboardingDay14(user, unsubUrl(user.unsubscribe_token));
  return sendViaResend(admin, email, subject, html, 'onboarding_day_14', user.id);
}

async function sendDormancy(admin: any, email: string, user: any) {
  const { subject, html } = buildDormancy(user, unsubUrl(user.unsubscribe_token));
  return sendViaResend(admin, email, subject, html, 'dormancy', user.id);
}

async function sendWeekly(admin: any, email: string, user: any) {
  const { subject, html } = buildWeekly(user, unsubUrl(user.unsubscribe_token));
  return sendViaResend(admin, email, subject, html, 'weekly', user.id);
}

async function sendBillDue(admin: any, email: string, user: any, bills: any[]) {
  const { subject, html } = buildBillDue(user, bills, unsubUrl(user.unsubscribe_token));
  return sendViaResend(admin, email, subject, html, 'bill_due_tomorrow', user.id);
}

async function sendLowBuffer(admin: any, email: string, user: any, buffer: number, monthlyBills: number) {
  const { subject, html } = buildLowBuffer(user, buffer, monthlyBills, unsubUrl(user.unsubscribe_token));
  return sendViaResend(admin, email, subject, html, 'low_buffer', user.id);
}

async function sendMonthlyWrap(admin: any, email: string, user: any) {
  const { subject, html } = buildMonthlyWrap(user, unsubUrl(user.unsubscribe_token));
  return sendViaResend(admin, email, subject, html, 'monthly_wrap', user.id);
}

async function sendCart(admin: any, email: string, user: any, stage: '24h' | '3d' | '7d') {
  const { subject, html } = buildCart(user, stage, unsubUrl(user.unsubscribe_token));
  return sendViaResend(admin, email, subject, html, `cart_${stage}`, user.id);
}

async function sendTrial2DaysLeft(admin: any, email: string, user: any) {
  const { subject, html } = buildTrial2DaysLeft(user, unsubUrl(user.unsubscribe_token));
  // DB type string preserved for the (user_id, type, sent_day) unique index.
  return sendViaResend(admin, email, subject, html, 'trial_day_5_nudge', user.id);
}

async function sendTrial24hLeft(admin: any, email: string, user: any) {
  const { subject, html } = buildTrial24hLeft(user, unsubUrl(user.unsubscribe_token));
  // DB type string preserved for the (user_id, type, sent_day) unique index.
  return sendViaResend(admin, email, subject, html, 'trial_day_7_last_call', user.id);
}

async function sendTrialEndedNoConvert(admin: any, email: string, user: any) {
  const { subject, html } = buildTrialEndedNoConvert(user, unsubUrl(user.unsubscribe_token));
  return sendViaResend(admin, email, subject, html, 'trial_ended_no_convert', user.id);
}

async function sendAchievement(admin: any, email: string, user: any, achievementId: string) {
  const { subject, html } = buildAchievement(user, achievementId, unsubUrl(user.unsubscribe_token));
  // Per-achievement type so the (user_id, type) unique constraint fires the
  // email exactly once per user per achievement, ever.
  return sendViaResend(admin, email, subject, html, `achievement_${achievementId}`, user.id);
}

async function sendDeepDiveSummary(admin: any, email: string, user: any, item: any) {
  const summary = item.deep_dive_summary || {};
  const { subject, html } = buildDeepDiveSummary(user, summary, unsubUrl(user.unsubscribe_token));
  // Per-item type so each plaid_item's deep-dive fires one email max. A user
  // who links a 2nd bank later gets a second deep-dive email when that item's
  // own deep-dive completes.
  return sendViaResend(admin, email, subject, html, `deep_dive_summary_${item.id}`, user.id);
}

// ============================================================
// Local preview. Run via:
//   deno run --allow-read --allow-write --allow-env \
//     supabase/functions/email-cron-daily/index.ts --preview
// Writes scripts/email-preview.html with all 11 templates rendered against
// sample data. No DB or Resend calls. Useful before pushing the function.
// ============================================================

async function renderPreview(): Promise<void> {
  const fakeUnsub = 'https://becomeable.app/u?token=preview';
  const dayMs = 86_400_000;
  const today = Date.now();

  // Last-7-day deposits, varied to make the bars look natural.
  const recentHistory = [
    { date: new Date(today - 6 * dayMs).toISOString(), amount: 850, debtExtra: 80, bufContrib: 60 },
    { date: new Date(today - 4 * dayMs).toISOString(), amount: 1240, debtExtra: 120, bufContrib: 90 },
    { date: new Date(today - 2 * dayMs).toISOString(), amount: 600, debtExtra: 50, bufContrib: 40 },
    { date: new Date(today - 0 * dayMs).toISOString(), amount: 380, debtExtra: 30, bufContrib: 25 },
  ];

  // Last-month history for monthly_wrap.
  const lastMonth = new Date(); lastMonth.setMonth(lastMonth.getMonth() - 1);
  const monthHistory: any[] = [];
  for (let i = 0; i < 9; i++) {
    const d = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 2 + i * 3);
    monthHistory.push({ date: d.toISOString(), amount: Math.round(400 + Math.random() * 1500), debtExtra: 80, bufContrib: 60 });
  }

  const userBase = {
    bills: [
      { name: 'Rent', amount: 1200, paid: false, due: '15', freq: 'monthly' },
      { name: 'Internet', amount: 89, paid: false, due: '5', freq: 'monthly' },
      { name: 'Phone', amount: 45, paid: false, due: '12', freq: 'monthly' },
    ],
    buffer: 1850,
  };
  const userWeek = { ...userBase, history: recentHistory };
  const userMonth = { ...userBase, history: monthHistory };
  const userLowBuf = { ...userBase, buffer: 480 };
  const billsTomorrow = [{ name: 'Rent', amount: 1200 }, { name: 'Internet', amount: 89 }];

  const sampleDeepDive = {
    deep_dive_summary: { new_bills: 4, new_debts: 1, new_sources: 2, dormant_bills: 1 },
    id: 'preview-item-id',
  };

  const userFirstIncome = { ...userBase, history: [{ date: new Date(today - 1 * dayMs).toISOString(), amount: 1240 }] };
  const userQuietWeek = { ...userBase, history: [] };

  const templates = [
    { id: 'signup_completed', built: buildSignupCompleted(userBase, fakeUnsub) },
    { id: 'trial_day_2', built: buildTrialDay2(userBase, fakeUnsub) },
    { id: 'first_income_next_day', built: buildFirstIncomeNextDay(userFirstIncome, fakeUnsub) },
    { id: 'onboarding_day_7_active', built: buildOnboardingDay7(userWeek, fakeUnsub) },
    { id: 'onboarding_day_7_quiet', built: buildOnboardingDay7(userQuietWeek, fakeUnsub) },
    { id: 'onboarding_day_14', built: buildOnboardingDay14(userWeek, fakeUnsub) },
    { id: 'dormancy', built: buildDormancy(userBase, fakeUnsub) },
    { id: 'weekly', built: buildWeekly(userWeek, fakeUnsub) },
    { id: 'bill_due_tomorrow', built: buildBillDue(userBase, billsTomorrow, fakeUnsub) },
    { id: 'low_buffer', built: buildLowBuffer(userLowBuf, 480, 1334, fakeUnsub) },
    { id: 'monthly_wrap', built: buildMonthlyWrap(userMonth, fakeUnsub) },
    { id: 'cart_24h', built: buildCart(userBase, '24h', fakeUnsub) },
    { id: 'cart_3d', built: buildCart(userBase, '3d', fakeUnsub) },
    { id: 'cart_7d', built: buildCart(userBase, '7d', fakeUnsub) },
    { id: 'trial_2_days_left', built: buildTrial2DaysLeft(userBase, fakeUnsub) },
    { id: 'trial_last_day', built: buildTrial24hLeft(userBase, fakeUnsub) },
    { id: 'trial_ended_no_convert', built: buildTrialEndedNoConvert(userBase, fakeUnsub) },
    { id: 'achievement_one_month_ahead', built: buildAchievement(userBase, 'one_month_ahead', fakeUnsub) },
    { id: 'achievement_debt_free', built: buildAchievement(userBase, 'debt_free', fakeUnsub) },
    { id: 'deep_dive_summary', built: buildDeepDiveSummary(userBase, sampleDeepDive.deep_dive_summary, fakeUnsub) },
  ];

  const sections = templates.map((t) => {
    const safeHtml = t.built.html.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    return `<section style="margin:48px 0;">
      <header style="max-width:600px;margin:0 auto 12px;color:#111;">
        <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#7a8b80;font-weight:800;">${t.id}</div>
        <div style="font-size:18px;font-weight:700;margin-top:4px;">Subject: ${t.built.subject}</div>
      </header>
      <div style="max-width:600px;margin:0 auto;border:1px solid #dfe7e2;border-radius:14px;overflow:hidden;background:#fff;">
        <iframe srcdoc="${safeHtml}" style="width:100%;height:780px;border:0;display:block;"></iframe>
      </div>
    </section>`;
  }).join('');

  const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Able email preview</title>
<style>body{margin:0;background:#f3f6f4;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;}</style>
</head><body>
<div style="max-width:600px;margin:0 auto;padding:48px 16px 8px;text-align:center;">
  <h1 style="font-size:26px;color:#111;margin:0;letter-spacing:-.02em;">Able email preview</h1>
  <div style="font-size:13px;color:#7a8b80;margin-top:6px;">${templates.length} templates &middot; rendered ${new Date().toISOString().split('T')[0]}</div>
</div>
${sections}
</body></html>`;

  const outPath = new URL('../../../scripts/email-preview.html', import.meta.url).pathname;
  await Deno.writeTextFile(outPath, page);
  console.log('Wrote ' + outPath);
}

if (IS_PREVIEW) {
  await renderPreview();
  Deno.exit(0);
}
