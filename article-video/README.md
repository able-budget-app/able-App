# Able article-video pipeline

Turns an Able article into a 3–4 min YouTube video with OpenAI TTS narration and brand-correct Remotion visuals.

## Pipeline

```
videos/<slug>/script.json  ─┐
                            ├─→ npm run tts       ─→ public/audio/<slug>.mp3
OPENAI_API_KEY ─────────────┘                          (durations written back to script.json)
                            │
                            ├─→ npm run render    ─→ videos/<slug>/out.mp4
public/product-shots/ ──────┘                          (1920×1080, 30 fps, h264)
```

## One-time setup

```bash
cd article-video
npm install
# Symlink phone shots into public/ so Remotion can serve them via staticFile():
ln -s ../../marketing-footage/product-shots public/product-shots
mkdir -p public/audio
# Set your OpenAI key (any shell that npm inherits from):
export OPENAI_API_KEY=sk-...
```

## Per-video workflow

1. **Write the script.** Copy `videos/_template/script.json` to `videos/<slug>/script.json`. Fill in each segment's `voiceText` (what the narrator says) and `headline` (what's on screen). Headlines should be short — 2 lines max — pulled from the brand-script's locked phrases when possible.
2. **Generate audio.** `VIDEO=<slug> npm run tts` — calls OpenAI TTS per segment, concatenates to one mp3, writes per-segment durations back into the script.
3. **Preview.** `npm run studio` — opens the Remotion Studio. Pass props by clicking the composition with `?propsFile=videos/<slug>/script.json`.
4. **Render.** `VIDEO=<slug> npm run render` — outputs `videos/<slug>/out.mp4`. Upload to YouTube.

## Script schema

```json
{
  "slug": "budgeting",
  "title": "How to Budget With Inconsistent Income",
  "subtitle": "The Floor-First method, explained.",
  "voice": "sage",
  "intro": {
    "durationSec": 5,
    "voiceText": "Most budgeting advice was built for steady paychecks.",
    "spokenIntro": true
  },
  "segments": [
    {
      "id": "the-floor",
      "voiceText": "The floor is bills plus tax. The amount you can not miss this month.",
      "eyebrow": "THE FLOOR",
      "headline": "Bills + tax.\nFunded first.",
      "subhead": "The amount you can't miss.",
      "shot": "01-dashboard",
      "layout": "right",
      "theme": "page"
    }
  ],
  "outro": {
    "durationSec": 5,
    "voiceText": "From Unable. To Able.",
    "tagline": "Become Able."
  }
}
```

`durationSec` on each segment gets overwritten by the TTS step with the actual audio duration. The visual scene cuts to that exact length.

## Brand alignment

All visuals match the social-posts brand system:
- Same Bricolage Grotesque font
- Same brand green (#2a7a4a) and surface palette
- Same wordmark sharpie underline (lens shape with rounded right end)
- Same bare phone shots from `marketing-footage/product-shots/<slug>/9x16-bare.png`
- Same theme variants: page / white / green / black / glass-dark
- Same layout patterns: phone-right / phone-left / text-only

If a brand token changes in `index.html` or `social/posts/_styles.css`, mirror it in `src/style.ts`.

## Voice

Default voice is `sage` (OpenAI TTS) — calm, clear, not hype-y. Override per video by setting `"voice": "alloy"` (or any other) in script.json. Available voices: alloy, ash, ballad, coral, echo, fable, nova, onyx, sage, shimmer, verse.

The voice instruction baked into the renderer ("Speak calmly and clearly. Warm but not hype-y. No exclamation points. Conversational pace, slightly slower than typical narration.") locks tone across voices.

## Cost (rough)

OpenAI `gpt-4o-mini-tts` is ~$0.60/hour of audio. A 4-minute video = ~$0.04 in TTS. ~$2 to generate the entire library at the current article count.
