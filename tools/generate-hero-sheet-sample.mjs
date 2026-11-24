/**
 * 纯 Node 零外部依赖生成「凛（lin_tinder）」128×128（4×4 格，单帧 32×32）验证用多帧 PNG 精灵表。
 * 运行方式：node tools/generate-hero-sheet-sample.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const SHEET_W = 128;
const SHEET_H = 128;
const CELL = 32;

const PALETTE = {
  o: [0x18, 0x19, 0x2a, 255], // 深靛描边
  f: [0xff, 0xd0, 0xab, 255], // 暖杏发丝/帽檐高光
  h: [0xd9, 0xa2, 0x7e, 255], // 发丝暗部
  s: [0xf0, 0xc8, 0xa0, 255], // 肤色
  e: [0x29, 0x28, 0x3b, 255], // 眼睛
  p: [0x43, 0x62, 0x8e, 255], // 巡火冬衣主色
  P: [0x5c, 0x80, 0xb0, 255], // 冬衣亮面
  q: [0x2d, 0x44, 0x66, 255], // 冬衣暗面
  b: [0xff, 0x7a, 0x2f, 255], // 余烬橙巾
  B: [0xff, 0xb3, 0x5c, 255], // 橙巾/火星亮部
  d: [0x79, 0x48, 0x3a, 255], // 皮靴与护腕
  w: [0xd8, 0xe8, 0xf8, 255], // 刀锋/急步残风亮白
  c: [0x8c, 0xc4, 0xec, 220], // 刀光冰蓝/雪雾轨迹
};

function makeCrcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
}
const CRC_TABLE = makeCrcTable();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodeRgbaPng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  const stride = width * 4;
  const raw = Buffer.alloc(height * (1 + stride));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + stride);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * stride, (y + 1) * stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function createCanvas(w, h) {
  const buf = Buffer.alloc(w * h * 4, 0);
  const set = (x, y, key) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const color = PALETTE[key];
    if (!color) return;
    const idx = (y * w + x) * 4;
    buf[idx] = color[0];
    buf[idx + 1] = color[1];
    buf[idx + 2] = color[2];
    buf[idx + 3] = color[3];
  };
  const rect = (x, y, rw, rh, key) => {
    for (let dy = 0; dy < rh; dy++)
      for (let dx = 0; dx < rw; dx++) set(x + dx, y + dy, key);
  };
  return { buf, set, rect };
}

/** 绘制带 1px 深色描边的头部（默认面朝右 +X） */
function drawHead(g, ox, oy, wince = false) {
  g.rect(ox - 3, oy, 7, 1, "o");
  g.rect(ox - 4, oy + 1, 9, 5, "o");
  g.rect(ox - 3, oy + 6, 7, 1, "o");
  g.rect(ox - 3, oy + 1, 7, 2, "f");
  g.rect(ox - 3, oy + 2, 2, 3, "h");
  g.rect(ox - 1, oy + 3, 5, 3, "s");
  if (wince) {
    g.set(ox + 1, oy + 4, "e");
    g.set(ox + 2, oy + 3, "e");
    g.set(ox + 3, oy + 4, "e");
  } else {
    g.set(ox + 1, oy + 4, "e");
    g.set(ox + 3, oy + 4, "e");
  }
}

/** 绘制冬衣躯干与胸前橙色围巾（含左侧飘带） */
function drawTorso(g, ox, oy, scarfWave = 0) {
  g.rect(ox - 4, oy, 9, 7, "o");
  g.rect(ox - 3, oy + 1, 7, 5, "p");
  g.rect(ox + 1, oy + 1, 3, 4, "P");
  g.rect(ox - 3, oy + 4, 3, 2, "q");
  // 胸前橙巾
  g.rect(ox - 3, oy, 7, 2, "b");
  g.set(ox + 2, oy, "B");
  // 飘在身后的橙巾尾端
  const sy = oy + 1 + scarfWave;
  g.rect(ox - 7, sy, 3, 2, "o");
  g.rect(ox - 6, sy, 2, 1, "b");
  g.set(ox - 7, sy + 1, "B");
}

function drawLegsStanding(g, ox, footY, spread = 0) {
  const lx = ox - 3 - spread;
  const rx = ox + 1 + spread;
  g.rect(lx, footY - 3, 3, 4, "o");
  g.rect(rx, footY - 3, 3, 4, "o");
  g.rect(lx + 1, footY - 3, 1, 2, "d");
  g.rect(rx + 1, footY - 3, 1, 2, "d");
  g.set(lx + 1, footY - 1, "b");
  g.set(rx + 1, footY - 1, "b");
}

function drawIdleFrame(g, cx, cy, step) {
  const lift = step === 1 || step === 2 ? -1 : 0;
  const wave = [0, -1, 0, 1][step];
  const footY = cy + 27;
  drawLegsStanding(g, cx + 16, footY, 0);
  drawTorso(g, cx + 16, cy + 17 + lift, wave);
  drawHead(g, cx + 16, cy + 10 + lift);
  // 右手执余烬短杖/火炬微光
  const handY = cy + 20 + lift;
  g.rect(cx + 20, handY - 1, 3, 3, "o");
  g.set(cx + 21, handY, "d");
  g.set(cx + 22, handY - 2, "b");
  g.set(cx + 22, handY - 3 + (step % 2), "B");
}

function drawWalkFrame(g, cx, cy, step) {
  const bob = step % 2 === 0 ? 1 : 0;
  const ox = cx + 16;
  const footY = cy + 27;
  if (step === 0) {
    // 左腿迈前、右腿蹬后
    g.rect(ox - 5, footY - 4, 3, 4, "o");
    g.set(ox - 4, footY - 2, "d");
    g.rect(ox + 2, footY - 3, 3, 4, "o");
    g.set(ox + 3, footY - 2, "d");
  } else if (step === 1) {
    drawLegsStanding(g, ox, footY, 0);
    g.rect(ox - 1, footY - 4, 3, 3, "o");
  } else if (step === 2) {
    // 右腿大步向前、左腿在后
    g.rect(ox - 4, footY - 3, 3, 4, "o");
    g.set(ox - 3, footY - 2, "d");
    g.rect(ox + 3, footY - 3, 3, 4, "o");
    g.set(ox + 4, footY - 2, "d");
  } else {
    drawLegsStanding(g, ox, footY, 0);
  }
  drawTorso(g, ox, cy + 17 + bob, step % 2 === 0 ? -1 : 1);
  drawHead(g, ox, cy + 10 + bob);
  // 摆臂与火光
  const armX = step === 0 ? ox + 1 : step === 2 ? ox + 5 : ox + 3;
  g.rect(armX, cy + 20 + bob, 3, 2, "o");
  g.set(armX + 1, cy + 19 + bob, "b");
}

function drawAttackFrame(g, cx, cy, step) {
  const shiftX = [-1, 2, 2, 1][step];
  const ox = cx + 16 + shiftX;
  const footY = cy + 27;
  drawLegsStanding(g, ox, footY, step === 1 || step === 2 ? 1 : 0);
  drawTorso(g, ox, cy + 17, step === 1 ? -1 : 0);
  drawHead(g, ox, cy + 10);

  if (step === 0) {
    // 蓄力举刃至肩后上方
    g.rect(ox - 4, cy + 7, 3, 5, "o");
    g.rect(ox - 3, cy + 7, 1, 4, "w");
    g.set(ox - 3, cy + 6, "B");
  } else if (step === 1) {
    // 前劈主帧：明亮刀弧横扫右侧
    g.rect(ox + 4, cy + 17, 6, 3, "o");
    g.rect(ox + 5, cy + 18, 5, 1, "w");
    for (let dy = -6; dy <= 6; dy++) {
      const arcX = ox + 9 - Math.floor((dy * dy) / 10);
      g.set(arcX, cy + 18 + dy, "w");
      g.set(arcX - 1, cy + 18 + dy, Math.abs(dy) < 4 ? "B" : "c");
    }
  } else if (step === 2) {
    // 挥砍延伸残影与火星
    g.rect(ox + 4, cy + 18, 6, 2, "w");
    g.set(ox + 10, cy + 16, "B");
    g.set(ox + 11, cy + 19, "b");
    g.set(ox + 9, cy + 22, "c");
  } else {
    // 收势回防
    g.rect(ox + 4, cy + 19, 3, 3, "o");
    g.set(ox + 5, cy + 19, "w");
    g.set(ox + 6, cy + 18, "b");
  }
}

function drawDashFrame(g, cx, cy, step) {
  const ox = cx + 18;
  const footY = cy + 27;
  // 压低身姿前冲（总高约 15px）
  g.rect(ox - 5, footY - 3, 4, 3, "o");
  g.rect(ox + 1, footY - 2, 4, 3, "o");
  g.set(ox - 4, footY - 2, "d");
  g.set(ox + 2, footY - 1, "d");
  drawTorso(g, ox, cy + 19, 0);
  // 拉长的水平橙巾残影
  g.rect(cx + 5 + step, cy + 19, 8, 2, "b");
  g.rect(cx + 4 + step, cy + 19, 3, 1, "B");
  drawHead(g, ox + 1, cy + 13);
  // 踏雪急步气流线
  g.rect(cx + 3, cy + 24 - step, 5, 1, "w");
  g.rect(cx + 5, cy + 16 + step, 4, 1, "c");
}

function drawHurtFrame(g, cx, cy) {
  const ox = cx + 14;
  const footY = cy + 27;
  drawLegsStanding(g, ox, footY, 1);
  drawTorso(g, ox, cy + 17, -1);
  drawHead(g, ox - 1, cy + 10, true);
  // 受击双臂护前与火花
  g.rect(ox + 4, cy + 15, 2, 3, "o");
  g.set(ox + 6, cy + 13, "B");
  g.set(ox + 7, cy + 16, "w");
}

function drawDeadFrame(g, cx, cy) {
  const baseY = cy + 27;
  // 横向倒在雪地（y=22..28）
  g.rect(cx + 7, baseY - 4, 18, 5, "o");
  g.rect(cx + 8, baseY - 3, 4, 3, "d"); // 靴子在左
  g.rect(cx + 12, baseY - 3, 7, 3, "p"); // 冬衣居中
  g.rect(cx + 14, baseY - 4, 4, 2, "b"); // 散落橙巾
  g.rect(cx + 19, baseY - 4, 5, 4, "f"); // 兜帽与头在右
  g.rect(cx + 20, baseY - 2, 3, 2, "s");
  g.set(cx + 22, baseY - 2, "e");
}

function buildLinTinderSheet() {
  const g = createCanvas(SHEET_W, SHEET_H);
  for (let frame = 0; frame < 16; frame++) {
    const cx = (frame % 4) * CELL;
    const cy = Math.floor(frame / 4) * CELL;
    if (frame < 4) drawIdleFrame(g, cx, cy, frame);
    else if (frame < 8) drawWalkFrame(g, cx, cy, frame - 4);
    else if (frame < 12) drawAttackFrame(g, cx, cy, frame - 8);
    else if (frame < 14) drawDashFrame(g, cx, cy, frame - 12);
    else if (frame === 14) drawHurtFrame(g, cx, cy);
    else drawDeadFrame(g, cx, cy);
  }
  return encodeRgbaPng(SHEET_W, SHEET_H, g.buf);
}

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outPath = path.join(
  rootDir,
  "src/frontend/public/assets/sprites/heroes/lin_tinder.png",
);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
const png = buildLinTinderSheet();
fs.writeFileSync(outPath, png);
console.log(
  `Generated ${path.relative(rootDir, outPath)} (${SHEET_W}x${SHEET_H}, ${png.length} bytes)`,
);
