/**
 * Generate narration for an article video using OpenAI TTS.
 *
 * Run: VIDEO=budgeting npm run tts
 *
 * Reads videos/<VIDEO>/script.json, concatenates all narration text
 * (intro + segment voiceText + outro), calls OpenAI's tts-1 / gpt-4o-mini-tts,
 * writes public/audio/<VIDEO>.mp3, then probes the duration with ffprobe
 * and writes per-segment durationSec back into script.json.
 *
 * Per-segment timing strategy: render each segment's voice separately and
 * use that segment's actual duration. Avoids cross-segment audio bleed
 * and gives Remotion exact timing for the visual scene cuts.
 *
 * Required env: OPENAI_API_KEY.
 */
import OpenAI from 'openai';
import {execSync} from 'node:child_process';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {dirname, resolve} from 'node:path';

const VIDEO = process.env.VIDEO;
if (!VIDEO) {
  console.error('error: set VIDEO env (e.g. VIDEO=budgeting npm run tts)');
  process.exit(1);
}

const SCRIPT_PATH = resolve(`videos/${VIDEO}/script.json`);
const AUDIO_DIR = resolve('public/audio');
const PER_SEG_DIR = resolve(`public/audio/${VIDEO}-segments`);
mkdirSync(AUDIO_DIR, {recursive: true});
mkdirSync(PER_SEG_DIR, {recursive: true});

type Script = {
  slug: string;
  title: string;
  subtitle?: string;
  voiceFile?: string;
  voice?: string; // e.g. 'sage', 'alloy'. Default: sage.
  totalSeconds?: number;
  intro: {durationSec?: number; voiceText?: string; spokenIntro?: boolean};
  outro: {durationSec?: number; voiceText?: string; tagline?: string; spokenOutro?: boolean};
  segments: Array<{
    id: string;
    durationSec?: number;
    voiceText: string; // narration text for this scene
    headline: string;
    subhead?: string;
    shot?: string;
    layout?: string;
    theme?: string;
    eyebrow?: string;
  }>;
};

const script: Script = JSON.parse(readFileSync(SCRIPT_PATH, 'utf8'));
const voice = script.voice ?? 'sage';

const client = new OpenAI();

// Helper: render one block of text to mp3 + return its duration.
async function render(text: string, outPath: string): Promise<number> {
  // OpenAI's TTS API. Model 'gpt-4o-mini-tts' supports steerability via
  // the `instructions` field; tts-1 is faster + cheaper, no instructions.
  const res = await client.audio.speech.create({
    model: 'gpt-4o-mini-tts',
    voice: voice as any,
    input: text,
    instructions:
      'Speak calmly and clearly. Warm but not hype-y. No exclamation points. Conversational pace, slightly slower than typical narration. Pause briefly between sentences.',
    response_format: 'mp3',
  });
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(outPath, buf);
  // Probe duration with ffprobe
  const probe = execSync(
    `ffprobe -v error -show_entries format=duration -of default=nokey=1:noprint_wrappers=1 "${outPath}"`,
  )
    .toString()
    .trim();
  return parseFloat(probe);
}

(async () => {
  console.log(`[tts] video=${VIDEO} voice=${voice}`);

  // Build per-segment audio files. Skip intro/outro audio if their
  // spokenIntro/spokenOutro flag is false (visual-only beats).
  const parts: Array<{file: string; sec: number; id: string}> = [];

  if (script.intro.voiceText && script.intro.spokenIntro !== false) {
    const out = `${PER_SEG_DIR}/00-intro.mp3`;
    const sec = await render(script.intro.voiceText, out);
    script.intro.durationSec = sec;
    parts.push({file: out, sec, id: 'intro'});
    console.log(`  [intro] ${sec.toFixed(2)}s`);
  } else {
    script.intro.durationSec = script.intro.durationSec ?? 5;
    console.log(`  [intro] (visual only) ${script.intro.durationSec}s`);
  }

  for (let i = 0; i < script.segments.length; i++) {
    const seg = script.segments[i];
    const out = `${PER_SEG_DIR}/${String(i + 1).padStart(2, '0')}-${seg.id}.mp3`;
    const sec = await render(seg.voiceText, out);
    seg.durationSec = sec;
    parts.push({file: out, sec, id: seg.id});
    console.log(`  [${seg.id}] ${sec.toFixed(2)}s`);
  }

  if (script.outro.voiceText && script.outro.spokenOutro !== false) {
    const out = `${PER_SEG_DIR}/99-outro.mp3`;
    const sec = await render(script.outro.voiceText, out);
    script.outro.durationSec = sec;
    parts.push({file: out, sec, id: 'outro'});
    console.log(`  [outro] ${sec.toFixed(2)}s`);
  } else {
    script.outro.durationSec = script.outro.durationSec ?? 5;
    console.log(`  [outro] (visual only) ${script.outro.durationSec}s`);
  }

  // Concatenate parts into a single mp3 with silence padding for
  // visual-only beats. Use ffmpeg's concat filter — gives us frame-accurate
  // joining without re-encoding.
  const totalSec = (script.intro.durationSec ?? 5) +
    script.segments.reduce((s, x) => s + (x.durationSec ?? 0), 0) +
    (script.outro.durationSec ?? 5);
  script.totalSeconds = totalSec;
  script.voiceFile = `audio/${VIDEO}.mp3`;

  const concatList = `${PER_SEG_DIR}/concat.txt`;
  // Build the concat list — pad visual-only intro/outro with silence files.
  const lines: string[] = [];
  for (const p of parts) lines.push(`file '${p.file}'`);
  writeFileSync(concatList, lines.join('\n'));
  const finalAudio = `${AUDIO_DIR}/${VIDEO}.mp3`;
  execSync(
    `ffmpeg -y -f concat -safe 0 -i "${concatList}" -c copy "${finalAudio}"`,
    {stdio: 'inherit'},
  );

  console.log(`[tts] wrote ${finalAudio} (${totalSec.toFixed(2)}s total)`);

  // Persist updated durations back into script.json
  writeFileSync(SCRIPT_PATH, JSON.stringify(script, null, 2));
  console.log(`[tts] updated ${SCRIPT_PATH}`);
})();
