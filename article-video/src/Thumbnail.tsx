import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {COLORS, FONT} from './style';
import type {Theme, Layout} from './components/BodyScene';

// YouTube thumbnail composition. 1280×720, rendered as a still PNG via:
//   remotion still src/index.ts Thumbnail videos/<slug>/thumbnail.png --props=videos/<slug>/script.json
//
// Reads the same script.json shape as ArticleVideo. Pulls thumbnail fields
// from `thumbnail` (override) → `intro.headline` / first segment / title
// (fallback) so most scripts get a usable thumbnail with no extra fields.

export type ThumbnailProps = {
  // Reuse the article-video script schema
  title: string;
  subtitle?: string;
  thumbnail?: {
    headline?: string;
    shot?: string;
    theme?: Theme;
    eyebrow?: string;
    layout?: Layout;
  };
  segments?: Array<{shot?: string}>;
};

const themeBg = (theme: Theme): string => {
  switch (theme) {
    case 'green':      return `linear-gradient(160deg, ${COLORS.greenLt} 0%, ${COLORS.green} 50%, ${COLORS.greenDk} 100%)`;
    case 'black':      return `radial-gradient(ellipse at 90% 10%, rgba(42,122,74,0.22) 0%, transparent 55%), linear-gradient(160deg, ${COLORS.black} 0%, #050b08 100%)`;
    case 'glass-dark': return `radial-gradient(ellipse at 90% 10%, rgba(42,122,74,0.18) 0%, transparent 55%), linear-gradient(160deg, ${COLORS.black} 0%, #050b08 100%)`;
    case 'white':      return COLORS.white;
    default:           return COLORS.page;
  }
};
const themeText = (theme: Theme): string =>
  theme === 'page' || theme === 'white' ? COLORS.t1 : COLORS.white;
const themeEyebrow = (theme: Theme): string =>
  theme === 'page' || theme === 'white' ? COLORS.green : '#cdebd8';

export const Thumbnail: React.FC<ThumbnailProps> = ({
  title,
  thumbnail,
  segments = [],
}) => {
  const theme: Theme = thumbnail?.theme ?? 'green';
  const eyebrow = thumbnail?.eyebrow ?? 'AN OVERVIEW FROM ABLE';
  const headline = thumbnail?.headline ?? title;
  const shot = thumbnail?.shot ?? segments[0]?.shot;
  const layout: Layout = thumbnail?.layout ?? (shot ? 'right' : 'text-only');

  const sq = theme === 'page' || theme === 'white'
    ? COLORS.squiggleGreen
    : COLORS.squiggleWhite;

  // Layout math (1280×720)
  const PADDING = 70;
  const PHONE_W = 290;
  const PHONE_H = Math.round(PHONE_W * (16 / 9)); // 516
  const PHONE_TOP = Math.round((720 - PHONE_H) / 2);
  const TEXT_W = shot ? 1280 - PHONE_W - 80 - PADDING * 2 : 1280 - PADDING * 2;
  const TEXT_LEFT =
    layout === 'left' && shot ? PADDING + PHONE_W + 80 : PADDING;
  const PHONE_LEFT =
    layout === 'left' ? PADDING : 1280 - PADDING - PHONE_W;

  const shotUrl = shot
    ? staticFile(`product-shots/${shot}/9x16-bare.png`)
    : undefined;

  return (
    <AbsoluteFill
      style={{
        background: themeBg(theme),
        fontFamily: FONT.family,
        color: themeText(theme),
      }}
    >
      {shot && shotUrl && (
        <Img
          src={shotUrl}
          style={{
            position: 'absolute',
            top: PHONE_TOP,
            left: PHONE_LEFT,
            width: PHONE_W,
            height: PHONE_H,
            objectFit: 'contain',
          }}
        />
      )}

      <div
        style={{
          position: 'absolute',
          top: PADDING,
          left: TEXT_LEFT,
          width: TEXT_W,
          height: 720 - PADDING * 2,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: layout === 'text-only' ? 'center' : 'flex-start',
          textAlign: layout === 'text-only' ? 'center' : 'left',
        }}
      >
        <div
          style={{
            color: themeEyebrow(theme),
            fontWeight: FONT.heavy,
            fontSize: 22,
            letterSpacing: '.22em',
            textTransform: 'uppercase',
            marginBottom: 28,
          }}
        >
          {eyebrow}
        </div>
        <h2
          style={{
            fontWeight: FONT.heavy,
            fontSize: layout === 'text-only' ? 92 : 76,
            letterSpacing: '-0.03em',
            lineHeight: 1.04,
            margin: 0,
          }}
          dangerouslySetInnerHTML={{__html: renderHeadline(headline, sq)}}
        />
      </div>

      {/* Brand wordmark, bottom-left */}
      <Wordmark color={themeText(theme)} squiggle={sq} />
    </AbsoluteFill>
  );
};

const Wordmark: React.FC<{color: string; squiggle: string}> = ({color, squiggle}) => (
  <div
    style={{
      position: 'absolute',
      bottom: 38,
      left: 50,
      color,
      fontFamily: FONT.family,
      fontWeight: FONT.black,
      fontSize: 44,
      letterSpacing: '-0.03em',
      lineHeight: 1,
    }}
  >
    <span style={{position: 'relative', display: 'inline-block'}}>
      Able
      <span
        style={{
          position: 'absolute',
          left: 0,
          right: '-4%',
          bottom: -6,
          height: 9,
          backgroundColor: squiggle,
          WebkitMaskImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 4.2' preserveAspectRatio='none'><path d='M3 2.6 Q2 2.4 3 2.15 Q58 1.75 115 0.15 Q119 1 119 2 Q119 3 115 3.9 Q58 3.55 3 2.65 Q2 2.45 3 2.6 Z' fill='white'/></svg>")`,
          maskImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 4.2' preserveAspectRatio='none'><path d='M3 2.6 Q2 2.4 3 2.15 Q58 1.75 115 0.15 Q119 1 119 2 Q119 3 115 3.9 Q58 3.55 3 2.65 Q2 2.45 3 2.6 Z' fill='white'/></svg>")`,
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
          WebkitMaskSize: '100% 100%',
          maskSize: '100% 100%',
        }}
      />
    </span>
  </div>
);

function renderHeadline(s: string, squiggleColor: string): string {
  return s
    .replace(/\n/g, '<br/>')
    .replace(/\{([^}]+)\}/g, (_m, inner) => {
      const safe = inner
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      return `<span style="position:relative;display:inline-block;white-space:nowrap;">${safe}<span style="position:absolute;left:0;right:-4%;bottom:-0.136em;height:0.205em;background-color:${squiggleColor};-webkit-mask-image:url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 120 4.2%22 preserveAspectRatio=%22none%22><path d=%22M3 2.6 Q2 2.4 3 2.15 Q58 1.75 115 0.15 Q119 1 119 2 Q119 3 115 3.9 Q58 3.55 3 2.65 Q2 2.45 3 2.6 Z%22 fill=%22white%22/></svg>');mask-image:url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 120 4.2%22 preserveAspectRatio=%22none%22><path d=%22M3 2.6 Q2 2.4 3 2.15 Q58 1.75 115 0.15 Q119 1 119 2 Q119 3 115 3.9 Q58 3.55 3 2.65 Q2 2.45 3 2.6 Z%22 fill=%22white%22/></svg>');-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-size:100% 100%;mask-size:100% 100%;"></span></span>`;
    });
}
