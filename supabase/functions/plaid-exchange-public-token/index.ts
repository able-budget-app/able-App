// plaid-exchange-public-token
// Exchanges a Link onSuccess public_token for a long-lived access_token,
// persists the plaid_items row, and pulls the initial accounts list.
//
// POST body:
//   {
//     public_token: string,                  // from Link onSuccess
//     institution: { id, name } | null,      // from Link onSuccess metadata
//     lookback_months?: 6 | 12 | 24          // captured for the initial sync
//   }
//
// Returns: { plaid_item_row_id, item_id, accounts }
//
// After this returns, the client should:
//   1) prompt the user to mark a primary spending account
//      (PATCH plaid_accounts.is_primary_spending = true)
//   2) call plaid-sync to start backfilling transactions

import { createClient } from 'npm:@supabase/supabase-js@2';
import { itemPublicTokenExchange, accountsGet } from '../_shared/plaid.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

type Body = {
  public_token: string;
  institution?: { id?: string | null; name?: string | null } | null;
  lookback_months?: 6 | 12 | 24;
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

    const body: Body = await req.json();
    if (!body?.public_token) return json(req, { error: 'public_token required' }, 400);

    const lookback: 6 | 12 | 24 = ([6, 12, 24] as const).includes(body.lookback_months as 6 | 12 | 24)
      ? (body.lookback_months as 6 | 12 | 24)
      : 6;

    const exchange = await itemPublicTokenExchange(body.public_token);
    const accountsResp = await accountsGet(exchange.access_token);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Upsert by Plaid's item_id so re-linking the same institution updates
    // rather than creating a duplicate.
    const { data: item, error: itemErr } = await admin
      .from('plaid_items')
      .upsert(
        {
          user_id: userId,
          plaid_item_id: exchange.item_id,
          access_token: exchange.access_token,
          institution_id: body.institution?.id ?? null,
          institution_name: body.institution?.name ?? null,
          status: 'active',
          error_code: null,
          error_message: null,
          lookback_months: lookback,
        },
        { onConflict: 'plaid_item_id' },
      )
      .select('id')
      .single();
    if (itemErr || !item) {
      console.error('plaid_items upsert failed:', itemErr);
      return json(req, { error: itemErr?.message ?? 'Could not save Plaid item' }, 500);
    }

    // Insert each account. Skip accounts the user already has linked.
    const accountRows = accountsResp.accounts.map((a) => ({
      user_id: userId,
      plaid_item_id: item.id,
      plaid_account_id: a.account_id,
      name: a.name,
      official_name: a.official_name,
      mask: a.mask,
      type: a.type,
      subtype: a.subtype,
      current_balance: a.balances.current,
      available_balance: a.balances.available,
      iso_currency_code: a.balances.iso_currency_code ?? 'USD',
      last_balance_at: new Date().toISOString(),
    }));

    const { error: acctErr } = await admin
      .from('plaid_accounts')
      .upsert(accountRows, { onConflict: 'plaid_account_id' });
    if (acctErr) {
      console.error('plaid_accounts upsert failed:', acctErr);
      return json(req, { error: acctErr.message }, 500);
    }

    return json(req, {
      plaid_item_row_id: item.id,
      item_id: exchange.item_id,
      lookback_months: lookback,
      accounts: accountsResp.accounts.map((a) => ({
        plaid_account_id: a.account_id,
        name: a.name,
        mask: a.mask,
        type: a.type,
        subtype: a.subtype,
        current_balance: a.balances.current,
      })),
    });
  } catch (e) {
    console.error('plaid-exchange-public-token error:', e);
    return json(req, { error: (e as Error).message }, 500);
  }
});

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  });
}
