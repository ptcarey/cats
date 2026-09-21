/**
 * Renders the app icons from one inline SVG so the artwork lives in a single
 * place. Run with `npm run icons` after changing the logo; the PNGs are
 * committed so a plain `npm run build` needs no image tooling.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'public', 'icons');

/**
 * @param {object} opts
 * @param {boolean} opts.maskable Insets the artwork for Android's safe zone.
 * @param {boolean} opts.background Draws the green tile behind the cat.
 */
function logoSvg({ maskable = false, background = true } = {}) {
  // Maskable icons get cropped to a circle on some launchers, so the artwork
  // is shrunk into the middle 80% and the background bleeds to the edges.
  const s = maskable ? 0.72 : 0.9;
  const t = (512 - 512 * s) / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2a9a58"/>
      <stop offset="1" stop-color="#14351f"/>
    </linearGradient>
  </defs>
  ${background ? `<rect width="512" height="512" rx="${maskable ? 0 : 96}" fill="url(#grass)"/>` : ''}
  <g transform="translate(${t} ${t}) scale(${s})">
    <!-- Ears -->
    <path d="M108 168 L96 54 L204 118 Z" fill="#f0833a" stroke="#4a2a12" stroke-width="14" stroke-linejoin="round"/>
    <path d="M404 168 L416 54 L308 118 Z" fill="#f0833a" stroke="#4a2a12" stroke-width="14" stroke-linejoin="round"/>
    <path d="M124 150 L118 88 L182 126 Z" fill="#ff8fbe"/>
    <path d="M388 150 L394 88 L330 126 Z" fill="#ff8fbe"/>
    <!-- Head -->
    <circle cx="256" cy="268" r="164" fill="#f0833a" stroke="#4a2a12" stroke-width="16"/>
    <!-- Stripes -->
    <path d="M256 104 v48 M212 112 v40 M300 112 v40" stroke="#d95f18" stroke-width="20" stroke-linecap="round"/>
    <!-- Eyes -->
    <ellipse cx="196" cy="252" rx="26" ry="34" fill="#22262b"/>
    <ellipse cx="316" cy="252" rx="26" ry="34" fill="#22262b"/>
    <circle cx="205" cy="240" r="9" fill="#ffffff"/>
    <circle cx="325" cy="240" r="9" fill="#ffffff"/>
    <!-- Nose and mouth -->
    <path d="M238 318 L274 318 L256 338 Z" fill="#ff8fbe" stroke="#4a2a12" stroke-width="8" stroke-linejoin="round"/>
    <path d="M256 338 q-26 30 -52 8 M256 338 q26 30 52 8" fill="none" stroke="#4a2a12" stroke-width="12" stroke-linecap="round"/>
    <!-- Whiskers -->
    <path d="M150 300 h-56 M150 330 l-52 18 M362 300 h56 M362 330 l52 18"
          stroke="#4a2a12" stroke-width="10" stroke-linecap="round"/>
    <!-- Ball tucked in the corner -->
    <circle cx="398" cy="404" r="74" fill="#fdfdfd" stroke="#2b2f36" stroke-width="14"/>
    <path d="M398 360 l34 25 -13 40 -42 0 -13 -40 Z" fill="#2b2f36"/>
  </g>
</svg>`;
}

async function main() {
  await mkdir(outDir, { recursive: true });

  const standard = Buffer.from(logoSvg({ maskable: false }));
  const maskable = Buffer.from(logoSvg({ maskable: true }));

  const jobs = [
    ['icon-192.png', standard, 192],
    ['icon-512.png', standard, 512],
    ['maskable-512.png', maskable, 512],
    ['apple-touch-icon.png', standard, 180],
  ];

  for (const [name, svg, size] of jobs) {
    await sharp(svg).resize(size, size).png({ compressionLevel: 9 }).toFile(join(outDir, name));
    console.log(`wrote icons/${name} (${size}x${size})`);
  }

  await writeFile(join(outDir, 'favicon.svg'), logoSvg({ maskable: false }), 'utf8');
  console.log('wrote icons/favicon.svg');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
