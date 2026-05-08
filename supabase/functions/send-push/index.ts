// send-push: posts a Web Push notification to all subscriptions belonging
// to a user. Service-role-only (called from email-cron-daily and other
// internal triggers; not user-callable). Uses VAPID-signed JWTs per the
// Web Push spec, no third-party push service.
//
// POST body:
//   {
//     user_id: string,
//     payload: {
//       title: string,
//       body?: string,
//       url?: string,           // deep-link, defaults to /app.html
//       tag?: string,           // dedupe key (so repeat pings don't stack)
//       requireInteraction?: bool,
//     }
//   }
//
// Returns: { sent: number, removed: number, errors: number }
//
// Env:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (standard)
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY    (Paul generates these once;
//                                           public also embedded in app.html
//                                           so the browser can subscribe)
//   VAPID_SUBJECT  (mailto:hello@becomeable.app or similar contact)
//
// VAPID key generation (one-time, by Paul, stored as Edge Function env vars):
//   npx web-push generate-vapid-keys
//
// Browser subscribe call uses the public key. send-push signs an ES256
// JWT with the private key and posts it as the Authorization header on
// each push request.

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const INTERNAL_SECRET = Deno.env.get('INTERNAL_FUNCTION_SECRET') ?? '';
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') || '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || '';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:hello@becomeable.app';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type PushPayload = {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
  requireInteraction?: boolean;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return json({ error: 'VAPID keys not configured. Run npx web-push generate-vapid-keys and set VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY env vars.' }, 500);
  }

  // Internal-only gate. Invoked by email-cron-daily (bills-due-tomorrow
  // push fires) and any future internal caller. Uses x-internal-auth
  // because Supabase mutates the Authorization header on cross-region
  // inter-function calls — see commit ac94d34 / e102ebc for the full
  // backstory.
  if (!INTERNAL_SECRET) {
    console.error('send-push: INTERNAL_FUNCTION_SECRET unset');
    return json({ error: 'not configured' }, 503);
  }
  const got = req.headers.get('x-internal-auth') ?? '';
  if (got !== INTERNAL_SECRET) return json({ error: 'Unauthorized' }, 401);

  let body: { user_id?: string; payload?: PushPayload };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid json' }, 400);
  }
  if (!body.user_id || !body.payload || !body.payload.title) {
    return json({ error: 'user_id and payload.title required' }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: subs, error } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', body.user_id);
  if (error) return json({ error: error.message }, 500);
  if (!subs || subs.length === 0) return json({ sent: 0, removed: 0, errors: 0, note: 'no subscriptions' });

  let sent = 0, removed = 0, errors = 0;
  const payloadStr = JSON.stringify(body.payload);

  for (const sub of subs) {
    try {
      const result = await sendOne(sub.endpoint, sub.p256dh, sub.auth, payloadStr);
      if (result.ok) {
        sent += 1;
        await admin.from('push_subscriptions').update({ last_used_at: new Date().toISOString(), failure_count: 0 }).eq('id', sub.id);
      } else if (result.gone) {
        // Endpoint is dead. Drop it.
        await admin.from('push_subscriptions').delete().eq('id', sub.id);
        removed += 1;
      } else {
        errors += 1;
        await admin.from('push_subscriptions').update({ failure_count: (sub as any).failure_count + 1 || 1 }).eq('id', sub.id);
      }
    } catch (e) {
      console.error('send-push: send error', e);
      errors += 1;
    }
  }

  return json({ sent, removed, errors });
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ─── Web Push core ────────────────────────────────────────────────────
// Implements RFC 8030 (push) + RFC 8291 (encryption) + RFC 8292 (VAPID).
// Encrypts the payload with the subscription's keys, signs a VAPID JWT
// with the private key, posts to the subscription endpoint.

async function sendOne(endpoint: string, p256dhB64u: string, authB64u: string, payload: string): Promise<{ ok: boolean; gone?: boolean }> {
  const audience = new URL(endpoint).origin;
  const jwt = await signVapidJwt(audience);

  // Encrypt the payload with the subscription's keys.
  const encrypted = await encryptPayload(p256dhB64u, authB64u, payload);

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'TTL': '86400', // 24h
      'Authorization': `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
    },
    body: encrypted,
  });
  if (res.status === 410 || res.status === 404) return { ok: false, gone: true };
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.warn(`push send failed ${res.status}: ${text}`);
    return { ok: false };
  }
  return { ok: true };
}

// ─── VAPID JWT (ES256) ────────────────────────────────────────────────
async function signVapidJwt(audience: string): Promise<string> {
  const header = { typ: 'JWT', alg: 'ES256' };
  const claim = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, // 12h
    sub: VAPID_SUBJECT,
  };
  const enc = new TextEncoder();
  const headerB64 = b64uEncode(enc.encode(JSON.stringify(header)));
  const claimB64  = b64uEncode(enc.encode(JSON.stringify(claim)));
  const signingInput = `${headerB64}.${claimB64}`;

  const privKey = await importVapidPrivateKey(VAPID_PRIVATE_KEY);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privKey, enc.encode(signingInput) as unknown as BufferSource);
  // ECDSA WebCrypto returns raw r||s; that IS the JWT-required form.
  const sigB64 = b64uEncode(new Uint8Array(sig));
  return `${signingInput}.${sigB64}`;
}

async function importVapidPrivateKey(b64u: string): Promise<CryptoKey> {
  const raw = b64uDecode(b64u);
  // The web-push convention: private key is 32 raw bytes for the d value
  // of the P-256 curve. We need to derive the public from the env var or
  // from the public key, and build a JWK.
  const d = b64uEncode(raw);
  const pubBytes = b64uDecode(VAPID_PUBLIC_KEY);
  // Public key from web-push CLI is uncompressed: 0x04 || x(32) || y(32) = 65 bytes.
  if (pubBytes.length !== 65 || pubBytes[0] !== 0x04) {
    throw new Error(`VAPID_PUBLIC_KEY shape unexpected: length ${pubBytes.length}`);
  }
  const x = b64uEncode(pubBytes.slice(1, 33));
  const y = b64uEncode(pubBytes.slice(33, 65));
  const jwk: JsonWebKey = { kty: 'EC', crv: 'P-256', x, y, d, ext: false };
  return await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}

// ─── aes128gcm payload encryption (RFC 8291) ──────────────────────────
async function encryptPayload(uaPubB64u: string, authSecretB64u: string, payload: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const uaPub = b64uDecode(uaPubB64u);    // 65 bytes uncompressed P-256
  const authSecret = b64uDecode(authSecretB64u); // 16 bytes
  const plaintext = enc.encode(payload);

  // 1) Generate ephemeral ECDH keypair (the server's "as_pub" / private).
  const asPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'],
  );
  const asPubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', asPair.publicKey)); // 65 bytes
  const uaPubKey = await crypto.subtle.importKey(
    'raw', uaPub as unknown as BufferSource,
    { name: 'ECDH', namedCurve: 'P-256' }, false, [],
  );

  // 2) ECDH derive shared secret.
  const ecdhBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: uaPubKey }, asPair.privateKey, 256,
  );
  const ecdhSecret = new Uint8Array(ecdhBits);

  // 3) HKDF-Extract with auth_secret as salt → PRK_key (32 bytes).
  // 4) HKDF-Expand "WebPush: info" || 0 || ua_public || as_public + 32 → IKM
  const wpInfo = concat(
    enc.encode('WebPush: info\0'), uaPub, asPubRaw,
  );
  const ikm = await hkdf(authSecret, ecdhSecret, wpInfo, 32);

  // 5) Generate 16-byte salt; HKDF over (ikm, salt, "Content-Encoding: aes128gcm" || 0) → CEK (16 bytes)
  // 6) Same with "Content-Encoding: nonce" || 0 → NONCE (12 bytes)
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cekInfo = enc.encode('Content-Encoding: aes128gcm\0');
  const nonceInfo = enc.encode('Content-Encoding: nonce\0');
  const cek = await hkdf(salt, ikm, cekInfo, 16);
  const nonce = await hkdf(salt, ikm, nonceInfo, 12);

  // 7) AES-128-GCM encrypt plaintext || 0x02 (delimiter, RFC 8188).
  const padded = concat(plaintext, new Uint8Array([0x02]));
  const cekKey = await crypto.subtle.importKey(
    'raw', cek as unknown as BufferSource, { name: 'AES-GCM' }, false, ['encrypt'],
  );
  const ct = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce as unknown as BufferSource }, cekKey,
    padded as unknown as BufferSource,
  ));

  // 8) Build the aes128gcm record: salt(16) || rs(4) || idlen(1) || keyid(idlen) || ciphertext
  // keyid here = the server's as_pub (65 bytes uncompressed).
  const rs = 4096;
  const rsBytes = new Uint8Array(4);
  new DataView(rsBytes.buffer).setUint32(0, rs, false);
  const idlen = new Uint8Array([asPubRaw.length]);
  return concat(salt, rsBytes, idlen, asPubRaw, ct);
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm as unknown as BufferSource, { name: 'HKDF' }, false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: salt as unknown as BufferSource, info: info as unknown as BufferSource },
    key, length * 8,
  );
  return new Uint8Array(bits);
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) { out.set(a, offset); offset += a.length; }
  return out;
}

function b64uEncode(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64uDecode(s: string): Uint8Array {
  const normalized = s.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
