/**
 * 批量生成 5 位英雄《光明旅者》极简无五官剪影风 128×128（4×4×32）精灵表。
 * 用法：node tools/generate-hero-sheets.mjs [--preview <dir>]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { draw as drawAlvin } from "./hero-sheets/drawers/alvin.mjs";
import { draw as drawCorvus } from "./hero-sheets/drawers/corvus.mjs";
import { draw as drawGale } from "./hero-sheets/drawers/gale.mjs";
import { draw as drawLin } from "./hero-sheets/drawers/lin.mjs";
import { draw as drawSuheng } from "./hero-sheets/drawers/suheng.mjs";
import { HERO_SPECS, O, PALETTES } from "./hero-sheets/palette.mjs";
import { blit, createLayer, encodeRgbaPng, mergeFx, outline, upscale } from "./hero-sheets/png.mjs";
import { poseFor } from "./hero-sheets/rig.mjs";

const SHEET_W = 128;
const SHEET_H = 128;
const CELL = 32;

const DRAWERS = {
  lin_tinder: drawLin,
  gale_smith: drawGale,
  suheng_herb: drawSuheng,
  corvus_hunt: drawCorvus,
  alvin_scribe: drawAlvin,
};

function parsePreviewDir(argv) {
  const idx = argv.indexOf("--preview");
  return idx >= 0 && argv[idx + 1] ? path.resolve(argv[idx + 1]) : null;
}

/** 校验单帧脚底基线（y = 27）与水平质心（16 ± 3）。 */
function assertFrameMetrics(id, frame, layer) {
  let maxY = -1;
  let sumX = 0;
  let count = 0;
  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < CELL; x++) {
      const a = layer.buf[(y * CELL + x) * 4 + 3];
      if (a > 0) {
        if (y > maxY) maxY = y;
        sumX += x;
        count++;
      }
    }
  }
  if (count === 0) throw new Error(`${id} frame ${frame}: 帧内容为空`);
  if (maxY !== 27) {
    throw new Error(`${id} frame ${frame}: 最低不透明行是 ${maxY}，预期为 27`);
  }
  const centroidX = sumX / count;
  if (centroidX < 13 || centroidX > 19) {
    throw new Error(
      `${id} frame ${frame}: 水平质心 ${centroidX.toFixed(2)} 超出 16±3 范围`,
    );
  }
}

/** 校验第 0 帧身体身高与整表 RGB 色数上限（≤ 5）。 */
function assertSheetMetrics(spec, frame0Body, sheetBuf) {
  let minY = CELL;
  let maxY = -1;
  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < CELL; x++) {
      if (frame0Body.buf[(y * CELL + x) * 4 + 3] > 0) {
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const bodyHeight = maxY - minY + 1;
  if (Math.abs(bodyHeight - spec.height) > 1) {
    throw new Error(
      `${spec.id} frame 0: 身高 ${bodyHeight}px 与目标 ${spec.height}±1 不符`,
    );
  }

  const rgbSet = new Set();
  for (let i = 0; i < sheetBuf.length; i += 4) {
    if (sheetBuf[i + 3] === 0) continue;
    rgbSet.add(`${sheetBuf[i]},${sheetBuf[i + 1]},${sheetBuf[i + 2]}`);
  }
  if (rgbSet.size > 5) {
    throw new Error(`${spec.id}: RGB 色数为 ${rgbSet.size}，超过 5 色上限`);
  }
  return { bodyHeight, colors: rgbSet.size };
}

function generateHero(spec, outDir, previewDir) {
  const pal = PALETTES[spec.id];
  const draw = DRAWERS[spec.id];
  const sheetBuf = Buffer.alloc(SHEET_W * SHEET_H * 4, 0);
  let frame0Body = null;

  for (let frame = 0; frame < 16; frame++) {
    const pose = poseFor(frame);
    const layer = createLayer(CELL, CELL);
    const fx = createLayer(CELL, CELL);
    draw(layer, fx, pose, pal);
    outline(layer, O);
    if (frame === 0) {
      frame0Body = createLayer(CELL, CELL);
      layer.buf.copy(frame0Body.buf);
    }
    mergeFx(layer, fx);
    assertFrameMetrics(spec.id, frame, layer);
    const cx = (frame % 4) * CELL;
    const cy = Math.floor(frame / 4) * CELL;
    blit(sheetBuf, SHEET_W, layer, cx, cy);
  }

  const metrics = assertSheetMetrics(spec, frame0Body, sheetBuf);
  const outPath = path.join(outDir, spec.file);
  fs.writeFileSync(outPath, encodeRgbaPng(SHEET_W, SHEET_H, sheetBuf));

  if (previewDir) {
    const x4 = upscale(sheetBuf, SHEET_W, SHEET_H, 4, 28);
    const pPath = path.join(previewDir, `${spec.id}_x4.png`);
    fs.writeFileSync(pPath, encodeRgbaPng(x4.width, x4.height, x4.buf));
  }
  return metrics;
}

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(rootDir, "src/frontend/public/assets/sprites/heroes");
const previewDir = parsePreviewDir(process.argv.slice(2));
fs.mkdirSync(outDir, { recursive: true });
if (previewDir) fs.mkdirSync(previewDir, { recursive: true });

try {
  for (const spec of HERO_SPECS) {
    const m = generateHero(spec, outDir, previewDir);
    console.log(
      `[OK] ${spec.file} (128x128, height=${m.bodyHeight}px, colors=${m.colors})`,
    );
  }
} catch (err) {
  console.error(`[FAIL] ${err.message}`);
  process.exitCode = 1;
}
