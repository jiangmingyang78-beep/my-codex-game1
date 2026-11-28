import { renderMetrics } from "../game/dev/renderMetrics";
import { RENDER_DEPTH } from "../game/renderDepth";
import { createTextureGenerator, registerCanvasTexture } from "./proceduralTextures.js";
import { drawImpactRings, drawParticleGlows, drawParticles } from "./particleCanvas.js";
import { PT } from "./particlePresets.js";
import { createParticleSimulation } from "./particleSimulation.js";
import { clamp, context2d, createBrowserCanvas, parseColor, toHex } from "./vfxPrimitives.js";

const CAMERA_PRE_RENDER = "prerender";
const ADD_BLEND = 1; // Phaser.BlendModes.ADD
const EMBER_INTERVAL = 0.13;
let instanceId = 0;

function viewBounds(camera) {
  const { x, y, width, height } = camera.worldView;
  const cos = Math.abs(Math.cos(camera.rotation));
  const sin = Math.abs(Math.sin(camera.rotation));
  const halfW = (width * cos + height * sin) / 2;
  const halfH = (height * cos + width * sin) / 2;
  return {
    x: Math.floor(x + width / 2 - halfW) - 8,
    y: Math.floor(y + height / 2 - halfH) - 8,
    width: Math.max(1, Math.ceil(2 * halfW)) + 17,
    height: Math.max(1, Math.ceil(2 * halfH)) + 17
  };
}

function createLayer(scene, key, depth, additive) {
  const canvas = createBrowserCanvas(1, 1);
  context2d(canvas, { willReadFrequently: true });
  const { texture } = registerCanvasTexture(scene, key, { canvas });
  const image = scene.add.image(0, 0, key).setOrigin(0).setDepth(depth);
  image.setVisible(false);
  if (additive) image.setBlendMode(ADD_BLEND);
  return { key, texture, image, populated: false };
}

function paintLayer(layer, view, populated, webgl, paint, effects, strength = 0) {
  if (!populated && !layer.populated) return;
  const { texture, image } = layer;
  image.setVisible(Boolean(populated));
  layer.populated = Boolean(populated);
  if (!populated) return;
  if (texture.width !== view.width || texture.height !== view.height) {
    texture.setSize(view.width, view.height);
    image.setSizeToFrame().setOrigin(0);
  }
  image.setPosition(view.x, view.y);
  const context = texture.getContext();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, texture.width, texture.height);
  context.save();
  context.translate(-view.x, -view.y);
  try { paint(context, effects, strength); } finally { context.restore(); }
  if (webgl) {
    texture.refresh();
    if (import.meta.env.DEV) renderMetrics.uploads++;
  }
}

function drawCombat(context, combat) {
  drawParticles(context, combat.particles);
  drawImpactRings(context, combat.rings);
}

// Cull before painting and keep the combat backing texture in stable size buckets.
function collectVisibleEffects(view, particles, rings, combat, ambient) {
  combat.particles.length = combat.rings.length = ambient.length = 0;
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  const viewRight = view.x + view.width, viewBottom = view.y + view.height;
  for (const p of particles) {
    const y = p.y - p.z;
    const ground = p.type === PT.debris || p.type === PT.ripple ? Math.abs(p.z) : 0;
    const tail = .1 * Math.max(Math.abs(p.dx), Math.abs(p.dy - p.dz), Math.abs(p.dz));
    const margin = Math.max(6, 3 * Math.max(p.s0, p.s1), tail) + ground + 3;
    if (!visible(view, p.x, y, margin)) continue;
    if (p.amb || p.type === PT.ember || p.type === PT.smoke) ambient.push(p);
    else {
      combat.particles.push(p);
      left = Math.min(left, p.x - margin); right = Math.max(right, p.x + margin);
      top = Math.min(top, y - margin); bottom = Math.max(bottom, y + margin);
    }
  }
  for (const ring of rings) {
    if (!visible(view, ring.x, ring.y, 40)) continue;
    combat.rings.push(ring);
    left = Math.min(left, ring.x - 40); right = Math.max(right, ring.x + 40);
    top = Math.min(top, ring.y - 40); bottom = Math.max(bottom, ring.y + 40);
  }
  const x = Math.max(view.x, Math.floor(left)), y = Math.max(view.y, Math.floor(top));
  const w = Math.min(viewRight, Math.ceil(right)) - x, h = Math.min(viewBottom, Math.ceil(bottom)) - y;
  if (!(w > 0 && h > 0)) return false;
  const out = combat.view;
  out.width = Math.min(view.width, Math.ceil(w / 128) * 128);
  out.height = Math.min(view.height, Math.ceil(h / 128) * 128);
  out.x = Math.min(x, viewRight - out.width);
  out.y = Math.min(y, viewBottom - out.height);
  return true;
}

function visible(view, x, y, margin) {
  return x >= view.x - margin && x <= view.x + view.width + margin &&
    y >= view.y - margin && y <= view.y + view.height + margin;
}

const gatherDefaults = {
  wood: { color: "#d4a776", count: 8 },
  stone: { color: "#b3bcc0", count: 8 },
  plant: { color: "#f1c773", count: 12 },
  water: { color: "#87cbd3", count: 10 },
  dust: { color: "#a48364", count: 7 }
};

/** World coordinates are in pixels. Call update(deltaMs / 1000) from the Scene. */
export function createEffects(scene, {
  camera = scene.cameras.main,
  maxParticles = 120,
  reducedMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  textureGenerator = createTextureGenerator(),
  bodyDepth = RENDER_DEPTH.combatParticles,
  glowDepth = bodyDepth + (RENDER_DEPTH.combatGlow - RENDER_DEPTH.combatParticles),
  tileSize = 16,
  ambientAt,
  isDark = () => false,
  lightStrength = () => 1,
  random = Math.random
} = {}) {
  if (!Number.isInteger(maxParticles) || maxParticles < 1) throw new RangeError("Invalid particle limit.");
  if (!Number.isFinite(tileSize) || tileSize <= 0) throw new RangeError("Tile size must be positive.");
  const simulation = createParticleSimulation({ maxParticles: reducedMotion ? Math.min(30, maxParticles) : maxParticles, random });
  const namespace = `emberwood-vfx-${++instanceId}`;
  const body = createLayer(scene, `${namespace}:body`, bodyDepth, false);
  const glow = createLayer(scene, `${namespace}:glow`, glowDepth, true);
  const fireLight = createLayer(scene, `${namespace}:fire-light`, RENDER_DEPTH.campHalo, true);
  const ambience = createLayer(scene, `${namespace}:ambience`, RENDER_DEPTH.ambientParticles, false);
  const ambienceGlow = createLayer(scene, `${namespace}:ambience-glow`, RENDER_DEPTH.ambientGlow, true);
  const layers = [body, glow, fireLight, ambience, ambienceGlow];
  const layerImages = layers.map(layer => layer.image);
  const combat = { view: { x: 0, y: 0, width: 1, height: 1 }, particles: [], rings: [] };
  const ambientParticles = [];
  const webgl = Boolean(scene.sys.game.renderer.gl);
  const camps = new Set(), flameSets = new Map(), flameKeys = [];
  let view = viewBounds(camera), tick = 0, destroyed = false, dirty = true;
  const markDirty = () => { dirty = true; };
  for (const other of scene.cameras.cameras) {
    if (other !== camera) other.ignore(layerImages);
  }

  function sparking(x, y, color, count, kind, dx = 0, dy = 0, leaves) {
    if (destroyed) return;
    if (![x, y, count, dx, dy].every(Number.isFinite)) throw new TypeError("Invalid particle coordinates, count or direction.");
    const limit = reducedMotion ? 6 : 48;
    const amount = clamp(Math.floor(count), 0, limit);
    if (!amount) return;
    simulation.sparks(x, y, toHex(parseColor(color)), amount, kind, dx, dy, leaves);
    markDirty();
  }

  function emitCampfire(x, y, { count = 1, color = "#ed995b" } = {}) {
    sparking(x, y - 3, color, count, "ember");
  }

  function emitHit(x, y, { kind = "strike", dx = 0, dy = 0, color } = {}) {
    if (destroyed) return;
    if (kind === "hurt") {
      if (![x, y].every(Number.isFinite)) throw new TypeError("Invalid hit position.");
      const tint = toHex(parseColor(color ?? "#ff8581"));
      simulation.impact(x, y, kind, !reducedMotion);
      sparking(x, y, tint, 8, "magic");
      return;
    } else if (kind === "guard") {
      sparking(x, y - 6, color ?? "#eac997", 6, "metal", -dx, -dy);
      return;
    } else {
      sparking(x, y - 4, color ?? "#ffe1a3", kind === "strike" ? 9 : 15, "metal", dx, dy);
      if (kind === "finisher" || kind === "boss") sparking(x, y, "#fd9c72", 13, "ember");
    }
    simulation.impact(x, y, kind, !reducedMotion);
  }

  function emitGather(x, y, { material = "wood", color, count, finished = false, dx = 0, dy = 0 } = {}) {
    if (destroyed) return;
    const preset = gatherDefaults[material] ?? gatherDefaults.plant;
    const kind = material === "stone" || material === "water" || material === "dust" ? material : "wood";
    const heavy = material === "wood" || material === "stone";
    const amount = count ?? (finished && heavy ? 15 : preset.count);
    if (amount <= 0) return;
    sparking(x, y - 2, color ?? preset.color, amount, kind, dx, dy, material === "wood");
    if (heavy) simulation.impact(x, y, "strike", !reducedMotion);
  }

  function emit({ type, x, y, payload = {} }) {
    if (type === "element.steam") sparking(x,y,"#c5d4d2",1,"steam");
    else if (type === "combat.hit") emitHit(x, y, payload);
    else if (type === "resource.collected") emitGather(x, y, payload);
    else if (type === "camp.lit") emitCampfire(x, y, { count: 6, ...payload });
    else if (type === "camp.ember") emitCampfire(x, y, payload);
  }

  function flameFrames(color, scale) {
    const signature = `${color}/${scale}`;
    if (flameSets.has(signature)) return flameSets.get(signature);
    const frames = [];
    for (let frame = 0; frame < 6; frame++) {
      const art = textureGenerator.flame({ color, scale, frame });
      const canvas = createBrowserCanvas(art.canvas.width, art.canvas.height);
      const context = context2d(canvas);
      context.fillStyle = "#221a23";
      context.fillRect(Math.round(art.anchorX - 5 * scale), Math.round(art.anchorY + 4 * scale), 10 * scale, 2 * scale);
      context.drawImage(art.canvas, 0, 0);
      const key = `${namespace}:fire:${flameSets.size}:${frame}`;
      frames.push(registerCanvasTexture(scene, key, { ...art, canvas }));
      flameKeys.push(key);
    }
    flameSets.set(signature, frames);
    return frames;
  }

  function addCampfire(x, y, {
    color = "#f49a59", haloColor = "#ffaa4b", scale = 1, radius = 64 * scale, depth = RENDER_DEPTH.campFlame, active = true
  } = {}) {
    if (destroyed) throw new Error("This scene's effects have been destroyed.");
    if (![x, y, radius, scale].every(Number.isFinite) || radius <= 0 || scale <= 0) {
      throw new RangeError("Campfire requires finite position and positive radius and scale.");
    }
    const halo = textureGenerator.halo(haloColor);
    const frames = flameFrames(toHex(parseColor(color)), scale);
    const start = frames[0];
    const image = scene.add.image(x, y, start.key).setOrigin(start.originX, start.originY).setDepth(depth).setVisible(active);
    const camp = { x, y, radius, halo, frames, image, active, carry: 0, frame: 0 };
    camps.add(camp);
    markDirty();
    return {
      setActive(value) {
        if (!camps.has(camp)) return;
        camp.active = Boolean(value);
        camp.carry = 0;
        image.setVisible(camp.active);
        markDirty();
      },
      destroy() {
        if (camps.delete(camp)) image.destroy();
        markDirty();
      }
    };
  }

  function update(seconds) {
    if (destroyed || !Number.isFinite(seconds) || seconds <= 0) return;
    const dt = Math.min(0.05, seconds);
    tick += dt;
    simulation.update(dt, { view, ambientAt: reducedMotion ? undefined : ambientAt, dark: isDark(), tileSize });
    for (const camp of camps) {
      if (!camp.active) continue;
      const cycle = Math.trunc(tick * 11 + camp.x * 0.31);
      const frame = reducedMotion ? 0 : ((cycle % 6) + 6) % 6;
      if (frame !== camp.frame) {
        camp.frame = frame;
        const art = camp.frames[frame];
        camp.image.setTexture(art.key).setOrigin(art.originX, art.originY);
      }
      camp.carry += dt;
      const interval = reducedMotion ? EMBER_INTERVAL * 3 : EMBER_INTERVAL;
      if (camp.carry >= interval) {
        camp.carry -= interval;
        if (visible(view, camp.x, camp.y, 36)) emitCampfire(camp.x, camp.y);
      }
    }
    markDirty();
  }

  function campPulse(camp) {
    const phase = camp.x * 0.37 + camp.y * 0.11;
    return reducedMotion ? 0.95 : 0.95 + Math.sin(tick * 8 + phase) * 0.032 +
      Math.sin(tick * 13.7 + phase * 1.7) * 0.022 + Math.sin(tick * 29 + phase * 2.3) * 0.014 +
      Math.sin(tick * 1.6 + phase) * 0.012;
  }

  // The caller can compose these full-radius lights into its own ambient light mask.
  function forEachCampLight(visit) {
    if (!camps.size) return;
    const strength = clamp(lightStrength(), 0, 1);
    for (const camp of camps) {
      if (!camp.active) continue;
      const pulse = campPulse(camp);
      visit({ canvas: camp.halo, x: camp.x, y: camp.y - 5, radius: camp.radius * pulse,
        alpha: Math.min(0.93, strength * (0.96 + (pulse - 0.95) * 1.6)) });
    }
  }

  function drawCampHalos(context, camps, strength) {
    context.globalCompositeOperation = "lighter";
    context.imageSmoothingEnabled = true;
    context.globalAlpha = strength * 0.22;
    for (const camp of camps) {
      const r = camp.radius * 0.79 * campPulse(camp);
      context.drawImage(camp.halo, camp.x - r, camp.y - 7 - r, 2 * r, 2 * r);
    }
  }

  function render() {
    const next = viewBounds(camera);
    if (!dirty && next.x === view.x && next.y === view.y && next.width === view.width && next.height === view.height) return;
    view = next;
    dirty = false;
    const { particles, rings } = simulation;
    const strength=clamp(lightStrength(),0,1);
    const litCamps = strength>0 && [...camps].filter(camp => camp.active && visible(view, camp.x, camp.y, camp.radius));
    const hasCombat = collectVisibleEffects(view, particles, rings, combat, ambientParticles);
    paintLayer(body, combat.view, hasCombat, webgl, drawCombat, combat);
    paintLayer(glow, combat.view, hasCombat && combat.particles.some(particle => particle.glow > 0), webgl, drawParticleGlows, combat.particles);
    paintLayer(fireLight, view, litCamps && litCamps.length > 0, webgl, drawCampHalos, litCamps, strength);
    paintLayer(ambience, view, ambientParticles.length > 0, webgl, drawParticles, ambientParticles);
    paintLayer(ambienceGlow, view, ambientParticles.some(particle => particle.glow > 0), webgl, drawParticleGlows, ambientParticles);
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    camera.off(CAMERA_PRE_RENDER, render);
    scene.events.off("shutdown", destroy);
    scene.events.off("destroy", destroy);
    for (const camp of camps) camp.image.destroy();
    camps.clear();
    for (const layer of layers) {
      layer.image.destroy();
      scene.textures.remove(layer.key);
    }
    for (const key of flameKeys) scene.textures.remove(key);
    flameKeys.length = 0;
    flameSets.clear();
    simulation.clear();
    combat.particles.length = combat.rings.length = ambientParticles.length = 0;
  }

  camera.on(CAMERA_PRE_RENDER, render);
  scene.events.once("shutdown", destroy);
  scene.events.once("destroy", destroy);
  return { emit, emitCampfire, emitHit, emitGather, addCampfire, forEachCampLight, update, destroy };
}
