#!/usr/bin/env node
/**
 * Build the unified Able Content Engine workbook.
 *
 * Outputs four CSV tabs into marketing-footage/social-export/workbook/.
 * Each CSV imports as a separate tab in a single Google Sheet:
 *
 *   00-README.md             — import instructions + tab roles
 *   01-schedule.csv          — IG/FB/LI cadence (Make scenario 4869011 reads this)
 *   02-yt-shorts.csv         — YouTube Shorts upload tracker
 *   03-tiktok.csv            — TikTok manual posting tracker
 *
 * The LinkedIn-draft tab and YouTube long-form tab live in your existing
 * YouTube tracker sheet for now (those have live state we can't recreate
 * locally). Once you're ready, migrate those into this workbook too.
 *
 * Run:
 *   node scripts/build-workbook.js
 *   LAUNCH_DATE=2026-05-11 node scripts/build-workbook.js   # pin the schedule's start date
 *
 * Re-runnable safely. Schedule's caption columns and statuses are regenerated
 * from social/captions/launch.js + social/index.html + social/posts/data.js
 * each run, so editing those source files and re-running stays consistent.
 *
 * Live status fields (yt_video_id, tt_url, posting timestamps) are written
 * BACK from the platform pipelines, so don't re-import on top of those —
 * import once to a fresh sheet, then let the pipelines own the state.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const WORKBOOK = path.join(ROOT, 'marketing-footage/social-export/workbook');

// ─── Smart post-order ───────────────────────────────────────────────
// Two goals:
//   1. Lead with brand-script for the first ~10 posts to anchor the voice.
//   2. Round-robin across categories afterward + alternate themes so
//      no two consecutive posts share a category or theme color.

function categorize(slug, id) {
  if (!slug) return 'legacy';
  if (slug.startsWith('brandscript-')) return 'brand-script';
  if (slug.startsWith('feature-')) return 'feature';
  if (slug.startsWith('landing-')) return 'landing';
  if (slug.startsWith('learn-')) return 'learn';
  if (slug.startsWith('identity-')) return 'identity';
  if (slug.startsWith('scenario-')) return 'scenario';
  if (slug.startsWith('counter-')) return 'counter';
  if (slug.startsWith('persona-')) return 'persona';
  if (slug.endsWith('-day-1-31')) return 'day-1-31';
  if (slug.startsWith('list-')) return 'listicle';
  if (id && id.startsWith('PC')) return 'product';
  return 'legacy';  // older C1-C49 + a few others
}

function computeOrder(carousels) {
  // Annotate each with category for downstream use.
  const items = carousels.map(c => ({
    c,
    category: categorize(c.slug, c.id),
    theme: c.theme || 'page',
  }));

  // Group by category.
  const byCat = {};
  for (const it of items) (byCat[it.category] ||= []).push(it);

  // Phase 1: opening 10 posts — pull brand-script first to anchor voice.
  const order = [];
  const open = (byCat['brand-script'] || []).slice(0, 10);
  byCat['brand-script'] = (byCat['brand-script'] || []).slice(10);
  order.push(...open);

  // Phase 2: round-robin across remaining categories with theme variety.
  // Preferred cycle order — categories that bring the brand voice forward first.
  const cycle = [
    'brand-script', 'identity', 'scenario', 'persona', 'feature',
    'counter', 'day-1-31', 'listicle', 'landing', 'learn',
    'product', 'legacy',
  ];

  // Loop until everything is placed.
  while (Object.values(byCat).some(list => list.length > 0)) {
    for (const cat of cycle) {
      const list = byCat[cat];
      if (!list || !list.length) continue;
      // Try to avoid same theme as last post.
      const last = order[order.length - 1];
      let pickIdx = 0;
      if (last) {
        const altIdx = list.findIndex(it => it.theme !== last.theme);
        if (altIdx >= 0) pickIdx = altIdx;
      }
      order.push(list.splice(pickIdx, 1)[0]);
    }
  }

  // Return a map { id → { order, category } }
  const result = {};
  order.forEach((it, idx) => {
    result[it.c.id] = { order: idx + 1, category: it.category };
  });
  return result;
}

// ─── Helpers ────────────────────────────────────────────────────────
function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function csvCell(v) {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCsv(filename, rows) {
  ensureDir(WORKBOOK);
  const out = path.join(WORKBOOK, filename);
  const text = rows.map(r => r.map(csvCell).join(',')).join('\n') + '\n';
  fs.writeFileSync(out, text);
  return { out, rowCount: rows.length - 1 };
}

// ─── Tab 1: Schedule (run build-master-sheet.js + copy output) ────────
function buildScheduleTab() {
  console.log('[1/3] Schedule tab — invoking build-master-sheet.js');
  execSync(`node "${path.join(__dirname, 'build-master-sheet.js')}"`, {
    stdio: ['ignore', 'pipe', 'inherit'],
    env: process.env,
  });
  // build-master-sheet.js writes to marketing-footage/social-export/_master-sheet.csv
  const src = path.join(ROOT, 'marketing-footage/social-export/_master-sheet.csv');
  const dst = path.join(WORKBOOK, '01-schedule.csv');
  ensureDir(WORKBOOK);
  fs.copyFileSync(src, dst);
  const rows = fs.readFileSync(dst, 'utf8').split('\n').filter(l => l.trim()).length - 1;
  console.log(`        ${dst.replace(ROOT + '/', '')} (${rows} rows)`);
}

// ─── Tab 2: YT Shorts (regenerated with post_order + category) ────────
function buildShortsTab(orderMap, carousels) {
  console.log('[2/3] YT Shorts tab — building with smart post_order');

  function cleanText(s) {
    if (!s) return '';
    return s.replace(/\{([^}]*)\}/g, '$1').replace(/\\n/g, ' ').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function hookOf(c) {
    const s0 = (c.slides || [])[0] || {};
    const muted = cleanText(s0.muted);
    const punch = cleanText(s0.punch);
    return (muted && punch) ? `${muted} ${punch}` : (punch || muted || c.slug || c.id);
  }

  function titleFor(c) {
    let t = hookOf(c);
    return t.length > 85 ? t.slice(0, 82) + '...' : t;
  }

  function tagsFor(c) {
    const base = new Set([
      'budgeting', 'variable income', 'inconsistent income',
      'freelancer', 'self employed', 'floor first', 'able app',
      'personal finance', '1099',
    ]);
    const s0 = (c.slides || [])[0] || {};
    if (s0.eyebrow) base.add(s0.eyebrow.toLowerCase());
    if (c.theme) base.add(c.theme.toLowerCase());
    for (const w of (c.slug || '').split('-')) {
      if (w.length > 3) base.add(w.toLowerCase());
    }
    return [...base].slice(0, 25).join(',');
  }

  function descriptionFor(c) {
    const hook = hookOf(c);
    const tags = ['#Shorts', '#Budgeting', '#VariableIncome', '#Freelancer', '#1099',
                  '#FloorFirst', '#InconsistentIncome', '#PersonalFinance',
                  '#SelfEmployed', '#FreelanceTok'];
    return [
      hook, '',
      'Built for the way you actually get paid. Floor-First Budgeting for variable income.', '',
      'Try Able free for 30 days: becomeable.app/get-able', '',
      tags.join(' '),
    ].join('\n');
  }

  const headers = [
    'post_order', 'category', 'file_slug', 'id', 'slug', 'status',
    'yt_title', 'yt_description', 'yt_tags',
    'youtube_video_id', 'youtube_url', 'yt_published_date', 'notes',
  ];

  // Sort carousels by computed post_order.
  const sorted = [...carousels].sort((a, b) => {
    const oa = orderMap[a.id]?.order || 9999;
    const ob = orderMap[b.id]?.order || 9999;
    return oa - ob;
  });

  const rows = [headers];
  for (const c of sorted) {
    const meta = orderMap[c.id] || { order: '', category: 'legacy' };
    rows.push([
      meta.order, meta.category, `${c.id}_${c.slug}`, c.id, c.slug || '',
      'pending', titleFor(c), descriptionFor(c), tagsFor(c),
      '', '', '', `${(c.slides || []).length} slides`,
    ]);
  }

  const { out, rowCount } = writeCsv('02-yt-shorts.csv', rows);
  console.log(`        ${out.replace(ROOT + '/', '')} (${rowCount} rows)`);

  // Also refresh the docs/ copy for standalone use.
  fs.copyFileSync(out, path.join(ROOT, 'docs/youtube-shorts-tracker.csv'));
}

// ─── Tab 3: TikTok manual tracker ─────────────────────────────────────
// TikTok has no Make app, so this tab tracks manual posting. Same MP4
// files as YT Shorts (the carousels-to-shorts.py output), but with
// TikTok-native captions/hashtags + manual posting status flow.
function buildTikTokTab(orderMap, carousels) {
  console.log('[3/3] TikTok tab — building with smart post_order');

  function cleanText(s) {
    if (!s) return '';
    return s.replace(/\{([^}]*)\}/g, '$1').replace(/\\n/g, ' ').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function hookOf(c) {
    const s0 = (c.slides || [])[0] || {};
    const muted = cleanText(s0.muted);
    const punch = cleanText(s0.punch);
    return (muted && punch) ? `${muted} ${punch}` : (punch || muted || c.slug || c.id);
  }

  function ttHashtagsFor(c) {
    const s0 = (c.slides || [])[0] || {};
    const tags = new Set([
      '#variableincome', '#freelancetok', '#1099', '#freelancer',
      '#smallbiz', '#budgetingtips', '#fyp',
    ]);
    if (s0.eyebrow) tags.add('#' + s0.eyebrow.toLowerCase().replace(/[^a-z0-9]/g, ''));
    return [...tags].slice(0, 8).join(' ');
  }

  const headers = [
    'post_order', 'category', 'file_slug', 'id', 'slug', 'status',
    'tt_caption', 'tt_hashtags', 'tt_scheduled_date',
    'tt_url', 'tt_views', 'notes',
  ];

  const sorted = [...carousels].sort((a, b) => {
    const oa = orderMap[a.id]?.order || 9999;
    const ob = orderMap[b.id]?.order || 9999;
    return oa - ob;
  });

  const rows = [headers];
  for (const c of sorted) {
    const meta = orderMap[c.id] || { order: '', category: 'legacy' };
    const fileSlug = `${c.id}_${c.slug}`;
    const hook = hookOf(c);
    const hashtags = ttHashtagsFor(c);
    const caption = `${hook}\n\n${hashtags}`;
    rows.push([
      meta.order, meta.category, fileSlug, c.id, c.slug || '',
      'pending', caption, hashtags, '', '', '',
      `${(c.slides || []).length} slides`,
    ]);
  }

  const { out, rowCount } = writeCsv('03-tiktok.csv', rows);
  console.log(`        ${out.replace(ROOT + '/', '')} (${rowCount} rows)`);
}

// ─── README ─────────────────────────────────────────────────────────
function writeReadme() {
  const md = `# Able Content Engine — Workbook

This folder contains CSVs that import as tabs into one Google Sheet. Each tab
drives a different posting pipeline.

## First-time import

1. Create a new Google Sheet. Name it \`Able Content Engine\`.
2. For each CSV in this folder (in numeric order — \`01-...\`, \`02-...\`,
   \`03-...\`), in Google Sheets: **File → Import → Upload → choose CSV →
   Import location: Insert new sheet(s)**. Rename the tab to match the
   filename's slug (e.g. \`schedule\`, \`yt-shorts\`, \`tiktok\`).
3. Set env vars so the pipelines find the new sheet:
   \`\`\`
   export SHEET_ID=<the workbook ID from the URL>
   export SHORTS_SHEET_ID=$SHEET_ID
   \`\`\`
4. The Make scenario \`4869011\` reads the \`schedule\` tab (rename Make's
   sheet input to point at this workbook). \`scripts/youtube-upload.py
   --shorts\` reads the \`yt-shorts\` tab. The \`tiktok\` tab is manual.

## Tabs

### \`01-schedule.csv\` → tab \`schedule\`
- The 65-week social cadence (Mon–Sat post schedule + Sun brand-script).
- Captions for IG / TT / LI / FB per slot.
- Drives **Make scenario 4869011** (IG + FB + LinkedIn auto-posting).
- Regenerated by \`node scripts/build-master-sheet.js\` from
  \`social/index.html\` WEEKS array + \`social/captions/launch.js\` captions.

### \`02-yt-shorts.csv\` → tab \`yt-shorts\`
- One row per active carousel (~256 rows).
- Auto-generated \`yt_title\` / \`yt_description\` (with #Shorts) / \`yt_tags\`.
- Drives **scripts/youtube-upload.py --shorts**.
- Reserved carousels are excluded automatically.

### \`03-tiktok.csv\` → tab \`tiktok\`
- Same MP4 files as YT Shorts (file_slug matches the
  \`marketing-footage/social-export/youtube-shorts/<file_slug>.mp4\` path).
- TikTok captions + hashtags tuned for TT-native conventions.
- **Manual posting** — Make doesn't have a TikTok app. Status flow:
  \`pending\` → \`scheduled\` → \`posted\` + \`tt_url\`.
- Re-uses the same MP4 you uploaded to Shorts; just paste into TikTok.

## Tabs NOT in this workbook yet

- **\`linkedin\` and \`yt-longform\`** still live in the existing YouTube
  tracker sheet (it has live state — video IDs, LinkedIn statuses, scheduled
  dates — that we can't reproduce locally). Migrate them later via copy/paste
  if you want a single workbook.

## Refresh

Re-run the orchestrator any time source files change (carousels, captions,
weeks, themes):

\`\`\`
node scripts/build-workbook.js
\`\`\`

Then **re-import the affected CSVs** into the matching tab. **Don't import on
top of live status columns** (yt_video_id, tt_url, status='posted', etc.) —
those are owned by the platform pipelines after first import. Import to a
parking tab and copy/paste only the columns that should refresh
(captions, hashtags, week themes).
`;
  ensureDir(WORKBOOK);
  fs.writeFileSync(path.join(WORKBOOK, '00-README.md'), md);
  console.log(`        ${path.join(WORKBOOK, '00-README.md').replace(ROOT + '/', '')}`);
}

// ─── Main ───────────────────────────────────────────────────────────
function loadCarousels() {
  const w = {};
  for (const p of [
    path.join(ROOT, 'social/posts/data.js'),
    path.join(ROOT, 'social/posts/product-data.js'),
  ]) {
    const src = fs.readFileSync(p, 'utf8');
    new Function('window', src)(w);
  }
  return [...(w.CAROUSELS || []), ...(w.PRODUCT_CAROUSELS || [])];
}

function main() {
  console.log('Building Able Content Engine workbook …\n');

  // Pre-compute smart post-order shared by both shorts + tiktok tabs.
  const carousels = loadCarousels();
  const orderMap = computeOrder(carousels);
  console.log(`  Computed post_order for ${Object.keys(orderMap).length} carousels`);

  buildScheduleTab();
  buildShortsTab(orderMap, carousels);
  buildTikTokTab(orderMap, carousels);

  console.log('\nWriting README');
  writeReadme();
  console.log('\nDone. Output:', WORKBOOK);
  console.log('Next: see 00-README.md for import steps.');
}

main();
