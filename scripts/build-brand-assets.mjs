/*
 * Every brand asset, from one definition.
 *
 * Icons, launch images and share cards were hand written the first two times the
 * app was renamed, and each rename meant editing the same mark in six files and
 * re-exporting thirteen launch images by hand. This builds all of them from the
 * geometry below, so the next change is one edit and one command:
 *
 *   npm install --no-save sharp && node scripts/build-brand-assets.mjs
 *
 * sharp is not a saved dependency because nothing at runtime or build time needs
 * it. It is a tool you reach for when the brand changes, which is rarely.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public');

const TERRACOTTA = '#c85a2e';
const SAGE = '#4f9469';
const PAPER = '#f8f7f5';
const INK = '#2b2320';
const QUIET = '#7a6a5f';

const NAME = 'DukaKonnect';
const TAGLINE = 'biashara yako, siku kwa siku';
const BLURB = 'Sales, stock, deni and expenses for small shops in Kenya.';

/*
 * The mark: a K, drawn as a connection.
 *
 * The stem is the ruled edge of a daybook page, which is the line the whole app
 * is built on. The two arms open off it, and the sage node sits exactly where
 * the upper arm lands, touching it -- one side of a trade meeting the other.
 * Sage is the shop's own colour throughout the app, so the node reads as the
 * counterparty rather than as decoration.
 *
 * Drawn with round-capped strokes rather than rectangles so it stays legible at
 * 16px, where the old mark's thin ledger rule used to disappear.
 */
const markGlyph = (fill = PAPER, node = SAGE) => `
  <g fill="none" stroke="${fill}" stroke-width="6.5" stroke-linecap="round">
    <path d="M18.5 19 V48"/>
    <path d="M21.5 34.5 L36.5 22"/>
    <path d="M21.5 34.5 L38 48"/>
  </g>
  <circle cx="43.5" cy="17.5" r="5" fill="${node}"/>`;

/** Rounded tile, for app icons and anywhere the mark stands alone. */
const markTile = (radius = 14) =>
  `<rect width="64" height="64" rx="${radius}" fill="${TERRACOTTA}"/>${markGlyph()}`;

const svg = (body, w = 64, h = 64) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${NAME}">${body}</svg>`;

// ---------------------------------------------------------------------------
// Vector sources
// ---------------------------------------------------------------------------
const sources = {
  'favicon.svg': svg(markTile(12)),
  'icon.svg': svg(markTile(14)),
  // Android crops maskable icons to a circle, so the tile runs full bleed and
  // the glyph is pulled into the middle 66%.
  'icon-maskable.svg': svg(
    `<rect width="64" height="64" fill="${TERRACOTTA}"/>
     <g transform="translate(32 32) scale(0.66) translate(-32 -32)">${markGlyph()}</g>`
  ),
};

const wordmark = (x, y, size, sub, subSize, subColor = QUIET) => `
  <text x="${x}" y="${y}" font-family="DM Sans, Segoe UI, Helvetica, Arial, sans-serif"
        font-size="${size}" font-weight="700" letter-spacing="-1">
    <tspan fill="${INK}">Duka</tspan><tspan fill="${TERRACOTTA}">Konnect</tspan>
  </text>
  ${sub ? `<text x="${x}" y="${y + subSize * 1.9}" font-family="DM Sans, Segoe UI, Helvetica, Arial, sans-serif"
        font-size="${subSize}" font-weight="500" fill="${subColor}">${sub}</text>` : ''}`;

sources['og-image.svg'] = svg(
  `<rect width="1200" height="630" fill="${PAPER}"/>
   <rect width="1200" height="10" fill="${TERRACOTTA}"/>
   <g transform="translate(96 128) scale(2.1)">${markTile(14)}</g>
   ${wordmark(96, 400, 86, TAGLINE, 34)}
   <text x="96" y="524" font-family="DM Sans, Segoe UI, Helvetica, Arial, sans-serif"
         font-size="27" font-weight="400" fill="${QUIET}">${BLURB}</text>`,
  1200,
  630
);

sources['social-square.svg'] = svg(
  `<rect width="1080" height="1080" fill="${PAPER}"/>
   <rect width="1080" height="14" fill="${TERRACOTTA}"/>
   <g transform="translate(420 300) scale(3.75)">${markTile(14)}</g>
   <text x="540" y="700" text-anchor="middle" font-family="DM Sans, Segoe UI, Helvetica, Arial, sans-serif"
         font-size="86" font-weight="700" letter-spacing="-1">
     <tspan fill="${INK}">Duka</tspan><tspan fill="${TERRACOTTA}">Konnect</tspan>
   </text>
   <text x="540" y="762" text-anchor="middle" font-family="DM Sans, Segoe UI, Helvetica, Arial, sans-serif"
         font-size="36" font-weight="500" fill="${QUIET}">${TAGLINE}</text>`,
  1080,
  1080
);

// Padded so that when it is fitted into a tall phone screen the mark stays
// modest rather than filling the width.
sources['splash-source.svg'] = svg(
  `<rect width="1000" height="1000" fill="${PAPER}"/>
   <g transform="translate(390 326) scale(3.4)">${markTile(14)}</g>
   <text x="500" y="640" text-anchor="middle" font-family="DM Sans, Segoe UI, Helvetica, Arial, sans-serif"
         font-size="58" font-weight="700" letter-spacing="-0.5">
     <tspan fill="${INK}">Duka</tspan><tspan fill="${TERRACOTTA}">Konnect</tspan>
   </text>`,
  1000,
  1000
);

for (const [name, contents] of Object.entries(sources)) {
  writeFileSync(join(pub, name), `${contents.trim()}\n`);
}

/*
 * The boot screen in index.html.
 *
 * It is inline so that something appears before any CSS, font or bundle has
 * loaded, which also means it is a second copy of the mark. The last rename
 * updated the aria-label and left the geometry, so the first thing every user
 * saw was the previous brand for a moment. Generated from here now, between
 * markers, so it cannot drift again.
 */
const bootMark = `          <!-- brand:boot-mark (generated by scripts/build-brand-assets.mjs) -->
          <svg viewBox="0 0 64 64" aria-label="${NAME}">
            <rect width="64" height="64" rx="14" fill="${TERRACOTTA}"/>
            <g fill="none" stroke="${PAPER}" stroke-width="6.5" stroke-linecap="round">
              <path d="M18.5 19 V48"/>
              <path d="M21.5 34.5 L36.5 22"/>
              <path d="M21.5 34.5 L38 48"/>
            </g>
            <circle cx="43.5" cy="17.5" r="5" fill="${SAGE}"/>
          </svg>
          <!-- /brand:boot-mark -->`;

{
  const indexPath = join(root, 'index.html');
  const html = readFileSync(indexPath, 'utf8');
  const replaced = html.replace(
    /[ 	]*<!-- brand:boot-mark[\s\S]*?<!-- \/brand:boot-mark -->/,
    bootMark
  );
  if (replaced === html) {
    console.warn('index.html: boot-mark markers not found, left untouched.');
  } else {
    writeFileSync(indexPath, replaced);
  }
}

// ---------------------------------------------------------------------------
// Raster
// ---------------------------------------------------------------------------
const png = (source, out, width, height = width, fit = 'cover') =>
  sharp(Buffer.from(sources[source]))
    .resize(width, height, { fit, background: PAPER })
    .png()
    .toFile(join(pub, out));

/*
 * A .ico that is really a PNG.
 *
 * Sharp cannot write ICO, but every browser still asks for /favicon.ico by name
 * and the format has allowed a PNG payload since Vista. That is 22 bytes of
 * header around a file sharp can already make, which beats another dependency.
 */
const ico = async () => {
  const body = await sharp(Buffer.from(sources['favicon.svg'])).resize(32, 32).png().toBuffer();
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // one image
  header.writeUInt8(32, 6); // width
  header.writeUInt8(32, 7); // height
  header.writeUInt8(0, 8); // palette size, 0 for truecolour
  header.writeUInt8(0, 9); // reserved
  header.writeUInt16LE(1, 10); // colour planes
  header.writeUInt16LE(32, 12); // bits per pixel
  header.writeUInt32LE(body.length, 14);
  header.writeUInt32LE(22, 18); // offset to the payload
  writeFileSync(join(pub, 'favicon.ico'), Buffer.concat([header, body]));
};

const SPLASHES = [
  [750, 1334], [828, 1792], [1125, 2436], [1170, 2532], [1179, 2556],
  [1242, 2208], [1242, 2688], [1284, 2778], [1290, 2796], [1536, 2048],
  [1620, 2160], [1668, 2388], [2048, 2732],
];

mkdirSync(join(pub, 'splash'), { recursive: true });

await Promise.all([
  png('favicon.svg', 'favicon-32.png', 32),
  png('favicon.svg', 'favicon-64.png', 64),
  png('icon.svg', 'apple-touch-icon.png', 180),
  png('icon.svg', 'pwa-192x192.png', 192),
  png('icon.svg', 'pwa-256x256.png', 256),
  png('icon.svg', 'pwa-384x384.png', 384),
  png('icon.svg', 'pwa-512x512.png', 512),
  png('icon-maskable.svg', 'pwa-maskable-512x512.png', 512),
  png('og-image.svg', 'og-image.png', 1200, 630),
  png('social-square.svg', 'social-square.png', 1080, 1080),
  ico(),
  // 'contain' on the launch images: the source is square and the screens are
  // tall, so the padding is filled with paper rather than cropping the mark.
  ...SPLASHES.map(([w, h]) =>
    png('splash-source.svg', `splash/splash-${w}x${h}.png`, w, h, 'contain')
  ),
]);

console.log(`Brand assets rebuilt for ${NAME}: ${Object.keys(sources).length} SVGs, ${11 + SPLASHES.length} rasters.`);
