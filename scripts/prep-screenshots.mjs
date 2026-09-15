#!/usr/bin/env node
/**
 * Turns raw phone screenshots into something fit for a landing page.
 *
 * A screenshot straight off an Android carries three things nobody wants to
 * see: the status bar with somebody's battery and notifications, the browser
 * chrome with the URL half cut off, and the system navigation bar. Cropping
 * them is the difference between a product shot and a photo of a phone.
 *
 * It also blurs whatever you point it at, because these are real shops. Phone
 * numbers, an email address and customer names all appear in ours, and none of
 * them belong on a public page.
 *
 * Usage:
 *   node scripts/prep-screenshots.mjs --in raw-screens --out public/screens
 *
 * Per-file blur regions live in a `blur.json` beside the input files, as
 * fractions of width and height so they survive any resolution:
 *
 *   { "home.png": [[0.12, 0.44, 0.40, 0.05]] }   // x, y, width, height
 */
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const inDir = path.resolve(arg('in', 'raw-screens'));
const outDir = path.resolve(arg('out', 'public/screens'));

// Defaults measured off a 720 x 1600 Chrome screenshot: status bar, then the
// URL bar, then the system nav at the bottom. Scaled by height, so a phone with
// a different resolution lands in roughly the same place. Override when the
// crop is visibly wrong rather than guessing at the numbers.
const TOP_FRACTION = Number(arg('top', 0.109));
const BOTTOM_FRACTION = Number(arg('bottom', 0.053));
const WIDTH = Number(arg('width', 720));

const run = async () => {
  if (!existsSync(inDir)) {
    console.error(`No input folder at ${inDir}. Put the screenshots there first.`);
    process.exit(1);
  }

  await mkdir(outDir, { recursive: true });

  const blurPath = path.join(inDir, 'blur.json');
  const blurs = existsSync(blurPath) ? JSON.parse(await readFile(blurPath, 'utf8')) : {};

  const files = (await readdir(inDir)).filter((f) => /\.(png|jpe?g)$/i.test(f));
  if (files.length === 0) {
    console.error(`Nothing to do: no images in ${inDir}`);
    process.exit(1);
  }

  for (const file of files) {
    const source = sharp(path.join(inDir, file));
    const { width, height } = await source.metadata();

    const top = Math.round(height * TOP_FRACTION);
    const bottom = Math.round(height * BOTTOM_FRACTION);
    const cropped = { left: 0, top, width, height: height - top - bottom };

    let image = sharp(path.join(inDir, file)).extract(cropped);

    // Blur happens after the crop, so the fractions you measure are the ones
    // you see in the output rather than in the original.
    const regions = blurs[file] ?? [];
    if (regions.length > 0) {
      const base = await image.png().toBuffer();
      const patches = [];

      for (const [fx, fy, fw, fh] of regions) {
        const box = {
          left: Math.max(0, Math.round(cropped.width * fx)),
          top: Math.max(0, Math.round(cropped.height * fy)),
          width: Math.min(cropped.width, Math.round(cropped.width * fw)),
          height: Math.min(cropped.height, Math.round(cropped.height * fh)),
        };
        if (box.width < 1 || box.height < 1) continue;

        // Blur the patch itself rather than drawing over it. A solid block
        // shouts "something was hidden here"; a blur reads as a real screen.
        const patch = await sharp(base).extract(box).blur(14).png().toBuffer();
        patches.push({ input: patch, left: box.left, top: box.top });
      }

      image = sharp(base).composite(patches);
    }

    const name = `${path.parse(file).name}.webp`;
    await image
      .resize({ width: WIDTH, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(path.join(outDir, name));

    console.log(
      `${file} -> ${name}  cropped ${top}px top, ${bottom}px bottom` +
        (regions.length ? `, ${regions.length} blurred` : '')
    );
  }

  // A starter config, so the first run tells you how to blur rather than
  // leaving you to find the format in the source.
  if (!existsSync(blurPath)) {
    await writeFile(
      blurPath,
      JSON.stringify(
        Object.fromEntries(files.map((f) => [f, []])),
        null,
        2
      ) + '\n'
    );
    console.log(`\nWrote ${blurPath}. Add [x, y, width, height] fractions and run again.`);
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
