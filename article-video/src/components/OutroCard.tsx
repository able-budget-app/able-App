import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {COLORS, FONT} from '../style';

type Props = {
  // Closing tagline. Default = brand seal.
  tagline?: string;
  url?: string;
};

// Brand outro card — last ~5s of every video. Brand seal "Become Able."
// + becomeable.app on a glass-dark surface. Mirrors the closing slide
// pattern used in social carousels.

export const OutroCard: React.FC<Props> = ({
  tagline = 'Become Able.',
  url = 'becomeable.app',
}) => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 24], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 90% 10%, rgba(42,122,74,0.18) 0%, transparent 55%), radial-gradient(ellipse at 10% 95%, rgba(42,122,74,0.12) 0%, transparent 60%), linear-gradient(160deg, #0e1a14 0%, #050b08 100%)`,
        fontFamily: FONT.family,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          opacity: fadeIn,
        }}
      >
        <h2
          style={{
            color: COLORS.white,
            fontWeight: FONT.heavy,
            fontSize: 124,
            letterSpacing: '-0.04em',
            lineHeight: 1,
            margin: 0,
            textAlign: 'center',
          }}
        >
          {tagline}
        </h2>
        <p
          style={{
            color: 'rgba(255,255,255,0.72)',
            fontWeight: FONT.bold,
            fontSize: 42,
            letterSpacing: '0.01em',
            marginTop: 56,
            textAlign: 'center',
          }}
        >
          {url}
        </p>
      </div>
    </AbsoluteFill>
  );
};
