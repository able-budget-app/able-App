import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile} from 'remotion';
import {IntroCard} from './components/IntroCard';
import {OutroCard} from './components/OutroCard';
import {BodyScene, Theme, Layout} from './components/BodyScene';
import {FPS} from './style';

// ─────────────────────────────────────────────────────────────────────
// Props schema. The full video is described by a single JSON object
// loaded as Remotion props (see videos/<slug>/script.json).
// ─────────────────────────────────────────────────────────────────────

export type ArticleVideoProps = {
  // Video metadata
  slug: string;
  title: string;
  subtitle?: string;
  voiceFile: string;          // path under public/audio/<slug>.mp3
  // Total duration in seconds — must match audio file. Computed by the
  // generate-audio.ts script and written into script.json.
  totalSeconds: number;
  // The script body. Each segment renders one BodyScene with its own
  // duration. Sum of segment durations + intro + outro should equal
  // totalSeconds.
  intro: {durationSec: number};
  outro: {durationSec: number; tagline?: string};
  segments: Segment[];
};

export type Segment = {
  id: string;
  durationSec: number;
  headline: string;
  subhead?: string;
  shot?: string;
  layout?: Layout;
  theme?: Theme;
  eyebrow?: string;
};

// ─────────────────────────────────────────────────────────────────────
// Composition — sequences scenes back-to-back, audio plays continuously
// on top. Frame counts are derived from each segment's durationSec at
// FPS.
// ─────────────────────────────────────────────────────────────────────

export const ArticleVideo: React.FC<ArticleVideoProps> = ({
  title,
  subtitle,
  voiceFile,
  intro,
  outro,
  segments,
}) => {
  const introFrames = Math.round(intro.durationSec * FPS);
  let cursor = introFrames;

  return (
    <AbsoluteFill style={{backgroundColor: '#000'}}>
      {/* Continuous narration */}
      <Audio src={staticFile(voiceFile)} />

      {/* Intro */}
      <Sequence from={0} durationInFrames={introFrames} layout="none">
        <IntroCard title={title} subtitle={subtitle} />
      </Sequence>

      {/* Body scenes */}
      {segments.map((seg) => {
        const frames = Math.round(seg.durationSec * FPS);
        const node = (
          <Sequence
            key={seg.id}
            from={cursor}
            durationInFrames={frames}
            layout="none"
          >
            <BodyScene
              headline={seg.headline}
              subhead={seg.subhead}
              shot={seg.shot}
              layout={seg.layout}
              theme={seg.theme}
              eyebrow={seg.eyebrow}
            />
          </Sequence>
        );
        cursor += frames;
        return node;
      })}

      {/* Outro */}
      <Sequence
        from={cursor}
        durationInFrames={Math.round(outro.durationSec * FPS)}
        layout="none"
      >
        <OutroCard tagline={outro.tagline} />
      </Sequence>
    </AbsoluteFill>
  );
};
