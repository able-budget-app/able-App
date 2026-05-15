// In-app account deletion. Required by Apple App Store Guideline 5.1.1(v).
//
// Wipes the caller's auth user + all owned rows in app tables, then signs
// the user out client-side. After deletion the user cannot sign back in to
// the same account; signing up with the same email creates a fresh, empty
// account.
//
// Security: uses the service-role client only to delete the AUTHENTICATED
// caller's own user_id. Cannot delete other users.

import { createClient } from 'npm:@supabase/supabase-js@2'

const _ALLOWED_ORIGINS = new Set([
  'https://becomeable.app',
  'https://www.becomeable.app',
  'capacitor://localhost',
  'able://localhost',
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
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}
function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  })
}

// Resolve the service-role secret. Prefer the new SUPABASE_SECRET_KEYS env
// (sb_secret_* format) over the deprecated legacy SERVICE_ROLE_KEY JWT.
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405)

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_ROLE = _getServiceKey()

    // Authenticate the caller via their Supabase JWT.
    const authHeader = req.headers.get('Authorization') ?? ''
    const userClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userRes, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userRes.user) return json(req, { error: 'Unauthorized' }, 401)
    const userId = userRes.user.id

    // Admin client (service role) for the delete operations.
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE)

    // Best-effort cleanup of owned rows across the app's tables. Some of
    // these are CASCADE on the FK to auth.users, but we run them explicitly
    // so a misconfigured FK doesn't leave orphaned data.
    const tables = [
      'plaid_transactions',
      'plaid_accounts',
      'plaid_items',
      'plaid_recurring_streams',
      'push_subscriptions',
      'referrals',
      'feedback',
      'user_data',
      'profiles',
    ]
    const cleanup: Record<string, string | null> = {}
    for (const t of tables) {
      try {
        const { error } = await admin.from(t).delete().eq(t === 'profiles' || t === 'user_data' ? 'id' : 'user_id', userId)
        cleanup[t] = error ? error.message : 'ok'
      } catch (e) {
        cleanup[t] = String(e?.message || e)
      }
    }

    // The critical step: delete the auth user. After this, the user cannot
    // sign back in to the same account.
    const { error: delErr } = await admin.auth.admin.deleteUser(userId)
    if (delErr) {
      return json(req, { error: 'Account deletion failed', detail: delErr.message, cleanup }, 500)
    }

    return json(req, { ok: true, cleanup }, 200)
  } catch (e) {
    return json(req, { error: 'Internal error', detail: String(e?.message || e) }, 500)
  }
})
