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
const POSTS       = w1.POSTS       || [];
const CAROUSELS   = w1.CAROUSELS   || [];
const BRANDSCRIPT = w1.BRANDSCRIPT || [];
const REELS       = w2.REELS       || [];

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
for (const p of POSTS)       byId.set(p.id, { ...p, _kind: 'single'      });
for (const c of CAROUSELS)   byId.set(c.id, { ...c, _kind: 'carousel'    });
for (const r of REELS)       byId.set(r.id, { ...r, _kind: 'reel'        });
for (const b of BRANDSCRIPT) byId.set(b.id, { ...b, _kind: 'brandscript' });

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
  'relevant_links', 'caption_ig', 'caption_tt', 'caption_li',
  // Repurposing pipeline (each social post → blog → NotebookLM → YouTube)
  'blog_url', 'yt_short_url', 'yt_long_url', 'notebooklm_url', 'repurpose_status',
  // Posting status
  'status',
];

const rows = [];
const usedBrandscriptIds = new Set();

for (const week of WEEKS) {
  // Render the day list with the Sun BS slot appended (matches the live cadence)
  const days = [...week.days];
  const bs = BS_CADENCE[week.n];
  if (bs) days.push({ day: 'Sun', type: 'brandscript', id: bs.id, note: bs.note });

  for (const d of days) {
    const item = byId.get(d.id);
    if (item && item._kind === 'brandscript') usedBrandscriptIds.add(item.id);

    const cap = CAPTIONS[`${week.n}|${d.day}`] || {};
    const links = cap.links || 'becomeable.app';
    const captionLi = cap.li ? `${cap.li}\n\n${links}` : '';

    rows.push([
      week.n,
      d.day,
      '',                                  // post_date — set after launch date is decided
      item ? item._kind : d.type,
      d.id,
      item ? item.slug : '',
      item ? (item.theme || '') : '',
      week.theme.replace(/&amp;/g, '&'),
      d.note || '',
      cleanPunch(item),
      filenameFor(item),
      driveFolderFor(item),
      links,                               // relevant_links — default "becomeable.app", overridable per slot
      cap.ig || '',                        // caption_ig
      cap.tt || '',                        // caption_tt
      captionLi,                           // caption_li — body + appended links
      '',                                  // blog_url — Phase 3
      '',                                  // yt_short_url — Phase 4
      '',                                  // yt_long_url — Phase 4
      '',                                  // notebooklm_url — Phase 3
      '',                                  // repurpose_status — free-text tracker
      'Pending',
    ]);
  }
}

// Reserve rows: brandscript items not used in cadence
for (const b of BRANDSCRIPT) {
  if (usedBrandscriptIds.has(b.id)) continue;
  const item = { ...b, _kind: 'brandscript' };
  rows.push([
    '', '', '',
    'brandscript',
    b.id, b.slug, b.theme || '',
    `Reserve · ${b.cat || 'Uncategorized'}`,
    '',
    cleanPunch(item),
    filenameFor(item),
    driveFolderFor(item),
    'becomeable.app',  // relevant_links
    '', '', '',        // captions
    '', '', '', '', '', // repurpose pipeline
    'Reserve',
  ]);
}

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
console.log(`Brandscript used in cadence: ${usedBrandscriptIds.size} / ${BRANDSCRIPT.length}`);
console.log(`Brandscript in reserve: ${BRANDSCRIPT.length - usedBrandscriptIds.size}`);
