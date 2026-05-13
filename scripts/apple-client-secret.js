#!/usr/bin/env node
// Generate the Apple "client secret" JWT for Supabase Auth.
// Apple caps exp at 6 months — Supabase warns you'll need to regenerate.
//
// Usage:
//   node scripts/apple-client-secret.js <path-to-.p8> <Key ID>
//
// Hardcoded (edit if these ever change):
//   Team ID:      XCRQAQSM3S
//   Services ID:  com.becomeable.app.signin   (the `sub` / web audience)

const fs = require('fs');
const crypto = require('crypto');

const TEAM_ID = 'XCRQAQSM3S';
const SERVICES_ID = 'com.becomeable.app.signin';

const [, , p8Path, keyId] = process.argv;
if (!p8Path || !keyId) {
  console.error('Usage: node scripts/apple-client-secret.js <path-to-.p8> <Key ID>');
  process.exit(1);
}

const privateKey = fs.readFileSync(p8Path.replace(/^~/, process.env.HOME), 'utf8');

const now = Math.floor(Date.now() / 1000);
const expSeconds = 60 * 60 * 24 * 180; // 180 days (Apple cap is ~6 months)

const header = { alg: 'ES256', kid: keyId, typ: 'JWT' };
const payload = {
  iss: TEAM_ID,
  iat: now,
  exp: now + expSeconds,
  aud: 'https://appleid.apple.com',
  sub: SERVICES_ID,
};

const b64url = (obj) =>
  Buffer.from(JSON.stringify(obj))
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

const signingInput = `${b64url(header)}.${b64url(payload)}`;

const signer = crypto.createSign('SHA256');
signer.update(signingInput);
const derSig = signer.sign(privateKey);

// crypto.sign for EC keys returns DER-encoded (r,s). Apple/JWT need raw r||s (64 bytes).
function derToJoseEs256(der) {
  // DER: 0x30 len 0x02 rLen r 0x02 sLen s
  let offset = 2;
  if (der[1] & 0x80) offset = 2 + (der[1] & 0x7f);
  if (der[offset] !== 0x02) throw new Error('bad DER');
  const rLen = der[offset + 1];
  const r = der.slice(offset + 2, offset + 2 + rLen);
  const sStart = offset + 2 + rLen;
  if (der[sStart] !== 0x02) throw new Error('bad DER');
  const sLen = der[sStart + 1];
  const s = der.slice(sStart + 2, sStart + 2 + sLen);
  const pad = (buf) => {
    if (buf.length === 32) return buf;
    if (buf.length === 33 && buf[0] === 0) return buf.slice(1);
    const out = Buffer.alloc(32);
    buf.copy(out, 32 - buf.length);
    return out;
  };
  return Buffer.concat([pad(r), pad(s)]);
}

const jose = derToJoseEs256(derSig)
  .toString('base64')
  .replace(/=/g, '')
  .replace(/\+/g, '-')
  .replace(/\//g, '_');

const jwt = `${signingInput}.${jose}`;
console.log(jwt);
console.error(`\nExpires: ${new Date((now + expSeconds) * 1000).toISOString()} (~6 months)`);
console.error('Paste the line above (no trailing newline) into Supabase → Auth → Apple → Secret Key.');
