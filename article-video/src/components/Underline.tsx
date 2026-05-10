import React from 'react';
import {COLORS, UNDERLINE_SVG} from '../style';

// Renders the brand sharpie underline beneath inline text. Same shape as
// the wordmark underline in the social posts (lens / wedge with rounded
// right end). Use as a sibling positioned absolutely under text content.

type Props = {
  // Width of the text being underlined (px). Underline matches this.
  width: number;
  // Height of the underline (px). Defaults to ~20% of the text height
  // — same proportion as .wordmark::after in brand/_brand.css.
  height?: number;
  // Color override; defaults to brand green.
  color?: string;
  // Slight tail extending past the right edge, in px.
  tailPx?: number;
};

export const Underline: React.FC<Props> = ({
  width,
  height = 12,
  color = COLORS.squiggleGreen,
  tailPx = 4,
}) => {
  return (
    <span
      style={{
        position: 'absolute',
        left: 0,
        right: -tailPx,
        bottom: -Math.round(height * 0.7),
        width: width + tailPx,
        height,
        backgroundColor: color,
        WebkitMaskImage: `url("${UNDERLINE_SVG}")`,
        maskImage: `url("${UNDERLINE_SVG}")`,
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskSize: '100% 100%',
        maskSize: '100% 100%',
      }}
    />
  );
};
