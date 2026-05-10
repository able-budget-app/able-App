import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {COLORS, FONT} from '../style';

type Props = {
  title: string;
  subtitle?: string;
  // Eyebrow shown above the title (e.g., "AN OVERVIEW FROM ABLE").
  eyebrow?: string;
};

// Brand intro card — first ~5s of every video. Wordmark-led, eyebrow,
// title, subtitle. Green gradient bg matching the .theme-green surface.

export const IntroCard: React.FC<Props> = ({
  title,
  subtitle,
  eyebrow = 'AN OVERVIEW FROM ABLE',
}) => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const slideIn = interpolate(frame, [0, 24], [40, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(160deg, ${COLORS.greenLt} 0%, ${COLORS.green} 50%, ${COLORS.greenDk} 100%)`,
        fontFamily: FONT.family,
      }}
    >
      {/* Top eyebrow */}
      <div
        style={{
          position: 'absolute',
          top: 80,
          left: 0,
          right: 0,
          textAlign: 'center',
          color: '#cdebd8',
          fontWeight: FONT.heavy,
          fontSize: 28,
          letterSpacing: '.22em',
          opacity: fadeIn,
        }}
      >
        {eyebrow}
      </div>

      {/* Center title block */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '0 120px',
          opacity: fadeIn,
          transform: `translateY(${slideIn}px)`,
        }}
      >
        <h1
          style={{
            color: COLORS.white,
            fontWeight: FONT.heavy,
            fontSize: 92,
            letterSpacing: '-0.03em',
            lineHeight: 1.04,
            textAlign: 'center',
            margin: 0,
            maxWidth: 1500,
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              color: 'rgba(255,255,255,0.78)',
              fontWeight: FONT.semibold,
              fontSize: 38,
              letterSpacing: '-0.01em',
              lineHeight: 1.3,
              marginTop: 32,
              textAlign: 'center',
              maxWidth: 1300,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>

      {/* Wordmark in bottom-left */}
      <Wordmark />
    </AbsoluteFill>
  );
};

const Wordmark: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      bottom: 70,
      left: 100,
      display: 'flex',
      alignItems: 'center',
      gap: 0,
    }}
  >
    <div
      style={{
        position: 'relative',
        color: COLORS.white,
        fontFamily: FONT.family,
        fontWeight: FONT.black,
        fontSize: 64,
        letterSpacing: '-0.03em',
        lineHeight: 1,
      }}
    >
      Able
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: '-4%',
          bottom: -10,
          height: 13,
          backgroundColor: COLORS.white,
          WebkitMaskImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 4.2' preserveAspectRatio='none'><path d='M3 2.6 Q2 2.4 3 2.15 Q58 1.75 115 0.15 Q119 1 119 2 Q119 3 115 3.9 Q58 3.55 3 2.65 Q2 2.45 3 2.6 Z' fill='white'/></svg>")`,
          maskImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 4.2' preserveAspectRatio='none'><path d='M3 2.6 Q2 2.4 3 2.15 Q58 1.75 115 0.15 Q119 1 119 2 Q119 3 115 3.9 Q58 3.55 3 2.65 Q2 2.45 3 2.6 Z' fill='white'/></svg>")`,
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
          WebkitMaskSize: '100% 100%',
          maskSize: '100% 100%',
        }}
      />
    </div>
  </div>
);
