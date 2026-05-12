#!/usr/bin/env node
import { mkdir, copyFile, rm, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const wrapperRoot = resolve(here, '..');
const repoRoot = resolve(wrapperRoot, '..');
const www = resolve(wrapperRoot, 'www');

const ASSETS = [
  ['app.html', 'index.html'],
  ['privacy.html', 'privacy.html'],
  ['terms.html', 'terms.html'],
  ['favicon.svg', 'favicon.svg'],
  ['favicon-16.png', 'favicon-16.png'],
  ['favicon-32.png', 'favicon-32.png'],
  ['apple-touch-icon.png', 'apple-touch-icon.png'],
  ['icon-192.png', 'icon-192.png'],
  ['icon-512.png', 'icon-512.png'],
];

if (existsSync(www)) await rm(www, { recursive: true });
await mkdir(www, { recursive: true });

for (const [src, dest] of ASSETS) {
  const from = resolve(repoRoot, src);
  if (!existsSync(from)) {
    if (src === 'terms.html') {
      console.warn(`[sync-www] ${src} not found at repo root — skipping (in-app links to /terms.html will 404 inside the bundle)`);
      continue;
    }
    throw new Error(`[sync-www] required asset missing: ${from}`);
  }
  await copyFile(from, resolve(www, dest));
  console.log(`[sync-www] ${src} -> www/${dest}`);
}

const indexPath = resolve(www, 'index.html');
const html = await readFile(indexPath, 'utf8');
const marker = '<!-- able-ios-wrapper -->';
if (!html.includes(marker)) {
  const injected = html.replace(
    '<head>',
    `<head>\n${marker}\n<meta name="able-runtime" content="ios-capacitor">\n`,
  );
  await writeFile(indexPath, injected);
  console.log('[sync-www] injected ios-capacitor runtime marker into index.html <head>');
}

console.log('[sync-www] done');
