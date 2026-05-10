import React from 'react';
import {AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {COLORS, FONT} from '../style';

export type Theme = 'page' | 'white' | 'green' | 'black' | 'glass-dark';
export type Layout = 'right' | 'left' | 'text-only';

type Props = {
  // The on-screen headline / pull-quote. Short — max 2 lines. Pull from
  // the script's onScreenText, not the full narration text.
  headline: string;
  // Optional subhead under the headline (smaller font).
  subhead?: string;
  // Phone shot to display. References a 9x16-bare.png in the repo at
  // /marketing-footage/product-shots/<shot>/9x16-bare.png. When omitted,
  // the layout becomes text-only and the headline gets more room.
  shot?: string;
  layout?: Layout;
  theme?: Theme;
  // Eyebrow above the headline (chapter title or section name).
  eyebrow?: string;
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
const themeMuted = (theme: Theme): string =>
  theme === 'page' || theme === 'white' ? COLORS.t2 : 'rgba(255,255,255,0.72)';
const themeEyebrow = (theme: Theme): string =>
  theme === 'page' || theme === 'white' ? COLORS.green : '#cdebd8';

// One scene of the body: theme bg, eyebrow, on-screen text, optional
// phone shot to the right or left. Audio is layered on top in the parent
// composition — this component is purely visual.

export const BodyScene: React.FC<Props> = ({
  headline,
  subhead,
  shot,
  layout = 'right',
  theme = 'page',
  eyebrow,
}) => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const slideIn = interpolate(frame, [0, 28], [30, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const showShot = shot && layout !== 'text-only';
  const shotUrl = shot
    ? staticFile(`product-shots/${shot}/9x16-bare.png`)
    : undefined;

  // Layout math (deterministic — simpler than CSS grid for video):
  // Canvas: 1920×1080. Padding: 100px each side → content 1720×880.
  // Phone: fixed 460px wide × 818px tall (9:16). Anchored top:131 (centered
  // vertically in the content area). Left or right edge of content area.
  // Text column: takes the remaining ~1180px width on the opposite side.

  const PADDING = 100;
  const PHONE_W = 460;
  const PHONE_H = Math.round(PHONE_W * (16 / 9)); // 818
  const PHONE_TOP = Math.round((1080 - PHONE_H) / 2); // 131
  const TEXT_W = showShot ? 1720 - PHONE_W - 80 : 1720; // 80px gap
  const TEXT_LEFT =
    layout === 'left' && showShot ? PADDING + PHONE_W + 80 : PADDING;
  const PHONE_LEFT =
    layout === 'left' ? PADDING : 1920 - PADDING - PHONE_W;

  return (
    <AbsoluteFill
      style={{
        background: themeBg(theme),
        fontFamily: FONT.family,
        color: themeText(theme),
      }}
    >
      {showShot && (
        <Img
          src={shotUrl!}
          style={{
            position: 'absolute',
            top: PHONE_TOP,
            left: PHONE_LEFT,
            width: PHONE_W,
            height: PHONE_H,
            objectFit: 'contain',
            opacity: fadeIn,
          }}
        />
      )}

      <div
        style={{
          position: 'absolute',
          top: PADDING,
          left: TEXT_LEFT,
          width: TEXT_W,
          height: 1080 - PADDING * 2,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: layout === 'text-only' ? 'center' : 'flex-start',
          textAlign: layout === 'text-only' ? 'center' : 'left',
          opacity: fadeIn,
          transform: `translateY(${slideIn}px)`,
        }}
      >
        {eyebrow && (
          <div
            style={{
              color: themeEyebrow(theme),
              fontWeight: FONT.heavy,
              fontSize: 26,
              letterSpacing: '.22em',
              textTransform: 'uppercase',
              marginBottom: 36,
            }}
          >
            {eyebrow}
          </div>
        )}
        <h2
          style={{
            fontWeight: FONT.heavy,
            fontSize: layout === 'text-only' ? 110 : 78,
            letterSpacing: '-0.03em',
            lineHeight: 1.05,
            margin: 0,
            // Render {phrase} chunks inline as the brand-underline span
            // (style.css uses an SVG mask; we inline-style the same SVG).
            // We do it dangerouslySetInnerHTML in a child below to avoid a
            // bigger refactor.
          }}
          dangerouslySetInnerHTML={{__html: renderHeadline(headline, theme)}}
        />
        {subhead && (
          <p
            style={{
              color: themeMuted(theme),
              fontWeight: FONT.semibold,
              fontSize: 34,
              letterSpacing: '-0.01em',
              lineHeight: 1.32,
              marginTop: 32,
              marginBottom: 0,
              maxWidth: '100%',
            }}
          >
            {subhead}
          </p>
        )}
      </div>
    </AbsoluteFill>
  );
};

// Convert "Bills + tax. {Funded first.}" → HTML with a brand sharpie
// underline span beneath the {…} portion. Uses the wordmark SVG path.
function renderHeadline(s: string, theme: Theme): string {
  const sq = theme === 'page' || theme === 'white'
    ? COLORS.squiggleGreen
    : COLORS.squiggleWhite;
  const html = s
    .replace(/\n/g, '<br/>')
    .replace(/\{([^}]+)\}/g, (_m, inner) => {
      const safe = inner
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      return `<span style="position:relative;display:inline-block;white-space:nowrap;">${safe}<span style="position:absolute;left:0;right:-4%;bottom:-0.136em;height:0.205em;background-color:${sq};-webkit-mask-image:url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 120 4.2%22 preserveAspectRatio=%22none%22><path d=%22M3 2.6 Q2 2.4 3 2.15 Q58 1.75 115 0.15 Q119 1 119 2 Q119 3 115 3.9 Q58 3.55 3 2.65 Q2 2.45 3 2.6 Z%22 fill=%22white%22/></svg>');mask-image:url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 120 4.2%22 preserveAspectRatio=%22none%22><path d=%22M3 2.6 Q2 2.4 3 2.15 Q58 1.75 115 0.15 Q119 1 119 2 Q119 3 115 3.9 Q58 3.55 3 2.65 Q2 2.45 3 2.6 Z%22 fill=%22white%22/></svg>');-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-size:100% 100%;mask-size:100% 100%;"></span></span>`;
    });
  return html;
}
