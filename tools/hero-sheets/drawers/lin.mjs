/**
 * Rin (lin_t.del): Height 18px.
 * The thin, long, sharp hood deep gray caps + the warm orange scarf + the fire light with the fine long iron spears.
 */
import { drawLegs } from "../rig.mjs";

function drawSpearRest(layer, cx, dy, pal) {
  // The spear leans behind it and neither the spear nor the speartails cross the baseline (y< = 25))
  for (let i = 0; i <= 11; i++) {
    const sy = 12 + dy + Math.floor(i * 1.1);
    if (sy <= 25) layer.set(cx - 7 + i, sy, pal.O);
  }
  layer.set(cx - 8, 11 + dy, pal.iron);
  layer.set(cx - 7, 11 + dy, pal.iron);
  layer.set(cx - 7, 12 + dy, pal.iron);
  layer.set(cx - 6, 12 + dy, pal.iron);
}

export function draw(layer, fx, pose, pal) {
  if (pose.anim === "dead") {
    layer.rect(8, 24, 4, 3, pal.O); // Boots
    layer.rect(12, 23, 8, 4, pal.cloak); // The cape
    layer.rect(15, 23, 4, 2, pal.scarf); // Spread the orange towels
    layer.rect(20, 23, 4, 4, pal.cloak); // The hood
    layer.rect(21, 24, 2, 2, pal.O); // Dark contour
    layer.hline(9, 26, 15, pal.O);
    layer.set(24, 25, pal.iron);
    return;
  }

  const cx = 16 + pose.lean;
  const dy = pose.bob + pose.crouch;

  drawLegs(layer, cx, pose, 2, 4);

  // The back is leaned against the iron spear (not the attack frame))
  if (pose.anim !== "attack") {
    drawSpearRest(layer, cx, dy, pal);
  }

  // Thin cape object (approx. 8px.))
  const cloakBottom = Math.min(24, 23 + dy);
  const cloakTop = 16 + dy;
  layer.rect(cx - 4, cloakTop, 8, cloakBottom - cloakTop + 1, pal.cloak);
  layer.rect(cx + 1, cloakTop + 2, 2, Math.max(2, cloakBottom - cloakTop - 2), pal.O);

  // The hoods are dark with five officers
  layer.set(cx - 3, 11 + dy, pal.cloak);
  layer.hline(cx - 3, 12 + dy, 5, pal.cloak);
  layer.rect(cx - 3, 13 + dy, 6, 3, pal.cloak);
  layer.rect(cx, 13 + dy, 3, 3, pal.O);

  // Warm orange scarf (neck +) to the tail)
  layer.hline(cx - 3, 16 + dy, 6, pal.scarf);
  layer.hline(cx - 2, 17 + dy, 4, pal.scarf);
  if (pose.anim === "dash") {
    // The rush is a horizontal sharp orange line
    layer.hline(cx - 12, 17 + dy, 9, pal.scarf);
    layer.hline(cx - 10, 18 + dy, 6, pal.scarf);
    fx.hline(cx - 14, 16 + dy, 5, pal.flame);
    fx.hline(cx - 11, 23, 5, pal.iron);
  } else {
    const wave = pose.anim === "idle" ? [0, -1, 0, 1][pose.step] : pose.step % 2 === 0 ? -1 : 1;
    layer.hline(cx - 7, 16 + dy + wave, 4, pal.scarf);
    layer.hline(cx - 9, 17 + dy + wave, 4, pal.scarf);
    layer.set(cx - 10, 16 + dy + wave, pal.scarf);
  }

  // Attack or firepuncher action
  if (pose.anim === "attack") {
    if (pose.step === 0) {
      // After the pull-out, the spear
      layer.hline(cx - 8, 18 + dy, 10, pal.O);
      layer.hline(cx - 9, 18 + dy, 2, pal.iron);
    } else if (pose.step === 1 || pose.step === 2) {
      // Procure + Dynamic bright lines
      const ext = pose.step === 1 ? 12 : 11;
      layer.hline(cx + 1, 18 + dy, ext, pal.O);
      layer.hline(cx + ext - 1, 18 + dy, 3, pal.iron);
      fx.hline(cx + 5, 17 + dy, 8, pal.flame);
      fx.hline(cx + 7, 19 + dy, 6, pal.scarf);
    } else {
      // - Get the signal
      layer.hline(cx + 2, 19 + dy, 6, pal.O);
      layer.set(cx + 8, 19 + dy, pal.iron);
    }
    return;
  }

  // Left/front torch with light
  const handX = cx + (pose.anim === "hurt" ? 3 : 5);
  const handY = 19 + dy;
  layer.vline(handX, handY, 3, pal.O);
  layer.set(handX, handY - 1, pal.scarf);
  fx.set(handX, handY - 2, pal.flame);
  if (pose.step % 2 === 1) fx.set(handX + 1, handY - 2, pal.scarf);
  if (pose.anim === "hurt") fx.set(cx + 6, 16 + dy, pal.flame);
}
