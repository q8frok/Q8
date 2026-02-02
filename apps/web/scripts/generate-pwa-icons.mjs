/**
 * PWA Icon Generator
 * Generates all required icons and splash screens from an SVG template.
 *
 * Usage: node scripts/generate-pwa-icons.mjs
 * Requires: sharp (devDependency)
 */

import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, '..', 'public');
const ICONS_DIR = join(PUBLIC_DIR, 'icons');
const SPLASH_DIR = join(PUBLIC_DIR, 'splash');

// Ensure output directories exist
mkdirSync(ICONS_DIR, { recursive: true });
mkdirSync(SPLASH_DIR, { recursive: true });

// Design tokens
const BG_COLOR = '#0A0A0F';
const ACCENT_PRIMARY = '#8B5CF6';
const ACCENT_SECONDARY = '#A78BFA';
const TEXT_COLOR = '#FFFFFF';

/**
 * Create an SVG string for the Q8 logo at the given size.
 * The text is centered with a subtle purple gradient accent line.
 */
function createLogoSvg(size) {
  const fontSize = Math.round(size * 0.42);
  const accentY = Math.round(size * 0.68);
  const accentWidth = Math.round(size * 0.3);
  const accentX = Math.round((size - accentWidth) / 2);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${ACCENT_PRIMARY}" />
      <stop offset="100%" stop-color="${ACCENT_SECONDARY}" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="${BG_COLOR}" />
  <text
    x="50%" y="50%"
    dominant-baseline="central"
    text-anchor="middle"
    font-family="system-ui, -apple-system, sans-serif"
    font-size="${fontSize}"
    font-weight="700"
    fill="${TEXT_COLOR}"
    letter-spacing="-0.02em"
  >Q8</text>
  <rect x="${accentX}" y="${accentY}" width="${accentWidth}" height="${Math.max(2, Math.round(size * 0.02))}" rx="1" fill="url(#accent)" />
</svg>`;
}

/**
 * Create a maskable icon SVG (with extra padding for safe zone).
 */
function createMaskableSvg(size) {
  const padding = Math.round(size * 0.1); // 10% safe zone
  const innerSize = size - padding * 2;
  const fontSize = Math.round(innerSize * 0.42);
  const accentY = Math.round(size * 0.64);
  const accentWidth = Math.round(innerSize * 0.3);
  const accentX = Math.round((size - accentWidth) / 2);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${ACCENT_PRIMARY}" />
      <stop offset="100%" stop-color="${ACCENT_SECONDARY}" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="${BG_COLOR}" />
  <text
    x="50%" y="50%"
    dominant-baseline="central"
    text-anchor="middle"
    font-family="system-ui, -apple-system, sans-serif"
    font-size="${fontSize}"
    font-weight="700"
    fill="${TEXT_COLOR}"
    letter-spacing="-0.02em"
  >Q8</text>
  <rect x="${accentX}" y="${accentY}" width="${accentWidth}" height="${Math.max(2, Math.round(size * 0.02))}" rx="1" fill="url(#accent)" />
</svg>`;
}

/**
 * Create a shortcut icon SVG with a custom label.
 */
function createShortcutSvg(size, label, iconColor) {
  const fontSize = Math.round(size * 0.35);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.15)}" fill="${BG_COLOR}" />
  <text
    x="50%" y="50%"
    dominant-baseline="central"
    text-anchor="middle"
    font-family="system-ui, -apple-system, sans-serif"
    font-size="${fontSize}"
    font-weight="600"
    fill="${iconColor}"
  >${label}</text>
</svg>`;
}

/**
 * Create a splash screen SVG.
 */
function createSplashSvg(width, height) {
  const logoSize = Math.round(Math.min(width, height) * 0.15);
  const fontSize = Math.round(logoSize * 0.5);
  const subtitleSize = Math.round(fontSize * 0.35);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${BG_COLOR}" />
      <stop offset="100%" stop-color="#0F0A1F" />
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${ACCENT_PRIMARY}" />
      <stop offset="100%" stop-color="${ACCENT_SECONDARY}" />
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg-grad)" />
  <text
    x="50%" y="46%"
    dominant-baseline="central"
    text-anchor="middle"
    font-family="system-ui, -apple-system, sans-serif"
    font-size="${fontSize}"
    font-weight="700"
    fill="${TEXT_COLOR}"
    letter-spacing="-0.02em"
  >Q8</text>
  <text
    x="50%" y="54%"
    dominant-baseline="central"
    text-anchor="middle"
    font-family="system-ui, -apple-system, sans-serif"
    font-size="${subtitleSize}"
    font-weight="400"
    fill="${ACCENT_PRIMARY}"
    opacity="0.7"
  >Personal Assistant</text>
</svg>`;
}

async function generateIcon(svg, outputPath) {
  await sharp(Buffer.from(svg)).png().toFile(outputPath);
  console.log(`  Created: ${outputPath}`);
}

async function main() {
  console.log('Generating PWA icons...\n');

  // Standard icons
  const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
  console.log('Standard icons:');
  for (const size of sizes) {
    const svg = createLogoSvg(size);
    await generateIcon(svg, join(ICONS_DIR, `icon-${size}x${size}.png`));
  }

  // Maskable icons
  console.log('\nMaskable icons:');
  for (const size of [192, 512]) {
    const svg = createMaskableSvg(size);
    await generateIcon(svg, join(ICONS_DIR, `icon-${size}x${size}-maskable.png`));
  }

  // Shortcut icons
  console.log('\nShortcut icons:');
  const chatSvg = createShortcutSvg(96, '\u{1F4AC}', ACCENT_PRIMARY);
  await generateIcon(chatSvg, join(ICONS_DIR, 'chat-icon.png'));

  const noteSvg = createShortcutSvg(96, '\u{1F4DD}', ACCENT_SECONDARY);
  await generateIcon(noteSvg, join(ICONS_DIR, 'note-icon.png'));

  // Splash screens
  console.log('\nSplash screens:');
  const splashSizes = [
    { name: 'iphone-16-promax', width: 1290, height: 2796 },
    { name: 'iphone-17-promax', width: 1320, height: 2868 },
  ];
  for (const { name, width, height } of splashSizes) {
    const svg = createSplashSvg(width, height);
    await generateIcon(svg, join(SPLASH_DIR, `${name}.png`));
  }

  // Favicon (32x32 PNG, then convert to ICO-compatible PNG)
  console.log('\nFavicon:');
  const faviconSvg = createLogoSvg(32);
  await sharp(Buffer.from(faviconSvg)).png().toFile(join(PUBLIC_DIR, 'favicon.ico'));
  console.log(`  Created: ${join(PUBLIC_DIR, 'favicon.ico')}`);

  // Also generate a proper 32x32 favicon.png
  await sharp(Buffer.from(faviconSvg)).png().toFile(join(PUBLIC_DIR, 'favicon.png'));
  console.log(`  Created: ${join(PUBLIC_DIR, 'favicon.png')}`);

  console.log('\nAll icons generated successfully!');
}

main().catch((error) => {
  console.error('Icon generation failed:', error);
  process.exit(1);
});
