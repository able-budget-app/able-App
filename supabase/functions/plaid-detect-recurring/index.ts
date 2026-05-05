// plaid-detect-recurring
// Drop-in replacement for plaid-recurring-refresh. Instead of calling
// Plaid's /transactions/recurring/get (which returns PRODUCT_NOT_READY
// for hours after a fresh connect), we group classified plaid_transactions
// rows ourselves and infer cadence. Writes the same plaid_recurring_streams
// table — analyzer + Activity scan + detected-bills banner all keep
// working unchanged.
//
// POST body:
//   { plaid_item_row_id: string }
//
// Returns: { inflow_count, outflow_count, last_refreshed_at, debug? }
//
// Algorithm:
//   1. Pull last 90 days of classified transactions for this item where
//      able_category in ('bill', 'debt_payment', 'income').
//   2. Group by (normalized_merchant_name, direction).
//   3. For each group with >=2 occurrences, compute the dominant interval
//      band. >=70% of intervals must fall in the band.
//   4. Compute average/last amounts, predicted next date, status.
//   5. Upsert into plaid_recurring_streams with a deterministic stream_id.
//   6. Tombstone previously-active streams that no longer detect.
//
// Stream_id is a hash of (plaid_item_id|merchant_key|direction) so that
// re-runs are idempotent — the unique (plaid_item_id, stream_id) constraint
// upserts the same row each time.
//
// Gateway: "Verify JWT" must be OFF. Two callers — the user (Authorization
// bearer in their session) or service-role internal.

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Detection knobs — kept as constants so they're easy to find + tune.
const LOOKBACK_DAYS = 90;
const MIN_DOMINANT_INTERVAL_RATIO = 0.6;
const AMOUNT_VARIANCE_TOLERANCE = 0.3; // ±30%
// Per-cadence minimum occurrences. Two visits to the same merchant 14
// days apart used to qualify as BIWEEKLY (e.g. "127 Saloon $7 BIWEEKLY"
// for a person who happened to grab a beer there twice in a month). Real
// recurring patterns prove themselves over more cycles. Annual subs by
// definition only fire once a year so we keep that bar at 2.
const MIN_OCCURRENCES_BY_BAND: Record<'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'ANNUALLY', number> = {
  WEEKLY: 6,    // ~6 weeks of consistent activity
  BIWEEKLY: 4,  // ~8 weeks
  MONTHLY: 3,   // 3 months
  ANNUALLY: 2,  // a true annual sub seen twice = legit
};
// Pre-band gate: every stream needs ≥2 occurrences to compute intervals
// at all. Cadence-specific minimums apply after the median lands a band.
const MIN_OCCURRENCES = 2;
// Cadence bands tuned for real bank-feed noise: widened MONTHLY to 26-34
// days (mortgage statements drift across month-length boundaries, esp.
// Feb→Mar; mid-month → end-of-month → mid-month produces 30-33d gaps).
// Dropped SEMI_MONTHLY entirely — it overlapped BIWEEKLY and rare for
// bills (twice-a-month rent splits would be biweekly close enough).
const CADENCE_BANDS: Array<{ name: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'ANNUALLY'; min: number; max: number }> = [
  { name: 'WEEKLY',       min: 5,   max: 9   },
  { name: 'BIWEEKLY',     min: 12,  max: 16  },
  { name: 'MONTHLY',      min: 26,  max: 34  },
  { name: 'ANNUALLY',     min: 350, max: 380 },
];

type Body = { plaid_item_row_id: string; debug?: boolean };

type TxnRow = {
  id: string;
  plaid_transaction_id: string;
  plaid_account_id: string;
  name: string | null;
  merchant_name: string | null;
  amount: number;
  date: string; // 'YYYY-MM-DD'
  iso_currency_code: string | null;
  personal_finance_category_primary: string | null;
  personal_finance_category_detailed: string | null;
  able_category: string | null;
  able_label: string | null;
};

type Group = {
  merchant_key: string;
  display_name: string;
  direction: 'inflow' | 'outflow';
  txns: TxnRow[];
};

type DetectedStream = {
  stream_id: string;
  direction: 'inflow' | 'outflow';
  merchant_name: string | null;
  description: string | null;
  personal_finance_category_detailed: string | null;
  frequency: 'WEEKLY' | 'BIWEEKLY' | 'SEMI_MONTHLY' | 'MONTHLY' | 'ANNUALLY' | 'UNKNOWN';
  status: 'MATURE' | 'EARLY_DETECTION';
  is_active: boolean;
  average_amount: number;
  last_amount: number;
  iso_currency_code: string;
  predicted_next_date: string | null;
  first_date: string;
  last_date: string;
  transaction_ids: string[];
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  try {
    const body: Body = await req.json();
    if (!body?.plaid_item_row_id) {
      return json({ error: 'plaid_item_row_id required' }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: item, error: itemErr } = await admin
      .from('plaid_items')
      .select('id, user_id')
      .eq('id', body.plaid_item_row_id)
      .single();
    if (itemErr || !item) return json({ error: 'Item not found' }, 404);
    const userId = item.user_id as string;
    const itemId = item.id as string;

    const { data: accounts, error: accErr } = await admin
      .from('plaid_accounts')
      .select('id')
      .eq('plaid_item_id', itemId);
    if (accErr) return json({ error: accErr.message }, 500);
    const accountIds = (accounts ?? []).map((a) => a.id as string);
    if (accountIds.length === 0) {
      return json({ inflow_count: 0, outflow_count: 0, last_refreshed_at: new Date().toISOString() });
    }

    const since = new Date();
    since.setUTCDate(since.getUTCDate() - LOOKBACK_DAYS);
    const sinceIso = since.toISOString().slice(0, 10);

    // Pull every classified transaction in the lookback window. We do NOT
    // filter by able_category — the classifier marks borderline monthly
    // subscriptions (Disney+, Cloudflare, etc.) as `discretionary` per its
    // conservative defaults, and pre-filtering would hide legitimate
    // recurring patterns. Recurring detection is orthogonal to category;
    // the analyzer downstream decides what to do with each stream.
    const { data: txns, error: txnErr } = await admin
      .from('plaid_transactions')
      .select(
        'id, plaid_transaction_id, plaid_account_id, name, merchant_name, amount, date, iso_currency_code, personal_finance_category_primary, personal_finance_category_detailed, able_category, able_label',
      )
      .in('plaid_account_id', accountIds)
      .gte('date', sinceIso)
      .not('able_category', 'is', null);
    if (txnErr) return json({ error: txnErr.message }, 500);

    const rows = (txns ?? []) as TxnRow[];
    if (rows.length === 0) {
      // Nothing classified yet (or no recurring categories present). Still
      // tombstone any stale streams so the table reflects current state.
      await tombstoneStaleStreams(admin, itemId, new Set<string>());
      return json({ inflow_count: 0, outflow_count: 0, last_refreshed_at: new Date().toISOString() });
    }

    const groups = groupTransactions(rows);
    const detected: DetectedStream[] = [];
    const debugRejected: { merchant: string; reason: string }[] = [];

    for (const g of groups) {
      const result = detectStream(g, itemId);
      if (result.stream) detected.push(result.stream);
      else if (body.debug) debugRejected.push({ merchant: g.display_name, reason: result.reason });
    }

    const detectedIds = new Set(detected.map((s) => s.stream_id));

    // Upsert detected streams. The (plaid_item_id, stream_id) unique
    // constraint makes this idempotent across re-runs.
    if (detected.length > 0) {
      const now = new Date().toISOString();
      const rowsToUpsert = detected.map((s) => ({
        user_id: userId,
        plaid_item_id: itemId,
        stream_id: s.stream_id,
        direction: s.direction,
        merchant_name: s.merchant_name,
        description: s.description,
        personal_finance_category_detailed: s.personal_finance_category_detailed,
        frequency: s.frequency,
        status: s.status,
        is_active: s.is_active,
        is_user_modified: false,
        average_amount: s.average_amount,
        last_amount: s.last_amount,
        iso_currency_code: s.iso_currency_code,
        predicted_next_date: s.predicted_next_date,
        first_date: s.first_date,
        last_date: s.last_date,
        transaction_ids: s.transaction_ids,
        last_refreshed_at: now,
        updated_at: now,
      }));
      const { error: upErr } = await admin
        .from('plaid_recurring_streams')
        .upsert(rowsToUpsert, { onConflict: 'plaid_item_id,stream_id' });
      if (upErr) {
        console.error('upsert failed:', upErr);
        return json({ error: upErr.message }, 500);
      }
    }

    // Tombstone any previously-active streams we didn't detect this run.
    await tombstoneStaleStreams(admin, itemId, detectedIds);

    // Touch the item's recurring-refresh timestamp for parity with the
    // legacy function — downstream code keys off this for "data freshness."
    await admin
      .from('plaid_items')
      .update({ last_recurring_refresh_at: new Date().toISOString() })
      .eq('id', itemId);

    const inflow_count = detected.filter((s) => s.direction === 'inflow').length;
    const outflow_count = detected.filter((s) => s.direction === 'outflow').length;

    console.log(
      `plaid-detect-recurring: item=${itemId} txns=${rows.length} groups=${groups.length} detected=${detected.length} (inflow=${inflow_count}, outflow=${outflow_count})`,
    );

    return json({
      inflow_count,
      outflow_count,
      last_refreshed_at: new Date().toISOString(),
      ...(body.debug ? { debug: { groups: groups.length, detected: detected.length, rejected: debugRejected } } : {}),
    });
  } catch (e) {
    console.error('plaid-detect-recurring error:', e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Same normalization rule used by the classifier, plus extra stripping
// for noise that shows up in real bank-feed merchant_name fields.
// Critical: Plaid sometimes appends the transaction date and posting
// suffixes to the merchant string, e.g.
//   "USAA INSURANCE PAYMEN WWW.USAA.COM TX 02/27"
//   "Payment to Chase card ending in 0714 04/23"
//   "ORIG CO NAME:STRIPE ORIG ID:... TRACE#:..." (full ACH descriptor)
// Without stripping these, every monthly occurrence becomes its own
// group with 1 transaction → never recurring.
function normalizeMerchantText(s: string | null): string {
  if (!s) return '';
  let out = s.toLowerCase();

  // ACH descriptor metadata: strip "KEY:VALUE" pairs where the value is
  // an opaque ID, trace number, or user's own name. The "orig co name:"
  // pair is special — the value IS the merchant brand, so we strip just
  // the key. Order matters: handle the keep-value case first so the
  // generic strip-key-and-value pass below doesn't eat it.
  out = out.replace(/\borig\s*co\s*name\s*[:#]\s*/g, ' ');
  // Strip key + value for opaque metadata fields.
  out = out.replace(
    /\b(orig\s*id|trace#?|ind\s*id|ind\s*name|co\s*entry\s*descr|sec|trn|eed|desc\s*date)\s*[:#]?\s*\S*/g,
    ' ',
  );

  out = out
    // dates: 02/27, 04/03/24, 4-23, 12-31-25
    .replace(/\b\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?\b/g, ' ')
    // long URLs / domains
    .replace(/\bwww\.[\w\-]+\.[a-z]{2,}\b/g, ' ')
    // phone numbers: +18005318722, 800-531-8722, (800) 531-8722
    .replace(/\+?\d{1,3}[-\s]?\(?\d{3}\)?[-\s]?\d{3}[-\s]?\d{4}/g, ' ')
    .replace(/\+\d{10,}/g, ' ')
    // POS prefix variants — payment-rail descriptors that prefix some
    // merchants but not others (POS DEBIT USAA vs USAA INSURANCE).
    // Strip them so the same vendor groups together.
    .replace(/\b(pos\s*debit|pos\s*credit|debit\s*card\s*purchase|recurring\s*card\s*purchase|electronic\s*payment|electronic\s*deposit)\b/g, ' ')
    // 4+ digit numeric runs (card-ending numbers, transaction IDs)
    .replace(/\b\d{4,}\b/g, ' ')
    // 2-3 letter US state codes when they appear as standalone words
    .replace(/\s+\b(tx|ca|ny|fl|wa|or|id|ut|az|nv|nm|co)\b(?=\s|$)/gi, ' ')
    .replace(/[.,]/g, ' ')
    .replace(/\b(inc|llc|ltd|corp|corporation|co)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Dedupe consecutive identical tokens, e.g. "seospace co seospace co"
  // (after .co domain stripping happens to repeat) → "seospace co".
  // Plaid sometimes mirrors the merchant in name + description fields and
  // both get concatenated upstream.
  const tokens = out.split(' ');
  const deduped: string[] = [];
  for (const tok of tokens) {
    if (deduped[deduped.length - 1] !== tok) deduped.push(tok);
  }
  return deduped.join(' ');
}

function groupTransactions(rows: TxnRow[]): Group[] {
  const map = new Map<string, Group>();
  for (const row of rows) {
    const merchant = normalizeMerchantText(row.merchant_name) || normalizeMerchantText(row.name);
    if (!merchant) continue;
    const direction: 'inflow' | 'outflow' = (row.amount ?? 0) < 0 ? 'inflow' : 'outflow';
    const key = `${merchant}|${direction}`;
    const existing = map.get(key);
    if (existing) {
      existing.txns.push(row);
    } else {
      map.set(key, {
        merchant_key: merchant,
        display_name: row.merchant_name ?? row.name ?? merchant,
        direction,
        txns: [row],
      });
    }
  }
  return Array.from(map.values());
}

function detectStream(group: Group, itemId: string): { stream: DetectedStream | null; reason: string } {
  // Collapse near-duplicate transactions into a single occurrence. Plaid
  // often splits a multi-line statement into N transactions across 1-3
  // consecutive days (utility bill with separate line items posting a
  // day apart; AWS sub-services). Anchor each cluster to its FIRST date
  // so a long string of 1-3-day-apart transactions doesn't snowball into
  // one giant cluster — May 1/3/6/8 must split into "May 1-3" + "May 6-8"
  // (or whatever the natural billing-period boundary is).
  const COLLAPSE_WINDOW_DAYS = 3;
  const sortedTxns = group.txns.slice().sort((a, b) => a.date.localeCompare(b.date));
  const occurrences: Array<{ firstDate: string; date: string; amount: number; ids: string[]; row: TxnRow }> = [];
  for (const t of sortedTxns) {
    const last = occurrences[occurrences.length - 1];
    if (last && daysBetween(last.firstDate, t.date) <= COLLAPSE_WINDOW_DAYS) {
      last.amount += Math.abs(t.amount ?? 0);
      last.ids.push(t.plaid_transaction_id);
      last.date = t.date; // last date within the cluster, used for predicting next
    } else {
      occurrences.push({
        firstDate: t.date,
        date: t.date,
        amount: Math.abs(t.amount ?? 0),
        ids: [t.plaid_transaction_id],
        row: t,
      });
    }
  }

  if (occurrences.length < MIN_OCCURRENCES) {
    return { stream: null, reason: `only ${occurrences.length} unique-date occurrence(s)` };
  }

  // Compute intervals (days between consecutive unique dates).
  const intervals: number[] = [];
  for (let i = 1; i < occurrences.length; i++) {
    intervals.push(daysBetween(occurrences[i - 1].date, occurrences[i].date));
  }

  // Pick the cadence band that contains the MEDIAN interval. Median is
  // outlier-resistant — one weird gap (statement closing late, holiday
  // shift) won't push us out of the right band. Then sanity-check that
  // a sufficient fraction of intervals are near the median, so we don't
  // accept truly variable patterns.
  const sortedIntervals = intervals.slice().sort((a, b) => a - b);
  const median = sortedIntervals[Math.floor(sortedIntervals.length / 2)];
  const bestBand = CADENCE_BANDS.find((b) => median >= b.min && median <= b.max) ?? null;

  if (!bestBand) {
    return { stream: null, reason: `median interval ${median}d outside all cadence bands` };
  }

  // Per-cadence occurrence floor. WEEKLY needs ~6 cycles, BIWEEKLY 4,
  // MONTHLY 3, ANNUALLY 2. Catches noise like "two restaurant visits
  // 14 days apart" being labelled BIWEEKLY recurring.
  const minForBand = MIN_OCCURRENCES_BY_BAND[bestBand.name];
  if (occurrences.length < minForBand) {
    return { stream: null, reason: `${bestBand.name} needs ≥${minForBand} occurrences, got ${occurrences.length}` };
  }

  // Sanity: at least MIN_DOMINANT_INTERVAL_RATIO of intervals must fall
  // within ±50% of the median. Catches cases where the median is in a
  // band but the surrounding intervals are wildly variable (e.g. user-
  // driven credit card payments that happen to median around 14 days
  // but really range from 3 to 30 days).
  const inRange = intervals.filter((d) => Math.abs(d - median) / Math.max(median, 1) <= 0.5).length;
  const ratio = inRange / intervals.length;
  if (ratio < MIN_DOMINANT_INTERVAL_RATIO) {
    return { stream: null, reason: `intervals too variable around median ${median}d (in-range ratio=${ratio.toFixed(2)})` };
  }

  // Amount sanity check using median + in-range share. The previous
  // mean+max-drift approach rejected things like OpenAI ($20 monthly
  // ChatGPT) when small one-off API charges ($0.97, $5.01) showed up
  // in the same month — a single tiny outlier swung max drift over the
  // limit. Median ignores outliers; we then ask "what fraction of
  // amounts are within ±50% of the median?" and require ≥ 60%. Catches
  // genuine variable-amount merchants (Walmart) while accepting fixed-
  // amount subscriptions with occasional usage spikes.
  const amounts = occurrences.map((o) => o.amount);
  const sortedAmounts = amounts.slice().sort((a, b) => a - b);
  const medianAmount = sortedAmounts[Math.floor(sortedAmounts.length / 2)];
  const amountInRange = amounts.filter((a) =>
    Math.abs(a - medianAmount) / Math.max(medianAmount, 0.01) <= 0.5,
  ).length;
  const amountInRangeRatio = amountInRange / amounts.length;
  if (amountInRangeRatio < 0.6) {
    return { stream: null, reason: `amounts too variable around median ${medianAmount.toFixed(2)} (in-range ratio=${amountInRangeRatio.toFixed(2)})` };
  }

  const lastOcc = occurrences[occurrences.length - 1];
  const firstOcc = occurrences[0];
  const lastAmount = lastOcc.amount;
  // Use median as the "typical" amount — robust to one-off API usage
  // spikes or refunds without dragging the headline number around.
  const avgAmount = medianAmount;
  const predictedNextDate = predictNextDate(lastOcc.date, bestBand.name);

  // Status: MATURE if 3+ unique-date occurrences, EARLY_DETECTION if 2.
  const status: 'MATURE' | 'EARLY_DETECTION' = occurrences.length >= 3 ? 'MATURE' : 'EARLY_DETECTION';

  // Prefer the most-recent merchant_name + description so the user sees
  // the latest version (some merchants change their statement names).
  const lastTxnRow = lastOcc.row;
  const reversed = occurrences.slice().reverse();
  const lastWithMerchant = reversed.find((o) => o.row.merchant_name);
  const lastWithName = reversed.find((o) => o.row.name);

  const stream: DetectedStream = {
    stream_id: makeStreamId(itemId, group.merchant_key, group.direction),
    direction: group.direction,
    merchant_name: lastWithMerchant?.row.merchant_name ?? null,
    description: lastWithName?.row.name ?? null,
    personal_finance_category_detailed: lastTxnRow.personal_finance_category_detailed,
    frequency: bestBand.name,
    status,
    is_active: true,
    average_amount: round2(avgAmount),
    last_amount: round2(lastAmount),
    iso_currency_code: lastTxnRow.iso_currency_code ?? 'USD',
    predicted_next_date: predictedNextDate,
    first_date: firstOcc.date,
    last_date: lastOcc.date,
    transaction_ids: occurrences.flatMap((o) => o.ids),
  };

  return { stream, reason: 'detected' };
}

function daysBetween(a: string, b: string): number {
  const ad = new Date(a + 'T00:00:00Z').getTime();
  const bd = new Date(b + 'T00:00:00Z').getTime();
  return Math.round((bd - ad) / 86400000);
}

function predictNextDate(lastDate: string, freq: DetectedStream['frequency']): string | null {
  const d = new Date(lastDate + 'T00:00:00Z');
  let days = 0;
  switch (freq) {
    case 'WEEKLY':       days = 7;   break;
    case 'BIWEEKLY':     days = 14;  break;
    case 'SEMI_MONTHLY': days = 15;  break;
    case 'MONTHLY':      days = 30;  break;
    case 'ANNUALLY':     days = 365; break;
    default:             return null;
  }
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Deterministic stream_id from (plaid_item_id, merchant_key, direction).
// Use a simple FNV-1a hash so re-runs upsert the same row via the unique
// constraint. SHA wasn't worth pulling a crypto import for this.
function makeStreamId(itemId: string, merchant: string, direction: 'inflow' | 'outflow'): string {
  const input = `${itemId}|${merchant}|${direction}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return `local_${h.toString(16).padStart(8, '0')}_${input.length.toString(36)}`;
}

// deno-lint-ignore no-explicit-any
async function tombstoneStaleStreams(admin: any, itemId: string, detectedIds: Set<string>): Promise<void> {
  const { data: existing, error } = await admin
    .from('plaid_recurring_streams')
    .select('stream_id, is_active, status')
    .eq('plaid_item_id', itemId);
  if (error) {
    console.error('tombstone read failed:', error);
    return;
  }
  // deno-lint-ignore no-explicit-any
  const stale = ((existing ?? []) as any[]).filter((r) =>
    r.is_active !== false && r.status !== 'TOMBSTONED' && !detectedIds.has(r.stream_id as string),
  );
  if (stale.length === 0) return;
  const now = new Date().toISOString();
  const { error: tErr } = await admin
    .from('plaid_recurring_streams')
    .update({ is_active: false, status: 'TOMBSTONED', last_refreshed_at: now, updated_at: now })
    .eq('plaid_item_id', itemId)
    .in('stream_id', stale.map((s) => s.stream_id));
  if (tErr) console.error('tombstone update failed:', tErr);
}
