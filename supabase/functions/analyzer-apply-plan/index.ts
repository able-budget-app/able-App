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
//     }
//   }
//
// Returns: { applied_sections, plan_status }

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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
};

type AnalyzerPlan = AnalyzerPlanShape;

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

    const body: Body = await req.json();
    if (!body?.plan_id) return json({ error: 'plan_id required' }, 400);

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
    if (planErr || !planRow) return json({ error: 'Plan not found' }, 404);
    if (planRow.user_id !== userId) return json({ error: 'Forbidden' }, 403);
    if (planRow.status === 'fully_applied') {
      return json({ error: 'Plan already fully applied' }, 409);
    }

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
      return json({ error: udErr.message }, 500);
    }

    const next = mergePlan(ud ?? { id: userId }, effective, flags);

    const { error: writeErr } = await admin
      .from('user_data')
      .upsert({ ...next, id: userId, updated_at: new Date().toISOString() });
    if (writeErr) return json({ error: writeErr.message }, 500);

    const allOn = flags.income_sources && flags.bills && flags.debts && flags.tax_allocation && flags.surplus_split;
    const newStatus = allOn ? 'fully_applied' : 'partially_applied';
    const now = new Date().toISOString();
    await admin
      .from('analyzer_plans')
      .update({
        status: newStatus,
        accepted_at: planRow.status === 'pending' || planRow.status === 'presenting' ? now : undefined,
        applied_at: now,
      })
      .eq('id', planRow.id);

    return json({
      applied_sections: Object.entries(flags).filter(([, v]) => v).map(([k]) => k),
      plan_status: newStatus,
    });
  } catch (e) {
    console.error('analyzer-apply-plan error:', e);
    return json({ error: (e as Error).message }, 500);
  }
});

function mergePlan(
  current: Record<string, unknown>,
  plan: AnalyzerPlan,
  flags: Required<SectionFlags>,
): Record<string, unknown> {
  const next = { ...current };

  // Sources: array of strings. Append new names without duplicating.
  if (flags.income_sources && plan.income_sources?.length) {
    const existing = Array.isArray(next.sources) ? (next.sources as string[]) : [];
    const seen = new Set(existing.map((s) => s.toLowerCase()));
    const additions = plan.income_sources
      .map((s) => s.name)
      .filter((n) => n && !seen.has(n.toLowerCase()));
    next.sources = [...existing, ...additions];
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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
