/**
 * Scaffold a new video folder.
 *
 * Run: npm run new -- --slug=<slug> [--title="..."] [--subtitle="..."]
 * Or:  npm run new -- <slug>            (prompts via positional)
 *
 * Creates videos/<slug>/script.json with placeholder text in every
 * field. The placeholders include guidance comments embedded as the
 * value itself ("REPLACE: …"), so as you edit you see what's expected.
 *
 * Refuses to overwrite an existing folder. Safe to re-run after fixing
 * a typo'd slug — just delete the wrong folder first.
 */
import {existsSync, mkdirSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

// ─── Parse args ──────────────────────────────────────────────────────
const argv = process.argv.slice(2);
let slug: string | undefined;
let title = 'REPLACE: Article title (max ~60 chars)';
let subtitle = 'REPLACE: One-line subtitle (or remove this field).';

for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--slug=')) slug = a.slice('--slug='.length);
  else if (a === '--slug') slug = argv[++i];
  else if (a.startsWith('--title=')) title = a.slice('--title='.length);
  else if (a === '--title') title = argv[++i];
  else if (a.startsWith('--subtitle=')) subtitle = a.slice('--subtitle='.length);
  else if (a === '--subtitle') subtitle = argv[++i];
  else if (!a.startsWith('--') && !slug) slug = a;
}

if (!slug) {
  console.error('error: missing --slug. Usage: npm run new -- --slug=freelancer-budget');
  process.exit(1);
}
if (!/^[a-z0-9-]+$/.test(slug)) {
  console.error(`error: slug "${slug}" must be lowercase letters, numbers, and hyphens only.`);
  process.exit(1);
}

// ─── Build the folder ────────────────────────────────────────────────
const dir = resolve(`videos/${slug}`);
if (existsSync(dir)) {
  console.error(`error: ${dir} already exists. Delete it first or pick a different slug.`);
  process.exit(1);
}
mkdirSync(dir, {recursive: true});

// ─── Template script ─────────────────────────────────────────────────
// 4 body segments by default — that's what a 3-4 min video looks like
// with this pacing. Add or remove segments freely. Mix layouts and
// themes so the cadence stays visual.

const tpl = {
  slug,
  title,
  subtitle,
  voice: 'sage',
  intro: {
    durationSec: 5,
    voiceText: 'REPLACE: One opening sentence. Hook in 8 seconds or less.',
    spokenIntro: true,
  },
  segments: [
    {
      id: 'segment-1',
      voiceText: 'REPLACE: 2-3 sentences of narration for this scene. The visible headline below appears while this voice line plays.',
      eyebrow: 'EYEBROW',
      headline: 'On-screen line\nwith {underlined} chunk.',
      subhead: 'Optional smaller line under the headline.',
      shot: '01-dashboard',
      layout: 'right',
      theme: 'page',
    },
    {
      id: 'segment-2',
      voiceText: 'REPLACE: 2-3 sentences. Pair the narration topic with the chosen shot — when voice talks about bills, show the bills shot.',
      eyebrow: 'EYEBROW',
      headline: '{Punchy} headline\non this scene.',
      subhead: 'Optional subhead.',
      shot: '03-plan-bills',
      layout: 'left',
      theme: 'green',
    },
    {
      id: 'segment-3',
      voiceText: 'REPLACE: 2-3 sentences.',
      eyebrow: 'EYEBROW',
      headline: 'Short on-screen\n{takeaway.}',
      shot: '02-allocation-flow',
      layout: 'right',
      theme: 'glass-dark',
    },
    {
      id: 'segment-4',
      voiceText: 'REPLACE: closing sentence or two before the outro card. Lands the takeaway.',
      eyebrow: 'EYEBROW',
      headline: 'Final on-screen\n{line.}',
      shot: '04-score',
      layout: 'left',
      theme: 'page',
    },
  ],
  outro: {
    durationSec: 5,
    voiceText: 'From Unable. To Able. Try it free for thirty days at becomeable.app.',
    tagline: 'Become Able.',
    spokenOutro: true,
  },
} as const;

const out = `${dir}/script.json`;
writeFileSync(out, JSON.stringify(tpl, null, 2) + '\n');

console.log(`[new-video] scaffolded ${out}`);
console.log('');
console.log('Next:');
console.log(`  1. Edit videos/${slug}/script.json — fill in every "REPLACE:" field.`);
console.log(`     • voiceText: what the narrator says (full sentences)`);
console.log(`     • headline:  what's on screen (short, brand-aligned, {underline} the keyword)`);
console.log(`     • shot:      one of marketing-footage/product-shots/<slug>/`);
console.log(`     • layout:    "right" | "left" | "text-only"`);
console.log(`     • theme:     "page" | "white" | "green" | "black" | "glass-dark"`);
console.log(`  2. VIDEO=${slug} npm run tts`);
console.log(`  3. VIDEO=${slug} npm run render`);
