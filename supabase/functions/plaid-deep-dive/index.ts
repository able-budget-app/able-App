// plaid-deep-dive
//
// Background pass that runs server-side after onboarding completes. Goal:
// catch the bills/sources/debts the initial pipeline missed because of the
// 2500-txn classify cap, without ever overwriting work the user has done
// in the app since the initial plan landed.
//
// Strict rules (architectural):
//   1. APPEND-ONLY. Never modifies an existing row in user_data.bills /
//      .debts / .sources. Only adds new ones with `review_reason: 'new'`,
//      or flags an existing row with `review_reason: 'dormant'` (still
//      doesn't delete — user decides).
//   2. NO LLM ANALYZER. Skips plaid-analyze entirely. The deep-dive uses
//      Haiku for classification (cheap) and the deterministic detectors
//      (recurring + credit-debts). No Sonnet, no tax_pct re-prop, no
//      surplus_split changes.
//   3. IDEMPOTENT. plaid_items.deep_dive_completed_at gates re-fires.
//
// POST body: { plaid_item_row_id: string }
// Auth: user JWT (typical — fired from app.html post-onboarding) OR
//       service-role (for cron / admin re-runs).
//
// Gateway: "Verify JWT" must be OFF.

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

type Body = { plaid_item_row_id: string };

type Bill = {
  id?: string;
  name?: string;
  amount?: number;
  due?: string;
  cat?: string;
  priority?: number;
  paid?: boolean;
  evidence_stream_id?: string | null;
  pending_review?: boolean;
  review_reason?: 'new' | 'dormant';
  fromDebtId?: string;
  [k: string]: unknown;
};

type Stream = {
  stream_id: string;
  direction: 'inflow' | 'outflow';
  merchant_name: string | null;
  description: string | null;
  frequency: string | null;
  is_active: boolean | null;
  status: string | null;
  average_amount: number | null;
  last_amount: number | null;
  predicted_next_date: string | null;
  last_date: string | null;
};

type CreditDebt = {
  id: string;
  name: string | null;
  mask: string | null;
  current_balance: number | null;
  purchase_apr: number | null;
  min_payment: number | null;
  due_day_of_month: number | null;
  evidence_stream_id: string | null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'POST only' }, 405);

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const bearerToken = authHeader.replace(/^Bearer\s+/i, '');
    const isServiceCall = !!bearerToken && bearerToken === SERVICE_ROLE;

    const body = (await req.json().catch(() => ({}))) as Body;
    if (!body?.plaid_item_row_id) {
      return json(req, { error: 'plaid_item_row_id required' }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Resolve item + ownership.
    const { data: item, error: itemErr } = await admin
      .from('plaid_items')
      .select('id, user_id, deep_dive_completed_at')
      .eq('id', body.plaid_item_row_id)
      .single();
    if (itemErr || !item) return json(req, { error: 'Item not found' }, 404);
    const userId: string = item.user_id;

    if (!isServiceCall) {
      const userClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userRes, error: userErr } = await userClient.auth.getUser();
      if (userErr || !userRes.user) return json(req, { error: 'Unauthorized' }, 401);
      if (userRes.user.id !== userId) return json(req, { error: 'Forbidden' }, 403);
    }

    // Idempotency guard.
    if (item.deep_dive_completed_at) {
      return json(req, {
        status: 'already_completed',
        completed_at: item.deep_dive_completed_at,
      });
    }

    const t0 = Date.now();
    const summary = {
      new_bills: 0,
      new_debts: 0,
      new_sources: 0,
      dormant_bills: 0,
      classified_remaining: 0,
      ran_at: new Date().toISOString(),
    };

    // ─── 1. Drain the classify queue ─────────────────────────────────
    // Loop plaid-classify-pending until remaining=0 or we hit the safety
    // cap. We pass through the original auth header (user JWT or
    // service-role) so downstream auth works the same.
    let totalClassified = 0;
    const MAX_LOOPS = 30; // 30 * 5 batches * 500 = up to 75,000 txns.
    for (let i = 0; i < MAX_LOOPS; i++) {
      const r = await invokeFn('plaid-classify-pending', authHeader, { max_batches: 5 });
      const classified = Number(r?.classified ?? 0);
      const remaining = Number(r?.remaining ?? 0);
      totalClassified += classified;
      if (classified === 0 || remaining === 0) break;
    }
    summary.classified_remaining = totalClassified;

    // ─── 2. Re-run recurring detection against the now-fuller pool ───
    await invokeFn('plaid-detect-recurring', authHeader, {
      plaid_item_row_id: item.id,
    });

    // ─── 3. Re-run credit-debt detection (Plaid liabilities) ─────────
    await invokeFn('plaid-detect-credit-debts', authHeader, {
      plaid_item_row_id: item.id,
    });

    // ─── 4. Read current state for diffing ───────────────────────────
    const [{ data: userData }, { data: streamRows }, { data: creditDebtRows }, { data: cardRows }] = await Promise.all([
      admin.from('user_data').select('bills, debts, sources').eq('id', userId).single(),
      admin.from('plaid_recurring_streams')
        .select('stream_id, direction, merchant_name, description, frequency, is_active, status, average_amount, last_amount, predicted_next_date, last_date')
        .eq('plaid_item_id', item.id),
      admin.from('plaid_credit_debts')
        .select('id, name, mask, current_balance, purchase_apr, min_payment, due_day_of_month, evidence_stream_id')
        .eq('plaid_item_id', item.id),
      admin.from('plaid_accounts')
        .select('mask, subtype')
        .eq('plaid_item_id', item.id)
        .in('subtype', ['credit card', 'line of credit']),
    ]);

    const existingBills: Bill[] = (userData?.bills as Bill[] | null) ?? [];
    const existingSources: string[] = (userData?.sources as string[] | null) ?? [];
    const existingDebts: Record<string, unknown>[] = (userData?.debts as Record<string, unknown>[] | null) ?? [];
    const streams: Stream[] = (streamRows ?? []) as Stream[];
    const creditDebts: CreditDebt[] = (creditDebtRows ?? []) as CreditDebt[];

    // Card masks on this item — used to drop credit-card payment streams
    // from the bill candidates. Same defensive filter as plaid-analyze's
    // stripCreditPaymentsFromOutflows: streams whose descriptor contains a
    // 3+-digit mask suffix are payments to the user's own card, surfaced
    // separately via plaid_credit_debts (which carries APR + min_payment).
    const cardMasks = (cardRows ?? [])
      .map((r) => r.mask)
      .filter((m): m is string => typeof m === 'string' && m.length >= 3);
    const cardMaskRegex = cardMasks.length
      ? new RegExp(`(?:^|\\D)(${cardMasks.map(escapeRegex).join('|')})(?:\\D|$)`)
      : null;
    const claimedStreamIds = new Set(
      creditDebts.map((cd) => cd.evidence_stream_id).filter((x): x is string => !!x),
    );

    // ─── 5. Diff: new bills from active outflow streams ──────────────
    const billStreamIdSet = new Set(
      existingBills.map((b) => b.evidence_stream_id).filter((x): x is string => !!x),
    );
    const billNameSet = new Set(
      existingBills.map((b) => normalizeName(b.name ?? '')),
    );

    const activeOutflows = streams.filter((s) => s.direction === 'outflow' && s.is_active);
    const newBills: Bill[] = [];
    for (const s of activeOutflows) {
      if (billStreamIdSet.has(s.stream_id)) continue;
      // Drop credit-card payment streams — surfaced through plaid_credit_debts.
      if (claimedStreamIds.has(s.stream_id)) continue;
      const baseName = (s.merchant_name || s.description || '').trim();
      if (!baseName) continue;
      if (billNameSet.has(normalizeName(baseName))) continue;
      // Defensive: any stream whose descriptor contains a card mask.
      if (cardMaskRegex) {
        const haystack = `${s.description ?? ''} ${s.merchant_name ?? ''}`;
        if (cardMaskRegex.test(haystack)) continue;
      }
      const amount = Math.abs(Number(s.average_amount ?? s.last_amount ?? 0));
      if (amount < 1) continue;
      newBills.push({
        id: `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
        name: baseName,
        amount: Math.round(amount * 100) / 100,
        due: derivDueDay(s.predicted_next_date),
        cat: 'utility',
        priority: 2,
        paid: false,
        evidence_stream_id: s.stream_id,
        pending_review: true,
        review_reason: 'new',
      });
      billStreamIdSet.add(s.stream_id);
      billNameSet.add(normalizeName(baseName));
    }
    summary.new_bills = newBills.length;

    // ─── 6. Diff: new income sources ─────────────────────────────────
    const sourceNameSet = new Set(existingSources.map((s) => normalizeName(s)));
    const activeInflows = streams.filter((s) => s.direction === 'inflow' && s.is_active);
    const newSources: string[] = [];
    for (const s of activeInflows) {
      const name = (s.merchant_name || s.description || '').trim();
      if (!name) continue;
      const key = normalizeName(name);
      if (sourceNameSet.has(key)) continue;
      // We don't have profile.business here without an LLM call, so we
      // append the rail-derived name. The user can rename in plan-review.
      // (P1 #5 work covers the onboarding-time work-vs-rail naming via
      // Sonnet; deep-dive is intentionally Haiku-only.)
      newSources.push(name);
      sourceNameSet.add(key);
    }
    summary.new_sources = newSources.length;

    // ─── 7. Diff: new credit-card debts ──────────────────────────────
    const debtNameSet = new Set(
      existingDebts.map((d) => normalizeName(String(d.name ?? ''))),
    );
    const newDebts: Record<string, unknown>[] = [];
    const newDebtBills: Bill[] = [];
    const colors = ['#e07a5f', '#c85a5a', '#d4956a', '#6b9fcf', '#9b8ec4', '#7aad8a'];
    for (const cd of creditDebts) {
      const name = (cd.name ?? '').trim();
      if (!name) continue;
      if (debtNameSet.has(normalizeName(name))) continue;
      const debtId = `d_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      newDebts.push({
        id: debtId,
        name,
        balance: cd.current_balance ?? 0,
        min: cd.min_payment ?? 0,
        rate: cd.purchase_apr != null ? cd.purchase_apr * 100 : 0,
        dueDay: cd.due_day_of_month ?? null,
        color: colors[(existingDebts.length + newDebts.length) % colors.length],
        orig: cd.current_balance ?? 0,
        pending_review: true,
        review_reason: 'new',
      });
      debtNameSet.add(normalizeName(name));

      if ((cd.min_payment ?? 0) > 0 && cd.due_day_of_month) {
        newDebtBills.push({
          id: `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
          name: `${name} (minimum)`,
          amount: cd.min_payment ?? 0,
          due: String(cd.due_day_of_month),
          cat: 'debt',
          priority: 1,
          paid: false,
          fromDebtId: debtId,
          evidence_stream_id: cd.evidence_stream_id,
          pending_review: true,
          review_reason: 'new',
        });
      }
    }
    summary.new_debts = newDebts.length;

    // ─── 8. Stale detection: flag bills whose source stream went dormant ──
    // We DO NOT remove anything. Just add review_reason:'dormant' so the
    // pending-review banner can prompt the user to keep / edit / remove.
    const streamById = new Map(streams.map((s) => [s.stream_id, s]));
    const updatedExistingBills = existingBills.map((b) => {
      // Skip bills the user has already paid this month (they're acting on
      // the bill — clearly not dormant from their POV).
      if (b.paid) return b;
      // Skip bills already flagged dormant (don't keep re-flagging).
      if (b.review_reason === 'dormant') return b;
      // Skip newly-added pending review rows from this run (just added).
      if (b.review_reason === 'new' && b.pending_review) return b;
      // Skip auto-debt-minimum bills (their "stream" is the debt, not a
      // recurring outflow on its own).
      if (b.fromDebtId) return b;

      let dormant = false;
      if (b.evidence_stream_id) {
        const s = streamById.get(b.evidence_stream_id);
        if (!s) {
          // Stream is gone entirely — Plaid retired it.
          dormant = true;
        } else if (!s.is_active || s.status === 'TOMBSTONED') {
          dormant = true;
        } else if (s.last_date && stale(s.last_date, b.amount, s.frequency)) {
          dormant = true;
        }
      }
      if (dormant) {
        summary.dormant_bills++;
        return { ...b, review_reason: 'dormant' as const, pending_review: true };
      }
      return b;
    });

    // ─── 9. Write back: append new + flag dormant. NEVER overwrite. ──
    const writeBills = [...updatedExistingBills, ...newBills, ...newDebtBills];
    const writeSources = [...existingSources, ...newSources];
    const writeDebts = [...existingDebts, ...newDebts];

    const { error: writeErr } = await admin
      .from('user_data')
      .update({
        bills: writeBills,
        sources: writeSources,
        debts: writeDebts,
      })
      .eq('id', userId);
    if (writeErr) {
      console.error(`plaid-deep-dive write failed for user ${userId}:`, writeErr);
      return json(req, { error: writeErr.message }, 500);
    }

    // ─── 10. Mark complete ───────────────────────────────────────────
    await admin
      .from('plaid_items')
      .update({
        deep_dive_completed_at: new Date().toISOString(),
        deep_dive_summary: summary,
      })
      .eq('id', item.id);

    console.log(`plaid-deep-dive: item ${item.id} done in ${Date.now() - t0}ms`, summary);
    return json(req, { status: 'completed', summary });
  } catch (err) {
    console.error('plaid-deep-dive error:', err);
    return json(req, { error: 'Internal server error' }, 500);
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────

async function invokeFn(name: string, authHeader: string, body: unknown): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        apikey: SERVICE_ROLE,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let json: unknown = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
    if (!res.ok) {
      console.warn(`invokeFn(${name}) returned ${res.status}: ${text}`);
      return null;
    }
    return json as Record<string, unknown>;
  } catch (e) {
    console.warn(`invokeFn(${name}) threw:`, e);
    return null;
  }
}

function normalizeName(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').replace(/[^a-z0-9 ]/g, '').trim();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function derivDueDay(predicted_next_date: string | null): string {
  if (!predicted_next_date) return '1';
  const d = new Date(predicted_next_date + 'T00:00:00Z');
  const day = d.getUTCDate();
  return Number.isFinite(day) && day >= 1 && day <= 31 ? String(day) : '1';
}

// last_date is older than 2× cycle length → consider dormant.
function stale(lastDate: string, _amount: number | undefined, frequency: string | null): boolean {
  const last = new Date(lastDate + 'T00:00:00Z').getTime();
  if (!Number.isFinite(last)) return false;
  const ageDays = (Date.now() - last) / 86400000;
  const cycleDays = frequency === 'WEEKLY' ? 7
    : frequency === 'BIWEEKLY' ? 14
    : frequency === 'SEMI_MONTHLY' ? 15
    : frequency === 'MONTHLY' ? 30
    : frequency === 'ANNUALLY' ? 365
    : 30;
  return ageDays > cycleDays * 2;
}

function json(req: Request, payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders(req), 'content-type': 'application/json' },
  });
}
