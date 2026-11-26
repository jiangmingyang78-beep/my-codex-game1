import { CELL_PX, type Camera, bakeTerrainCanvas, exportPanoramaPng, renderScene } from "./mapRenderer";
import { combatOverlay } from "./combatOverlay";
import { blocked, editable, selected, type Session } from "./state/selection";
import { changePoint, place, removePoint } from "./state/mapCommands";
import type { LayerFlags } from "./types";
export function mapInteraction(s: Session) {
  const canvas = document.querySelector<HTMLCanvasElement>("#mapCanvas")!,
    ctx = canvas.getContext("2d")!;
  const cam: Camera = { cx: 0, cy: 0, zoom: 1 };
  const layers: LayerFlags = {
    regions: true,
    lights: true,
    resources: true,
    spawns: true,
    collision: false,
    grid: false,
  };
  let level = 1,
    baked = bakeTerrainCanvas(s.map),
    terrain = s.map.tiles;
  let hover: { tx: number; ty: number } | null = null;
  let drag: {
    x: number;
    y: number;
    cx: number;
    cy: number;
    pan: boolean;
    moved: boolean;
    target?: ReturnType<typeof selected>;
  } | null = null;
  const id = (k: string) => document.getElementById(k)!;
  const hit = (tx: number, ty: number) => [...s.map.spawns, ...s.map.objects].find((p) => p.tx === tx && p.ty === ty);
  function draw() {
    if (s.map.tiles !== terrain) {
      terrain = s.map.tiles;
      baked = bakeTerrainCanvas(s.map);
    }
    const r = canvas.getBoundingClientRect();
    if (canvas.width !== Math.floor(r.width) || canvas.height !== Math.floor(r.height)) {
      canvas.width = Math.max(1, Math.floor(r.width));
      canvas.height = Math.max(1, Math.floor(r.height));
    }
    renderScene(ctx, canvas.width, canvas.height, baked, s.map, cam, layers, level, hover, s.selected);
    combatOverlay(ctx, s, cam);
    if (hover) {
      const { tx, ty } = hover,
        m = s.map,
        solid = blocked(m, tx, ty),
        k = (ty - m.originY) * m.width + tx - m.originX;
      if (s.tool !== 1) {
        ctx.strokeStyle = solid ? "#ff4d59" : "#80ebba";
        ctx.lineWidth = 2;
        const scale = CELL_PX * cam.zoom,
          x = canvas.width / 2 + (tx - cam.cx) * scale,
          y = canvas.height / 2 + (ty - cam.cy) * scale;
        ctx.strokeRect(x, y, scale, scale);
        if (drag?.target) {
          ctx.fillStyle = ctx.strokeStyle;
          ctx.globalAlpha = 0.48;
          ctx.fillRect(x, y, scale, scale);
          ctx.globalAlpha = 1;
        }
      }
      id("statusCoords").textContent =
        "格 (" + tx + ", " + ty + ") · 像素 (" + (tx + 0.5) * m.tileSize + ", " + (ty + 0.5) * m.tileSize + ")";
      id("statusRegion").textContent =
        m.regions.find((r) => tx >= r.x && ty >= r.y && tx < r.x + r.w && ty < r.y + r.h)?.name ?? "界外";
      id("statusTerrain").textContent = m.palette[m.tiles[k]]?.name ?? "—";
      id("statusSolid").textContent = solid ? "阻挡" : "可通行";
      id("statusSolid").classList.toggle("danger", solid);
      id("statusItem").textContent = hit(tx, ty)?.label ?? "";
    }
    id("zoomLabel").textContent = Math.round(cam.zoom * 100) + "%";
    canvas.style.cursor = s.tool === 1 ? (drag ? "grabbing" : "grab") : "crosshair";
  }
  function fit() {
    cam.zoom = Math.max(
      0.12,
      Math.min(
        12,
        (canvas.clientWidth - 32) / (s.map.width * CELL_PX),
        (canvas.clientHeight - 32) / (s.map.height * CELL_PX),
      ),
    );
    cam.cx = s.map.originX + s.map.width / 2;
    cam.cy = s.map.originY + s.map.height / 2;
    draw();
  }
  function zoom(factor: number, x = canvas.width / 2, y = canvas.height / 2) {
    const old = cam.zoom;
    cam.zoom = Math.max(0.12, Math.min(12, old * factor));
    cam.cx += ((x - canvas.width / 2) / CELL_PX) * (1 / old - 1 / cam.zoom);
    cam.cy += ((y - canvas.height / 2) / CELL_PX) * (1 / old - 1 / cam.zoom);
    draw();
  }
  const tile = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect(),
      scale = CELL_PX * cam.zoom;
    return {
      tx: Math.floor(cam.cx + (e.clientX - r.left - canvas.width / 2) / scale),
      ty: Math.floor(cam.cy + (e.clientY - r.top - canvas.height / 2) / scale),
    };
  };
  canvas.onpointerdown = (e) => {
    if (e.button !== 0 && e.button !== 1) return;
    const t = tile(e),
      p = hit(t.tx, t.ty);
    drag = {
      x: e.clientX,
      y: e.clientY,
      cx: cam.cx,
      cy: cam.cy,
      pan: e.button === 1 || s.tool === 1,
      moved: false,
      target: s.tool === 4 && editable(p) ? p : undefined,
    };
    canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  canvas.onpointermove = (e) => {
    if (drag) {
      const dx = e.clientX - drag.x,
        dy = e.clientY - drag.y;
      if (Math.hypot(dx, dy) > 3) drag.moved = true;
      if (drag.pan) {
        cam.cx = drag.cx - dx / (CELL_PX * cam.zoom);
        cam.cy = drag.cy - dy / (CELL_PX * cam.zoom);
      }
    }
    hover = tile(e);
    draw();
  };
  canvas.onpointercancel = () => {
    drag = null;
    hover = null;
    draw();
  };
  canvas.onpointerleave = () => {
    if (!drag) {
      hover = null;
      draw();
    }
  };
  canvas.onpointerup = (e) => {
    if (!drag) return;
    const d = drag;
    drag = null;
    const { tx, ty } = tile(e),
      p = hit(tx, ty);
    if (d.target && !blocked(s.map, tx, ty)) {
      s.selected = d.target.id;
      changePoint(s, d.target, { tx, ty });
    } else if (!d.moved && e.button === 0) {
      if (s.tool === 2 || s.tool === 3) place(s, tx, ty);
      else if (s.tool === 5 && p) removePoint(s, p);
      else {
        s.selected = p?.id ?? null;
        if (p && "enemyId" in p && p.enemyId) s.enemyId = p.enemyId;
        s.refresh();
      }
    }
    draw();
  };
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      zoom(e.deltaY < 0 ? 1.18 : 1 / 1.18, e.clientX - r.left, e.clientY - r.top);
    },
    { passive: false },
  );
  canvas.ondblclick = () => {
    if (s.tool === 1 && hover) {
      cam.cx = hover.tx + 0.5;
      cam.cy = hover.ty + 0.5;
      cam.zoom = Math.max(cam.zoom, 3);
      draw();
    }
  };
  window.addEventListener("keydown", (e) => {
    if (
      (e.target instanceof Element && e.target.matches("input,select,textarea")) ||
      document.querySelector("dialog[open]") ||
      e.ctrlKey ||
      e.metaKey ||
      e.altKey
    )
      return;
    if (/^[1-5]$/.test(e.key) && s.mode === "adventure") {
      s.tool = Number(e.key);
      s.tab = "map";
      s.refresh();
      return;
    }
    const move: Record<string, number[]> = {
      w: [0, -1],
      a: [-1, 0],
      s: [0, 1],
      d: [1, 0],
      arrowup: [0, -1],
      arrowleft: [-1, 0],
      arrowdown: [0, 1],
      arrowright: [1, 0],
    };
    const v = move[e.key.toLowerCase()];
    if (v) {
      e.preventDefault();
      cam.cx += (v[0] * 4) / cam.zoom;
      cam.cy += (v[1] * 4) / cam.zoom;
      draw();
    }
  });
  for (const c of document.querySelectorAll<HTMLInputElement>("[data-layer]"))
    c.onchange = () => {
      layers[c.dataset.layer as keyof LayerFlags] = c.checked;
      draw();
    };
  for (const b of document.querySelectorAll<HTMLElement>("[data-camp]"))
    b.onclick = () => {
      level = Number(b.dataset.camp);
      document.querySelectorAll("[data-camp]").forEach((x) => x.classList.toggle("active", x === b));
      draw();
    };
  id("btnFit").onclick = fit;
  id("btnReset").onclick = () => {
    fit();
    cam.zoom = 1.6;
    draw();
  };
  id("btnZoomOut").onclick = () => zoom(0.8);
  id("btnZoomIn").onclick = () => zoom(1.25);
  id("btnExport").onclick = () => exportPanoramaPng(baked, s.map, layers, level);
  new ResizeObserver(draw).observe(canvas);
  function focus() {
    const point = selected(s);
    if (!point) return;
    cam.cx = point.tx + 0.5;
    cam.cy = point.ty + 0.5;
    cam.zoom = Math.max(cam.zoom, 2);
    draw();
  }
  return { draw, fit, focus };
}
