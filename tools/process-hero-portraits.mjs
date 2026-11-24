/**
 * 将 assets/portraits-backup/ 下的原始英雄半身像缩至 512×512 Lanczos PNG，
 * 输出至 src/frontend/public/assets/portraits/。
 * 运行方式：node tools/process-hero-portraits.mjs
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
    // 非正方形时优先保留头部与上半身（顶部偏上裁剪）
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
