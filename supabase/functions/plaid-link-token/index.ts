// plaid-link-token
// Creates a Plaid Link token for the frontend.
//
// POST body:
//   {
//     mode?: 'new' | 'update',                  // default 'new'
//     lookback_months?: 6 | 12 | 24,            // default 6 (D1.4 lock)
//     plaid_item_row_id?: string                // required if mode='update'
//   }
//
// Returns: { link_token, expiration, mode }
//
// Per Able's Plaid v1 architecture decisions (2026-04-28):
//   - products = ["transactions"] only (Balance auto-initializes)
//   - lookback options 6/12/24 (no 3mo)
//   - webhook URL from PLAID_WEBHOOK_URL env if set

import { createClient } from 'npm:@supabase/supabase-js@2';
import { linkTokenCreate } from '../_shared/plaid.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PLAID_WEBHOOK_URL = Deno.env.get('PLAID_WEBHOOK_URL') ?? undefined;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Body = {
  mode?: 'new' | 'update';
  lookback_months?: 6 | 12 | 24;
  plaid_item_row_id?: string;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes.user) return json({ error: 'Unauthorized' }, 401);
    const userId = userRes.user.id;

    const body: Body = await req.json().catch(() => ({}));
    const mode: 'new' | 'update' = body.mode ?? 'new';
    const lookback: 6 | 12 | 24 = ([6, 12, 24] as const).includes(body.lookback_months as 6 | 12 | 24)
      ? (body.lookback_months as 6 | 12 | 24)
      : 6;

    // Update mode requires the user's existing access_token.
    let accessToken: string | undefined;
    if (mode === 'update') {
      if (!body.plaid_item_row_id) {
        return json({ error: 'plaid_item_row_id required for update mode' }, 400);
      }
      const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
      const { data: item, error } = await admin
        .from('plaid_items')
        .select('access_token, user_id')
        .eq('id', body.plaid_item_row_id)
        .single();
      if (error || !item) return json({ error: 'Item not found' }, 404);
      if (item.user_id !== userId) return json({ error: 'Forbidden' }, 403);
      accessToken = item.access_token;
    }

    const dayMap: Record<6 | 12 | 24, number> = { 6: 180, 12: 365, 24: 730 };

    const link = await linkTokenCreate({
      user: { client_user_id: userId },
      client_name: 'Able',
      products: mode === 'update' ? [] : ['transactions'],
      country_codes: ['US'],
      language: 'en',
      ...(PLAID_WEBHOOK_URL ? { webhook: PLAID_WEBHOOK_URL } : {}),
      ...(accessToken ? { access_token: accessToken } : {}),
      ...(mode === 'new' ? { transactions: { days_requested: dayMap[lookback] } } : {}),
    });

    return json({
      link_token: link.link_token,
      expiration: link.expiration,
      mode,
      lookback_months: lookback,
    });
  } catch (e) {
    console.error('plaid-link-token error:', e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
