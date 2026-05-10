import {Config} from '@remotion/cli/config';

// Public dir holds shared static assets — phone shots get symlinked in
// at install time so we don't duplicate ~5MB of PNGs into this project.
Config.setPublicDir('./public');

// 1080p H.264 with quality tuned for YouTube. CRF 18 = visually lossless
// for screen content; preset slow for better compression at this level.
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setCodec('h264');
Config.setCrf(18);

// Concurrency = let Remotion pick. Renders are CPU-bound; default works.
