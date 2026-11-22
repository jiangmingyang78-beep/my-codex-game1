import { createTextureGenerator, registerCanvasTexture } from "./proceduralTextures.js";
import { drawImpactRings, drawParticleGlows, drawParticles } from "./particleCanvas.js";
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
  if (additive) image.setBlendMode(ADD_BLEND);
  return { key, texture, image, populated: false };
}

function paintLayer(layer, view, populated, webgl, paint) {
  if (!populated && !layer.populated) return;
  const { texture, image } = layer;
  if (populated) {
    if (texture.width !== view.width || texture.height !== view.height) {
      texture.setSize(view.width, view.height);
      image.setSizeToFrame().setOrigin(0);
    }
    image.setPosition(view.x, view.y);
  }
  const context = texture.getContext();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, texture.width, texture.height);
  if (populated) {
    context.save();
    context.translate(-view.x, -view.y);
    try { paint(context); } finally { context.restore(); }
  }
  if (webgl) texture.refresh();
  layer.populated = populated;
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
  bodyDepth = 100,
  glowDepth = bodyDepth + 1,
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
  const webgl = Boolean(scene.sys.game.renderer.gl);
  const camps = new Set(), flameSets = new Map(), flameKeys = [];
  let view = viewBounds(camera), tick = 0, destroyed = false, dirty = true;
  const markDirty = () => { dirty = true; };
  for (const other of scene.cameras.cameras) {
    if (other !== camera) other.ignore([body.image, glow.image]);
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
    if (type === "combat.hit") emitHit(x, y, payload);
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
    color = "#f49a59", haloColor = "#ffaa4b", scale = 1, radius = 64 * scale, depth = 1, active = true
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

  function drawCampHalo(context, camp, strength) {
    const r = camp.radius * 0.79 * campPulse(camp);
    context.globalCompositeOperation = "lighter";
    context.imageSmoothingEnabled = true;
    context.globalAlpha = strength * 0.22;
    context.drawImage(camp.halo, camp.x - r, camp.y - 7 - r, 2 * r, 2 * r);
    context.globalAlpha = 1;
  }

  function render() {
    const next = viewBounds(camera);
    if (!dirty && next.x === view.x && next.y === view.y && next.width === view.width && next.height === view.height) return;
    view = next;
    dirty = false;
    const { particles, rings } = simulation;
    const litCamps = [...camps].filter(camp => camp.active && visible(view, camp.x, camp.y, camp.radius));
    paintLayer(body, view, particles.length > 0 || rings.length > 0, webgl, context => {
      drawParticles(context, particles);
      drawImpactRings(context, rings);
    });
    paintLayer(glow, view, litCamps.length > 0 || particles.some(particle => particle.glow > 0), webgl, context => {
      const strength = clamp(lightStrength(), 0, 1);
      for (const camp of litCamps) drawCampHalo(context, camp, strength);
      drawParticleGlows(context, particles);
    });
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    camera.off(CAMERA_PRE_RENDER, render);
    scene.events.off("shutdown", destroy);
    scene.events.off("destroy", destroy);
    for (const camp of camps) camp.image.destroy();
    camps.clear();
    for (const layer of [body, glow]) {
      layer.image.destroy();
      scene.textures.remove(layer.key);
    }
    for (const key of flameKeys) scene.textures.remove(key);
    flameKeys.length = 0;
    flameSets.clear();
    simulation.clear();
  }

  camera.on(CAMERA_PRE_RENDER, render);
  scene.events.once("shutdown", destroy);
  scene.events.once("destroy", destroy);
  return { emit, emitCampfire, emitHit, emitGather, addCampfire, forEachCampLight, update, destroy };
}
