/**
 * Run TTS + render + thumbnail for every video that's missing them.
 *
 * Run: npm run all
 * Or:  npm run all -- --force          (rebuild everything)
 * Or:  npm run all -- --only=slug,...  (only these videos)
 *
 * Skips any script.json that still contains "REPLACE:" — protects
 * against running TTS on a half-edited template (which would burn API
 * credits on placeholder text).
 *
 * Steps per video:
 *   1. If script contains "REPLACE:" → skip with warning.
 *   2. If audio missing OR --force → run TTS.
 *   3. If thumbnail missing OR --force → render thumbnail.
 *   4. If out.mp4 missing OR --force → render video.
 */
import {execSync} from 'node:child_process';
import {existsSync, readdirSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const argv = process.argv.slice(2);
const force = argv.includes('--force');
const onlyArg = argv.find((a) => a.startsWith('--only='));
const only = onlyArg
  ? new Set(onlyArg.slice('--only='.length).split(',').map((s) => s.trim()))
  : null;

const VIDEOS_DIR = resolve('videos');
const slugs = readdirSync(VIDEOS_DIR, {withFileTypes: true})
  .filter((e) => e.isDirectory() && !e.name.startsWith('_'))
  .map((e) => e.name)
  .filter((s) => (only ? only.has(s) : true))
  .sort();

if (slugs.length === 0) {
  console.log('[build-all] no videos found in videos/');
  process.exit(0);
}

console.log(`[build-all] checking ${slugs.length} video(s): ${slugs.join(', ')}`);

let ranTts = 0;
let ranThumb = 0;
let ranVideo = 0;
let skipped = 0;

for (const slug of slugs) {
  const dir = `videos/${slug}`;
  const scriptPath = `${dir}/script.json`;
  if (!existsSync(scriptPath)) {
    console.log(`  [${slug}] no script.json — skipping`);
    skipped++;
    continue;
  }
  const raw = readFileSync(scriptPath, 'utf8');
  if (raw.includes('REPLACE:')) {
    console.log(`  [${slug}] still has REPLACE: placeholders — skipping (edit the script first)`);
    skipped++;
    continue;
  }

  const audioPath = `public/audio/${slug}.mp3`;
  const thumbPath = `${dir}/thumbnail.png`;
  const videoPath = `${dir}/out.mp4`;

  console.log(`\n[${slug}]`);

  // 1. TTS
  if (force || !existsSync(audioPath)) {
    console.log(`  → tts`);
    execSync(`VIDEO=${slug} npm run tts`, {stdio: 'inherit'});
    ranTts++;
  } else {
    console.log(`  ✓ audio exists (${audioPath})`);
  }

  // 2. Thumbnail
  if (force || !existsSync(thumbPath)) {
    console.log(`  → thumbnail`);
    execSync(
      `npx remotion still src/index.ts Thumbnail ${thumbPath} --props=${scriptPath} --log=warn`,
      {stdio: 'inherit'},
    );
    ranThumb++;
  } else {
    console.log(`  ✓ thumbnail exists (${thumbPath})`);
  }

  // 3. Video
  if (force || !existsSync(videoPath)) {
    console.log(`  → render`);
    execSync(`VIDEO=${slug} npm run render`, {stdio: 'inherit'});
    ranVideo++;
  } else {
    console.log(`  ✓ video exists (${videoPath})`);
  }
}

console.log(``);
console.log(`[build-all] done — tts:${ranTts} thumb:${ranThumb} video:${ranVideo} skipped:${skipped}`);
