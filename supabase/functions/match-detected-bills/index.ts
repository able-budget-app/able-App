// match-detected-bills — semantic dedupe for the Bills-tab review banner.
//
// The client-side fuzzy match is substring-only and misses cases like
// "Northwestern Mutual" ↔ "Life insurance" or "Google One" ↔ "Google storage".
// This function takes the user's existing bills + the un-matched Plaid
// recurring streams, and asks Claude Haiku 4.5 which streams are
// semantically the same recurring obligation as which bills.
//
// Returns just the matches; the client uses them to filter the review list
// (and could later use them to attach stream_ids to bills for Light matching).
//
// Gateway: "Verify JWT" must be OFF — we verify the JWT in code via
// auth.getUser(). Without this check, the endpoint is open to the public
// internet and anyone can drain Anthropic credits by spamming POSTs.

import Anthropic from 'npm:@anthropic-ai/sdk@^0.40.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
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
const MAX_BILLS = 60;
const MAX_STREAMS = 60;

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

type BillInput = {
  id: string;
  name: string;
  amount: number;
  cat?: string;
  freq?: string;
};
type StreamInput = {
  stream_id: string;
  merchant_name?: string | null;
  description?: string | null;
  amount: number;
  frequency?: string | null;
  category?: string | null;
};
type Match = { stream_id: string; bill_id: string };

// Per-user in-memory rate limit. Each Anthropic call costs real money, and a
// normal user opens the Bills tab maybe 5-10 times a day. 30/day is generous
// for users + tight enough that a dev-console spam loop hits the cap quickly.
// Per-isolate (resets on cold start) — not bulletproof against sustained
// attack but enough to keep the spend bounded for a 20-50-user launch.
const HOURLY_CAP = 15;
const DAILY_CAP = 30;
const _callLog = new Map<string, number[]>(); // userId -> array of call timestamps (ms)
function _checkRateLimit(userId: string): { ok: true } | { ok: false; reason: string } {
  const now = Date.now();
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;
  const log = (_callLog.get(userId) || []).filter((t) => now - t < day);
  if (log.filter((t) => now - t < hour).length >= HOURLY_CAP) {
    return { ok: false, reason: `Hourly cap reached (${HOURLY_CAP}). Try again later.` };
  }
  if (log.length >= DAILY_CAP) {
    return { ok: false, reason: `Daily cap reached (${DAILY_CAP}). Resets in a few hours.` };
  }
  log.push(now);
  _callLog.set(userId, log);
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'POST only' }, 405);

  try {
    // Verify caller. Function calls Anthropic on every invocation, so an
    // unauthenticated endpoint is a credit-drain vector.
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes.user) return json(req, { error: 'Unauthorized' }, 401);

    const limit = _checkRateLimit(userRes.user.id);
    if (!limit.ok) return json(req, { error: limit.reason }, 429);

    const body = await req.json();
    const bills: BillInput[] = Array.isArray(body?.bills) ? body.bills : [];
    const streams: StreamInput[] = Array.isArray(body?.streams) ? body.streams : [];

    if (streams.length === 0) return json(req, { matches: [] });
    if (bills.length === 0) return json(req, { matches: [] });
    if (bills.length > MAX_BILLS || streams.length > MAX_STREAMS) {
      return json(req, { error: `Too many items (max ${MAX_BILLS} bills, ${MAX_STREAMS} streams)` }, 400);
    }

    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 2000,
      system: [
        { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
      ],
      messages: [
        { role: 'user', content: buildUserMessage(bills, streams) },
      ],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    console.log(
      `match-detected-bills: bills=${bills.length}, streams=${streams.length}, ` +
      `response_text_len=${text.length}, stop=${response.stop_reason}, model=${response.model}`,
    );

    const matches = parseMatches(text, bills, streams);
    return json(req, { matches, usage: response.usage });
  } catch (e) {
    console.error('match-detected-bills error:', e);
    return json(req, { error: 'Internal server error' }, 500);
  }
});

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  });
}

function buildUserMessage(bills: BillInput[], streams: StreamInput[]): string {
  const billsTrim = bills.map((b) => ({
    id: b.id,
    name: b.name,
    amount: b.amount,
    cat: b.cat ?? null,
    freq: b.freq ?? null,
  }));
  const streamsTrim = streams.map((s) => ({
    stream_id: s.stream_id,
    merchant_name: s.merchant_name ?? null,
    description: s.description ?? null,
    amount: s.amount,
    frequency: s.frequency ?? null,
    category: s.category ?? null,
  }));
  return `User's existing bills:\n${JSON.stringify(billsTrim, null, 2)}\n\nDetected recurring streams (not yet matched):\n${JSON.stringify(streamsTrim, null, 2)}`;
}

function parseMatches(text: string, bills: BillInput[], streams: StreamInput[]): Match[] {
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const objStart = stripped.indexOf('{');
  const objEnd = stripped.lastIndexOf('}');
  if (objStart === -1 || objEnd === -1 || objEnd <= objStart) {
    console.error('match-detected-bills: no JSON object found. raw:', text.slice(0, 800));
    return [];
  }
  let parsed: { matches?: unknown } = {};
  try { parsed = JSON.parse(stripped.slice(objStart, objEnd + 1)); }
  catch { return []; }
  if (!Array.isArray(parsed.matches)) return [];
  const billIds = new Set(bills.map((b) => b.id));
  const streamIds = new Set(streams.map((s) => s.stream_id));
  return parsed.matches
    .filter((m: unknown): m is Match =>
      !!m && typeof (m as Match).stream_id === 'string' && typeof (m as Match).bill_id === 'string'
      && streamIds.has((m as Match).stream_id) && billIds.has((m as Match).bill_id),
    );
}

const SYSTEM_PROMPT = `You match recurring bank-transaction streams to a user's existing bills for Able, a budgeting app.

Your job: for each stream, decide if it represents the SAME recurring obligation as one of the user's existing bills. A match means the user is already tracking this charge under a bill — even if the names are different.

Common patterns to recognize:
- Brand name on the stream, generic name on the bill: "Northwestern Mutual" ↔ "Life insurance", "Geico" ↔ "Auto insurance", "ConEd" ↔ "Electric bill", "Verizon Wireless" ↔ "Phone".
- Product variant on the stream, simpler bill name: "Google One" ↔ "Google storage", "iCloud+" ↔ "Apple storage", "Disney Plus" ↔ "Disney+".
- Same brand but different naming: "Netflix.com" ↔ "Netflix", "Spotify USA" ↔ "Spotify".
- Different formatting: "VERIZON WIRELESS PMT" ↔ "Verizon".

Use amount + cadence as supporting signal: if a stream and bill have very similar amounts (within ~10%) and the same cadence, that strengthens a semantic match. If amounts diverge wildly, lower your confidence.

Be conservative. When in doubt, do NOT match. It's better to leave a stream un-matched (the user will see it in the review list and can decide) than to incorrectly hide it because you forced a match. If a stream's merchant could plausibly be more than one of the user's bills, return no match for it.

Each stream can match at most ONE bill. Each bill can match at most ONE stream — if multiple streams plausibly match the same bill, pick the closest by amount + cadence and leave the others unmatched.

# Output

Return ONLY a JSON object of this exact shape. No prose. No markdown fences.

{
  "matches": [
    { "stream_id": "<copy from input>", "bill_id": "<copy from input>" }
  ]
}

Streams not in "matches" are unmatched. If you find no matches at all, return { "matches": [] }.`;
