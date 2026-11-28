/**
 * Resize the original hero portraits in assets/portraits-backup/ to 512×512
 * Lanczos PNGs in src/frontend/public/assets/portraits/.
 * Run with node tools/process-hero-portraits.mjs.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const HERO_IDS = [
  "lin_tinder",
  "gale_smith",
  "suheng_herb",
  "corvus_hunt",
  "alvin_scribe",
];

const TARGET_SIZE = 512;

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backupDir = path.join(rootDir, "assets/portraits-backup");
const outDir = path.join(rootDir, "src/frontend/public/assets/portraits");

fs.mkdirSync(outDir, { recursive: true });

for (const heroId of HERO_IDS) {
  const srcPath = path.join(backupDir, `${heroId}.orig.jpg`);
  if (!fs.existsSync(srcPath)) {
    throw new Error(`Missing source backup portrait: ${srcPath}`);
  }
  const meta = await sharp(srcPath).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (w < TARGET_SIZE || h < TARGET_SIZE) {
    throw new Error(`Source portrait is too small: ${srcPath} (${w}x${h})`);
  }

  let pipeline = sharp(srcPath);
  if (w !== h) {
    const side = Math.min(w, h);
    const left = Math.floor((w - side) / 2);
    // Prefer to the head and upper body (tops are trimmed in the opposite direction) when non-correction is not the norm)
    const top = Math.min(h - side, Math.floor((h - side) * 0.15));
    pipeline = pipeline.extract({ left, top, width: side, height: side });
  }

  const outPath = path.join(outDir, `${heroId}.png`);
  await pipeline
    .resize(TARGET_SIZE, TARGET_SIZE, {
      kernel: sharp.kernel.lanczos3,
      fastShrinkOnLoad: false,
    })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(outPath);

  const outMeta = await sharp(outPath).metadata();
  const bytes = fs.statSync(outPath).size;
  console.log(
    `${heroId}.png: ${w}x${h} -> ${outMeta.width}x${outMeta.height} (${outMeta.format}, ${bytes} bytes)`,
  );
}
