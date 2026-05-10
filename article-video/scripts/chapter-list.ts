/**
 * Print YouTube-format chapter timestamps for a script.json.
 *
 * Run: VIDEO=<slug> npm run chapters
 *      npm run chapters -- --slug=<slug>
 *
 * Reads videos/<slug>/script.json (after TTS has filled in durationSec
 * for each segment), computes cumulative timestamps, and prints the
 * block ready to paste into a YouTube description.
 *
 * Output format:
 *   00:00 Intro
 *   00:07 The problem
 *   00:23 The basics
 *   ...
 *   01:30 Outro
 *
 * Eyebrow text becomes the chapter label; falls back to segment id.
 * YouTube requires: at least 3 chapters, first must be 00:00, each at
 * least 10 seconds long.
 */
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const slug = process.env.VIDEO ?? process.argv.slice(2).find((a) => !a.startsWith('--')) ??
  process.argv.find((a) => a.startsWith('--slug='))?.slice('--slug='.length);

if (!slug) {
  console.error('error: set VIDEO=<slug> or pass --slug=<slug>');
  process.exit(1);
}

const path = resolve(`videos/${slug}/script.json`);
const script = JSON.parse(readFileSync(path, 'utf8'));

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

let t = 0;
const lines: string[] = [];
lines.push(`${fmt(t)} Intro`);
t += script.intro.durationSec ?? 5;

for (const seg of script.segments) {
  // Title-case the eyebrow for the chapter label
  const label = (seg.eyebrow ?? seg.id)
    .split(/\s+/)
    .map((w: string) => w[0]?.toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
  lines.push(`${fmt(t)} ${label}`);
  t += seg.durationSec ?? 10;
}

lines.push(`${fmt(t)} Outro`);

console.log(lines.join('\n'));
