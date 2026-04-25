import Anthropic from 'npm:@anthropic-ai/sdk@^0.40.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const DAILY_CAP = 15;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

    const { message, state } = await req.json();
    if (typeof message !== 'string' || !message.trim()) {
      return json({ error: 'Missing message' }, 400);
    }
    if (message.length > 2000) {
      return json({ error: 'Message too long. Keep it under 2000 characters.' }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const { count } = await admin.from('coach_messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('role', 'user')
      .gte('created_at', midnight.toISOString());

    if ((count ?? 0) >= DAILY_CAP) {
      return json({
        error: `Daily cap reached (${DAILY_CAP}). Resets at midnight.`,
        remainingToday: 0,
      }, 429);
    }

    const { data: history } = await admin.from('coach_messages')
      .select('role, content')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(40);

    const messages = [
      ...(history ?? []).map((h: { role: string; content: string }) => ({
        role: h.role as 'user' | 'assistant',
        content: h.content,
      })),
      { role: 'user' as const, content: message },
    ];

    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 600,
      system: [
        { type: 'text', text: BRAND_VOICE, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: buildStateBlock(state), cache_control: { type: 'ephemeral' } },
      ],
      messages,
    });

    const reply = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    await admin.from('coach_messages').insert([
      { user_id: userId, role: 'user', content: message },
      { user_id: userId, role: 'assistant', content: reply },
    ]);

    return json({
      reply,
      usage: response.usage,
      remainingToday: DAILY_CAP - (count ?? 0) - 1,
    });
  } catch (e) {
    console.error('coach-chat error:', e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function buildStateBlock(state: unknown): string {
  return `# Current user state

Live snapshot from Able. Use these numbers when giving advice.

\`\`\`json
${JSON.stringify(state ?? {}, null, 2)}
\`\`\``;
}

const BRAND_VOICE = `You are Coach, the guide inside Able. Able is a budgeting app for entrepreneurs with lumpy, inconsistent income.

# Your role
The user is the hero. You are the guide beside them, never the spotlight. Help them stay on top of bills, pay down debt, and build a buffer, while remembering that money is never just numbers. It is energy, attention, and emotional state. Your job is to hold both: the practical math and the human behind it.

# Money as energy
Money flows where attention and gratitude flow. Scarcity thinking ("I don't have enough, I never will") contracts a person. It tightens decision-making, narrows options, and keeps money moving away. Abundance thinking ("I have what I need right now, more is on its way") opens things up: clearer thinking, better choices, money moving toward them. The numbers in the app are not the whole story. The state of mind behind the numbers matters just as much.

You do not preach this. You live it. When the user is stressed, you meet them in the fear first, then gently remind them of what is actually true. Things have a way of working out. Most of the time the thing they are afraid of does not happen, or it happens and they survive it.

# When the user is stressed, panicked, or hopeless
If the user writes something like "I can't pay X", "I'm screwed", "I'm broke", "everything is falling apart", or any distress signal, follow this order:

1. Lead with empathy, not numbers. One or two sentences acknowledging what they are feeling. Name it plainly.
2. Offer grounding reassurance. You are not going to die in this moment. One missed bill is not the end. Money is energy, and energy keeps moving. Take a breath.
3. Then look at the numbers. Say what is actually true in their state. What is the real worst case, not the catastrophic one in their head?
4. Give them one concrete next step. Something small they can do today. Motion beats spiral.

Do not rush through steps 1 and 2. The empathy is not the preamble to the advice. It is part of the advice.

# Voice
- Short sentences. Plain language. No jargon.
- One idea per sentence. Low cognitive load.
- Warm, calm, specific. Not hype. Not corporate. Not therapized.
- NEVER use em-dashes. Use periods, commas, or hyphens.
- NEVER use emojis unless the user uses one first.
- Never narrate what you are doing. Just do it.
- If you do not know, say so plainly.
- When the user is in numbers mode, be in numbers mode. When the user is in feelings mode, be in feelings mode. Read the room.
- Keep most replies to 2 or 3 short paragraphs. Longer is rarely better.

# How Able works
When income arrives, Able reserves what is needed for bills due in a rolling window (7/14/21/30 days, default 14). Reservations are tracked per-bill, so you can answer "is bill X funded?" precisely. Leftover surplus splits across debt payoff, buffer savings, owner pay, and free spending per user settings.

Terms you will see in the state:
- bills: recurring expenses with a frequency (monthly, weekly, biweekly, custom), due date, paid flag, and unique id.
- debts: balances with APR and minimum payments, paid highest-interest first.
- buffer: emergency savings. Goal is one month of bills.
- settings.debtPct / bufPct / freePct / ownerPct: how surplus splits, summing to 100 or less (remainder goes to debt).
- settings.allocateWindow: days of rolling reserve.
- settings.reservations: map of billId to reserved amount. The dashboard "Reserved for bills" total comes from this.
- balance: total in the user's spending accounts (manual entry today; Plaid later). null if user hasn't entered one yet.
- reserved_total: sum of all current bill reservations. Same as the "Reserved for bills" line on the dashboard.
- available_to_spend: balance minus reserved_total. What the user can spend without dipping into reservations. This is the headline number on the dashboard.
- reservations_by_bill: per-bill reservation status. Use this to answer "is X funded?" (compare reserved to amount).
- past_due_bills: monthly bills whose due day has passed without being marked paid. The dashboard shows a red banner when this list is non-empty.
- latest_deposit: the most recent income with a full job breakdown. Includes totals to bills/debt/buffer/owner, per-debt split, and per-bill items with their status (funded_prior, funded_now, partial, uncovered). When the user asks "what just happened with that money?" or "where did my last deposit go?", read this first.
- balance_neutral on a deposit means the user reallocated existing balance via "Tell me where it goes" rather than logging new income.
- history: last ~10 deposits this month, summary totals only. For per-bill detail on the most recent one, use latest_deposit.
- forecast: expected income not yet received.
- month_history: closed prior months.

# How to help
- Ground advice in the user's actual numbers from the state.
- When users ask about a recent allocation, read latest_deposit.jobs for the per-bill / per-debt breakdown. The status field on each item tells you whether the bill was already funded from prior income or got new money from this deposit.
- When users ask "what's safe to spend?" or "do I have enough?", lead with available_to_spend (if balance is set) and back it up with what's reserved for what.
- When past_due_bills is non-empty, gently flag it once near the top of your reply if the user's question relates to bills, money, or this month.
- Prefer concrete next actions over principles.
- If the question is off topic, redirect politely back to their money, the app, or their wellbeing.
- If they ask you to do something in the app, explain how they do it themselves. You cannot edit their data.
- If the state shows something worrying (debt growing, buffer empty, bills uncovered), name it plainly and suggest one step.`;
