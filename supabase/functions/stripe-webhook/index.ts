const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": [
    "authorization",
    "x-client-info",
    "apikey",
    "content-type",
    "stripe-signature",
  ].join(", "),
};

const TIMESTAMP_TOLERANCE_SECONDS = 300;

const POSTHOG_API_KEY = Deno.env.get("POSTHOG_API_KEY") ??
  "phc_B6PH36QxpExnyBYhfScFFF6LhDvoyxuFr6PypJuxxky3";
const POSTHOG_HOST = Deno.env.get("POSTHOG_HOST") ?? "https://us.i.posthog.com";

// Fire-and-forget PostHog capture from the server. Wrapped so PostHog
// outages never break the webhook response back to Stripe. If PostHog is
// down, Stripe still gets 200 OK and the DB update still runs — only the
// event is lost.
async function capturePostHog(
  event: string,
  distinctId: string,
  properties: Record<string, unknown>,
) {
  try {
    const res = await fetch(`${POSTHOG_HOST}/i/v0/e/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: POSTHOG_API_KEY,
        event,
        distinct_id: distinctId,
        properties: {
          ...properties,
          $lib: "able-webhook-server",
          source: "stripe_webhook",
        },
        timestamp: new Date().toISOString(),
      }),
    });
    if (!res.ok) {
      console.error(
        `PostHog capture failed: ${event}`,
        res.status,
        await res.text(),
      );
    }
  } catch (err) {
    console.error(`PostHog capture error: ${event}`, err);
  }
}

// Trial window helpers. Stripe timestamps are Unix seconds.
function calculateTrialLengthDays(
  sub: { trial_start?: number | null; trial_end?: number | null },
): number | null {
  if (!sub.trial_start || !sub.trial_end) return null;
  return Math.round((sub.trial_end - sub.trial_start) / 86400);
}

function calculateDaysInTrial(
  sub: { trial_start?: number | null },
): number | null {
  if (!sub.trial_start) return null;
  const nowSec = Math.floor(Date.now() / 1000);
  return Math.round((nowSec - sub.trial_start) / 86400);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const signature = req.headers.get("stripe-signature");
    const body = await req.text();
    // Dual-mode secrets: live + test. The function verifies an incoming
    // signature against either one. The matching mode's API key is then
    // used for any Stripe API call-backs (resolved after JSON.parse below).
    const WEBHOOK_SECRET_LIVE = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
    const WEBHOOK_SECRET_TEST = Deno.env.get("STRIPE_WEBHOOK_SECRET_TEST") ?? "";
    const STRIPE_SECRET_LIVE = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
    const STRIPE_SECRET_TEST = Deno.env.get("STRIPE_SECRET_KEY_TEST") ?? "";
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!signature) return respond({ error: "Missing signature" }, 400);

    const parts = signature.split(",");
    const timestamp = parts.find((p) => p.startsWith("t="))?.split("=")[1];
    const sig = parts.find((p) => p.startsWith("v1="))?.split("=")[1];
    if (!timestamp || !sig) return respond({ error: "Malformed signature" }, 400);

    const ts = parseInt(timestamp, 10);
    const now = Math.floor(Date.now() / 1000);
    if (!Number.isFinite(ts) || Math.abs(now - ts) > TIMESTAMP_TOLERANCE_SECONDS) {
      return respond({ error: "Timestamp outside tolerance" }, 400);
    }

    const encoder = new TextEncoder();
    const signedPayload = `${timestamp}.${body}`;
    // Try the live secret first; fall back to the test secret. Either one
    // succeeding is sufficient — this lets Stripe CLI-signed test events
    // and real live-mode webhooks share the same endpoint.
    const verifyWithSecret = async (secret: string): Promise<boolean> => {
      if (!secret) return false;
      const k = await crypto.subtle.importKey(
        "raw", encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
      );
      const s = await crypto.subtle.sign("HMAC", k, encoder.encode(signedPayload));
      const c = Array.from(new Uint8Array(s))
        .map((b) => b.toString(16).padStart(2, "0")).join("");
      return timingSafeEqual(c, sig);
    };
    const verifiedLive = await verifyWithSecret(WEBHOOK_SECRET_LIVE);
    const verifiedTest = verifiedLive ? false : await verifyWithSecret(WEBHOOK_SECRET_TEST);
    if (!verifiedLive && !verifiedTest) {
      return respond({ error: "Invalid signature" }, 400);
    }

    const event = JSON.parse(body);
    // Pick the Stripe API key matching the event's mode. Fall back to
    // whichever key is set if only one mode is configured in the env.
    // applyCredit() and any other callback into Stripe closes over this.
    const STRIPE_SECRET = event.livemode === false
      ? (STRIPE_SECRET_TEST || STRIPE_SECRET_LIVE)
      : (STRIPE_SECRET_LIVE || STRIPE_SECRET_TEST);
    const log: Record<string, unknown> = {
      event: event.type,
      id: event.id,
      livemode: event.livemode === true,
      verified_via: verifiedLive ? "live" : "test",
      steps: [],
    };

    const sbHeaders = {
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
      "Content-Type": "application/json",
    };

    async function upsertProfile(userId: string, email: string, status: string, customerId?: string) {
      const profilePayload: Record<string, unknown> = { id: userId, email, subscription_status: status };
      if (customerId) profilePayload.stripe_customer_id = customerId;
      const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
        method: "POST",
        headers: { ...sbHeaders, Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify(profilePayload),
      });
      (log.steps as unknown[]).push({ step: "upsert_profile", status: res.status });
      await fetch(`${SUPABASE_URL}/rest/v1/user_data`, {
        method: "POST",
        headers: { ...sbHeaders, Prefer: "resolution=ignore-duplicates" },
        body: JSON.stringify({ id: userId }),
      });
    }

    async function patchProfileByCustomer(customerId: string, fields: Record<string, unknown>) {
      const url = `${SUPABASE_URL}/rest/v1/profiles?stripe_customer_id=eq.${customerId}`;
      const res = await fetch(url, {
        method: "PATCH",
        headers: { ...sbHeaders, Prefer: "return=representation" },
        body: JSON.stringify(fields),
      });
      (log.steps as unknown[]).push({ step: "patch_profile", status: res.status, fields: Object.keys(fields) });
    }

    async function getUserIdByCustomer(customerId: string): Promise<string | null> {
      const url = `${SUPABASE_URL}/rest/v1/profiles?stripe_customer_id=eq.${customerId}&select=id`;
      const res = await fetch(url, { headers: sbHeaders });
      const rows = await res.json().catch(() => []);
      return Array.isArray(rows) && rows[0] ? rows[0].id : null;
    }

    async function linkReferralByToken(refToken: string, referredUserId: string): Promise<string | null> {
      const url = `${SUPABASE_URL}/rest/v1/referrals?ref_token=eq.${refToken}`;
      const res = await fetch(url, {
        method: "PATCH",
        headers: { ...sbHeaders, Prefer: "return=representation" },
        body: JSON.stringify({
          referred_user_id: referredUserId,
          status: "trial_started",
          trial_started_at: new Date().toISOString(),
        }),
      });
      const rows = await res.json().catch(() => []);
      return Array.isArray(rows) && rows[0] ? rows[0].referrer_id : null;
    }

    async function markReferralConverted(referredUserId: string): Promise<string | null> {
      const url = `${SUPABASE_URL}/rest/v1/referrals?referred_user_id=eq.${referredUserId}&status=neq.converted`;
      const res = await fetch(url, {
        method: "PATCH",
        headers: { ...sbHeaders, Prefer: "return=representation" },
        body: JSON.stringify({
          status: "converted",
          converted_at: new Date().toISOString(),
        }),
      });
      const rows = await res.json().catch(() => []);
      return Array.isArray(rows) && rows[0] ? rows[0].referrer_id : null;
    }

    async function applyCredit(customerId: string, cents: number, desc: string): Promise<string | null> {
      const params = new URLSearchParams({
        amount: (-Math.abs(cents)).toString(),
        currency: "usd",
        description: desc,
      });
      const res = await fetch(
        `https://api.stripe.com/v1/customers/${customerId}/balance_transactions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${STRIPE_SECRET}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params,
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("Stripe credit failed:", data);
        return null;
      }
      return data?.id ?? null;
    }

    async function countRows(url: string): Promise<number> {
      const res = await fetch(url, { headers: sbHeaders });
      const rows = await res.json().catch(() => []);
      return Array.isArray(rows) ? rows.length : 0;
    }

    async function grantRewardsIfEarned(referrerId: string) {
      const trialUrl = `${SUPABASE_URL}/rest/v1/referrals?referrer_id=eq.${referrerId}&status=in.(trial_started,converted)&select=id`;
      const convertedUrl = `${SUPABASE_URL}/rest/v1/referrals?referrer_id=eq.${referrerId}&status=eq.converted&select=id`;
      const trialCount = await countRows(trialUrl);
      const convertedCount = await countRows(convertedUrl);

      const rewardsUrl = `${SUPABASE_URL}/rest/v1/referral_rewards?user_id=eq.${referrerId}&select=reward_type`;
      const rewardsRes = await fetch(rewardsUrl, { headers: sbHeaders });
      const rewardRows = await rewardsRes.json().catch(() => []);
      const monthsGranted = rewardRows.filter((r: { reward_type: string }) => r.reward_type === "free_month").length;
      const yearsGranted = rewardRows.filter((r: { reward_type: string }) => r.reward_type === "free_year").length;

      const monthsToGrant = Math.max(0, Math.floor(trialCount / 3) - monthsGranted);
      const yearsToGrant = Math.max(0, Math.floor(convertedCount / 5) - yearsGranted);

      (log.steps as unknown[]).push({
        step: "rewards_check", referrerId, trialCount, convertedCount,
        monthsGranted, yearsGranted, monthsToGrant, yearsToGrant,
      });

      if (monthsToGrant === 0 && yearsToGrant === 0) return;

      const profUrl = `${SUPABASE_URL}/rest/v1/profiles?id=eq.${referrerId}&select=stripe_customer_id`;
      const profRes = await fetch(profUrl, { headers: sbHeaders });
      const profRows = await profRes.json().catch(() => []);
      const customerId = Array.isArray(profRows) && profRows[0] ? profRows[0].stripe_customer_id : null;
      if (!customerId) {
        (log.steps as unknown[]).push({ step: "rewards_skipped_no_customer", referrerId });
        return;
      }

      for (let i = 0; i < monthsToGrant; i++) {
        const txnId = await applyCredit(customerId, 999, "Able referral reward: 1 free month");
        await fetch(`${SUPABASE_URL}/rest/v1/referral_rewards`, {
          method: "POST",
          headers: sbHeaders,
          body: JSON.stringify({
            user_id: referrerId,
            reward_type: "free_month",
            referral_ids: [],
            stripe_coupon_id: txnId,
          }),
        });
      }

      for (let i = 0; i < yearsToGrant; i++) {
        const txnId = await applyCredit(customerId, 7900, "Able referral reward: 1 free year");
        await fetch(`${SUPABASE_URL}/rest/v1/referral_rewards`, {
          method: "POST",
          headers: sbHeaders,
          body: JSON.stringify({
            user_id: referrerId,
            reward_type: "free_year",
            referral_ids: [],
            stripe_coupon_id: txnId,
          }),
        });
      }
    }

    function mapSubStatus(s: string): string {
      switch (s) {
        case "trialing": return "trialing";
        case "active": return "active";
        case "past_due": return "past_due";
        case "unpaid": return "past_due";
        case "incomplete": return "incomplete";
        case "canceled": return "inactive";
        case "incomplete_expired": return "inactive";
        default: return "inactive";
      }
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.metadata?.supabase_uid;
        const email = session.customer_email || session.customer_details?.email || "";
        const customerId = session.customer;
        log.userId = userId; log.email = email; log.customerId = customerId;
        const initialStatus = session.mode === "payment" ? "lifetime" : "trialing";
        if (userId && email) await upsertProfile(userId, email, initialStatus, customerId);
        else if (customerId) await patchProfileByCustomer(customerId, { subscription_status: initialStatus });

        const refToken = session.metadata?.ref_token;
        if (refToken && userId) {
          const referrerId = await linkReferralByToken(refToken, userId);
          if (referrerId) {
            log.referrerId = referrerId;
            await grantRewardsIfEarned(referrerId);
          }
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object;
        const mapped = mapSubStatus(sub.status);
        const fields: Record<string, unknown> = {
          subscription_status: mapped,
          stripe_subscription_id: sub.id,
        };
        if (sub.trial_end) fields.trial_end_at = new Date(sub.trial_end * 1000).toISOString();
        log.subStatus = sub.status;
        log.mappedStatus = mapped;
        await patchProfileByCustomer(sub.customer, fields);

        if (mapped === "active") {
          const referredUserId = await getUserIdByCustomer(sub.customer);
          if (referredUserId) {
            const referrerId = await markReferralConverted(referredUserId);
            if (referrerId) {
              log.referrerId = referrerId;
              await grantRewardsIfEarned(referrerId);
            }
          }
        }

        // paid_conversion: the North Star. Fires only on the .updated event
        // (not .created) and only when the previous status was trialing.
        // This avoids false conversions for lifetime purchasers or any
        // subscription that never had a trial.
        if (
          event.type === "customer.subscription.updated" &&
          event.data.previous_attributes?.status === "trialing" &&
          sub.status === "active"
        ) {
          const userId = await getUserIdByCustomer(sub.customer);
          if (userId) {
            const priceItem = sub.items?.data?.[0]?.price;
            const unitAmount = priceItem?.unit_amount;
            const mrr = typeof unitAmount === "number" ? unitAmount / 100 : null;
            (log.steps as unknown[]).push({ step: "paid_conversion", userId });
            await capturePostHog("paid_conversion", userId, {
              stripe_customer_id: sub.customer,
              stripe_subscription_id: sub.id,
              plan_price_id: priceItem?.id ?? null,
              mrr,
              currency: priceItem?.currency ?? null,
              trial_length_days: calculateTrialLengthDays(sub),
              days_in_trial: calculateDaysInTrial(sub),
            });
            // Mark the person as paid in PostHog. Wrapped separately so a
            // PostHog outage never breaks the webhook response.
            try {
              const idRes = await fetch(`${POSTHOG_HOST}/capture/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  api_key: POSTHOG_API_KEY,
                  event: "$identify",
                  distinct_id: userId,
                  properties: {
                    $set: {
                      plan: "paid",
                      mrr,
                      converted_at: new Date().toISOString(),
                    },
                  },
                }),
              });
              if (!idRes.ok) {
                console.error(
                  "PostHog $identify failed",
                  idRes.status,
                  await idRes.text(),
                );
              }
            } catch (err) {
              console.error("PostHog $identify error:", err);
            }
          } else {
            console.warn(
              "paid_conversion skipped: no user found for customer",
              sub.customer,
            );
          }
        }

        // payment_recovered: past_due → active transition. Fires after the
        // DB status update above so the event always lags a successful write.
        // days_in_past_due is null for now — computing it requires tracking
        // a past_due_at timestamp on the profiles row, which we do not yet.
        if (
          event.type === "customer.subscription.updated" &&
          event.data.previous_attributes?.status === "past_due" &&
          sub.status === "active"
        ) {
          const userId = await getUserIdByCustomer(sub.customer);
          if (userId) {
            const priceItem = sub.items?.data?.[0]?.price;
            const unitAmount = priceItem?.unit_amount;
            const mrr = typeof unitAmount === "number" ? unitAmount / 100 : null;
            (log.steps as unknown[]).push({ step: "payment_recovered", userId });
            await capturePostHog("payment_recovered", userId, {
              stripe_customer_id: sub.customer,
              stripe_subscription_id: sub.id,
              mrr,
              days_in_past_due: null,
            });
          } else {
            console.warn(
              "payment_recovered skipped: no user found for customer",
              sub.customer,
            );
          }
        }
        break;
      }
      case "customer.subscription.trial_will_end": {
        // Stripe fires this automatically ~3 days before trial_end. Must
        // be enabled in Stripe Dashboard > Webhook endpoint > Events.
        // We do not write to the DB here; just a PostHog notification so
        // lifecycle emails and funnel analytics know the window is open.
        const sub = event.data.object;
        const userId = await getUserIdByCustomer(sub.customer);
        if (userId) {
          const priceItem = sub.items?.data?.[0]?.price;
          const unitAmount = priceItem?.unit_amount;
          const mrr = typeof unitAmount === "number" ? unitAmount / 100 : null;
          (log.steps as unknown[]).push({ step: "trial_ending_soon", userId });
          await capturePostHog("trial_ending_soon", userId, {
            stripe_customer_id: sub.customer,
            stripe_subscription_id: sub.id,
            trial_end_at: sub.trial_end
              ? new Date(sub.trial_end * 1000).toISOString()
              : null,
            plan_price_id: priceItem?.id ?? null,
            mrr,
          });
        } else {
          console.warn(
            "trial_ending_soon skipped: no user found for customer",
            sub.customer,
          );
        }
        break;
      }
      case "customer.subscription.deleted": {
        await patchProfileByCustomer(event.data.object.customer, { subscription_status: "inactive" });
        break;
      }
      case "invoice.payment_failed": {
        await patchProfileByCustomer(event.data.object.customer, { subscription_status: "past_due" });

        // payment_failed: fired after the DB status update so the event
        // always lags a successful write. Never throws; PostHog outage
        // leaves the DB update intact and Stripe gets 200 OK.
        const invoice = event.data.object;
        const userId = await getUserIdByCustomer(invoice.customer);
        if (userId) {
          const amtDue = typeof invoice.amount_due === "number"
            ? invoice.amount_due / 100
            : null;
          (log.steps as unknown[]).push({ step: "payment_failed", userId });
          await capturePostHog("payment_failed", userId, {
            stripe_customer_id: invoice.customer,
            stripe_subscription_id: invoice.subscription ?? null,
            amount_due: amtDue,
            currency: invoice.currency ?? null,
            attempt_count: invoice.attempt_count ?? null,
            next_payment_attempt: invoice.next_payment_attempt
              ? new Date(invoice.next_payment_attempt * 1000).toISOString()
              : null,
          });
        } else {
          console.warn(
            "payment_failed skipped: no user found for customer",
            invoice.customer,
          );
        }
        break;
      }
    }

    console.log("WEBHOOK RESULT:", JSON.stringify(log));
    return respond({ received: true, log });
  } catch (error) {
    console.error("WEBHOOK ERROR:", (error as Error).message, (error as Error).stack);
    return respond({ error: (error as Error).message }, 400);
  }
});

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}
