/**
 * Insert the 3 stats yt-longform rows directly into the yt-longform tab.
 *
 * HOW TO RUN:
 * 1. Open the Google Sheet workbook
 *    (https://docs.google.com/spreadsheets/d/1DnQXWKcbGLMHvzxjk9yjQKDhzOGTm9Wph27ly7tHNlA)
 * 2. Extensions → Apps Script
 * 3. Replace the default Code.gs contents with the contents of this file
 * 4. Save (Cmd+S). Pick a name like "Insert stats yt-longform rows"
 * 5. Click the function dropdown (top) and select `insertStatsRows`
 * 6. Click Run. First time, you'll authorize the script to access the sheet.
 * 7. Check the yt-longform tab — 3 new rows appended at the bottom.
 *
 * The script reads the actual header row, then maps each field by column
 * NAME (not position), so it works no matter what column order the sheet uses.
 *
 * If your tab is named something other than what we expect, edit
 * `TAB_NAME_CANDIDATES` below.
 */

const TAB_NAME_CANDIDATES = ['yt-longform', 'yt_longform', 'longform', 'yt longform', 'YT Longform'];

function insertStatsRows() {
  const ss = SpreadsheetApp.getActive();
  const tab = findTab(ss);
  if (!tab) {
    SpreadsheetApp.getUi().alert(
      'Could not find the yt-longform tab. Edit TAB_NAME_CANDIDATES in this script to include your tab name.'
    );
    return;
  }

  // Read header row (row 1)
  const lastCol = tab.getLastColumn();
  const header = tab.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim());
  Logger.log('Header found (%s cols): %s', header.length, header.join(', '));

  const colIndex = {};
  header.forEach((name, i) => { if (name) colIndex[name] = i; });

  // Validate that essential columns exist
  const essential = ['slug', 'page_url', 'page_title', 'page_type', 'cluster', 'status', 'yt_title', 'yt_description', 'linkedin_post_text'];
  const missing = essential.filter(c => colIndex[c] === undefined);
  if (missing.length) {
    SpreadsheetApp.getUi().alert(
      'Missing expected columns in yt-longform header: ' + missing.join(', ') +
      '. Found columns: ' + header.join(', ')
    );
    return;
  }

  // Build the 3 row objects
  const rows = [pillar(), supporting1(), supporting2()];

  // Map each row object to an array aligned with the actual header order
  const data = rows.map(rowObj => {
    const arr = new Array(header.length).fill('');
    Object.entries(rowObj).forEach(([key, value]) => {
      if (colIndex[key] !== undefined) arr[colIndex[key]] = value;
    });
    return arr;
  });

  // Append rows
  const startRow = tab.getLastRow() + 1;
  tab.getRange(startRow, 1, data.length, header.length).setValues(data);

  SpreadsheetApp.getUi().alert(
    'Inserted ' + data.length + ' rows starting at row ' + startRow + '.\n' +
    'Slugs: ' + rows.map(r => r.slug).join(', ')
  );
}

function findTab(ss) {
  // First try named lookup
  for (const name of TAB_NAME_CANDIDATES) {
    const t = ss.getSheetByName(name);
    if (t) return t;
  }
  // Fallback: try GID 2008884803 (the yt-longform tab gid you shared)
  const targetGid = 2008884803;
  const sheets = ss.getSheets();
  for (const s of sheets) {
    if (s.getSheetId() === targetGid) return s;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// Row data
// ─────────────────────────────────────────────────────────────

function pillar() {
  return {
    slug: 'inconsistent-income-data',
    page_url: '/learn/inconsistent-income-data/',
    page_title: "The Inconsistent Income Economy: 2026 Data on America's 77 Million Variable Earners",
    page_type: 'pillar',
    cluster: 'learn-inconsistent-income-data',
    priority: '1',
    status: 'pending',
    last_updated: '',
    notebook_url: '',
    source_materials: '(see docs/notebooklm-sources/inconsistent-income-data-bundle.md)',
    prompt_used: '(see docs/notebooklm-youtube-spec.md)',
    video_duration_target: '4-5 min',
    video_duration_actual: '',
    youtube_video_id: '',
    youtube_url: '',
    yt_title: 'Inconsistent Income in America: 2026 Data on 77M Variable Earners | Able',
    yt_description: [
      "77 million American adults get paid different amounts every month. The 2026 data picture on the inconsistent-income economy, who they are, how they get paid, and why traditional budgeting fails most of them.",
      "",
      "From Able, the budgeting app built for inconsistent income.",
      "",
      "Read the full article: https://becomeable.app/learn/inconsistent-income-data/?utm_source=youtube&utm_medium=video&utm_campaign=stats-pillar",
      "",
      "Chapters",
      "00:00 Intro",
      "00:30 The 77 million number",
      "01:00 The 70-million-person gig economy",
      "01:30 87% struggle to manage spending",
      "02:00 The confidence gap",
      "02:30 Volatility hits every income bracket",
      "03:00 What the data tells us",
      "03:30 The Floor-First reframe",
      "",
      "Floor-First Budgeting",
      "Per-deposit allocation that pays your bills and taxes before any dollar gets to vote on dinner.",
      "",
      "Try Able free for 30 days",
      "https://becomeable.app?utm_source=youtube&utm_medium=video&utm_campaign=stats-pillar",
      "$14.99/month or $129/year. Card required, no charge until day 31. Cancel anytime.",
      "",
      "#InconsistentIncome #VariableIncome #FloorFirstBudgeting #FreelanceMoney"
    ].join('\n'),
    yt_tags: 'Able, inconsistent income, variable income, 77 million Americans, gig economy statistics, freelancer statistics, income volatility, Floor-First Budgeting, budgeting statistics, 2026 personal finance data',
    yt_thumbnail_path: 'article-video/videos/inconsistent-income-data/thumbnail.png',
    video_drive_id: '',
    yt_playlist: 'Inconsistent Income Data',
    yt_chapters: '00:00 Intro\n00:30 The 77 million number\n01:00 The 70-million-person gig economy\n01:30 87% struggle to manage spending\n02:00 The confidence gap\n02:30 Volatility hits every income bracket\n03:00 What the data tells us\n03:30 The Floor-First reframe',
    embed_position: 'top',
    embed_status: 'pending',
    schema_status: 'pending',
    view_count_30d: '',
    clickthrough_30d: '',
    linkedin_post_text: pillarLinkedIn(),
    linkedin_status: 'pending_review',
    linkedin_scheduled_date: '2026-05-14',
    linkedin_url: '',
    linkedin_posted_date: '',
    notes: ''
  };
}

function supporting1() {
  return {
    slug: 'why-87-percent-struggle-to-budget',
    page_url: '/learn/inconsistent-income-data/why-87-percent-struggle-to-budget/',
    page_title: 'Why 87% of Americans Struggle to Manage Their Money',
    page_type: 'supporting',
    cluster: 'learn-inconsistent-income-data',
    priority: '2',
    status: 'pending',
    last_updated: '',
    notebook_url: '',
    source_materials: '(see docs/notebooklm-sources/inconsistent-income-data-bundle.md)',
    prompt_used: '(see docs/notebooklm-youtube-spec.md)',
    video_duration_target: '3-4 min',
    video_duration_actual: '',
    youtube_video_id: '',
    youtube_url: '',
    yt_title: 'Why 87% of Americans Struggle With Money (2026 Data) | Able',
    yt_description: [
      "87% of Americans say they struggled to manage their spending. The cause is structural, not individual, and the 2026 data shows exactly why traditional budgeting fails most people.",
      "",
      "From Able, the budgeting app built for inconsistent income.",
      "",
      "Read the full article: https://becomeable.app/learn/inconsistent-income-data/why-87-percent-struggle-to-budget/?utm_source=youtube&utm_medium=video&utm_campaign=87-percent",
      "",
      "Chapters",
      "00:00 Intro",
      "00:20 What 87% actually means",
      "00:50 Intent vs friction",
      "01:20 Structural causes",
      "02:00 The five reasons budgets fail",
      "02:45 What working looks like",
      "03:15 The Floor-First answer",
      "",
      "Try Able free for 30 days",
      "https://becomeable.app?utm_source=youtube&utm_medium=video&utm_campaign=87-percent",
      "$14.99/month or $129/year. Card required, no charge until day 31. Cancel anytime.",
      "",
      "#InconsistentIncome #VariableIncome #FloorFirstBudgeting #BudgetingStatistics"
    ].join('\n'),
    yt_tags: 'Able, why budgeting fails, 87 percent struggle, americans bad at budgeting, budgeting failure, structural finance problem, Floor-First Budgeting, inconsistent income, 2026 personal finance statistics',
    yt_thumbnail_path: 'article-video/videos/why-87-percent-struggle-to-budget/thumbnail.png',
    video_drive_id: '',
    yt_playlist: 'Inconsistent Income Data',
    yt_chapters: '00:00 Intro\n00:20 What 87% actually means\n00:50 Intent vs friction\n01:20 Structural causes\n02:00 The five reasons budgets fail\n02:45 What working looks like\n03:15 The Floor-First answer',
    embed_position: 'top',
    embed_status: 'pending',
    schema_status: 'pending',
    view_count_30d: '',
    clickthrough_30d: '',
    linkedin_post_text: supporting1LinkedIn(),
    linkedin_status: 'pending_review',
    linkedin_scheduled_date: '2026-05-14',
    linkedin_url: '',
    linkedin_posted_date: '',
    notes: ''
  };
}

function supporting2() {
  return {
    slug: 'inside-77-million-variable-income-workers',
    page_url: '/learn/inconsistent-income-data/inside-77-million-variable-income-workers/',
    page_title: "Inside America's 77 Million Variable-Income Workers",
    page_type: 'supporting',
    cluster: 'learn-inconsistent-income-data',
    priority: '2',
    status: 'pending',
    last_updated: '',
    notebook_url: '',
    source_materials: '(see docs/notebooklm-sources/inconsistent-income-data-bundle.md)',
    prompt_used: '(see docs/notebooklm-youtube-spec.md)',
    video_duration_target: '3-4 min',
    video_duration_actual: '',
    youtube_video_id: '',
    youtube_url: '',
    yt_title: "Inside America's 77M Variable-Income Workers (2026 Data) | Able",
    yt_description: [
      "77 million American adults get paid different amounts every month. Who they are, what they earn, and how their finances differ from a paycheck worker, with 2026 data.",
      "",
      "From Able, the budgeting app built for inconsistent income.",
      "",
      "Read the full article: https://becomeable.app/learn/inconsistent-income-data/inside-77-million-variable-income-workers/?utm_source=youtube&utm_medium=video&utm_campaign=77-million",
      "",
      "Chapters",
      "00:00 Intro",
      "00:25 What variable income covers",
      "00:55 The six working segments",
      "01:35 Scale and growth",
      "02:10 The six structural differences",
      "02:50 Per-deposit thinking",
      "03:25 Segment templates",
      "",
      "Try Able free for 30 days",
      "https://becomeable.app?utm_source=youtube&utm_medium=video&utm_campaign=77-million",
      "$14.99/month or $129/year. Card required, no charge until day 31. Cancel anytime.",
      "",
      "#InconsistentIncome #VariableIncome #GigEconomy #FloorFirstBudgeting"
    ].join('\n'),
    yt_tags: 'Able, variable income, 77 million Americans, gig economy demographics, freelancer income, creator income, commission income, inconsistent income workers, Floor-First Budgeting, 2026 workforce statistics',
    yt_thumbnail_path: 'article-video/videos/inside-77-million-variable-income-workers/thumbnail.png',
    video_drive_id: '',
    yt_playlist: 'Inconsistent Income Data',
    yt_chapters: '00:00 Intro\n00:25 What variable income covers\n00:55 The six working segments\n01:35 Scale and growth\n02:10 The six structural differences\n02:50 Per-deposit thinking\n03:25 Segment templates',
    embed_position: 'top',
    embed_status: 'pending',
    schema_status: 'pending',
    view_count_30d: '',
    clickthrough_30d: '',
    linkedin_post_text: supporting2LinkedIn(),
    linkedin_status: 'pending_review',
    linkedin_scheduled_date: '2026-05-14',
    linkedin_url: '',
    linkedin_posted_date: '',
    notes: ''
  };
}

function pillarLinkedIn() {
  return [
    "77 million American adults get paid different amounts every month.",
    "",
    "That number is the most under-reported statistic in the personal-finance category. It comes from the Federal Reserve's Survey of Household Economics and Decisionmaking, which found that nearly 3 in 10 adults report income that varies month to month. Applied to the ~258 million US adult population, that is approximately 77 million people.",
    "",
    "It is roughly 1 in 3 working-age adults. And the trend is moving up, not down. The full-time independent workforce alone more than doubled between 2020 and 2024.",
    "",
    "Underneath the headline, three more numbers tell the rest of the story.",
    "",
    "89% of US households experienced a month-to-month income change of at least 5% in JPMorgan Chase Institute's bank-account-data study. Median household swing: 36%. That is not survey self-report. That is measured reality from millions of checking accounts.",
    "",
    "Volatility is not a low-income condition. 5.6 million American independent workers earn over $100,000 a year. Their income still swings monthly. 20.6% of households earning over $150K say they live paycheck to paycheck. Volatility and low income are different problems that need different tools, and the most common mistake in financial media is conflating them.",
    "",
    "87% of Americans say they struggled to manage their spending in 2025 (LendingTree). 91.8% worry about their budget. Only about one-third use a formal budgeting method consistently. The gap between the worry and the working system is the size of the problem.",
    "",
    "When 87% of any population fails at the same task, the explanation is rarely 87 individual character flaws. The explanation is structural. The tooling, designed around a Friday paycheck of a known amount, no longer matches how a growing share of the workforce actually gets paid.",
    "",
    "Floor-First Budgeting drops the monthly-paycheck assumption and rebuilds around the deposit. Every deposit fills the floor (bills + tax) first, before any dollar gets to vote on dinner. A reserve absorbs slow months. The pay-yourself number is set below your best and above your worst, and it holds.",
    "",
    "The full data picture and methodology are in the new article and accompanying video below. Built for the 77 million."
  ].join('\n');
}

function supporting1LinkedIn() {
  return [
    "87% of Americans say they struggled to manage their spending in 2025.",
    "",
    "The instinct on reading that is to conclude that most people are bad with money. The data, read carefully, points somewhere else.",
    "",
    "The same survey that produced the 87% number also found that 69% of Americans plan to start tracking their spending, 59% plan to learn more about managing money, 77% have already changed how they manage their finances in response to economic conditions, and 83% are focused on what they can control financially.",
    "",
    "That is not a portrait of indifference. It is effort meeting friction.",
    "",
    "When a system fails at scale, the explanation is rarely \"everyone has the same individual flaw.\" The explanation is usually that the system itself does not fit the situation it is being applied to.",
    "",
    "The personal-finance system most Americans inherit, monthly budgeting, was designed around a specific income shape. A predictable amount, on a predictable schedule, into a predictable account. That shape has gotten less and less common as 70 million Americans now work in the gig economy and 27.7 million work full-time as independents, more than double the 2020 number.",
    "",
    "A monthly budget fails for a deposit-based worker for five structural reasons. It is allocated against a number you do not yet know. It treats the floor (bills + tax) as a category rather than a priority. There is no smoothing mechanism for slow months. Tax allocation becomes a quarterly surprise instead of a per-deposit cost. And the system measures intention rather than reality.",
    "",
    "The 13% of Americans who feel confident about their money are not 13% more disciplined than everyone else. They are operating with a structure that fits. Once that structure is in place, the discipline and literacy gaps stop costing money.",
    "",
    "The full breakdown of why traditional budgeting fails inconsistent-income workers, and the five-rule Floor-First system that replaces it, is in the new article and accompanying video below."
  ].join('\n');
}

function supporting2LinkedIn() {
  return [
    "The 77 million is not one homogeneous group.",
    "",
    "It includes at least six recognizable working segments, and each one breaks a different assumption in the legacy budgeting toolkit.",
    "",
    "Freelancers and independent contractors get paid per project, on net-15 to net-90 terms. Creators earn across multiple platforms (ad revenue, brand deals, merch, subscriptions, affiliates) on different schedules. Gig workers are paid daily or weekly in amounts that depend on shifts and demand. Commission earners (real estate, sales, financial advisors) see large checks separated by long gaps. Small business owners receive owner pay as whatever the business has left. And W-2 workers with variable schedules in hospitality, retail, healthcare, and trades see their paychecks vary because their hours vary.",
    "",
    "The financial reality of every segment differs from a steady paycheck in six specific ways.",
    "",
    "Income arrival is unscheduled. Taxes are not withheld. Benefits are self-funded. Income shape is \"shocky\" rather than smooth. The mental load is higher. And slow months trigger real crises, not just inconvenience. Low-income households spend an average of 6 months per year with income running at least 20% below typical, according to the US Financial Diaries Project.",
    "",
    "For all six differences, the unifying fix is the same: stop budgeting by the month. Budget by the deposit.",
    "",
    "Every deposit gets routed at arrival. Tax bucket fills first. Bills get reserved. Pay-yourself comes out on the scheduled day regardless of what the deposit looked like. The reserve refills during surplus. Free spending is what is left, not the residual after spending. That is Floor-First Budgeting. One toolkit, designed for the way the 77 million actually get paid.",
    "",
    "The full segment-by-segment breakdown, plus the templates for each of the six categories, are in the new article and accompanying video below."
  ].join('\n');
}
