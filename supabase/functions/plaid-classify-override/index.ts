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

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

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

      // Sync user_data.bills when the user marks a recurring pattern as
      // a bill. Without this, plaid_transactions.able_category gets updated
      // and the override pattern is saved, but the Bills page (which reads
      // user_data.bills) doesn't see the new bill — so the user marks
      // Villa Sport as a bill from Activity, the categorization works, but
      // Bills page doesn't update. P0 bug filed 2026-05-08.
      //
      // Only fires for category='bill' with override=true (a "just this
      // transaction" reclassify is a per-row decision, not a "this is a
      // recurring bill" assertion). De-classify away from bill is NOT
      // mirrored as a bill removal — too risky for false positives on
      // manually-added bills with similar names; the user can delete from
      // the Bills page if needed.
      if (body.able_category === 'bill') {
        try {
          await addBillFromOverride(admin, userId, txn, matchValue, label);
        } catch (e) {
          console.error('classify-override: addBillFromOverride threw', e);
        }
      }
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

// When a user reclassifies a recurring pattern → 'bill', mirror the
// decision into user_data.bills so the Bills page picks it up. The amount
// + frequency come from plaid_recurring_streams when we have a matching
// stream; otherwise we fall back to the txn's own amount and assume monthly.
async function addBillFromOverride(
  admin: SupabaseClient,
  userId: string,
  txn: { merchant_name: string | null; name: string | null; amount: number; date: string },
  matchValue: string,
  label: string,
): Promise<void> {
  const matchValueLower = matchValue.toLowerCase().trim();
  if (!matchValueLower) return;

  const { data: ud, error: udErr } = await admin
    .from('user_data')
    .select('bills')
    .eq('id', userId)
    .single();
  if (udErr) {
    console.error('addBillFromOverride: user_data read failed', udErr);
    return;
  }
  const bills: Record<string, unknown>[] = Array.isArray(ud?.bills)
    ? [...(ud.bills as Record<string, unknown>[])]
    : [];

  // De-dup: if any existing bill name overlaps the override pattern (in
  // either direction, case-insensitive), assume it's already represented.
  // Two-way containment catches both "Villa Sport" matching "villa sport"
  // and short patterns like "spotify" matching a longer "Spotify Premium".
  const dup = bills.some((b) => {
    const nm = String(b?.name || '').toLowerCase();
    return nm && (nm.includes(matchValueLower) || matchValueLower.includes(nm));
  });
  if (dup) return;

  // Find a matching plaid_recurring_streams row for amount + cadence.
  // Match against the override pattern in either direction so we still
  // handle name_substring overrides where the pattern is shorter than
  // Plaid's full merchant_name.
  const { data: streams } = await admin
    .from('plaid_recurring_streams')
    .select('stream_id, merchant_name, average_amount')
    .eq('user_id', userId)
    .eq('direction', 'outflow');
  const matchedStream = (streams ?? []).find((s) => {
    const m = String((s as { merchant_name?: string | null }).merchant_name || '').toLowerCase();
    return m && (m.includes(matchValueLower) || matchValueLower.includes(m));
  }) as { stream_id?: string; average_amount?: number } | undefined;

  const amount = matchedStream
    ? Math.abs(Number(matchedStream.average_amount) || 0)
    : Math.abs(Number(txn.amount) || 0);
  if (amount <= 0) return;

  // Default due_day from the originating txn's date when we don't have a
  // stream to derive it from. Bills page accepts string '1'..'31'.
  let due = '1';
  if (txn.date) {
    const day = new Date(`${txn.date}T12:00:00Z`).getUTCDate();
    if (Number.isFinite(day) && day >= 1 && day <= 31) due = String(day);
  }

  bills.push({
    id: `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    name: label,
    amount,
    due,
    cat: 'utility',
    priority: 2,
    paid: false,
    evidence_stream_id: matchedStream?.stream_id ?? null,
    source: 'reclassify_override',
  });

  const { error: upErr } = await admin
    .from('user_data')
    .update({ bills })
    .eq('id', userId);
  if (upErr) {
    console.error('addBillFromOverride: bills update failed', upErr);
    return;
  }
  console.log(`classify-override: added bill "${label}" $${amount} (stream=${matchedStream?.stream_id ?? 'none'}) for user ${userId.slice(0, 8)}`);
}
