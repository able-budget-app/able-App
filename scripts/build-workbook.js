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

// ─── Tab 2: YT Shorts (run build-shorts-sheet.js + copy output) ───────
function buildShortsTab() {
  console.log('[2/3] YT Shorts tab — invoking build-shorts-sheet.js');
  execSync(`node "${path.join(__dirname, 'build-shorts-sheet.js')}"`, {
    stdio: ['ignore', 'pipe', 'inherit'],
    env: process.env,
  });
  const src = path.join(ROOT, 'docs/youtube-shorts-tracker.csv');
  const dst = path.join(WORKBOOK, '02-yt-shorts.csv');
  ensureDir(WORKBOOK);
  fs.copyFileSync(src, dst);
  const rows = fs.readFileSync(dst, 'utf8').split('\n').filter(l => l.trim()).length - 1;
  console.log(`        ${dst.replace(ROOT + '/', '')} (${rows} rows)`);
}

// ─── Tab 3: TikTok manual tracker ─────────────────────────────────────
// TikTok has no Make app, so this tab tracks manual posting. Same MP4
// files as YT Shorts (we re-use the carousels-to-shorts.py output), but
// TikTok captions/hashtags follow TT-native conventions.
function buildTikTokTab() {
  console.log('[3/3] TikTok tab — building from active carousels');

  // Load active carousels (mirrors build-shorts-sheet.js loader)
  const w = {};
  for (const p of [
    path.join(ROOT, 'social/posts/data.js'),
    path.join(ROOT, 'social/posts/product-data.js'),
  ]) {
    const src = fs.readFileSync(p, 'utf8');
    new Function('window', src)(w);
  }
  const carousels = [...(w.CAROUSELS || []), ...(w.PRODUCT_CAROUSELS || [])];

  // Pull launch.js captions for the TT-specific text per cadence week|day
  const captionsSrc = fs.readFileSync(path.join(ROOT, 'social/captions/launch.js'), 'utf8');
  const capsScope = {};
  new Function('window', captionsSrc)(capsScope);
  const captions = capsScope.LAUNCH_CAPTIONS || {};

  // Index existing TT captions by carousel ID (find any cadence slot whose comment mentions the ID)
  // We just want a starter caption — Paul can refine per row.
  const ttCaptionByCarousel = {};
  for (const slotKey of Object.keys(captions)) {
    const slot = captions[slotKey];
    if (!slot.tt) continue;
    // Slot may not name a carousel directly; we'll match via the comment pattern in raw source.
    // Simpler: skip the match — Paul will fill in or we auto-generate.
  }

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
      '#variableincome',
      '#freelancetok',
      '#1099',
      '#freelancer',
      '#smallbiz',
      '#budgetingtips',
      '#fyp',
    ]);
    if (s0.eyebrow) tags.add('#' + s0.eyebrow.toLowerCase().replace(/[^a-z0-9]/g, ''));
    return [...tags].slice(0, 8).join(' ');
  }

  const headers = [
    'file_slug',
    'id',
    'slug',
    'status',          // pending → scheduled → posted
    'tt_caption',      // hook + tag line + hashtags (TikTok format)
    'tt_hashtags',     // separate for analytics
    'tt_scheduled_date',
    'tt_url',          // filled after posting
    'tt_views',        // optional — manual stat tracking
    'notes',
  ];

  const rows = [headers];
  for (const c of carousels) {
    const fileSlug = `${c.id}_${c.slug}`;
    const hook = hookOf(c);
    const hashtags = ttHashtagsFor(c);
    const caption = `${hook}\n\n${hashtags}`;
    rows.push([
      fileSlug,
      c.id,
      c.slug || '',
      'pending',
      caption,
      hashtags,
      '',                                       // tt_scheduled_date
      '',                                       // tt_url
      '',                                       // tt_views
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
function main() {
  console.log('Building Able Content Engine workbook …\n');
  buildScheduleTab();
  buildShortsTab();
  buildTikTokTab();
  console.log('\nWriting README');
  writeReadme();
  console.log('\nDone. Output:', WORKBOOK);
  console.log('Next: see 00-README.md for import steps.');
}

main();
