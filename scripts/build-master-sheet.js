#!/usr/bin/env node
/**
 * Build the master schedule CSV for Able social posting.
 *
 * Reads:
 *   social/posts/data.js   — POSTS, CAROUSELS, BRANDSCRIPT
 *   social/reels/data.js   — REELS
 *   social/index.html      — WEEKS array + BS_CADENCE (Sun reinforcement)
 *
 * Writes:
 *   marketing-footage/social-export/_master-sheet.csv
 *
 * Each row = one cadence slot OR one reserve item. Columns:
 *   week, day, post_date, format, id, slug, theme, week_theme,
 *   notes, punch, filename, drive_folder,
 *   caption_ig, caption_tt, caption_li, status
 *
 * To use: in the existing "1. Master Sheet Generation" Google Sheet,
 * File → Import → Upload the CSV → "Replace data starting at A1".
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// Launch date — anchors the post_date column. W1 Mon = LAUNCH_DATE.
// Override per-run with: LAUNCH_DATE=2026-05-11 node scripts/build-master-sheet.js
// Default: the next Monday on or after today (so re-running mid-week doesn't
// retroactively shift dates into the past).
function nextMondayOnOrAfter(d) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  const day = c.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const offset = day === 1 ? 0 : (8 - day) % 7;
  c.setDate(c.getDate() + offset);
  return c;
}
const LAUNCH_DATE = process.env.LAUNCH_DATE
  ? new Date(process.env.LAUNCH_DATE + 'T00:00:00')
  : nextMondayOnOrAfter(new Date());

const DAY_OFFSET = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
function postDateFor(weekN, dayName) {
  const off = DAY_OFFSET[dayName];
  if (off === undefined || !weekN) return '';
  const d = new Date(LAUNCH_DATE);
  d.setDate(d.getDate() + (weekN - 1) * 7 + off);
  return d.toISOString().slice(0, 10);
}

// ─────────────────────────────────────────────────────────────────────
// Load data sources
// ─────────────────────────────────────────────────────────────────────
function loadDataJs(p) {
  const w = {};
  new Function('window', fs.readFileSync(p, 'utf8'))(w);
  return w;
}

const w1 = loadDataJs(path.join(ROOT, 'social/posts/data.js'));
const w2 = loadDataJs(path.join(ROOT, 'social/reels/data.js'));
const w3 = loadDataJs(path.join(ROOT, 'social/posts/product-data.js'));
const POSTS             = w1.POSTS             || [];
const CAROUSELS         = w1.CAROUSELS         || [];
const BRANDSCRIPT       = w1.BRANDSCRIPT       || [];
const REELS             = w2.REELS             || [];
const PRODUCT_POSTS     = w3.PRODUCT_POSTS     || [];
const PRODUCT_CAROUSELS = w3.PRODUCT_CAROUSELS || [];

// Captions per cadence slot, keyed by `${week}|${day}` (e.g. "1|Mon").
// Each record: { ig, tt, li, links? }. `li` is the LinkedIn body without the
// trailing URL — this script appends `\n\n{relevant_links}` automatically.
// `links` (optional) overrides the relevant_links column for that slot.
function loadCaptionMap(p) {
  if (!fs.existsSync(p)) return {};
  const w = {};
  new Function('window', fs.readFileSync(p, 'utf8'))(w);
  return w.LAUNCH_CAPTIONS || {};
}
const CAPTIONS = loadCaptionMap(path.join(ROOT, 'social/captions/launch.js'));

// Extract WEEKS + BS_CADENCE literals from index.html
const html = fs.readFileSync(path.join(ROOT, 'social/index.html'), 'utf8');

function extractLiteral(src, decl) {
  const i = src.indexOf(decl);
  if (i === -1) throw new Error(`not found: ${decl}`);
  // Find matching closing for the opening bracket/brace right after `=`
  const eq = src.indexOf('=', i) + 1;
  // Skip whitespace
  let k = eq;
  while (/\s/.test(src[k])) k++;
  const open = src[k];
  const close = open === '[' ? ']' : open === '{' ? '}' : null;
  if (!close) throw new Error(`unexpected literal start: ${open}`);
  let depth = 0;
  let inString = null;
  let escape = false;
  for (let j = k; j < src.length; j++) {
    const ch = src[j];
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (inString) { if (ch === inString) inString = null; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { inString = ch; continue; }
    // Skip line comments
    if (ch === '/' && src[j+1] === '/') { j = src.indexOf('\n', j); if (j === -1) j = src.length; continue; }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return src.slice(k, j + 1);
    }
  }
  throw new Error(`unterminated literal: ${decl}`);
}

const WEEKS       = eval('(' + extractLiteral(html, 'const WEEKS')       + ')');
const BS_CADENCE  = eval('(' + extractLiteral(html, 'const BS_CADENCE')  + ')');

// ─────────────────────────────────────────────────────────────────────
// Lookup by id (combines all 4 collections)
// ─────────────────────────────────────────────────────────────────────
const byId = new Map();
for (const p of POSTS)             byId.set(p.id, { ...p, _kind: 'single'      });
for (const p of PRODUCT_POSTS)     byId.set(p.id, { ...p, _kind: 'single'      });
for (const c of CAROUSELS)         byId.set(c.id, { ...c, _kind: 'carousel'    });
for (const c of PRODUCT_CAROUSELS) byId.set(c.id, { ...c, _kind: 'carousel'    });
for (const r of REELS)             byId.set(r.id, { ...r, _kind: 'reel'        });
for (const b of BRANDSCRIPT)       byId.set(b.id, { ...b, _kind: 'brandscript' });

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────
function cleanPunch(item) {
  if (!item) return '';
  if (item._kind === 'reel') {
    // Use the first beat as preview
    const first = (item.beats || [])[0];
    return cleanText(first ? first.text : '');
  }
  if (item._kind === 'carousel') {
    // Use cover slide's punch
    const cover = (item.slides || [])[0];
    return cleanText(cover ? cover.punch : '');
  }
  // single, brandscript
  const muted = item.muted ? cleanText(item.muted) + ' / ' : '';
  return muted + cleanText(item.punch || '');
}

function cleanText(s) {
  return (s || '')
    .replace(/\{([^}]+)\}/g, '$1')   // strip squiggle markers
    .replace(/\n/g, ' / ')           // line breaks → " / "
    .trim();
}

function filenameFor(item) {
  if (!item) return '';
  if (item._kind === 'single' || item._kind === 'brandscript') return `${item.id}_${item.slug}.png`;
  if (item._kind === 'carousel')                                 return `${item.id}_${item.slug}`;     // folder
  if (item._kind === 'reel')                                     return `${item.id}_${item.slug}.mp4`;
  return '';
}

function driveFolderFor(item) {
  if (!item) return '';
  if (item._kind === 'single' || item._kind === 'brandscript') return 'social-export/singles';
  if (item._kind === 'carousel')                                 return `social-export/carousels/${item.id}_${item.slug}`;
  if (item._kind === 'reel')                                     return 'social-export/reels';
  return '';
}

// CSV — wrap fields with commas, quotes, or newlines in double quotes; escape internal quotes
function csvCell(v) {
  const s = (v == null ? '' : String(v));
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}
function csvRow(arr) { return arr.map(csvCell).join(','); }

// Wrap a value as an inline text-formula `="..."` so Google Sheets imports it as text
// rather than coercing leading zeros / leading apostrophes. Used for IDs like "09" and
// punch previews like "'Save more' / isn't a plan."
function asTextFormula(s) {
  return '="' + String(s).replace(/"/g, '""') + '"';
}

// Decide whether a cell needs the text-formula wrapping
function preserveAsText(value, columnName) {
  const s = String(value || '');
  if (s === '') return false;
  // IDs that are pure-numeric strings (like "09") — Sheets strips leading zero
  if (columnName === 'id' && /^\d+$/.test(s)) return true;
  // Any text starting with `'` — Sheets strips it (text-format escape)
  if (s.startsWith("'")) return true;
  return false;
}

// ─────────────────────────────────────────────────────────────────────
// Build rows
// ─────────────────────────────────────────────────────────────────────
const HEADERS = [
  // Schedule
  'week', 'day', 'post_date',
  // Asset
  'format', 'id', 'slug', 'theme', 'week_theme', 'notes', 'punch',
  'filename', 'drive_folder',
  // Captions per platform — relevant_links feeds into caption_li for LinkedIn
  // caption_fb auto-derived from caption_ig (swap "Link in bio." for URL)
  'relevant_links', 'caption_ig', 'caption_tt', 'caption_li', 'caption_fb',
  // Repurposing pipeline (each social post → blog → NotebookLM → YouTube)
  'blog_url', 'yt_short_url', 'yt_long_url', 'notebooklm_url', 'repurpose_status',
  // Posting status (column W after caption_fb insertion)
  'status',
  // Per-platform result URLs (Make scenario writes back here)
  'ig_url', 'fb_url', 'tt_url', 'li_url', 'posted_at',
];

// Items approved 2026-05-21 to be promoted from library to schedule.
// They fill the first N gaps left by removing TikTok-slideshow items.
const PROMOTED_TO_SCHEDULE = [
  '51', '57', '60', '71',
  'P04', 'P06', 'P08', 'P09', 'P12',
  'P16', 'P17', 'P18', 'P19', 'P21', 'P23', 'P24', 'P26',
  'R53',
];

const rows = [];
const usedIds = new Set();
const freedCarouselSlots = [];  // {weekN, dayName, weekTheme} for each removed TT-slideshow

for (const week of WEEKS) {
  // Render the day list with the Sun BS slot appended (matches the live cadence)
  const days = [...week.days];
  const bs = BS_CADENCE[week.n];
  if (bs) days.push({ day: 'Sun', type: 'brandscript', id: bs.id, note: bs.note });

  for (const d of days) {
    const item = byId.get(d.id);
    // Skip TikTok slideshows entirely — they live in the 02-yt-short sheet, not IG cadence
    if (item && item._kind === 'carousel') {
      freedCarouselSlots.push({ weekN: week.n, dayName: d.day, weekTheme: week.theme.replace(/&amp;/g, '&') });
      continue;
    }
    if (item) usedIds.add(item.id);

    const cap = CAPTIONS[`${week.n}|${d.day}`] || {};
    const links = cap.links || 'becomeable.app/get-able';
    const captionLi = cap.li ? `${cap.li}\n\n${links}` : '';
    // Facebook caption: same body as IG, but Facebook allows clickable URLs in
    // posts (unlike Instagram), so swap "Link in bio." for the relevant URL.
    const captionFb = cap.ig ? cap.ig.replace(/Link in bio\./g, links) : '';

    rows.push([
      week.n,
      d.day,
      postDateFor(week.n, d.day),          // post_date computed from LAUNCH_DATE
      item ? item._kind : d.type,
      d.id,
      item ? item.slug : '',
      item ? (item.theme || '') : '',
      week.theme.replace(/&amp;/g, '&'),
      d.note || '',
      cleanPunch(item),
      filenameFor(item),
      driveFolderFor(item),
      links,                               // relevant_links — default "becomeable.app/get-able", overridable per slot
      cap.ig || '',                        // caption_ig
      cap.tt || '',                        // caption_tt
      captionLi,                           // caption_li — body + appended links
      captionFb,                           // caption_fb — IG body with URL inlined
      '',                                  // blog_url — Phase 3
      '',                                  // yt_short_url — Phase 4
      '',                                  // yt_long_url — Phase 4
      '',                                  // notebooklm_url — Phase 3
      '',                                  // repurpose_status — free-text tracker
      'Pending',
      '', '', '', '', '',                  // ig_url, fb_url, tt_url, li_url, posted_at — Make populates these
    ]);
  }
}

// Promote approved items into the freed TikTok-slideshow slots (chronological order)
for (let i = 0; i < PROMOTED_TO_SCHEDULE.length && i < freedCarouselSlots.length; i++) {
  const slot = freedCarouselSlots[i];
  const id = PROMOTED_TO_SCHEDULE[i];
  const item = byId.get(id);
  if (!item) {
    console.warn(`PROMOTED id ${id} not found in any library — skipping`);
    continue;
  }
  usedIds.add(id);
  const cap = CAPTIONS[`${slot.weekN}|${slot.dayName}`] || {};
  const links = cap.links || 'becomeable.app/get-able';
  const captionLi = cap.li ? `${cap.li}\n\n${links}` : '';
  const captionFb = cap.ig ? cap.ig.replace(/Link in bio\./g, links) : '';
  rows.push([
    slot.weekN, slot.dayName, postDateFor(slot.weekN, slot.dayName),
    item._kind, id, item.slug, item.theme || '',
    slot.weekTheme,
    `Promoted from library 2026-05-21`,
    cleanPunch(item),
    filenameFor(item),
    driveFolderFor(item),
    links,
    cap.ig || '',
    cap.tt || '',
    captionLi,
    captionFb,
    '', '', '', '', '',
    'Pending',
    '', '', '', '', '',
  ]);
}

// Reserve rows: active items not used in cadence (excluding TikTok slideshows
// — they have their own sheet — and Launch L## items which live in the Launch sheet)
const RESERVE_POOLS = [
  { kind: 'single',      list: POSTS         },
  { kind: 'single',      list: PRODUCT_POSTS },
  { kind: 'reel',        list: REELS         },
  { kind: 'brandscript', list: BRANDSCRIPT   },
];
for (const { kind, list } of RESERVE_POOLS) {
  for (const e of list) {
    if (usedIds.has(e.id)) continue;
    // L## launch items live in the dedicated Launch sheet, not the cadence
    if (e.cat === 'Launch') continue;
    const item = { ...e, _kind: kind };
    rows.push([
      '', '', '',
      kind,
      e.id, e.slug, e.theme || '',
      `Reserve · ${e.cat || 'Uncategorized'}`,
      '',
      cleanPunch(item),
      filenameFor(item),
      driveFolderFor(item),
      'becomeable.app/get-able',  // relevant_links
      '', '', '', '',    // caption_ig, caption_tt, caption_li, caption_fb
      '', '', '', '', '', // repurpose pipeline
      'Reserve',
      '', '', '', '', '', // ig_url, fb_url, tt_url, li_url, posted_at
    ]);
  }
}

// ─────────────────────────────────────────────────────────────────────
// Sort: scheduled rows by post_date asc, reserve rows last
// ─────────────────────────────────────────────────────────────────────
rows.sort((a, b) => {
  const aRes = a[22] === 'Reserve';
  const bRes = b[22] === 'Reserve';
  if (aRes !== bRes) return aRes ? 1 : -1;          // reserves to bottom
  return String(a[2]).localeCompare(String(b[2])); // post_date asc (YYYY-MM-DD)
});

// ─────────────────────────────────────────────────────────────────────
// Write CSV
// ─────────────────────────────────────────────────────────────────────
// Apply text-formula wrapping to cells that would otherwise be coerced by Sheets
// (numeric strings with leading zeros, strings starting with `'`)
const protectedRows = rows.map(row =>
  row.map((v, i) => preserveAsText(v, HEADERS[i]) ? asTextFormula(v) : v)
);

const outPath = path.join(ROOT, 'marketing-footage/social-export/_master-sheet.csv');
const csv = [csvRow(HEADERS), ...protectedRows.map(csvRow)].join('\n') + '\n';
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, csv);

// Stats
const fmt = rows.reduce((a, r) => (a[r[3]] = (a[r[3]] || 0) + 1, a), {});
console.log(`Wrote ${rows.length} rows to ${path.relative(ROOT, outPath)}`);
console.log('By format:');
Object.entries(fmt).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
const reserveCount = rows.filter(r => r[22] === 'Reserve').length;
console.log(`Cadence rows: ${rows.length - reserveCount}  ·  Reserve rows: ${reserveCount}`);
const brandscriptUsed = [...usedIds].filter(id => BRANDSCRIPT.some(b => b.id === id)).length;
console.log(`Brandscript used in cadence: ${brandscriptUsed} / ${BRANDSCRIPT.length}`);
