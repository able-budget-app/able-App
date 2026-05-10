// Able brand tokens — mirrors index.html / app.html / brand/_brand.css.
// Single source of truth for the video composition. Anything visual that
// can be expressed via these tokens should be — never hardcode brand
// colors or font names anywhere else in src/.

export const COLORS = {
  // Primary green palette (matches CSS vars)
  green:   '#2a7a4a',
  greenLt: '#3d9e78',
  greenDk: '#1f6038',

  // Page surfaces
  page:    '#f0f7f2',
  white:   '#ffffff',
  cardSt:  '#f7fbf8',

  // Text
  t1:      '#111c16',
  t2:      '#4a5c52',
  t3:      '#8ca898',

  // Theme bgs (match social/posts/_styles.css)
  black:        '#0e1a14',
  glassDarkBg:  '#152622',

  // Accents
  squiggleGreen: '#2a7a4a',
  squiggleWhite: '#ffffff',
} as const;

export const FONT = {
  family: '"Bricolage Grotesque", -apple-system, BlinkMacSystemFont, sans-serif',
  // Bricolage weights we use
  regular: 400,
  medium:  500,
  semibold: 600,
  bold:    700,
  heavy:   800,
  black:   900,
} as const;

// The brand sharpie underline SVG (same path used in social/posts/_styles.css
// and brand/_brand.css). Used as a CSS mask-image; viewBox 120 4.2.
export const UNDERLINE_SVG = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 4.2' preserveAspectRatio='none'><path d='M3 2.6 Q2 2.4 3 2.15 Q58 1.75 115 0.15 Q119 1 119 2 Q119 3 115 3.9 Q58 3.55 3 2.65 Q2 2.45 3 2.6 Z' fill='white'/></svg>`;

// Standard timings (frames at 30fps unless noted)
export const FPS = 30;
export const SCENE_FADE_IN  = 12;  // 0.4s
export const SCENE_FADE_OUT = 12;
