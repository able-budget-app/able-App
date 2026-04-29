// plaid-webhook
// Receives webhooks from Plaid, verifies the ES256 JWT in the
// Plaid-Verification header, and updates plaid_items state.
//
// Verification flow (per Plaid docs):
//   1. Parse JWT header → assert alg=ES256 → extract kid.
//   2. Fetch JWK via /webhook_verification_key/get using the kid (cached).
//   3. Verify JWT signature with the JWK.
//   4. Assert iat is within 5 minutes (replay window).
//   5. Compute SHA256 of the raw body; constant-time compare against
//      the request_body_sha256 claim.
//
// Dispatch: this function is intentionally narrow — it updates item-level
// state (status, error, sync flags) and returns 200. It does NOT call
// /transactions/sync inline. The client (app.html) polls plaid_items.
// last_webhook_at and triggers plaid-sync when it sees fresh activity.
// A cron job can also sweep items where last_webhook_at > last_sync_at.
//
// IMPORTANT: this function must have JWT verification turned OFF at the
// Supabase gateway level (so Plaid can reach it without an Auth header).
// Verification of the Plaid signature happens INSIDE this function.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { jwtVerify, importJWK, decodeProtectedHeader, type JWK } from 'npm:jose@^5.9.0';
import { plaidApi } from '../_shared/plaid.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const REPLAY_WINDOW_SECONDS = 5 * 60;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'plaid-verification, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// In-memory JWK cache. Edge function cold starts re-fetch.
const jwkCache = new Map<string, CryptoKey>();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  try {
    const verification = req.headers.get('Plaid-Verification') ?? '';
    if (!verification) return json({ error: 'missing Plaid-Verification' }, 401);

    // Read body as raw text (whitespace-sensitive for SHA256 comparison).
    const rawBody = await req.text();

    await verifyPlaidSignature(verification, rawBody);

    const event = JSON.parse(rawBody) as PlaidWebhookEvent;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    await dispatch(admin, event);

    return json({ ok: true });
  } catch (e) {
    console.error('plaid-webhook error:', e);
    return json({ error: (e as Error).message }, e instanceof VerifyError ? 401 : 500);
  }
});

// ─── Verification ──────────────────────────────────────────────────────

class VerifyError extends Error {}

async function verifyPlaidSignature(jwt: string, rawBody: string): Promise<void> {
  let header;
  try {
    header = decodeProtectedHeader(jwt);
  } catch {
    throw new VerifyError('malformed JWT');
  }
  if (header.alg !== 'ES256') throw new VerifyError(`unexpected alg: ${header.alg}`);
  const kid = header.kid;
  if (!kid) throw new VerifyError('missing kid');

  const key = await getVerificationKey(kid);

  const { payload } = await jwtVerify(jwt, key, {
    algorithms: ['ES256'],
    clockTolerance: REPLAY_WINDOW_SECONDS,
  });

  const iat = payload.iat;
  if (typeof iat !== 'number') throw new VerifyError('missing iat claim');
  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - iat);
  if (ageSeconds > REPLAY_WINDOW_SECONDS) {
    throw new VerifyError(`replay window exceeded (${ageSeconds}s old)`);
  }

  const claimedHash = payload.request_body_sha256;
  if (typeof claimedHash !== 'string') throw new VerifyError('missing body hash claim');

  const computedHash = await sha256Hex(rawBody);
  if (!constantTimeEqual(claimedHash, computedHash)) {
    throw new VerifyError('body hash mismatch');
  }
}

async function getVerificationKey(kid: string): Promise<CryptoKey> {
  const cached = jwkCache.get(kid);
  if (cached) return cached;

  const resp = await plaidApi<{ key_id: string }, { key: JWK }>(
    '/webhook_verification_key/get',
    { key_id: kid },
  );
  const key = await importJWK(resp.key, 'ES256');
  if (!('type' in key)) throw new VerifyError('failed to import JWK');
  jwkCache.set(kid, key as CryptoKey);
  return key as CryptoKey;
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ─── Dispatch ─────────────────────────────────────────────────────────

type PlaidWebhookEvent = {
  webhook_type: string;
  webhook_code: string;
  item_id?: string;
  account_id?: string;
  error?: { error_code: string; error_message: string } | null;
  consent_expiration_time?: string | null;
  disconnect_time?: string | null;
  reason?: string;
  initial_update_complete?: boolean;
  historical_update_complete?: boolean;
  // ...other event-specific fields
};

async function dispatch(
  admin: SupabaseClient,
  ev: PlaidWebhookEvent,
): Promise<void> {
  console.log(`webhook received: ${ev.webhook_type}/${ev.webhook_code} item=${ev.item_id ?? '?'}`);

  const itemId = ev.item_id;
  if (!itemId) return;

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { last_webhook_at: now };

  if (ev.webhook_type === 'TRANSACTIONS') {
    if (ev.webhook_code === 'SYNC_UPDATES_AVAILABLE') {
      // Caller / cron will call plaid-sync. Just stamp the timestamp.
      if (ev.initial_update_complete) updates.initial_sync_complete = true;
      if (ev.historical_update_complete) updates.historical_sync_complete = true;
    }
    if (ev.webhook_code === 'RECURRING_TRANSACTIONS_UPDATE') {
      // Caller / cron will call plaid-recurring-refresh.
    }
  } else if (ev.webhook_type === 'ITEM') {
    switch (ev.webhook_code) {
      case 'ERROR':
        updates.status = 'error';
        updates.error_code = ev.error?.error_code ?? null;
        updates.error_message = ev.error?.error_message ?? null;
        break;
      case 'PENDING_EXPIRATION':
        updates.status = 'pending_expiration';
        updates.consent_expiration_at = ev.consent_expiration_time ?? null;
        break;
      case 'PENDING_DISCONNECT':
        updates.status = 'pending_disconnect';
        break;
      case 'USER_PERMISSION_REVOKED':
      case 'USER_ACCOUNT_REVOKED':
        updates.status = 'revoked';
        if (ev.account_id) {
          // Best-effort: drop the revoked account row.
          await admin
            .from('plaid_accounts')
            .delete()
            .eq('plaid_account_id', ev.account_id);
        }
        break;
      case 'NEW_ACCOUNTS_AVAILABLE':
        // Surface to UI via item state. User must run Link in update mode.
        updates.status = 'pending_disconnect'; // closest existing flag
        break;
      case 'WEBHOOK_UPDATE_ACKNOWLEDGED':
        // Nothing to do.
        return;
    }
  }

  await admin
    .from('plaid_items')
    .update(updates)
    .eq('plaid_item_id', itemId);
}

// ─── Helpers ──────────────────────────────────────────────────────────

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
