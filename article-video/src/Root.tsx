import React from 'react';
import {Composition, getInputProps} from 'remotion';
import {ArticleVideo, ArticleVideoProps} from './ArticleVideo';
import {FPS} from './style';

// Root registers the ArticleVideo composition. Duration is computed from
// the input props at render time so different scripts get different
// runtimes from one composition.

const defaultProps: ArticleVideoProps = {
  slug: 'placeholder',
  title: 'How to Budget With Inconsistent Income',
  subtitle: 'The Floor-First method, explained.',
  voiceFile: 'audio/placeholder.mp3',
  totalSeconds: 30,
  intro: {durationSec: 5},
  outro: {durationSec: 5, tagline: 'Become Able.'},
  segments: [
    {
      id: 'demo',
      durationSec: 20,
      eyebrow: 'THE FLOOR',
      headline: 'Bills + tax.\nFunded first.',
      subhead: 'The amount you can\'t miss this month.',
      shot: '01-dashboard',
      layout: 'right',
      theme: 'page',
    },
  ],
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="ArticleVideo"
      component={ArticleVideo}
      defaultProps={defaultProps}
      width={1920}
      height={1080}
      fps={FPS}
      // Duration is recomputed at render time once the props arrive —
      // pass `--props` with the script.json.
      durationInFrames={Math.round(
        (defaultProps.intro.durationSec +
          defaultProps.outro.durationSec +
          defaultProps.segments.reduce((s, x) => s + x.durationSec, 0)) *
          FPS,
      )}
      calculateMetadata={({props}) => {
        const total =
          props.intro.durationSec +
          props.outro.durationSec +
          props.segments.reduce((s, x) => s + x.durationSec, 0);
        return {
          durationInFrames: Math.round(total * FPS),
        };
      }}
    />
  );
};
