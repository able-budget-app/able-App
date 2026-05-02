// plaid-classify-override
// User-driven re-classification from the Income Inbox UI. Updates a single
// plaid_transactions row to a new category/label AND (optionally) writes a
// user_classification_overrides row so future matching transactions get
// auto-classified the same way without an LLM call.
//
// POST body:
//   {
//     txn_row_id: string,                              // plaid_transactions.id (UUID)
//     able_category: 'income'|'bill'|'debt_payment'|'tax_payment'|'transfer'|'discretionary',
//     able_label?: string,                             // optional; falls back to merchant_name/name
//     create_override?: boolean,                       // default true
//     override_kind?: 'merchant'|'name_substring',     // required when create_override=true
//     override_value?: string,                         // required when create_override=true; lowercased + trimmed
//     override_direction?: 'inflow'|'outflow'|'both',  // default derived from txn sign
//   }
//
// Auth: user JWT (the function runs as the user via RLS-aware client to
// verify ownership, then uses service_role to write — RLS on plaid_transactions
// is SELECT-only for users).

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const VALID_CATEGORIES = new Set([
  'income', 'bill', 'debt_payment', 'tax_payment', 'transfer', 'discretionary',
]);
const VALID_OVERRIDE_KINDS = new Set(['merchant', 'name_substring']);
const VALID_DIRECTIONS = new Set(['inflow', 'outflow', 'both']);

type Body = {
  txn_row_id?: string;
  able_category?: string;
  able_label?: string;
  create_override?: boolean;
  override_kind?: string;
  override_value?: string;
  override_direction?: string;
  // Optional tax-deductible flag — when present, sets is_tax_deductible on
  // the row (used by the Tax export view). Omitted = leave field as-is.
  is_tax_deductible?: boolean;
  // Optional business label — when present (including empty string to clear),
  // sets business_label on the row. Omitted = leave field as-is.
  business_label?: string | null;
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

    const body: Body = await req.json().catch(() => ({} as Body));

    if (!body.txn_row_id) return json({ error: 'txn_row_id required' }, 400);
    if (!body.able_category || !VALID_CATEGORIES.has(body.able_category)) {
      return json({ error: 'invalid able_category' }, 400);
    }

    const createOverride = body.create_override !== false; // default true
    if (createOverride) {
      if (!body.override_kind || !VALID_OVERRIDE_KINDS.has(body.override_kind)) {
        return json({ error: 'invalid override_kind' }, 400);
      }
      if (!body.override_value || typeof body.override_value !== 'string') {
        return json({ error: 'override_value required' }, 400);
      }
      if (body.override_direction && !VALID_DIRECTIONS.has(body.override_direction)) {
        return json({ error: 'invalid override_direction' }, 400);
      }
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Fetch the txn (service-role query, then verify it belongs to the user).
    const { data: txn, error: txnErr } = await admin
      .from('plaid_transactions')
      .select('id, user_id, merchant_name, name, amount')
      .eq('id', body.txn_row_id)
      .single();
    if (txnErr || !txn) {
      console.error('classify-override: txn lookup failed', txnErr);
      return json({ error: 'Transaction not found' }, 404);
    }
    if (txn.user_id !== userId) {
      return json({ error: 'Forbidden' }, 403);
    }

    const label = (body.able_label && body.able_label.trim().length > 0)
      ? body.able_label.trim()
      : (txn.merchant_name ?? txn.name ?? 'Inflow');

    const updatePayload: Record<string, unknown> = {
      able_category: body.able_category,
      able_label: label,
      able_confidence: 1.0,
      able_classified_at: new Date().toISOString(),
    };
    if (typeof body.is_tax_deductible === 'boolean') {
      updatePayload.is_tax_deductible = body.is_tax_deductible;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'business_label')) {
      // Empty string or null both clear the tag; non-empty trims whitespace
      // so duplicate labels with stray spaces collapse.
      const raw = body.business_label;
      updatePayload.business_label = (typeof raw === 'string' && raw.trim().length > 0)
        ? raw.trim()
        : null;
    }
    const { error: updErr } = await admin
      .from('plaid_transactions')
      .update(updatePayload)
      .eq('id', txn.id);
    if (updErr) {
      console.error('classify-override: update failed', updErr);
      return json({ error: updErr.message }, 500);
    }

    let overrideId: string | null = null;
    if (createOverride) {
      const direction = body.override_direction
        ?? ((txn.amount ?? 0) < 0 ? 'inflow' : 'outflow');
      const matchValue = body.override_value!.toLowerCase().trim();
      // Upsert so re-labeling the same pattern updates the existing row
      // instead of erroring on the unique constraint.
      const { data: ov, error: ovErr } = await admin
        .from('user_classification_overrides')
        .upsert(
          {
            user_id: userId,
            match_kind: body.override_kind!,
            match_value: matchValue,
            direction,
            able_category: body.able_category,
            able_label: label,
          },
          { onConflict: 'user_id,match_kind,match_value,direction' },
        )
        .select('id')
        .single();
      if (ovErr) {
        // The txn update already succeeded; surface the override failure
        // but don't roll back the user-visible action.
        console.error('classify-override: override upsert failed', ovErr);
        return json({
          ok: true,
          txn_updated: true,
          override_created: false,
          override_error: ovErr.message,
        });
      }
      overrideId = ov?.id ?? null;
    }

    return json({
      ok: true,
      txn_updated: true,
      override_created: createOverride,
      override_id: overrideId,
    });
  } catch (e) {
    console.error('plaid-classify-override error:', e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
