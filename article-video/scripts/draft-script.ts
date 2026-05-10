/**
 * Draft a script.json from an article using Claude (anthropic SDK).
 *
 * Run: ANTHROPIC_API_KEY=... npm run draft -- --article=able-content/budgeting/index.md
 *      [--slug=budgeting]               (auto-derived from filename if omitted)
 *      [--segments=6]                   (target segment count, default 6)
 *      [--theme-rotation=mixed|green|alt]
 *
 * Loads:
 *   - The article markdown
 *   - docs/notebooklm-sources/00-able-brand-spine.md (the brand voice spine)
 *   - The Thumbnail/BodyScene schema requirements (built into the prompt)
 *
 * Calls Claude Sonnet, expects JSON response, validates the schema, writes
 * videos/<slug>/script.json.
 *
 * Cost: ~$0.05-0.10 per article on claude-sonnet-4-7. Output goes through
 * a strict JSON parser; if the model returns prose around the JSON, we
 * extract the first {...} block.
 */
import Anthropic from '@anthropic-ai/sdk';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {basename, dirname, resolve} from 'node:path';

// ─── Args ────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
let articlePath: string | undefined;
let slug: string | undefined;
let segmentTarget = 6;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--article=')) articlePath = a.slice('--article='.length);
  else if (a === '--article') articlePath = argv[++i];
  else if (a.startsWith('--slug=')) slug = a.slice('--slug='.length);
  else if (a === '--slug') slug = argv[++i];
  else if (a.startsWith('--segments=')) segmentTarget = parseInt(a.slice('--segments='.length), 10);
}
if (!articlePath) {
  console.error('error: missing --article. Usage: npm run draft -- --article=able-content/budgeting/index.md');
  process.exit(1);
}
articlePath = resolve('..', articlePath); // article-video sits one dir below the article tree
if (!existsSync(articlePath)) {
  console.error(`error: ${articlePath} not found`);
  process.exit(1);
}
if (!slug) {
  // Derive slug from path: able-content/budgeting/index.md → budgeting
  const parts = articlePath.split('/');
  const idx = parts.findIndex((p) => p === 'able-content');
  slug = idx >= 0 && parts[idx + 1] ? parts[idx + 1] : basename(articlePath, '.md');
}

// ─── Load sources ────────────────────────────────────────────────────
const article = readFileSync(articlePath, 'utf8');
const brandSpinePath = resolve('../docs/notebooklm-sources/00-able-brand-spine.md');
const brandSpine = existsSync(brandSpinePath)
  ? readFileSync(brandSpinePath, 'utf8')
  : '';

if (!brandSpine) {
  console.warn('[draft] brand-spine not found; voice may drift');
}

// ─── Schema description for the model ────────────────────────────────
// We explain the schema in plain English + give a worked example. The
// model returns JSON that fits this exact shape.

const SCHEMA = `
The script.json schema:

{
  "slug": string,                         // url-safe slug
  "title": string,                        // shown on intro card; max ~60 chars
  "subtitle": string,                     // optional 1-line subtitle on intro
  "voice": "sage" | "alloy" | "nova" | ...,  // OpenAI TTS voice; default "sage"
  "intro": {
    "durationSec": 5,
    "voiceText": string,                  // 1 sentence opener; hook in 8 sec
    "spokenIntro": true
  },
  "segments": [
    {
      "id": string,                       // kebab-case, e.g. "the-floor"
      "voiceText": string,                // 2-3 narration sentences (full)
      "eyebrow": string,                  // SHORT all-caps, e.g. "RULE 1"
      "headline": string,                 // 1-2 lines on screen; use \\n for line break; wrap the punchy 1-3 word chunk in {curly braces} for the brand underline
      "subhead": string,                  // optional smaller line
      "shot": "01-dashboard"|"02-allocation-flow"|"03-plan-bills"|"04-score"|"05-coach"|"06-log-income"|"07-settings"|"08-more-menu"|"09-refer"|"10-debts"|"11-tax-view"|"12-deep-dive"|"13-tax-classify"|"14-tax-export",
      "layout": "right" | "left" | "text-only",
      "theme": "page" | "white" | "green" | "black" | "glass-dark"
    }
  ],
  "outro": {
    "durationSec": 5,
    "voiceText": "From Unable. To Able. Try it free for thirty days at becomeable.app.",
    "tagline": "Become Able.",
    "spokenOutro": true
  },
  "thumbnail": {                          // optional override for the YouTube thumbnail
    "headline": string,                   // shorter than title, max 6 words; use {} for underline
    "shot": string,                       // pick the most "money" shot
    "theme": "green" | "page"
  }
}

Voice rules (locked):
- No em dashes. Hyphens are fine.
- No exclamation points.
- "Reserve" — never "buffer" or "smoothing reserve."
- Never use "every dollar gets a job" (YNAB tagline).
- No competitor names.
- Customer is the hero. Able is the guide.
- Don't promise outcomes. "Helps you" not "guarantees."
- "Become Able." is the closing tagline only, never a CTA.
- The villain is the monthly-paycheck assumption. Not any specific company.

Layout/theme rotation rules:
- Alternate "right" and "left" so the cadence isn't monotone.
- Mix themes: page, green, glass-dark are the bread-and-butter; black for stakes; white for clean explainers.
- Pair shot to topic: voice talks about coach → 05-coach; bills → 03-plan-bills; allocation → 02-allocation-flow; score → 04-score; tax → 11-tax-view or 14-tax-export.

Headline rules:
- 2 lines max, line break with \\n.
- Wrap the 1-3 word punch in {curly braces} for the brand sharpie underline.
- Don't put articles ("a", "the") inside the {} unless they belong with the punch.
- Examples:
    "Know your\\n{floor.}"
    "Every deposit\\nfills the {floor first.}"
    "Build your {reserve}\\nbefore you spend."
`;

// ─── The prompt ──────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a video script writer for Able, an app for people whose income arrives unpredictably.

Your output is a JSON object matching the schema below. You write narration that sounds calm, specific, and brand-aligned, paired with on-screen headlines that pop. Every line must follow the locked voice rules.

${SCHEMA}

You output ONLY the JSON object. No prose before or after. No markdown fences.`;

const USER_PROMPT = `Write a script.json for a 3-4 minute YouTube video covering this article. Target ${segmentTarget} body segments (excluding intro and outro). The narration should track the article's structure but compressed to video pace.

The brand spine for voice/methodology/capabilities (treat as locked truth):
---
${brandSpine}
---

The article to summarize:
---
${article}
---

Output the JSON object only. The slug should be "${slug}".`;

// ─── Call Claude ─────────────────────────────────────────────────────
const client = new Anthropic();

console.log(`[draft] article=${articlePath}`);
console.log(`[draft] slug=${slug}, target_segments=${segmentTarget}`);
console.log(`[draft] calling claude-sonnet-4-7...`);

(async () => {
  const start = Date.now();
  const res = await client.messages.create({
    model: 'claude-sonnet-4-7',
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages: [{role: 'user', content: USER_PROMPT}],
  });
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`[draft] response in ${elapsed}s, tokens in/out: ${res.usage.input_tokens}/${res.usage.output_tokens}`);

  const text = res.content
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('\n')
    .trim();

  // Extract first JSON object — robust to model returning prose around it.
  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}');
  if (jsonStart < 0 || jsonEnd < 0) {
    console.error('[draft] could not find JSON in response:');
    console.error(text);
    process.exit(1);
  }
  const jsonStr = text.slice(jsonStart, jsonEnd + 1);

  let parsed: any;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e: any) {
    console.error('[draft] JSON parse failed:', e.message);
    console.error('--- raw response ---\n' + text);
    process.exit(1);
  }

  // Sanity checks
  const required = ['slug', 'title', 'voice', 'intro', 'segments', 'outro'];
  for (const k of required) {
    if (!(k in parsed)) {
      console.error(`[draft] missing required field: ${k}`);
      process.exit(1);
    }
  }
  if (!Array.isArray(parsed.segments) || parsed.segments.length === 0) {
    console.error('[draft] segments must be a non-empty array');
    process.exit(1);
  }

  // Force slug consistency (the model can drift)
  parsed.slug = slug;

  const dir = resolve(`videos/${slug}`);
  mkdirSync(dir, {recursive: true});
  const out = `${dir}/script.json`;
  writeFileSync(out, JSON.stringify(parsed, null, 2) + '\n');

  console.log(`[draft] wrote ${out} (${parsed.segments.length} segments)`);
  console.log(``);
  console.log(`Next:`);
  console.log(`  1. Review videos/${slug}/script.json — tweak voice/headlines as needed`);
  console.log(`  2. VIDEO=${slug} npm run tts`);
  console.log(`  3. VIDEO=${slug} npm run thumbnail`);
  console.log(`  4. VIDEO=${slug} npm run render`);
  console.log(`  Or just: npm run all`);
})();
