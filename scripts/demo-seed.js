/* eslint-disable */
// ════════════════════════════════════════════════════════════════════════
// Able demo seed
// ────────────────────────────────────────────────────────────────────────
// Loaded by app.html only when the URL contains ?demo=1 (or sessionStorage
// has able_demo='1'). It hijacks Supabase before the app initializes, then
// lets the app's normal auth/load flow run against a stubbed client that
// serves the "Alex" persona. Nothing is written to the real database.
//
// Exit demo mode: window.exitAbleDemo()  (or remove ?demo=1 from the URL).
// Reset the demo: window.resetAbleDemo() (just reloads the page).
// ════════════════════════════════════════════════════════════════════════
(function () {
  var params = new URLSearchParams(location.search);
  var ENABLED = params.get('demo') === '1' || sessionStorage.getItem('able_demo') === '1';
  if (!ENABLED) return;
  sessionStorage.setItem('able_demo', '1');

  console.log('%c[Able demo] Demo mode active. No data will be written to Supabase.',
    'background:#1f3a2b;color:#b8e0c8;padding:4px 8px;border-radius:4px;font-weight:700;');

  // ── 0. Suppress the flash of auth/paywall/onboard before the auth flow
  //       finishes. App.html's load handler shows a "Loading your account"
  //       card during the auth flow; we let that show because it briefly
  //       sets the right tone for the recording.
  document.documentElement.setAttribute('data-able-demo', '1');
  var demoStyle = document.createElement('style');
  demoStyle.textContent =
    'html[data-able-demo="1"] #auth-screen,' +
    'html[data-able-demo="1"] #paywall-screen,' +
    'html[data-able-demo="1"] #onboard-screen' +
    '{display:none !important;}';
  (document.head || document.documentElement).appendChild(demoStyle);

  // ── 1. Persona ───────────────────────────────────────────────────────
  var DEMO_USER = {
    id: 'demo-alex-0000-0000-0000-000000000001',
    email: 'alex@demo.able',
    created_at: new Date(Date.now() - 95 * 86400000).toISOString(),
    app_metadata: { provider: 'email' },
    user_metadata: {},
    aud: 'authenticated',
    role: 'authenticated',
  };

  function dayOfMonthInNDays(n) {
    var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n);
    return d.getDate();
  }
  function daysAgoTs(n) { return Date.now() - n * 86400000; }
  function daysAgoDate(n) { return new Date(daysAgoTs(n)).toLocaleDateString(); }

  var DEMO_BILLS = [
    { name: 'Rent',             amount: 1400, freq: 'monthly', due: String(dayOfMonthInNDays(6)),  cat: 'housing',   priority: 1, paid: false },
    { name: 'Phone',            amount: 85,   freq: 'monthly', due: String(dayOfMonthInNDays(4)),  cat: 'utilities', priority: 2, paid: false },
    { name: 'Internet',         amount: 90,   freq: 'monthly', due: String(dayOfMonthInNDays(11)), cat: 'utilities', priority: 2, paid: false },
    { name: 'Health insurance', amount: 340,  freq: 'monthly', due: String(dayOfMonthInNDays(9)),  cat: 'insurance', priority: 1, paid: false },
    { name: 'Software (Adobe + Figma + Notion)', amount: 120, freq: 'monthly', due: 'ongoing', cat: 'subs', priority: 3, paid: false },
  ];

  var CC_DEBT_ID = 'd_demo_cc_chase_0001';
  var DEMO_DEBTS = [
    { id: CC_DEBT_ID, name: 'Chase Sapphire CC', balance: 4200, min: 125, rate: 22, dueDay: 18, color: '#e07a5f', orig: 5463 },
  ];
  // Linked minimum-payment bill (matches what addDebt() would auto-create).
  DEMO_BILLS.push({
    name: 'Chase Sapphire CC (minimum)', amount: 125, freq: 'monthly', due: '18',
    cat: 'debt', priority: 1, paid: false, fromDebtId: CC_DEBT_ID,
  });

  function makeHistoryEntry(amount, source, daysAgo, splits) {
    return {
      id: 'h_demo_' + daysAgo + '_' + Math.random().toString(36).slice(2, 6),
      amount: amount, source: source,
      date: daysAgoDate(daysAgo), ts: daysAgoTs(daysAgo),
      debtExtra: splits.debt, bufContrib: splits.buffer,
      billsPaid: splits.bills, ownerPaid: splits.owner,
      debtSplit: splits.debt > 0 ? [{ debtName: 'Chase Sapphire CC', rate: 22, amount: splits.debt }] : [],
      jobs: [
        { name: 'Set aside for taxes',           why: '28% of every dollar to a separate tax account.',                    amount: splits.tax,    color: 'var(--ds-c2)',   bg: '#d9ecde',            type: 'fixed', destination: 'savings_bucket' },
        { name: 'Cover upcoming bills',          why: 'Rent, phone, internet, health, software in the next 14 days.',      amount: splits.bills,  color: 'var(--ds-t1)',   bg: 'var(--ds-card2)',    type: 'bills' },
        { name: 'Pay extra on Chase Sapphire CC', why: '22% APR — highest interest first.',                                amount: splits.debt,   color: 'var(--coral)',   bg: 'var(--coral-light)', type: 'debt' },
        { name: 'Move to savings (buffer)',      why: 'Slow-month protection. 6-month goal: $14k.',                         amount: splits.buffer, color: 'var(--sky)',     bg: 'var(--sky-light)',   type: 'buffer' },
        { name: 'Pay yourself',                  why: '14% owner draw. Locked in regardless of season.',                    amount: splits.owner,  color: 'var(--ds-c2)',   bg: '#d9ecde',            type: 'ownerpay' },
        { name: 'Yours to spend freely',         why: '8% guilt-free. No tracking, no rules.',                              amount: splits.free,   color: 'var(--text2)',   bg: 'var(--bg2)',         type: 'free' },
      ].filter(function (j) { return j.amount > 0.01; }),
      jobsDone: {},
    };
  }
  // Tax 28%, bills ~25%, debt 12%, buffer 13%, owner 14%, free 8%. Sums to deposit.
  var DEMO_HISTORY = [
    makeHistoryEntry(2400, 'Freelance design',  8, { tax: 672, bills: 600, debt: 288, buffer: 312, owner: 336, free: 192 }),
    makeHistoryEntry(1800, 'Freelance design', 15, { tax: 504, bills: 450, debt: 216, buffer: 234, owner: 252, free: 144 }),
    makeHistoryEntry(3200, 'Freelance design', 22, { tax: 896, bills: 800, debt: 384, buffer: 416, owner: 448, free: 256 }),
  ];

  var DEMO_OBLIGATIONS = [{
    id: 'fa_demo_tax_0001',
    label: 'Tax set-aside',
    percentage: 28,
    destination: 'savings_bucket',
    enabledSources: [],
    active: true,
    note: 'Off the top, every deposit. Sits in a separate savings account until quarterly estimated taxes are due.',
  }];

  var DEMO_LESSONS_COMPLETED = [
    'py1',
    'd1', 'd2', 'd3',
    'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10',
    'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10',
    'm1', 'm2', 'm3', 'm4', 'm5', 'm6',
  ];
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  var DEMO_USER_DATA = {
    id: DEMO_USER.id,
    bills: DEMO_BILLS,
    debts: DEMO_DEBTS,
    history: DEMO_HISTORY,
    forecast: [],
    buffer: 3200,
    settings: {
      debtPct: 20, bufPct: 15, freePct: 8, ownerPct: 14, allocateWindow: 14,
      tour_done: true,
      balance: 5000,
      bufferGoal: 14000, bufferGoalMonths: 6,
      allocResetMonth: new Date().toISOString().slice(0, 7),
      learn: {
        streak:    { current: 9, longest: 12, lastActiveDate: todayStr() },
        // Pre-claim every badge the seed would earn so the badge-earned modal
        // doesn't pop during render.
        badges:    [
          'first_lesson', 'streak_3', 'streak_7',
          'ten_lessons', 'twenty_lessons',
          'course_payself', 'course_credit', 'course_funding',
        ],
        scrollPositions: {},
        completedCount: DEMO_LESSONS_COMPLETED.length,
        games: {},
      },
    },
    month_history: [],
    sources: ['Freelance design', 'Client retainer', 'Side projects', 'Other'],
    allocated_to_bills: 1850,
    obligations: DEMO_OBLIGATIONS,
    profile: {
      name: 'Alex',
      business_type: 'Freelance design',
      goals: 'Pay off the credit card, build a 6-month buffer, and stop the income roller coaster.',
    },
    email_prefs: { dormancy: false, weekly: true },
    last_active: new Date().toISOString(),
    updated_at:  new Date().toISOString(),
  };

  var DEMO_COACH_MESSAGES = [
    {
      role: 'user',
      content: "I just got paid $2,400 from a client. Where should it go?",
      created_at: new Date(daysAgoTs(8)).toISOString(),
    },
    {
      role: 'assistant',
      content: "Nice deposit. Here's how I'd split it.\n\n**Taxes ($672)** off the top — 28% to your tax savings account. Non-negotiable.\n\n**Bills ($600)** covers rent, phone, internet, health insurance, and your CC minimum coming up in the next 14 days.\n\n**Pay yourself ($336)** — 14% owner draw. You earned it.\n\n**Extra to Chase Sapphire ($288)** — 22% APR is bleeding you. Hit it hard.\n\n**Buffer ($312)** — keeps you on pace to hit your 6-month goal of $14k.\n\n**Free spending ($192)** — guilt-free. Use it.",
      created_at: new Date(daysAgoTs(8) + 30000).toISOString(),
    },
    {
      role: 'user',
      content: "Can I push more to the credit card and skip the buffer this round?",
      created_at: new Date(daysAgoTs(8) + 120000).toISOString(),
    },
    {
      role: 'assistant',
      content: "You can — but I'd push back a little.\n\nYou've got $3,200 in buffer right now. That's about 1.4 months of expenses. The CC will get paid off either way; the buffer is what stops the next slow month from putting you back on the card.\n\nIf you want to accelerate, I'd suggest: keep the buffer contribution, and pull from your free spending bucket this round. That gets the CC down faster without leaving you exposed.\n\nWant me to recompute the split that way?",
      created_at: new Date(daysAgoTs(8) + 150000).toISOString(),
    },
  ];

  // ── 2. Supabase stub ─────────────────────────────────────────────────
  // Each query path returns the seeded data the app expects.
  function makeFromChain(table) {
    var rows = [];
    var single = null;
    if (table === 'user_data')        single = DEMO_USER_DATA;
    if (table === 'profiles')         single = { id: DEMO_USER.id, subscription_status: 'active' };
    if (table === 'lesson_progress')  rows   = DEMO_LESSONS_COMPLETED.map(function (id) { return { lesson_id: id }; });
    if (table === 'coach_messages')   rows   = DEMO_COACH_MESSAGES.map(function (m) { return { role: m.role, content: m.content, created_at: m.created_at }; });
    if (table === 'referrals' || table === 'referral_rewards') rows = [];

    var chain;
    chain = {
      select:      function () { return chain; },
      eq:          function () { return chain; },
      neq:         function () { return chain; },
      in:          function () { return chain; },
      gt:          function () { return chain; },
      lt:          function () { return chain; },
      order:       function () { return chain; },
      limit:       function () { return chain; },
      range:       function () { return chain; },
      single:      function () { return Promise.resolve({ data: single, error: null }); },
      maybeSingle: function () { return Promise.resolve({ data: single, error: null }); },
      // Mutations are no-ops — we never write back to a real DB.
      upsert:      function () { return Promise.resolve({ data: null, error: null }); },
      insert:      function () { return Promise.resolve({ data: null, error: null }); },
      update:      function () { return chain; },
      delete:      function () { return chain; },
      // Awaitable as the list-form query result.
      then:        function (resolve, reject) {
        return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
      },
    };
    return chain;
  }

  // We need to drive the auth state so app.html's onAuthStateChange handler
  // runs the load flow against the stub. Capture the callback the app
  // registers and invoke it with a synthetic INITIAL_SESSION.
  var capturedAuthCb = null;
  var stubAuth = {
    onAuthStateChange: function (cb) {
      capturedAuthCb = cb;
      return { data: { subscription: { unsubscribe: function () {} } } };
    },
    getSession: function () {
      return Promise.resolve({
        data: { session: { user: DEMO_USER, access_token: 'demo-token' } },
        error: null,
      });
    },
    getUser: function () {
      return Promise.resolve({ data: { user: DEMO_USER }, error: null });
    },
    signInWithOAuth:        function () { return Promise.resolve({ data: null, error: null }); },
    signInWithPassword:     function () { return Promise.resolve({ data: null, error: null }); },
    signUp:                 function () { return Promise.resolve({ data: null, error: null }); },
    signOut:                function () { return Promise.resolve({ error: null }); },
    exchangeCodeForSession: function () { return Promise.resolve({ data: { session: null }, error: null }); },
  };
  var stubFunctions = {
    invoke: function (name, opts) {
      if (name === 'coach-chat') {
        // Pull the last user message off the in-memory history so we can
        // tailor the canned reply. Fall back to a generic reply.
        var msg = '';
        try { msg = (opts && opts.body && opts.body.message) || ''; } catch (_) {}
        var reply = pickCoachReply(msg);
        // Simulate a streaming-feel by delaying ~1.4s so the "Coach is
        // thinking" bubble lingers before the response renders.
        return new Promise(function (resolve) {
          setTimeout(function () {
            resolve({ data: { reply: reply, remainingToday: 47 }, error: null });
          }, 1400);
        });
      }
      return Promise.resolve({ data: null, error: { message: 'Demo mode: edge functions disabled (' + name + ')' } });
    },
  };

  // Lightweight intent matcher for the demo coach. Picks the most relevant
  // canned reply based on keywords in the user's message. Each reply is
  // grounded in the seeded persona (Chase Sapphire $4,200 @ 22%, $3,200 buffer,
  // $14k goal, 28% tax rule, 14-day allocation window).
  function pickCoachReply(message) {
    var m = String(message || '').toLowerCase();
    if (/extra.*\$?\s*400|400.*credit|400.*card|pay.*down.*card|extra.*card/.test(m)) {
      return [
        "Yes — and the math is in your favor. Here's what $400 extra to Chase Sapphire actually does:",
        "",
        "**Right now:** $4,200 balance · 22% APR · $125 min. At minimums only, you're looking at ~52 months and ~$1,460 in interest. Not great.",
        "",
        "**With $400 extra this month:** Balance drops to $3,800. Next month's interest charge falls from ~$77 to ~$70. Over the life of the debt, that single $400 saves you ~$190 in interest and chops about 4 months off the payoff.",
        "",
        "**The catch:** your buffer is at $3,200, which is ~1.4 months of expenses. Goal is 6 months ($14k). Pulling $400 from buffer would set that timeline back ~2 weeks.",
        "",
        "**My recommendation:** take it from your free-spending bucket this round, not buffer. You've got $192 sitting there from the last deposit and ~$200 from the round before. Combine those, top up another $50 from buffer, and you hit $400 without touching the safety net.",
        "",
        "Want me to recompute the next deposit with that split locked in?",
      ].join("\n");
    }
    if (/buffer|emergency|safety|slow.*month/.test(m)) {
      return [
        "You're at $3,200 — about 1.4 months of expenses ($2,160/mo). Goal is 6 months ($14,000), so you're 23% of the way.",
        "",
        "**Pace check:** with 15% of every deposit going to buffer (~$300/$400 per deposit, depending on size), you're on track to hit $14k in roughly 8-9 months at current income. Faster if income picks up, slower if it dips.",
        "",
        "**One thing to watch:** the 22% APR on Chase Sapphire is more expensive than the buffer's growth, so once you're at 3 months ($6,500-ish), I'd consider routing more to debt. Buffer is for emergencies, not optimization. 3 months covers most slow-month scenarios for a freelance designer.",
      ].join("\n");
    }
    if (/tax|set.aside|quarterly/.test(m)) {
      return [
        "28% off the top, every deposit. So far this month you've set aside:",
        "",
        "**$2,072** across three deposits ($672 + $504 + $896). That's sitting in your tax savings bucket, untouched.",
        "",
        "**Q2 estimated payment** is due June 15 — you'll need ~$3,800 if your run rate holds (28% of projected $13.5k Q2 income). At current pace, you'll be there with ~$200 to spare.",
        "",
        "Heads up: if you book a big project this quarter, bump the rate temporarily — better to over-set-aside and refund yourself than be short on June 15.",
      ].join("\n");
    }
    if (/split|allocat|deposit|where.*go|breakdown/.test(m)) {
      return [
        "Here's how a fresh deposit lands with your current rules:",
        "",
        "**1. Tax set-aside (28%)** — off the top, into your separate tax savings.",
        "**2. Bills (next 14 days)** — Rent, Phone, Internet, Health, Software, CC minimum. Whatever's needed lands here first.",
        "**3. Pay yourself (14%)** — owner draw. Locked in.",
        "**4. Extra debt (20% of surplus)** — straight to Chase Sapphire (highest APR).",
        "**5. Buffer (15% of surplus)** — toward your $14k goal.",
        "**6. Free spending (8% of surplus)** — yours to use however.",
        "",
        "Want me to walk through what a specific deposit amount would look like?",
      ].join("\n");
    }
    // Default: warm, grounded reply that references the persona.
    return [
      "I'm reading your full picture: $4,200 on Chase Sapphire at 22%, $3,200 in buffer, six bills in the next two weeks totaling about $2,160, and a 28% tax rule pulling off the top of every deposit.",
      "",
      "What's on your mind? Try \"can I pay extra on the card?\", \"how's my buffer pacing?\", or \"what about taxes?\"",
    ].join("\n");
  }
  var stubClient = {
    auth: stubAuth,
    from: function (table) { return makeFromChain(table); },
    functions: stubFunctions,
    channel: function () {
      return { on: function () { return this; }, subscribe: function () { return this; }, unsubscribe: function () {} };
    },
    removeChannel: function () {},
  };
  window.supabase = { createClient: function () { return stubClient; } };

  // Stripe is a hard dep at boot. Stub it just in case the CDN script
  // fails (offline recordings).
  if (typeof window.Stripe === 'undefined') {
    window.Stripe = function () {
      return {
        redirectToCheckout: function () { return Promise.resolve({ error: null }); },
      };
    };
  }

  // ── 3. After load, fire the synthetic auth event so the app loads
  //       Alex's data through its normal pipeline.
  function fireAuth() {
    if (typeof capturedAuthCb !== 'function') {
      return setTimeout(fireAuth, 30);
    }
    var session = { user: DEMO_USER, access_token: 'demo-token' };
    try { capturedAuthCb('INITIAL_SESSION', session); } catch (e) { console.error('[Able demo] auth dispatch failed', e); }

    // The auth handler does its work asynchronously. Once it finishes,
    // tear down the auth/paywall guards, preload lesson progress so the
    // Money Literacy Score is correct on first Learn-tab open, and expose
    // helper escape hatches.
    setTimeout(function () {
      var auth = document.getElementById('auth-screen');             if (auth) auth.style.display = 'none';
      var pw   = document.getElementById('paywall-screen');          if (pw)   pw.style.display = 'none';
      var ob   = document.getElementById('onboard-screen');          if (ob)   ob.style.display = 'none';
      var col  = document.getElementById('checkout-return-loading'); if (col) col.remove();
      var app  = document.getElementById('app');                     if (app)  app.style.display = 'block';
      // Preload lcCompleted (loadLessonProgress is a function decl, so
      // it's on window in classic-script context).
      try { if (typeof window.loadLessonProgress === 'function') window.loadLessonProgress(); } catch (_) {}
      console.log('[Able demo] Persona loaded:', DEMO_USER.email,
        '· bills:', DEMO_USER_DATA.bills.length,
        '· debts:', DEMO_USER_DATA.debts.length,
        '· deposits:', DEMO_USER_DATA.history.length,
        '· lessons completed:', DEMO_LESSONS_COMPLETED.length + '/41');
    }, 250);
  }

  if (document.readyState === 'complete') {
    setTimeout(fireAuth, 0);
  } else {
    window.addEventListener('load', function () { setTimeout(fireAuth, 0); });
  }

  // ── 4. Helper escape hatches ─────────────────────────────────────────
  window.exitAbleDemo = function () {
    sessionStorage.removeItem('able_demo');
    var url = new URL(location.href);
    url.searchParams.delete('demo');
    location.replace(url.toString());
  };
  window.resetAbleDemo = function () {
    sessionStorage.setItem('able_demo', '1');
    location.reload();
  };
})();
