// plaid-item-remove
// Honors Plaid's required user-offboarding flow. Calls /item/remove with
// the user's access_token and deletes the plaid_items row, which
// cascades to plaid_accounts, plaid_transactions, and
// plaid_recurring_streams via FK on delete cascade.
//
// POST body: { plaid_item_row_id: string }
//
// Auth: requires the user's bearer token. The row's user_id must match
// the authenticated user.
//
// _shared/plaid.ts is inlined below so this function deploys
// self-contained from the Supabase dashboard.

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
const PLAID_ENV = Deno.env.get('PLAID_ENV') ?? 'sandbox';
const PLAID_HOSTS: Record<string, string> = {
  sandbox: 'https://sandbox.plaid.com',
  development: 'https://development.plaid.com',
  production: 'https://production.plaid.com',
};
const PLAID_HOST = PLAID_HOSTS[PLAID_ENV] ?? PLAID_HOSTS.sandbox;

type PlaidErrorBody = {
  error_type: string;
  error_code: string;
  error_message: string;
  display_message?: string | null;
  request_id?: string;
};

class PlaidApiError extends Error {
  status: number;
  plaid: PlaidErrorBody;
  constructor(status: number, plaid: PlaidErrorBody) {
    super(`Plaid ${plaid.error_code}: ${plaid.error_message}`);
    this.status = status;
    this.plaid = plaid;
  }
}

async function plaidApi<TReq extends Record<string, unknown>, TRes>(
  path: string,
  body: TReq,
): Promise<TRes> {
  const clientId = Deno.env.get('PLAID_CLIENT_ID');
  const secret = Deno.env.get('PLAID_SECRET');
  if (!clientId || !secret) {
    throw new Error('PLAID_CLIENT_ID and PLAID_SECRET must be set');
  }
  const res = await fetch(`${PLAID_HOST}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, secret, ...body }),
  });
  const text = await res.text();
  let parsed: unknown = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { /* non-JSON body */ }
  if (!res.ok) {
    const err = (parsed ?? {
      error_type: 'API_ERROR',
      error_code: 'UNKNOWN',
      error_message: text || `HTTP ${res.status}`,
    }) as PlaidErrorBody;
    throw new PlaidApiError(res.status, err);
  }
  return parsed as TRes;
}

const itemRemove = (access_token: string) =>
  plaidApi<{ access_token: string }, { request_id: string }>('/item/remove', { access_token });

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
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
  };
}

type Body = { plaid_item_row_id?: string };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'POST only' }, 405);

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes.user) return json(req, { error: 'Unauthorized' }, 401);
    const userId = userRes.user.id;

    const body: Body = await req.json().catch(() => ({}));
    if (!body.plaid_item_row_id) return json(req, { error: 'plaid_item_row_id required' }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: item, error: fetchErr } = await admin
      .from('plaid_items')
      .select('id, user_id, access_token, institution_name')
      .eq('id', body.plaid_item_row_id)
      .single();
    if (fetchErr || !item) return json(req, { error: 'Item not found' }, 404);
    if (item.user_id !== userId) return json(req, { error: 'Forbidden' }, 403);

    // Tell Plaid first. If the call succeeds, the access_token is
    // invalidated and we should drop the row regardless. If Plaid
    // returns ITEM_NOT_FOUND we treat that as already-removed and
    // proceed to delete the row anyway.
    try {
      await itemRemove(item.access_token);
    } catch (e) {
      if (e instanceof PlaidApiError && e.plaid.error_code === 'ITEM_NOT_FOUND') {
        console.warn(`item ${item.id} already removed at Plaid; proceeding with local delete`);
      } else {
        console.error('plaid /item/remove failed:', e);
        return json(req, { error: (e as Error).message }, 502);
      }
    }

    const { error: delErr } = await admin
      .from('plaid_items')
      .delete()
      .eq('id', item.id);
    if (delErr) {
      console.error('plaid_items delete failed:', delErr);
      return json(req, { error: delErr.message }, 500);
    }

    return json(req, { ok: true, institution_name: item.institution_name });
  } catch (e) {
    console.error('plaid-item-remove error:', e);
    return json(req, { error: 'Internal server error' }, 500);
  }
});

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  });
}
