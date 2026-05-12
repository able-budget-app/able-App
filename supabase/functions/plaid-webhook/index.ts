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

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const INTERNAL_SECRET = Deno.env.get('INTERNAL_FUNCTION_SECRET') ?? '';
const REPLAY_WINDOW_SECONDS = 5 * 60;
const PLAID_ENV = Deno.env.get('PLAID_ENV') ?? 'sandbox';
const PLAID_HOSTS: Record<string, string> = {
  sandbox: 'https://sandbox.plaid.com',
  development: 'https://development.plaid.com',
  production: 'https://production.plaid.com',
};
const PLAID_HOST = PLAID_HOSTS[PLAID_ENV] ?? PLAID_HOSTS.sandbox;

async function plaidApi<TReq extends Record<string, unknown>, TRes>(
  path: string,
  body: TReq,
): Promise<TRes> {
  const clientId = Deno.env.get('PLAID_CLIENT_ID');
  const secret = Deno.env.get('PLAID_SECRET');
  if (!clientId || !secret) throw new Error('PLAID_CLIENT_ID and PLAID_SECRET must be set');
  const res = await fetch(`${PLAID_HOST}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, secret, ...body }),
  });
  const text = await res.text();
  let parsed: unknown = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
  if (!res.ok) throw new Error(`Plaid ${path} failed: ${text || res.status}`);
  return parsed as TRes;
}

const _ALLOWED_ORIGINS = new Set([
  'https://becomeable.app',
  'https://www.becomeable.app',
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
  'Access-Control-Allow-Headers': 'plaid-verification, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
  };
}

// In-memory JWK cache. Edge function cold starts re-fetch.
const jwkCache = new Map<string, CryptoKey>();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'POST only' }, 405);

  try {
    const verification = req.headers.get('Plaid-Verification') ?? '';
    if (!verification) return json(req, { error: 'missing Plaid-Verification' }, 401);

    // Read body as raw text (whitespace-sensitive for SHA256 comparison).
    const rawBody = await req.text();

    await verifyPlaidSignature(verification, rawBody);

    const event = JSON.parse(rawBody) as PlaidWebhookEvent;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    await dispatch(admin, event);

    return json(req, { ok: true });
  } catch (e) {
    console.error('plaid-webhook error:', e);
    return json(req, { error: (e as Error).message }, e instanceof VerifyError ? 401 : 500);
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

  let triggerSync = false;
  let triggerRecurring = false;
  if (ev.webhook_type === 'TRANSACTIONS') {
    if (ev.webhook_code === 'SYNC_UPDATES_AVAILABLE') {
      // Don't eagerly write initial_sync_complete / historical_sync_complete
      // here based on the webhook's claim — let plaid-sync set those flags
      // based on the actual /transactions/sync response status. The webhook
      // only signals "data is ready to fetch"; the flags must mean "we
      // actually have the data". Otherwise a sync failure (network blip,
      // 401, anything) would leave the row claiming history complete with
      // no transactions to back it up — exactly the silent-data-loss bug
      // we hit on 2026-05-08 before commit e102ebc.
      //
      // Pull immediately. Without this the user has to open the app for
      // their data to land, which was the dominant cause of "missing
      // deposits". Sync runs in the background via EdgeRuntime.waitUntil
      // so this handler still returns 200 inside Plaid's 10s budget.
      triggerSync = true;
    }
    if (ev.webhook_code === 'RECURRING_TRANSACTIONS_UPDATE') {
      // P2 #21: Plaid signals new recurring streams are available. Flag the
      // item so the client can show a "your plan can be refined" banner,
      // and fire plaid-recurring-refresh in the background so streams get
      // pulled without waiting on cron. Status becomes 'fresh' when refresh
      // completes and finds at least one new stream.
      updates.recurring_status = 'pending';
      updates.recurring_last_attempt_at = now;
      updates.recurring_attempt_count = (updates.recurring_attempt_count as number ?? 0) + 1;
      // Trigger refresh AFTER the item update writes (the function needs
      // the row id, not the Plaid item id). The triggerRecurring flag
      // mirrors the triggerSync pattern below.
      triggerRecurring = true;
    }
  } else if (ev.webhook_type === 'ITEM') {
    switch (ev.webhook_code) {
      case 'ERROR':
        updates.status = 'error';
        updates.error_code = ev.error?.error_code ?? null;
        updates.error_message = ev.error?.error_message ?? null;
        break;
      case 'LOGIN_REPAIRED':
        // Update mode succeeded — clear the prompt.
        updates.status = 'active';
        updates.error_code = null;
        updates.error_message = null;
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
        // Surface to UI via item state. User must run Link in update mode
        // with account_selection_enabled to choose the new accounts.
        updates.status = 'pending_disconnect';
        updates.error_message = 'New accounts are available at this bank. Reconnect to choose which ones to share.';
        break;
      case 'WEBHOOK_UPDATE_ACKNOWLEDGED':
        // Nothing to do.
        return;
    }
  }

  const { data: updatedItem, error: updateErr } = await admin
    .from('plaid_items')
    .update(updates)
    .eq('plaid_item_id', itemId)
    .select('id')
    .maybeSingle();
  if (updateErr) {
    console.error(`failed to update plaid_items for ${itemId}:`, updateErr);
  }

  if (triggerSync && updatedItem?.id) {
    scheduleBackgroundSync(updatedItem.id);
  }
  if (triggerRecurring && updatedItem?.id) {
    scheduleRecurringRefresh(updatedItem.id);
  }
}

// Fire plaid-sync in the background so the webhook handler can return 200
// inside Plaid's 10-second budget. plaid-sync accepts a service-role caller
// and looks up the user from the item row.
function scheduleBackgroundSync(plaidItemRowId: string): void {
  const url = `${SUPABASE_URL}/functions/v1/plaid-sync`;
  const work = fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SERVICE_ROLE}`,
      'x-internal-auth': INTERNAL_SECRET,
    },
    body: JSON.stringify({ plaid_item_row_id: plaidItemRowId }),
  })
    .then(async (r) => {
      const text = await r.text().catch(() => '');
      if (!r.ok) {
        console.error(`webhook→sync failed for item ${plaidItemRowId} (${r.status}): ${text}`);
      } else {
        console.log(`webhook→sync ok for item ${plaidItemRowId}: ${text}`);
      }
    })
    .catch((e) => console.error(`webhook→sync threw for item ${plaidItemRowId}:`, e));

  const er = (globalThis as unknown as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
  if (er?.waitUntil) {
    er.waitUntil(work);
  }
  // If EdgeRuntime is unavailable (local dev), the in-flight fetch should
  // still complete before the runtime is reaped.
}

// Fire plaid-recurring-refresh on a RECURRING_TRANSACTIONS_UPDATE webhook
// so streams are pulled the moment Plaid finishes computing them. Mirrors
// the scheduleBackgroundSync pattern: hits the function with service-role
// auth, lets the runtime keep the work alive past the webhook 200.
function scheduleRecurringRefresh(plaidItemRowId: string): void {
  const url = `${SUPABASE_URL}/functions/v1/plaid-recurring-refresh`;
  const work = fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SERVICE_ROLE}`,
      'x-internal-auth': INTERNAL_SECRET,
    },
    body: JSON.stringify({ plaid_item_row_id: plaidItemRowId, source: 'webhook' }),
  })
    .then(async (r) => {
      const text = await r.text().catch(() => '');
      if (!r.ok) {
        console.error(`webhook→recurring-refresh failed for item ${plaidItemRowId} (${r.status}): ${text}`);
      } else {
        console.log(`webhook→recurring-refresh ok for item ${plaidItemRowId}: ${text}`);
      }
    })
    .catch((e) => console.error(`webhook→recurring-refresh threw for item ${plaidItemRowId}:`, e));

  const er = (globalThis as unknown as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
  if (er?.waitUntil) {
    er.waitUntil(work);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  });
}
