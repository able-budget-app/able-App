#!/usr/bin/env node
/**
 * Generate the YouTube Shorts tracker CSV from active carousels.
 *
 * Reads:   social/posts/data.js  (window.CAROUSELS — active only, not RESERVED)
 *          social/posts/product-data.js  (window.PRODUCT_CAROUSELS)
 *
 * Writes:  docs/youtube-shorts-tracker.csv
 *
 * Each row pairs a carousel with auto-generated YouTube metadata:
 *   - file_slug (the MP4 stem, e.g. C50_never-you — matches export-social.py + carousels-to-shorts.py output)
 *   - id, slug (the carousel's data.js id + slug)
 *   - status (defaults to 'pending'; flip to 'ready-to-upload' when ready)
 *   - yt_title (slide-1 punch cleaned, capped to ~80 chars + Able tag)
 *   - yt_description (slide-1 hook + 5 features pitch + CTA + #Shorts hashtags)
 *   - yt_tags (comma-separated, drawn from eyebrow + theme + topic)
 *   - youtube_video_id, youtube_url, yt_published_date (filled by uploader)
 *
 * Usage:
 *   node scripts/build-shorts-sheet.js
 *
 * Import the resulting CSV into a Google Sheet to drive
 * scripts/youtube-upload.py --shorts.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// Load data.js + product-data.js inside a fake window scope (mirrors build-master-sheet.js).
function loadCarousels() {
  const w = {};
  for (const p of [
    path.join(ROOT, 'social/posts/data.js'),
    path.join(ROOT, 'social/posts/product-data.js'),
  ]) {
    const src = fs.readFileSync(p, 'utf8');
    new Function('window', src)(w);
  }
  const active = (w.CAROUSELS || []);
  const product = (w.PRODUCT_CAROUSELS || []);
  return [...active, ...product];
}

// Strip {highlight} braces, collapse \n to space, condense whitespace.
function cleanText(s) {
  if (!s) return '';
  return s
    .replace(/\{([^}]*)\}/g, '$1')
    .replace(/\\n/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Pull slide-1 punch + muted into a single-line hook.
function carouselHook(c) {
  const s0 = (c.slides || [])[0] || {};
  const muted = cleanText(s0.muted);
  const punch = cleanText(s0.punch);
  if (muted && punch) return `${muted} ${punch}`;
  return punch || muted || c.slug || c.id;
}

// Title: hook cleaned + cap. YouTube hard cap is 100 chars; we cap at 85 to leave room for engagement.
function titleFor(c) {
  let t = carouselHook(c);
  if (t.length > 85) t = t.slice(0, 82) + '...';
  return t;
}

// Tags: drawn from eyebrow + theme + recurring hashtags. Lowercase, deduped.
function tagsFor(c) {
  const base = new Set([
    'budgeting',
    'variable income',
    'inconsistent income',
    'freelancer',
    'self employed',
    'floor first',
    'able app',
    'personal finance',
    '1099',
  ]);
  const s0 = (c.slides || [])[0] || {};
  if (s0.eyebrow) base.add(s0.eyebrow.toLowerCase());
  if (c.theme) base.add(c.theme.toLowerCase());
  // Slug words can hint at extra tags
  for (const w of (c.slug || '').split('-')) {
    if (w.length > 3) base.add(w.toLowerCase());
  }
  return [...base].slice(0, 25).join(',');
}

// Description: hook + brand block + #Shorts hashtags. YouTube needs #Shorts in title or
// description to surface the upload as a Short.
function descriptionFor(c) {
  const hook = carouselHook(c);
  const hashTags = [
    '#Shorts',
    '#Budgeting',
    '#VariableIncome',
    '#Freelancer',
    '#1099',
    '#FloorFirst',
    '#InconsistentIncome',
    '#PersonalFinance',
    '#SelfEmployed',
    '#FreelanceTok',
  ];
  return [
    hook,
    '',
    'Built for the way you actually get paid. Floor-First Budgeting for variable income.',
    '',
    'Try Able free for 30 days: becomeable.app/get-able',
    '',
    hashTags.join(' '),
  ].join('\n');
}

// CSV field escape per RFC 4180.
function csvCell(v) {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function main() {
  const carousels = loadCarousels();
  const headers = [
    'file_slug',
    'id',
    'slug',
    'status',
    'yt_title',
    'yt_description',
    'yt_tags',
    'youtube_video_id',
    'youtube_url',
    'yt_published_date',
    'notes',
  ];

  const rows = carousels.map(c => {
    const fileSlug = `${c.id}_${c.slug}`;
    return [
      fileSlug,
      c.id,
      c.slug || '',
      'pending',
      titleFor(c),
      descriptionFor(c),
      tagsFor(c),
      '',                     // youtube_video_id (uploader fills)
      '',                     // youtube_url      (uploader fills)
      '',                     // yt_published_date (uploader fills)
      `${(c.slides || []).length} slides`,
    ];
  });

  const csv = [headers, ...rows]
    .map(row => row.map(csvCell).join(','))
    .join('\n') + '\n';

  const outPath = path.join(ROOT, 'docs/youtube-shorts-tracker.csv');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, csv);

  console.log(`Wrote ${rows.length} rows to ${path.relative(ROOT, outPath)}`);
  console.log('');
  console.log('Next steps:');
  console.log('  1. Import this CSV into a fresh Google Sheet');
  console.log('  2. Flip status from "pending" to "ready-to-upload" on rows to publish');
  console.log('  3. Run: python3 scripts/youtube-upload.py --shorts --sheet-id <ID>');
}

main();
