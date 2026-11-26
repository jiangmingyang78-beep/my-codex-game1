/**
 * 纯 Node + 内置 zlib 的 PNG 编码与像素画布工具。
 */
import zlib from "node:zlib";

function makeCrcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
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

/** 将 RGBA 像素缓冲区编码为无压缩过滤的 PNG Buffer。 */
export function encodeRgbaPng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
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

/** 创建指定尺寸的 RGBA 图层，提供像素、矩形与线段绘制方法。 */
export function createLayer(w = 32, h = 32) {
  const buf = Buffer.alloc(w * h * 4, 0);
  const get = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return [0, 0, 0, 0];
    const i = (y * w + x) * 4;
    return [buf[i], buf[i + 1], buf[i + 2], buf[i + 3]];
  };
  const set = (x, y, rgba) => {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || iy < 0 || ix >= w || iy >= h || !rgba) return;
    const i = (iy * w + ix) * 4;
    buf[i] = rgba[0];
    buf[i + 1] = rgba[1];
    buf[i + 2] = rgba[2];
    buf[i + 3] = rgba[3] ?? 255;
  };
  const rect = (x, y, rw, rh, rgba) => {
    for (let dy = 0; dy < rh; dy++) {
      for (let dx = 0; dx < rw; dx++) set(x + dx, y + dy, rgba);
    }
  };
  const hline = (x, y, len, rgba) => rect(x, y, len, 1, rgba);
  const vline = (x, y, len, rgba) => rect(x, y, 1, len, rgba);
  return { w, h, buf, get, set, rect, hline, vline };
}

/** 对图层执行 4 邻域外描边：凡透明且紧邻不透明像素的格子均填为描边色。 */
export function outline(layer, rgba) {
  const { w, h, buf } = layer;
  const src = Buffer.from(buf);
  const isOpaque = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    return src[(y * w + x) * 4 + 3] > 0;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (src[i + 3] > 0) continue;
      if (
        isOpaque(x - 1, y) ||
        isOpaque(x + 1, y) ||
        isOpaque(x, y - 1) ||
        isOpaque(x, y + 1)
      ) {
        buf[i] = rgba[0];
        buf[i + 1] = rgba[1];
        buf[i + 2] = rgba[2];
        buf[i + 3] = rgba[3] ?? 255;
      }
    }
  }
}

/** 将不描边的特效层叠加到主体层上（半透明光晕仅落在透明像素，避免产生混合杂色）。 */
export function mergeFx(base, fx) {
  const { w, h, buf } = base;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const fa = fx.buf[i + 3];
      if (fa === 0) continue;
      if (fa < 255 && buf[i + 3] > 0) continue;
      buf[i] = fx.buf[i];
      buf[i + 1] = fx.buf[i + 1];
      buf[i + 2] = fx.buf[i + 2];
      buf[i + 3] = fa;
    }
  }
}

/** 将单帧图层拷贝到大表指定格位 (cx, cy)。 */
export function blit(sheetBuf, sheetW, layer, cx, cy) {
  for (let y = 0; y < layer.h; y++) {
    for (let x = 0; x < layer.w; x++) {
      const si = (y * layer.w + x) * 4;
      const di = ((cy + y) * sheetW + (cx + x)) * 4;
      sheetBuf[di] = layer.buf[si];
      sheetBuf[di + 1] = layer.buf[si + 1];
      sheetBuf[di + 2] = layer.buf[si + 2];
      sheetBuf[di + 3] = layer.buf[si + 3];
    }
  }
}

/** 最近邻放大预览图，并可选地在每行第 28 像素处绘制基线参考线。 */
export function upscale(buf, w, h, k, baselineY = -1) {
  const outW = w * k;
  const outH = h * k;
  const out = Buffer.alloc(outW * outH * 4, 0);
  for (let y = 0; y < outH; y++) {
    const sy = Math.floor(y / k);
    for (let x = 0; x < outW; x++) {
      const sx = Math.floor(x / k);
      const si = (sy * w + sx) * 4;
      const di = (y * outW + x) * 4;
      if (buf[si + 3] > 0) {
        out[di] = buf[si];
        out[di + 1] = buf[si + 1];
        out[di + 2] = buf[si + 2];
        out[di + 3] = buf[si + 3];
      } else {
        // 棋盘格暗背景方便看清透明与深色轮廓
        const dark = (Math.floor(x / (k * 4)) + Math.floor(y / (k * 4))) % 2 === 0;
        out[di] = dark ? 22 : 30;
        out[di + 1] = dark ? 26 : 34;
        out[di + 2] = dark ? 40 : 50;
        out[di + 3] = 255;
      }
      if (baselineY >= 0 && sy % 32 === baselineY && y % k === 0) {
        out[di] = 255;
        out[di + 1] = 80;
        out[di + 2] = 120;
        out[di + 3] = 255;
      }
    }
  }
  return { width: outW, height: outH, buf: out };
}
