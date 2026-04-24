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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const signature = req.headers.get("stripe-signature");
    const body = await req.text();
    const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
    const STRIPE_SECRET = Deno.env.get("STRIPE_SECRET_KEY")!;
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
    const key = await crypto.subtle.importKey(
      "raw", encoder.encode(WEBHOOK_SECRET),
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
    const computed = Array.from(new Uint8Array(signed))
      .map((b) => b.toString(16).padStart(2, "0")).join("");

    if (!timingSafeEqual(computed, sig)) {
      return respond({ error: "Invalid signature" }, 400);
    }

    const event = JSON.parse(body);
    const log: Record<string, unknown> = { event: event.type, id: event.id, steps: [] };

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
        break;
      }
      case "customer.subscription.deleted": {
        await patchProfileByCustomer(event.data.object.customer, { subscription_status: "inactive" });
        break;
      }
      case "invoice.payment_failed": {
        await patchProfileByCustomer(event.data.object.customer, { subscription_status: "past_due" });
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
