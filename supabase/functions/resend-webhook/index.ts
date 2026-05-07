// Resend webhook handler. Receives email lifecycle events (bounced,
// complained, delivered, opened, clicked, etc.) and writes the relevant
// status to user_data.email_status so email-cron-daily can stop pinging
// hard-bounced or complained addresses. Without this, bounces silently
// retry every day and damage sender reputation over time.
//
// Setup:
//   1. Run supabase/email_status.sql once to add the column.
//   2. Deploy this function via dashboard paste (Verify JWT off — webhooks
//      come from Resend, not authenticated users).
//   3. Set RESEND_WEBHOOK_SECRET env var on the function (any random string).
//   4. In Resend dashboard → Webhooks → Add endpoint:
//        URL:    https://<project>.supabase.co/functions/v1/resend-webhook
//        Events: email.bounced, email.complained, email.delivered (optional)
//        Signing secret: copy into RESEND_WEBHOOK_SECRET env var
//
// Resend signs every webhook with svix-style HMAC headers (svix-id,
// svix-timestamp, svix-signature). We verify the signature before trusting
// the event.

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('RESEND_WEBHOOK_SECRET') || '';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405 });
  }

  // Read body as text first so we can verify the signature against the raw
  // payload before parsing.
  const rawBody = await req.text();

  // Resend webhooks use svix signatures. Fail closed if the secret env var
  // is missing — production should always have one, and accepting unsigned
  // events would let anyone POST forged bounce/complaint flags into our
  // email_status column.
  if (!WEBHOOK_SECRET) {
    console.error('resend-webhook: RESEND_WEBHOOK_SECRET not configured');
    return new Response('not configured', { status: 503 });
  }
  const ok = await verifySvixSignature(req.headers, rawBody, WEBHOOK_SECRET);
  if (!ok) {
    console.warn('resend-webhook: signature verification failed');
    return new Response('invalid signature', { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response('invalid json', { status: 400 });
  }

  const type: string = event?.type || '';
  // Resend payload shape: { type, created_at, data: { email_id, to: string[], from, subject, ... } }
  const data = event?.data || {};
  const recipients: string[] = Array.isArray(data.to) ? data.to : (typeof data.to === 'string' ? [data.to] : []);
  if (recipients.length === 0) {
    return new Response('ok', { status: 200 });
  }

  // Normalize emails to lowercase for matching (Supabase auth stores lowercase).
  const emails = recipients.map((e) => String(e).toLowerCase().trim()).filter(Boolean);

  // Map Resend event type → our email_status value. We only flag durable
  // states: hard bounce or complaint. Soft bounces and "delivered" don't
  // cause us to stop sending — those are normal lifecycle.
  let nextStatus: string | null = null;
  if (type === 'email.bounced') {
    const bounceType = (data.bounce?.type || data.bounce_type || '').toLowerCase();
    // Hard bounce = address doesn't exist; never retry. Soft bounce =
    // mailbox full / temporary; keep retrying (default behavior).
    if (bounceType === 'hard' || bounceType === 'permanent' || bounceType === 'undetermined') {
      nextStatus = 'bounced';
    }
  } else if (type === 'email.complained' || type === 'email.complaint') {
    nextStatus = 'complained';
  }

  if (!nextStatus) {
    // Other event types (delivered, opened, clicked, etc.) we just log.
    return new Response('ok', { status: 200 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Look up the auth user(s) by email. For each match, update user_data.email_status.
  let updated = 0;
  for (const email of emails) {
    try {
      // listUsers can be paged; for the typical "we just sent to one user" case
      // a direct filter is safer. Supabase admin auth doesn't have a perfect
      // single-email lookup, so we fetch and filter the page that contains them.
      // For larger user bases, swap to a custom RPC or auth.users query.
      const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
      const match = (users?.users || []).find((u: any) => (u.email || '').toLowerCase() === email);
      if (!match) {
        console.warn(`resend-webhook: no user found for ${email} (${nextStatus})`);
        continue;
      }
      const { error } = await admin.from('user_data').upsert({
        id: match.id,
        email_status: nextStatus,
        email_status_updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
      if (error) {
        console.error(`resend-webhook: upsert failed for ${email}`, error);
        continue;
      }
      updated += 1;
    } catch (e) {
      console.error('resend-webhook: lookup error', e);
    }
  }

  return new Response(JSON.stringify({ ok: true, type, status_set: nextStatus, updated }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});

// Svix signature verification (Resend uses svix). The signature header is
// `svix-signature` formatted like "v1,<base64-hmac> v1,<another-hmac>".
// We compute HMAC-SHA256 over `${svix-id}.${svix-timestamp}.${rawBody}` with
// the secret (base64-decoded, prefixed "whsec_") and compare to any of the
// signatures in the header.
async function verifySvixSignature(headers: Headers, body: string, secret: string): Promise<boolean> {
  try {
    const id = headers.get('svix-id') || headers.get('webhook-id');
    const ts = headers.get('svix-timestamp') || headers.get('webhook-timestamp');
    const sig = headers.get('svix-signature') || headers.get('webhook-signature');
    if (!id || !ts || !sig) return false;

    // Reject events older than 5 minutes to defeat replay.
    const age = Date.now() / 1000 - Number(ts);
    if (Number.isFinite(age) && Math.abs(age) > 5 * 60) return false;

    const cleanSecret = secret.startsWith('whsec_') ? secret.slice(6) : secret;
    const keyBytes = base64Decode(cleanSecret);
    // Deno's TS lib reports Uint8Array as ArrayBufferLike; importKey wants a
    // strict ArrayBuffer-backed BufferSource. Cast through unknown to silence
    // the false-positive without runtime cost.
    const key = await crypto.subtle.importKey(
      'raw', keyBytes as unknown as BufferSource,
      { name: 'HMAC', hash: 'SHA-256' },
      false, ['sign'],
    );
    const dataBytes = new TextEncoder().encode(`${id}.${ts}.${body}`);
    const mac = await crypto.subtle.sign('HMAC', key, dataBytes as unknown as BufferSource);
    const expected = base64Encode(new Uint8Array(mac));

    // sig header can contain multiple signatures separated by spaces.
    const parts = sig.split(' ').map((p) => p.split(',')[1]).filter(Boolean);
    return parts.some((p) => timingSafeEqual(p, expected));
  } catch (e) {
    console.error('resend-webhook: signature verify threw', e);
    return false;
  }
}

function base64Decode(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function base64Encode(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
}
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
