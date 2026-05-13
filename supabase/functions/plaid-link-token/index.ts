// plaid-link-token
// Creates a Plaid Link token for the frontend.
//
// POST body:
//   {
//     mode?: 'new' | 'update' | 'add_product',  // default 'new'
//     lookback_months?: 6 | 12 | 24,            // default 6 (D1.4 lock)
//     plaid_item_row_id?: string                // required if mode='update' or 'add_product'
//     account_selection_enabled?: boolean       // update mode + NEW_ACCOUNTS_AVAILABLE
//     products_to_add?: string[]                // required if mode='add_product' (e.g. ['liabilities'])
//   }
//
// Returns: { link_token, expiration, mode }
//
// _shared/plaid.ts is inlined below so the function deploys
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
const PLAID_WEBHOOK_URL = Deno.env.get('PLAID_WEBHOOK_URL') ?? undefined;
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
  try { parsed = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
  if (!res.ok) {
    throw new Error(`Plaid ${path} failed: ${text || res.status}`);
  }
  return parsed as TRes;
}

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

type Body = {
  mode?: 'new' | 'update' | 'add_product';
  lookback_months?: 6 | 12 | 24;
  plaid_item_row_id?: string;
  account_selection_enabled?: boolean;
  // Products to add when mode='add_product'. Plaid will reconfirm with
  // the user and update the item's product list server-side. Default
  // ['liabilities'] for the post-PR-#13 enable-real-APR flow.
  products_to_add?: string[];
  // OAuth redirect URI. Required by Plaid for OAuth-based institutions
  // (Chase, Capital One, USAA, etc.). Must be registered in the Plaid
  // dashboard as an allowed URI. Front-end passes
  // `${window.location.origin}/app.html`.
  redirect_uri?: string;
};

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
    const mode: 'new' | 'update' | 'add_product' = body.mode ?? 'new';
    const lookback: 6 | 12 | 24 = ([6, 12, 24] as const).includes(body.lookback_months as 6 | 12 | 24)
      ? (body.lookback_months as 6 | 12 | 24)
      : 6;

    // Update + add_product modes require the user's existing access_token.
    let accessToken: string | undefined;
    if (mode === 'update' || mode === 'add_product') {
      if (!body.plaid_item_row_id) {
        return json(req, { error: `plaid_item_row_id required for ${mode} mode` }, 400);
      }
      const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
      const { data: item, error } = await admin
        .from('plaid_items')
        .select('access_token, user_id')
        .eq('id', body.plaid_item_row_id)
        .single();
      if (error || !item) return json(req, { error: 'Item not found' }, 404);
      if (item.user_id !== userId) return json(req, { error: 'Forbidden' }, 403);
      accessToken = item.access_token;
    }

    // add_product needs at least one product to add. Default to liabilities
    // (the v1 use case post-PR-#13). Whitelist defends against arbitrary
    // products being requested from the client.
    let productsToAdd: string[] = [];
    if (mode === 'add_product') {
      const allowed = new Set(['liabilities']);
      const requested = (body.products_to_add ?? ['liabilities']).filter((p) => allowed.has(p));
      if (requested.length === 0) {
        return json(req, { error: 'products_to_add must contain at least one allowed product' }, 400);
      }
      productsToAdd = requested;
    }

    const dayMap: Record<6 | 12 | 24, number> = { 6: 180, 12: 365, 24: 730 };

    // products array semantics by mode:
    //   'new'         — initial link, request the full v1 product set.
    //   'update'      — empty (Plaid resolves the item's existing products).
    //   'add_product' — the products to ADD to an existing item. Plaid
    //                   reconfirms with the user and merges these into
    //                   the item's product list.
    const products = mode === 'update'
      ? []
      : mode === 'add_product'
        ? productsToAdd
        : ['transactions', 'liabilities'];

    const reqBody: Record<string, unknown> = {
      user: { client_user_id: userId },
      client_name: 'Able',
      products,
      country_codes: ['US'],
      language: 'en',
    };
    if (PLAID_WEBHOOK_URL) reqBody.webhook = PLAID_WEBHOOK_URL;
    if (accessToken) reqBody.access_token = accessToken;
    if (mode === 'new') reqBody.transactions = { days_requested: dayMap[lookback] };
    if (mode === 'update' && body.account_selection_enabled) {
      reqBody.update = { account_selection_enabled: true };
    }
    // redirect_uri is an OAuth callback URL. Plaid's dashboard allow-list is
    // the real gate (must be pre-registered), but we also pin it here so a
    // hostile caller can't forward the flow to an unregistered origin. Allow
    // becomeable.app + www + deploy-preview + localhost only.
    if (body.redirect_uri) {
      const uri = String(body.redirect_uri);
      const allowed = /^https:\/\/(?:www\.)?becomeable\.app(?:\/.*)?$/.test(uri)
        || /^https:\/\/deploy-preview-\d+--becomeable\.netlify\.app(?:\/.*)?$/.test(uri)
        || /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/.*)?$/.test(uri);
      if (allowed) reqBody.redirect_uri = uri;
    }

    const link = await plaidApi<typeof reqBody, { link_token: string; expiration: string; request_id: string }>(
      '/link/token/create',
      reqBody,
    );

    return json(req, {
      link_token: link.link_token,
      expiration: link.expiration,
      mode,
      lookback_months: lookback,
    });
  } catch (e) {
    console.error('plaid-link-token error:', e);
    return json(req, { error: 'Internal server error' }, 500);
  }
});

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  });
}
