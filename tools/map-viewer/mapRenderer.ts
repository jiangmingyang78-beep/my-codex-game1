import type { LayerFlags, MapObject, MapSnapshot, MapSpawn } from "./types";

export const CELL_PX = 6;

export interface Camera {
  cx: number;
  cy: number;
  zoom: number;
}

export const OBJ_COLOR: Record<string, string> = {
  campfire: "#ff7a2f",
  relay_socket: "#ffb347",
  gate: "#ffd166",
  beacon: "#7ce8ff",
  wood: "#9c6b43",
  ore: "#90b7d6",
  stone: "#9ca3af",
  herb: "#7be088",
  food: "#f06e84",
  fiber: "#c9b578",
  story_prop: "#d7b4ff",
  explosive_barrel: "#ff5a47",
  mirror_lamp: "#b8f4ff",
  altar: "#8be9fd",
  board: "#f1c283",
  landmark: "#a9d387",
  core: "#ffd166",
};

const tileHash = (x: number, y: number) => (((x * 374761393 + y * 668265263) ^ 0x5bd1e995) >>> 0) % 17;

export function bakeTerrainCanvas(snap: MapSnapshot): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = snap.width * CELL_PX;
  c.height = snap.height * CELL_PX;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;

  for (let gy = 0; gy < snap.height; gy += 1) {
    for (let gx = 0; gx < snap.width; gx += 1) {
      const idx = gy * snap.width + gx;
      const tid = snap.tiles[idx];
      const pal = snap.palette[tid] || snap.palette[0];
      const px = gx * CELL_PX;
      const py = gy * CELL_PX;
      const h = tileHash(snap.originX + gx, snap.originY + gy);

      ctx.fillStyle = pal.color;
      if (snap.biomeColors && snap.biomeIds && (tid === 1 || tid === 3 || tid === 4)) {
        ctx.fillStyle = snap.biomeColors[snap.biomeIds[idx]] || pal.color;
      }
      ctx.fillRect(px, py, CELL_PX, CELL_PX);

      const acc = pal.accent || "#ffffff";
      if (pal.key === "tree") {
        ctx.fillStyle = acc;
        ctx.fillRect(px + 1, py + 1, CELL_PX - 2, CELL_PX - 2);
        ctx.fillStyle = "#0e1920";
        ctx.fillRect(px + 2, py + CELL_PX - 1, 2, 1);
      } else if (pal.key === "wall" || pal.key === "rock") {
        ctx.fillStyle = acc;
        ctx.fillRect(px, py, CELL_PX, 1);
        ctx.fillRect(px + (h % 3), py + 2, 2, 2);
      } else if (pal.key === "ice" || pal.key === "water") {
        ctx.fillStyle = acc;
        if (h < 7) ctx.fillRect(px + 1, py + (h % 4) + 1, 3, 1);
      } else if (pal.key === "coal_vein") {
        ctx.fillStyle = acc;
        ctx.fillRect(px + 2, py + 2, 2, 2);
      } else if (pal.key === "fireBase") {
        ctx.fillStyle = acc;
        ctx.fillRect(px + 1, py + 1, CELL_PX - 2, CELL_PX - 2);
      } else if (pal.key === "floor") {
        ctx.fillStyle = acc;
        ctx.fillRect(px, py + 2, CELL_PX, 1);
      } else if (h < 4) {
        ctx.fillStyle = acc;
        ctx.fillRect(px + (h % 4) + 1, py + ((h * 3) % 4) + 1, 1, 1);
      }
    }
  }
  return c;
}

export function renderScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  baked: HTMLCanvasElement,
  snap: MapSnapshot,
  cam: Camera,
  layers: LayerFlags,
  campLevel: number,
  hoverTile: { tx: number; ty: number } | null,
  selectedId: string | null,
): void {
  ctx.fillStyle = "#080b14";
  ctx.fillRect(0, 0, w, h);

  const pxPerTile = CELL_PX * cam.zoom;
  const toScreenX = (tx: number) => w / 2 + (tx - cam.cx) * pxPerTile;
  const toScreenY = (ty: number) => h / 2 + (ty - cam.cy) * pxPerTile;

  const mapX = toScreenX(snap.originX);
  const mapY = toScreenY(snap.originY);
  const mapW = snap.width * pxPerTile;
  const mapH = snap.height * pxPerTile;

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(baked, mapX, mapY, mapW, mapH);

  if (layers.collision) {
    ctx.fillStyle = "rgba(255, 62, 92, 0.34)";
    for (let gy = 0; gy < snap.height; gy += 1) {
      for (let gx = 0; gx < snap.width; gx += 1) {
        if (!snap.solidMask[gy * snap.width + gx]) continue;
        ctx.fillRect(toScreenX(snap.originX + gx), toScreenY(snap.originY + gy), pxPerTile, pxPerTile);
      }
    }
  }

  if (layers.grid || pxPerTile >= 18) {
    ctx.strokeStyle = pxPerTile >= 18 ? "rgba(220, 231, 242, 0.16)" : "rgba(220, 231, 242, 0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let gx = 0; gx <= snap.width; gx += 1) {
      const sx = Math.round(toScreenX(snap.originX + gx)) + 0.5;
      if (sx >= 0 && sx <= w) { ctx.moveTo(sx, Math.max(0, mapY)); ctx.lineTo(sx, Math.min(h, mapY + mapH)); }
    }
    for (let gy = 0; gy <= snap.height; gy += 1) {
      const sy = Math.round(toScreenY(snap.originY + gy)) + 0.5;
      if (sy >= 0 && sy <= h) { ctx.moveTo(Math.max(0, mapX), sy); ctx.lineTo(Math.min(w, mapX + mapW), sy); }
    }
    ctx.stroke();
  }

  if (layers.lights) {
    for (const obj of snap.objects) {
      const rTiles = obj.kind === "campfire" ? (snap.campRadiiByLevel[campLevel] ?? obj.radiusTiles ?? 4) : obj.radiusTiles;
      if (!Number.isFinite(rTiles) || !rTiles || rTiles <= 0) continue;
      const sx = toScreenX(obj.tx + 0.5);
      const sy = toScreenY(obj.ty + 0.5);
      const rPx = rTiles * pxPerTile;
      const grad = ctx.createRadialGradient(sx, sy, Math.max(2, rPx * 0.1), sx, sy, rPx);
      const rgb = obj.kind === "beacon" ? "124, 232, 255" : "255, 138, 48";
      grad.addColorStop(0, `rgba(${rgb}, 0.28)`);
      grad.addColorStop(1, `rgba(${rgb}, 0.02)`);
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(sx, sy, rPx, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = `rgba(${rgb}, 0.72)`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  if (layers.regions) {
    ctx.save();
    ctx.font = "600 12px ui-monospace, monospace";
    for (const reg of snap.regions) {
      const rx = toScreenX(reg.x), ry = toScreenY(reg.y);
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = reg.dashed ? "rgba(124, 232, 255, 0.45)" : "rgba(255, 209, 102, 0.55)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(rx, ry, reg.w * pxPerTile, reg.h * pxPerTile);
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(8, 11, 20, 0.78)";
      ctx.fillRect(rx + 4, ry + 4, ctx.measureText(reg.name).width + 10, 18);
      ctx.fillStyle = "#ffd166";
      ctx.fillText(reg.name, rx + 9, ry + 17);
    }
    ctx.restore();
  }

  if (layers.resources) {
    for (const obj of snap.objects) drawObjectMarker(ctx, obj, toScreenX(obj.tx + 0.5), toScreenY(obj.ty + 0.5), pxPerTile, obj.id === selectedId);
  }
  if (layers.spawns) {
    for (const sp of snap.spawns) drawSpawnMarker(ctx, sp, toScreenX(sp.tx + 0.5), toScreenY(sp.ty + 0.5), pxPerTile, sp.id === selectedId);
  }

  if (hoverTile) {
    const hx = toScreenX(hoverTile.tx), hy = toScreenY(hoverTile.ty);
    ctx.strokeStyle = "#7ce8ff";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(hx, hy, pxPerTile, pxPerTile);
  }
}

function drawObjectMarker(ctx: CanvasRenderingContext2D, obj: MapObject, sx: number, sy: number, pxPerTile: number, selected: boolean) {
  const r = Math.max(3, Math.min(8, pxPerTile * 0.34));
  ctx.fillStyle = OBJ_COLOR[obj.kind] || "#ffffff";
  ctx.strokeStyle = selected ? "#ffd166" : "#0b0e17";
  ctx.lineWidth = selected ? 2.5 : 1.2;
  ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
  ctx.strokeRect(sx - r, sy - r, r * 2, r * 2);
  if (pxPerTile >= 12 || ["campfire", "relay_socket", "gate", "beacon", "altar", "core"].includes(obj.kind)) {
    ctx.font = "11px sans-serif";
    ctx.fillStyle = "#dce7f2";
    ctx.fillText(obj.label, sx + r + 3, sy + 4);
  }
}

function drawSpawnMarker(ctx: CanvasRenderingContext2D, sp: MapSpawn, sx: number, sy: number, pxPerTile: number, selected: boolean) {
  const color = sp.kind === "hero" ? "#4ade80" : sp.kind === "boss" ? "#ff3b5c" : sp.kind === "night" ? "#c084fc" : sp.kind === "site" ? "#38bdf8" : "#fb923c";
  const r = sp.kind === "boss" || sp.kind === "hero" ? 6 : 4;
  ctx.fillStyle = color;
  ctx.strokeStyle = selected ? "#ffd166" : "#0b0e17";
  ctx.lineWidth = selected ? 2.5 : 1.5;
  ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  if (pxPerTile >= 10 || sp.kind === "boss" || sp.kind === "hero" || sp.kind === "site") {
    ctx.font = "11px sans-serif";
    ctx.fillStyle = color;
    ctx.fillText(sp.label, sx + r + 4, sy + 4);
  }
}

export function exportPanoramaPng(baked: HTMLCanvasElement, snap: MapSnapshot, layers: LayerFlags, campLevel: number): void {
  const c = document.createElement("canvas");
  c.width = baked.width;
  c.height = baked.height;
  const ctx = c.getContext("2d")!;
  renderScene(ctx, c.width, c.height, baked, snap, { cx: snap.originX + snap.width / 2, cy: snap.originY + snap.height / 2, zoom: 1 }, layers, campLevel, null, null);
  c.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `emberwood_${snap.mode}_map.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, "image/png");
}
