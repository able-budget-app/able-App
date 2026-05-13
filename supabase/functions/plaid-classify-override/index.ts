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

    const body: Body = await req.json().catch(() => ({} as Body));

    if (!body.txn_row_id) return json(req, { error: 'txn_row_id required' }, 400);
    if (!body.able_category || !VALID_CATEGORIES.has(body.able_category)) {
      return json(req, { error: 'invalid able_category' }, 400);
    }

    const createOverride = body.create_override !== false; // default true
    if (createOverride) {
      if (!body.override_kind || !VALID_OVERRIDE_KINDS.has(body.override_kind)) {
        return json(req, { error: 'invalid override_kind' }, 400);
      }
      if (!body.override_value || typeof body.override_value !== 'string') {
        return json(req, { error: 'override_value required' }, 400);
      }
      if (body.override_direction && !VALID_DIRECTIONS.has(body.override_direction)) {
        return json(req, { error: 'invalid override_direction' }, 400);
      }
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Fetch the txn (service-role query, then verify it belongs to the user).
    // `date` is needed by syncBillForOverride to derive a default due_day when
    // we add a bill from an override that doesn't match a recurring stream.
    const { data: txn, error: txnErr } = await admin
      .from('plaid_transactions')
      .select('id, user_id, merchant_name, name, amount, date')
      .eq('id', body.txn_row_id)
      .single();
    if (txnErr || !txn) {
      console.error('classify-override: txn lookup failed', txnErr);
      return json(req, { error: 'Transaction not found' }, 404);
    }
    if (txn.user_id !== userId) {
      return json(req, { error: 'Forbidden' }, 403);
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
      return json(req, { error: updErr.message }, 500);
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
        return json(req, {
          ok: true,
          txn_updated: true,
          override_created: false,
          override_error: ovErr.message,
        });
      }
      overrideId = ov?.id ?? null;

      // Sync user_data.bills with the override decision. Without this,
      // plaid_transactions.able_category and the override pattern get
      // saved, but the Bills page (which reads user_data.bills) doesn't
      // see the change. Symmetric: marking → bill adds; marking away
      // from bill removes. P0 bug filed 2026-05-08, second-pass symmetric
      // fix 2026-05-08 evening.
      //
      // Only fires when create_override=true (a "just this transaction"
      // reclassify is a per-row decision, not a "this is/isn't a recurring
      // bill" assertion). The user is taking an explicit action by
      // creating the pattern, so we trust their intent — if a removal
      // catches a manually-added bill with an overlapping name, they
      // can re-add it from the Bills page. No data loss path.
      try {
        await syncBillForOverride(admin, userId, txn, matchValue, label, body.able_category);
      } catch (e) {
        console.error('classify-override: syncBillForOverride threw', e);
      }
    }

    return json(req, {
      ok: true,
      txn_updated: true,
      override_created: createOverride,
      override_id: overrideId,
    });
  } catch (e) {
    console.error('plaid-classify-override error:', e);
    return json(req, { error: 'Internal server error' }, 500);
  }
});

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  });
}

// Mirror an override decision into user_data.bills. When the user
// classifies a recurring pattern as 'bill' we add a row; when they
// classify it away from 'bill' we remove any matching rows. Match logic
// is symmetric (case-insensitive substring containment in either
// direction) so "spotify" matches "Spotify Premium" and vice-versa.
//
// Amount + cadence on add come from plaid_recurring_streams when we have
// a matching stream; otherwise we fall back to the txn's own amount and
// assume monthly.
async function syncBillForOverride(
  admin: SupabaseClient,
  userId: string,
  txn: { merchant_name: string | null; name: string | null; amount: number; date: string },
  matchValue: string,
  label: string,
  newCategory: string,
): Promise<void> {
  const matchValueLower = matchValue.toLowerCase().trim();
  if (!matchValueLower) return;

  const { data: ud, error: udErr } = await admin
    .from('user_data')
    .select('bills')
    .eq('id', userId)
    .single();
  if (udErr) {
    console.error('syncBillForOverride: user_data read failed', udErr);
    return;
  }
  const bills: Record<string, unknown>[] = Array.isArray(ud?.bills)
    ? [...(ud.bills as Record<string, unknown>[])]
    : [];

  const matchesPattern = (b: Record<string, unknown>) => {
    const nm = String(b?.name || '').toLowerCase();
    return !!nm && (nm.includes(matchValueLower) || matchValueLower.includes(nm));
  };

  if (newCategory === 'bill') {
    // Add path. De-dup if a name-overlapping bill already exists.
    if (bills.some(matchesPattern)) return;

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
      console.error('syncBillForOverride: add failed', upErr);
      return;
    }
    console.log(`classify-override: added bill "${label}" $${amount} (stream=${matchedStream?.stream_id ?? 'none'}) for user ${userId.slice(0, 8)}`);
    return;
  }

  // Remove path: any category other than 'bill' (discretionary, transfer,
  // debt_payment, tax_payment) means "this is no longer a bill". Drop
  // every bill row whose name overlaps the override pattern. The user took
  // an explicit action; if the match catches a manually-added bill with an
  // overlapping name, they can re-add it from the Bills page (no data loss).
  const removed = bills.filter(matchesPattern);
  if (removed.length === 0) return;
  const remaining = bills.filter((b) => !matchesPattern(b));

  const { error: upErr } = await admin
    .from('user_data')
    .update({ bills: remaining })
    .eq('id', userId);
  if (upErr) {
    console.error('syncBillForOverride: remove failed', upErr);
    return;
  }
  console.log(`classify-override: removed ${removed.length} bill(s) matching "${matchValueLower}" for user ${userId.slice(0, 8)}`);
}
