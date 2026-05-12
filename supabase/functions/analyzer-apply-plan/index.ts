// analyzer-apply-plan
// Takes an analyzer_plan and merges its sections into the user's user_data
// row. Maps the Analyzer's API vocabulary onto Able's app schema:
//   - reserve_pct → settings.bufPct
//   - bills.due_day_of_month → bill.due (string, "1".."31")
//   - tax_allocation.suggested_pct → an entry in obligations[]
//   - debts → debts[]; if min_payment + due_day_of_month present, the app's
//             auto-bill convention is mirrored here so the linked "(minimum)"
//             bill shows up the same way it does for manual debt entry.
//
// POST body:
//   {
//     plan_id: string,
//     sections?: {
//       income_sources?: boolean,
//       bills?: boolean,
//       debts?: boolean,
//       tax_allocation?: boolean,
//       surplus_split?: boolean
//     },                           // default: all true
//     overrides?: {                // optional user-edited values; when
//       income_sources?: ...,      // present, used in place of the plan's
//       bills?: ...,               // version of that section.
//       debts?: ...,
//       tax_allocation?: ...,
//       surplus_split?: ...
//     },
//     pending_review?: boolean     // when true, mark created bills + debts
//                                  // with pending_review:true + a
//                                  // source_plan_id provenance so the
//                                  // client can confirm/skip them later
//                                  // without losing data if the page closes.
//                                  // Plan status goes to 'auto_applied'
//                                  // instead of 'fully_applied'.
//   }
//
// Returns: { applied_sections, plan_status }

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

type SectionFlags = {
  income_sources?: boolean;
  bills?: boolean;
  debts?: boolean;
  tax_allocation?: boolean;
  surplus_split?: boolean;
};

type AnalyzerPlanShape = {
  income_sources?: { name: string }[];
  bills?: {
    name: string;
    amount: number;
    due_day_of_month?: number | null;
    frequency?: string;
    evidence_stream_id?: string | null;
  }[];
  debts?: {
    name: string;
    min_payment: number;
    due_day_of_month?: number | null;
    rate_estimate?: number | null;
    balance_estimate?: number | null;
  }[];
  tax_allocation?: { suggested_pct: number; evidence_summary?: string };
  surplus_split?: {
    owner_pct: number;
    debt_pct: number;
    reserve_pct: number;
    free_pct: number;
  };
};

type Body = {
  plan_id: string;
  sections?: SectionFlags;
  overrides?: Partial<AnalyzerPlanShape>;
  pending_review?: boolean;
  // Auto-apply during onboarding sets this so Plaid-detected income
  // sources fully replace whatever defaults / intake_channels chips
  // landed in user_data.sources earlier. Default = append (preserves
  // user-added custom sources on subsequent re-applies).
  replace_sources?: boolean;
};

type AnalyzerPlan = AnalyzerPlanShape;

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
    if (!body?.plan_id) return json(req, { error: 'plan_id required' }, 400);

    const flags: Required<SectionFlags> = {
      income_sources: body.sections?.income_sources ?? true,
      bills: body.sections?.bills ?? true,
      debts: body.sections?.debts ?? true,
      tax_allocation: body.sections?.tax_allocation ?? true,
      surplus_split: body.sections?.surplus_split ?? true,
    };

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: planRow, error: planErr } = await admin
      .from('analyzer_plans')
      .select('id, user_id, plan_json, status')
      .eq('id', body.plan_id)
      .single();
    if (planErr || !planRow) return json(req, { error: 'Plan not found' }, 404);
    if (planRow.user_id !== userId) return json(req, { error: 'Forbidden' }, 403);
    if (planRow.status === 'fully_applied') {
      return json(req, { error: 'Plan already fully applied' }, 409);
    }

    const pendingReview = body.pending_review === true;

    const plan = planRow.plan_json as AnalyzerPlan;

    // Merge user overrides on top of the plan. For any section the user
    // edited, the override array/object replaces the plan's version
    // entirely. Sections without an override use the plan's data.
    const o = body.overrides ?? {};
    const effective: AnalyzerPlan = {
      income_sources: o.income_sources ?? plan.income_sources,
      bills:          o.bills          ?? plan.bills,
      debts:          o.debts          ?? plan.debts,
      tax_allocation: o.tax_allocation ?? plan.tax_allocation,
      surplus_split:  o.surplus_split  ?? plan.surplus_split,
    };

    const { data: ud, error: udErr } = await admin
      .from('user_data')
      .select('*')
      .eq('id', userId)
      .single();
    if (udErr && udErr.code !== 'PGRST116') {
      // PGRST116 = no rows; that's fine, we'll create one.
      return json(req, { error: udErr.message }, 500);
    }

    const next = mergePlan(ud ?? { id: userId }, effective, flags, {
      pendingReview,
      sourcePlanId: planRow.id,
      replaceSources: body.replace_sources === true,
    });

    const { error: writeErr } = await admin
      .from('user_data')
      .upsert({ ...next, id: userId, updated_at: new Date().toISOString() });
    if (writeErr) return json(req, { error: writeErr.message }, 500);

    const allOn = flags.income_sources && flags.bills && flags.debts && flags.tax_allocation && flags.surplus_split;
    const newStatus = pendingReview
      ? 'auto_applied'
      : (allOn ? 'fully_applied' : 'partially_applied');
    const now = new Date().toISOString();
    // Check the status update result instead of swallowing it. Until the
    // schema added 'auto_applied' to the CHECK constraint, this update was
    // silently failing on every auto-apply call — function returned 200,
    // status stayed 'pending', user_data wrote successfully but the plan
    // lifecycle never advanced. If the update fails now, surface a 500 so
    // the client can show a real error instead of pretending success.
    const { error: statusErr } = await admin
      .from('analyzer_plans')
      .update({
        status: newStatus,
        accepted_at: planRow.status === 'pending' || planRow.status === 'presenting' ? now : undefined,
        applied_at: now,
      })
      .eq('id', planRow.id);
    if (statusErr) {
      console.error('analyzer-apply-plan: plan status update failed:', statusErr);
      return json(req, { error: `plan status update failed: ${statusErr.message}` }, 500);
    }

    return json(req, {
      applied_sections: Object.entries(flags).filter(([, v]) => v).map(([k]) => k),
      plan_status: newStatus,
    });
  } catch (e) {
    console.error('analyzer-apply-plan error:', e);
    return json(req, { error: 'Internal server error' }, 500);
  }
});

function mergePlan(
  current: Record<string, unknown>,
  plan: AnalyzerPlan,
  flags: Required<SectionFlags>,
  opts: { pendingReview: boolean; sourcePlanId: string; replaceSources: boolean },
): Record<string, unknown> {
  const next = { ...current };
  const reviewTag = opts.pendingReview
    ? { pending_review: true, source_plan_id: opts.sourcePlanId }
    : {};

  // Sources: array of strings.
  //   replace_sources:true (onboarding auto-apply) — overwrite with the
  //     plan's sources so generic defaults / intake-channel chips don't
  //     double up next to Plaid-detected ones.
  //   default — append new names without duplicating, so a user who
  //     re-applies a refreshed plan keeps any sources they added by hand.
  if (flags.income_sources && plan.income_sources?.length) {
    const planSources = plan.income_sources
      .map((s) => s.name)
      .filter((n): n is string => Boolean(n));
    if (opts.replaceSources) {
      next.sources = planSources;
    } else {
      const existing = Array.isArray(next.sources) ? (next.sources as string[]) : [];
      const seen = new Set(existing.map((s) => s.toLowerCase()));
      const additions = planSources.filter((n) => !seen.has(n.toLowerCase()));
      next.sources = [...existing, ...additions];
    }
  }

  // Settings: surplus split percentages. reserve_pct → bufPct.
  if (flags.surplus_split && plan.surplus_split) {
    const settings = (next.settings && typeof next.settings === 'object'
      ? next.settings
      : {}) as Record<string, unknown>;
    next.settings = {
      ...settings,
      ownerPct: plan.surplus_split.owner_pct,
      debtPct: plan.surplus_split.debt_pct,
      bufPct: plan.surplus_split.reserve_pct,
      freePct: plan.surplus_split.free_pct,
    };
  }

  // Tax allocation → an entry in obligations[].
  if (flags.tax_allocation && plan.tax_allocation && plan.tax_allocation.suggested_pct > 0) {
    const obligations = Array.isArray(next.obligations) ? [...(next.obligations as Record<string, unknown>[])] : [];
    const existingTaxIdx = obligations.findIndex(
      (o) => typeof o.label === 'string' && o.label.toLowerCase() === 'tax',
    );
    const taxRow = {
      id: existingTaxIdx >= 0 ? obligations[existingTaxIdx].id : `fa_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      label: 'Tax',
      percentage: plan.tax_allocation.suggested_pct,
      destination: 'external_transfer',
      enabledSources: [],
      active: true,
      note: plan.tax_allocation.evidence_summary ?? null,
      ...reviewTag,
    };
    if (existingTaxIdx >= 0) {
      obligations[existingTaxIdx] = { ...obligations[existingTaxIdx], ...taxRow };
    } else {
      obligations.push(taxRow);
    }
    next.obligations = obligations;
  }

  // Debts: append, skip duplicates by name (case-insensitive).
  // Mirror app.html's auto-bill convention: when a debt has min_payment +
  // due_day_of_month, also add a "<name> (minimum)" bill linked by fromDebtId.
  let addedDebtBills: Record<string, unknown>[] = [];
  if (flags.debts && plan.debts?.length) {
    const existingDebts = Array.isArray(next.debts) ? [...(next.debts as Record<string, unknown>[])] : [];
    const seenDebt = new Set(existingDebts.map((d) => String(d.name ?? '').toLowerCase()));
    const colors = ['#e07a5f', '#c85a5a', '#d4956a', '#6b9fcf', '#9b8ec4', '#7aad8a'];

    for (const d of plan.debts) {
      if (!d.name || seenDebt.has(d.name.toLowerCase())) continue;
      const debtId = `d_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const debtRow: Record<string, unknown> = {
        id: debtId,
        name: d.name,
        balance: d.balance_estimate ?? 0,
        min: d.min_payment,
        rate: d.rate_estimate != null ? d.rate_estimate * 100 : 0,
        dueDay: d.due_day_of_month ?? null,
        color: colors[existingDebts.length % colors.length],
        orig: d.balance_estimate ?? 0,
        ...reviewTag,
      };
      existingDebts.push(debtRow);
      seenDebt.add(d.name.toLowerCase());

      if (d.min_payment > 0 && d.due_day_of_month) {
        addedDebtBills.push({
          id: `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
          name: `${d.name} (minimum)`,
          amount: d.min_payment,
          due: String(d.due_day_of_month),
          cat: 'debt',
          priority: 1,
          paid: false,
          fromDebtId: debtId,
          ...reviewTag,
        });
      }
    }
    next.debts = existingDebts;
  }

  // Bills: append, skip duplicates by name. Includes the auto-debt bills.
  if (flags.bills || addedDebtBills.length) {
    const existingBills = Array.isArray(next.bills) ? [...(next.bills as Record<string, unknown>[])] : [];
    const seenBill = new Set(existingBills.map((b) => String(b.name ?? '').toLowerCase()));

    const planBillRows = (flags.bills && plan.bills?.length) ? plan.bills.map((b) => ({
      id: `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      name: b.name,
      amount: b.amount,
      due: b.due_day_of_month != null ? String(b.due_day_of_month) : '1',
      cat: 'utility',
      priority: 2,
      paid: false,
      // Preserve the source recurring stream id so the post-onboarding
      // deep-dive (and future re-analyzes) can match this bill back to a
      // Plaid stream — used for stale detection ("looks canceled — keep,
      // edit, or remove?") and for skip-on-rewrite dedup.
      evidence_stream_id: b.evidence_stream_id ?? null,
      ...reviewTag,
    })) : [];

    for (const row of [...planBillRows, ...addedDebtBills]) {
      const nameKey = String(row.name ?? '').toLowerCase();
      if (!nameKey || seenBill.has(nameKey)) continue;
      existingBills.push(row);
      seenBill.add(nameKey);
    }
    next.bills = existingBills;
  }

  return next;
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  });
}
