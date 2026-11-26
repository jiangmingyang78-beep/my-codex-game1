const PALETTE = [
  "#181c2b", "#2b3040", "#dce7f2", "#89a8c4", "#8c93a3", "#555e70", "#ff7a2f", "#ffd166",
  "#8f2d2d", "#e2bfa2", "#6b4730", "#3e2a22", "#4e7a57", "#80ad84", "#3d506b", "#7ce8ff",
];
const PALETTE_RGB = PALETTE.map((hex) => ({
  hex, r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16),
}));
const ROW_LABELS = ["第0行·待机", "第1行·行走", "第2行·攻击", "第3行·急步受击"];
const state = {
  fileName: "demo.png", cols: 4, rows: 4, fw: 32, fh: 32, ax: 16, ay: 28,
  scale: 6, sheetScale: 3, row: 0, col: 0, playing: true, fps: 9,
  flipX: false, bgMode: "checker", showGrid: true, showAnchor: true,
  undoStack: [], lastTick: performance.now(), glowPhase: 0,
};
const origCanvas = document.createElement("canvas"), origCtx = origCanvas.getContext("2d", { willReadFrequently: true });
const workCanvas = document.createElement("canvas"), workCtx = workCanvas.getContext("2d", { willReadFrequently: true });
const $ = (id) => document.getElementById(id), pCanvas = $("previewCanvas"), pCtx = pCanvas.getContext("2d");
const sCanvas = $("sheetCanvas"), sCtx = sCanvas.getContext("2d");
const log = (msg) => { $("logBox").textContent = `[${new Date().toTimeString().slice(0, 8)}] ${msg}\n${$("logBox").textContent}`.trim(); };
const clampInt = (v, min, max, fb) => { const n = parseInt(v, 10); return Number.isNaN(n) ? fb : Math.max(min, Math.min(max, n)); };

function pushUndo() {
  if (!workCanvas.width) return;
  state.undoStack.push(workCtx.getImageData(0, 0, workCanvas.width, workCanvas.height));
  if (state.undoStack.length > 15) state.undoStack.shift();
  $("btnUndo").disabled = state.undoStack.length === 0;
}

function updateStats() {
  const d = workCtx.getImageData(0, 0, workCanvas.width, workCanvas.height).data, tol = Number($("tolRange").value), colors = new Set();
  let semi = 0, mag = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    if (d[i + 3] < 255) semi += 1;
    colors.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
    if (Math.hypot(d[i] - 255, d[i + 1], d[i + 2] - 255) <= tol) mag += 1;
  }
  $("diagBadge").textContent = `${workCanvas.width}×${workCanvas.height} | ${colors.size}色 | 毛边${semi} | 洋红${mag}`;
}

function rebuildRowButtons() {
  if (state.row >= state.rows) state.row = 0;
  const wrap = $("rowButtons"); wrap.innerHTML = "";
  for (let r = 0; r < state.rows; r += 1) {
    const btn = document.createElement("button"); btn.textContent = ROW_LABELS[r] || `第${r}行`;
    btn.classList.toggle("active", r === state.row);
    btn.onclick = () => { state.row = r; state.col = 0; rebuildRowButtons(); renderAll(); };
    wrap.appendChild(btn);
  }
}

function loadSource(src, name, category = "sprite") {
  origCanvas.width = workCanvas.width = src.width; origCanvas.height = workCanvas.height = src.height;
  origCtx.imageSmoothingEnabled = workCtx.imageSmoothingEnabled = false;
  origCtx.clearRect(0, 0, src.width, src.height); workCtx.clearRect(0, 0, src.width, src.height);
  origCtx.drawImage(src, 0, 0); workCtx.drawImage(src, 0, 0);
  state.fileName = name; state.undoStack = []; $("btnUndo").disabled = true; $("fileBadge").textContent = name;
  state.cols = category === "portrait" ? 1 : 4; state.rows = category === "portrait" ? 1 : 4;
  state.fw = Math.max(8, Math.floor(src.width / state.cols)); state.fh = Math.max(8, Math.floor(src.height / state.rows));
  state.ax = Math.round(state.fw / 2); state.ay = Math.max(0, state.fh - 4);
  $("inpCols").value = state.cols; $("inpRows").value = state.rows; $("inpFW").value = state.fw; $("inpFH").value = state.fh; $("inpAX").value = state.ax; $("inpAY").value = state.ay;
  state.col = 0; rebuildRowButtons(); updateStats(); renderAll();
}

function drawBg(ctx, w, h, sc, ax, ay) {
  if (state.bgMode === "checker") {
    const cell = Math.max(4, Math.min(16, sc * 2));
    for (let y = 0; y < h; y += cell) for (let x = 0; x < w; x += cell) {
      ctx.fillStyle = ((x / cell + y / cell) & 1) === 0 ? "#222738" : "#2c3248"; ctx.fillRect(x, y, cell, cell);
    }
  } else if (state.bgMode === "night" || state.bgMode === "snow") {
    ctx.fillStyle = state.bgMode === "snow" ? "#dce7f2" : "#121626"; ctx.fillRect(0, 0, w, h);
  } else {
    ctx.fillStyle = "#121626"; ctx.fillRect(0, 0, w, h);
    const r = Math.max(w, h) * (0.7 + Math.sin(state.glowPhase) * 0.05), g = ctx.createRadialGradient(ax, ay, Math.max(2, sc * 2), ax, ay, r);
    g.addColorStop(0, "rgba(255,166,77,0.5)"); g.addColorStop(0.5, "rgba(255,122,47,0.22)"); g.addColorStop(1, "rgba(18,22,38,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
}

function drawCross(ctx, cx, cy, sz) {
  const x = Math.round(cx) + 0.5, y = Math.round(cy) + 0.5;
  ctx.strokeStyle = "#ff3b5c"; ctx.lineWidth = 1; ctx.beginPath();
  ctx.moveTo(x - sz, y); ctx.lineTo(x + sz, y); ctx.moveTo(x, y - sz); ctx.lineTo(x, y + sz); ctx.stroke();
}

function renderPreview() {
  const { fw, fh, scale: sc, row, col, ax, ay } = state, cw = fw * sc, ch = fh * sc;
  if (pCanvas.width !== cw || pCanvas.height !== ch) { pCanvas.width = cw; pCanvas.height = ch; }
  pCtx.imageSmoothingEnabled = false;
  $("frameBadge").textContent = `行 ${row} · 列 ${col}/${state.cols - 1} (#${row * state.cols + col})`;
  drawBg(pCtx, cw, ch, sc, ax * sc, ay * sc);
  const sx = col * fw, sy = row * fh;
  if (sx < workCanvas.width && sy < workCanvas.height) {
    const sw = Math.min(fw, workCanvas.width - sx), sh = Math.min(fh, workCanvas.height - sy);
    pCtx.save(); pCtx.imageSmoothingEnabled = false;
    if (state.flipX) { pCtx.translate(ax * 2 * sc, 0); pCtx.scale(-1, 1); }
    pCtx.drawImage(workCanvas, sx, sy, sw, sh, 0, 0, sw * sc, sh * sc); pCtx.restore();
  }
  if (state.showGrid) { pCtx.strokeStyle = "rgba(124,232,255,0.45)"; pCtx.lineWidth = 1; pCtx.strokeRect(0.5, 0.5, cw - 1, ch - 1); }
  if (state.showAnchor) drawCross(pCtx, ax * sc, ay * sc, Math.max(8, sc * 3));
}

function renderSheet() {
  const sc = state.sheetScale, cw = workCanvas.width * sc, ch = workCanvas.height * sc;
  if (sCanvas.width !== cw || sCanvas.height !== ch) { sCanvas.width = cw; sCanvas.height = ch; }
  sCtx.imageSmoothingEnabled = false; drawBg(sCtx, cw, ch, sc, cw / 2, ch / 2); sCtx.drawImage(workCanvas, 0, 0, cw, ch);
  if (state.showGrid) {
    sCtx.strokeStyle = "rgba(220,231,242,0.28)"; sCtx.lineWidth = 1; sCtx.beginPath();
    for (let c = 0; c <= state.cols; c += 1) { const x = c * state.fw * sc + 0.5; sCtx.moveTo(x, 0); sCtx.lineTo(x, state.rows * state.fh * sc); }
    for (let r = 0; r <= state.rows; r += 1) { const y = r * state.fh * sc + 0.5; sCtx.moveTo(0, y); sCtx.lineTo(state.cols * state.fw * sc, y); }
    sCtx.stroke();
  }
  if (state.showAnchor) for (let r = 0; r < state.rows; r += 1) for (let c = 0; c < state.cols; c += 1) {
    drawCross(sCtx, (c * state.fw + state.ax) * sc, (r * state.fh + state.ay) * sc, Math.max(4, sc * 2));
  }
  sCtx.strokeStyle = "#ff7a2f"; sCtx.lineWidth = 2;
  sCtx.strokeRect(state.col * state.fw * sc + 1, state.row * state.fh * sc + 1, state.fw * sc - 2, state.fh * sc - 2);
}

const renderAll = () => { renderPreview(); renderSheet(); };

function cleanMagenta() {
  const w = workCanvas.width, h = workCanvas.height, tol = Number($("tolRange").value), flood = $("chkFlood").checked;
  pushUndo();
  const img = workCtx.getImageData(0, 0, w, h), d = img.data, hit = (i) => Math.hypot(d[i] - 255, d[i + 1], d[i + 2] - 255) <= tol;
  let cleared = 0;
  if (!flood) {
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] && hit(i)) { d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 0; cleared += 1; }
  } else {
    const vis = new Uint8Array(w * h), q = new Int32Array(w * h); let hd = 0, tl = 0;
    const enq = (x, y) => { if (x < 0 || x >= w || y < 0 || y >= h) return; const idx = y * w + x, p = idx * 4; if (!vis[idx] && (!d[p + 3] || hit(p))) { vis[idx] = 1; q[tl++] = idx; } };
    for (let x = 0; x < w; x += 1) { enq(x, 0); enq(x, h - 1); }
    for (let y = 1; y < h - 1; y += 1) { enq(0, y); enq(w - 1, y); }
    while (hd < tl) { const idx = q[hd++], p = idx * 4, x = idx % w, y = (idx - x) / w; if (d[p + 3]) { d[p] = d[p + 1] = d[p + 2] = d[p + 3] = 0; cleared += 1; } enq(x - 1, y); enq(x + 1, y); enq(x, y - 1); enq(x, y + 1); }
  }
  workCtx.putImageData(img, 0, 0); updateStats(); renderAll(); log(`去除洋红底（容差 ${tol}）：已清除 ${cleared} 像素。`);
}

function snapPalette() {
  pushUndo();
  const harden = $("chkHarden").checked, img = workCtx.getImageData(0, 0, workCanvas.width, workCanvas.height), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    if (harden && d[i + 3] < 128) { d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 0; continue; }
    let best = PALETTE_RGB[0], bestDist = Infinity;
    for (const c of PALETTE_RGB) {
      const rm = (d[i] + c.r) * 0.5, dr = d[i] - c.r, dg = d[i + 1] - c.g, db = d[i + 2] - c.b;
      const dist = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
      if (dist < bestDist) { bestDist = dist; best = c; }
    }
    d[i] = best.r; d[i + 1] = best.g; d[i + 2] = best.b; if (harden) d[i + 3] = 255;
  }
  workCtx.putImageData(img, 0, 0); updateStats(); renderAll(); log("已吸附至余烬林 16 色主色板。");
}

function loadMagentaDemo() {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const ctx = c.getContext("2d"); ctx.fillStyle = "#ff00ff"; ctx.fillRect(0, 0, 128, 128);
  for (let r = 0; r < 4; r += 1) for (let col = 0; col < 4; col += 1) {
    const ox = col * 32, oy = r * 32, bob = r === 1 && col % 2 ? -1 : 0;
    ctx.fillStyle = "#181c2b"; ctx.fillRect(ox + 12, oy + 10 + bob, 8, 13);
    ctx.fillStyle = "#3d506b"; ctx.fillRect(ox + 13, oy + 16 + bob, 6, 6);
    ctx.fillStyle = "#ff7a2f"; ctx.fillRect(ox + 12, oy + 15 + bob, 8, 2);
    ctx.fillStyle = "#e2bfa2"; ctx.fillRect(ox + 14, oy + 12 + bob, 4, 3);
    ctx.fillStyle = "#3e2a22"; ctx.fillRect(ox + 13, oy + 23, 2, 5); ctx.fillRect(ox + 17, oy + 23, 2, 5);
  }
  loadSource(c, "demo_magenta.png", "sprite"); log("已加载 128×128 洋红底测试图。");
}

function loadUrlAsset(url, name, category) {
  const img = new Image(); img.onload = () => { loadSource(img, name, category); log(`已加载项目资源：${name}`); };
  img.onerror = () => log(`加载失败：${url}`); img.src = url;
}

function loadLocalFile(file) {
  const reader = new FileReader();
  reader.onload = () => { const img = new Image(); img.onload = () => { loadSource(img, file.name, "sprite"); log(`已载入本地文件：${file.name}`); }; img.src = String(reader.result); };
  reader.readAsDataURL(file);
}

for (const hex of PALETTE) {
  const btn = document.createElement("button"); btn.className = "swatch";
  btn.innerHTML = `<span class="swatch-chip" style="background:${hex}"></span><span>${hex}</span>`;
  btn.onclick = () => navigator.clipboard?.writeText(hex).then(() => log(`已复制 ${hex}`));
  $("paletteGrid").appendChild(btn);
}

const bindGroup = (sel, attr, setter) => document.querySelectorAll(sel).forEach((b) => b.onclick = () => {
  setter(b.dataset[attr]); document.querySelectorAll(sel).forEach((x) => x.classList.toggle("active", x === b)); renderAll();
});
bindGroup("[data-scale]", "scale", (v) => { state.scale = Number(v); });
bindGroup("[data-sheet-scale]", "sheetScale", (v) => { state.sheetScale = Number(v); });
bindGroup("[data-bg]", "bg", (v) => { state.bgMode = v; });

$("btnOpenFile").onclick = () => $("fileInput").click();
$("fileInput").onchange = (e) => { if (e.target.files?.[0]) loadLocalFile(e.target.files[0]); e.target.value = ""; };
$("btnLoadMagenta").onclick = loadMagentaDemo;
$("btnUndo").onclick = () => { const p = state.undoStack.pop(); if (!p) return; workCtx.putImageData(p, 0, 0); $("btnUndo").disabled = !state.undoStack.length; updateStats(); renderAll(); };
$("btnReset").onclick = () => { pushUndo(); workCtx.clearRect(0, 0, workCanvas.width, workCanvas.height); workCtx.drawImage(origCanvas, 0, 0); updateStats(); renderAll(); };
$("btnExport").onclick = () => workCanvas.toBlob((b) => { const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = `${state.fileName.replace(/\.[^.]+$/, "")}_clean.png`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); log(`已导出 ${a.download}`); }, "image/png");
$("btnLoadAsset").onclick = () => { const o = $("assetSelect").selectedOptions[0]; if (o) loadUrlAsset(o.value, o.textContent, o.dataset.cat); };
$("btnPlayPause").onclick = () => { state.playing = !state.playing; $("btnPlayPause").textContent = state.playing ? "⏸ 暂停" : "▶ 播放"; $("btnPlayPause").classList.toggle("active", state.playing); };
$("btnPrev").onclick = () => { state.playing = false; state.col = (state.col - 1 + state.cols) % state.cols; renderAll(); };
$("btnNext").onclick = () => { state.playing = false; state.col = (state.col + 1) % state.cols; renderAll(); };
$("btnFlipX").onclick = () => { state.flipX = !state.flipX; $("btnFlipX").textContent = `⇄ flipX: ${state.flipX ? "开" : "关"}`; $("btnFlipX").classList.toggle("active", state.flipX); renderPreview(); };
$("fpsRange").oninput = () => { state.fps = Number($("fpsRange").value); $("fpsVal").textContent = `${state.fps} fps`; };
$("tolRange").oninput = () => { $("tolVal").textContent = $("tolRange").value; updateStats(); };
$("chkGrid").onchange = () => { state.showGrid = $("chkGrid").checked; renderAll(); };
$("chkAnchor").onchange = () => { state.showAnchor = $("chkAnchor").checked; renderAll(); };
$("btnCleanMagenta").onclick = cleanMagenta; $("btnSnapPalette").onclick = snapPalette;
$("btnAutoFrame").onclick = () => { state.fw = Math.max(8, Math.floor(workCanvas.width / state.cols)); state.fh = Math.max(8, Math.floor(workCanvas.height / state.rows)); $("inpFW").value = state.fw; $("inpFH").value = state.fh; renderAll(); };
$("btnDefaultAnchor").onclick = () => { state.ax = 16; state.ay = 28; $("inpAX").value = 16; $("inpAY").value = 28; renderAll(); };
for (const id of ["inpCols", "inpRows", "inpFW", "inpFH", "inpAX", "inpAY"]) $(id).onchange = () => {
  state.cols = clampInt($("inpCols").value, 1, 32, 4); state.rows = clampInt($("inpRows").value, 1, 32, 4);
  state.fw = clampInt($("inpFW").value, 8, 512, 32); state.fh = clampInt($("inpFH").value, 8, 512, 32);
  state.ax = clampInt($("inpAX").value, 0, 512, 16); state.ay = clampInt($("inpAY").value, 0, 512, 28);
  rebuildRowButtons(); renderAll();
};
sCanvas.onclick = (e) => { const r = sCanvas.getBoundingClientRect(), c = Math.floor((e.clientX - r.left) / state.sheetScale / state.fw), rw = Math.floor((e.clientY - r.top) / state.sheetScale / state.fh); if (c >= 0 && c < state.cols && rw >= 0 && rw < state.rows) { state.row = rw; state.col = c; rebuildRowButtons(); renderAll(); } };
sCanvas.onmousemove = (e) => { const r = sCanvas.getBoundingClientRect(), x = Math.floor((e.clientX - r.left) / state.sheetScale), y = Math.floor((e.clientY - r.top) / state.sheetScale); if (x < 0 || y < 0 || x >= workCanvas.width || y >= workCanvas.height) return; const p = workCtx.getImageData(x, y, 1, 1).data; $("hoverBadge").textContent = `(${x},${y}) #${[p[0], p[1], p[2]].map((v) => v.toString(16).padStart(2, "0")).join("")} α=${p[3]}`; };
window.ondragover = (e) => { e.preventDefault(); $("dropOverlay").classList.add("visible"); };
window.ondragleave = () => $("dropOverlay").classList.remove("visible");
window.ondrop = (e) => { e.preventDefault(); $("dropOverlay").classList.remove("visible"); if (e.dataTransfer?.files?.[0]) loadLocalFile(e.dataTransfer.files[0]); };

fetch("/api/assets").then((r) => r.json()).then(({ assets }) => {
  const sel = $("assetSelect");
  for (const a of assets) { const o = document.createElement("option"); o.value = a.url; o.textContent = `[${a.category}] ${a.name}`; o.dataset.cat = a.category; sel.appendChild(o); }
  const first = assets.find((a) => a.category === "sprite") || assets[0];
  if (first) { sel.value = first.url; loadUrlAsset(first.url, first.name, first.category); } else loadMagentaDemo();
}).catch(() => loadMagentaDemo());

(function tick(now) {
  let dirty = false;
  if (state.playing && now - state.lastTick >= 1000 / Math.max(1, state.fps)) { state.lastTick = now; state.col = (state.col + 1) % Math.max(1, state.cols); dirty = true; }
  if (state.bgMode === "campfire") { state.glowPhase = (state.glowPhase + 0.08) % 6.28; dirty = true; }
  if (dirty) renderAll();
  requestAnimationFrame(tick);
})(performance.now());
