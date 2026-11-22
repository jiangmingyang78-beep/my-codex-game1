export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeOut = t => 1 - (1 - t) * (1 - t);

export function createBrowserCanvas(width, height) {
  if (typeof document === "undefined") {
    throw new Error("VFX needs a browser canvas or an injected createCanvas(width, height).");
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function context2d(canvas, options) {
  const context = canvas.getContext("2d", options);
  if (!context) throw new Error("Unable to create a 2D canvas context for Emberwood VFX.");
  return context;
}

export function parseColor(color) {
  if (typeof color === "string") {
    if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)) {
      const hex = color.length === 4 ? color.slice(1).replace(/./g, digit => digit + digit) : color.slice(1);
      return [0, 2, 4].map(index => parseInt(hex.slice(index, index + 2), 16));
    }
    const rgb = /^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*(?:\d*\.)?\d+)?\s*\)$/i.exec(color);
    if (rgb) return rgb.slice(1, 4).map(channel => clamp(Number(channel), 0, 255));
  }
  if (Array.isArray(color) && color.length === 3 && color.every(Number.isFinite)) {
    return color.map(channel => clamp(channel, 0, 255));
  }
  throw new TypeError(`Expected #RGB, #RRGGBB, rgb(), rgba() or an RGB array. Received ${color}.`);
}

export const toHex = rgb => "#" + rgb.map(channel =>
  clamp(Math.round(channel), 0, 255).toString(16).padStart(2, "0")).join("");

export const mixColor = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

export function shiftColor(color, amount) {
  const target = amount > 0 ? [255, 238, 206] : [22, 24, 46];
  return mixColor(Array.isArray(color) ? color : parseColor(color), target, Math.abs(amount));
}

export function radialCanvas(makeCanvas, color, size, stops) {
  const canvas = makeCanvas(size, size);
  const context = context2d(canvas);
  const rgb = parseColor(color).map(Math.round).join(",");
  const center = size / 2;
  const gradient = context.createRadialGradient(center, center, 0, center, center, center);
  for (const [offset, alpha] of stops) gradient.addColorStop(offset, `rgba(${rgb},${alpha})`);
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  return canvas;
}

export function setBounded(cache, key, value, limit = 256) {
  if (cache.size >= limit) cache.delete(cache.keys().next().value);
  cache.set(key, value);
  return value;
}
