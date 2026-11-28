/**
 * Gale_J: Height 20px, shoulders wide.. —.
 * A thick, wide-blown black-skinned apron + iron-bleed squares with two arms + left shoulder 2x2 Dark red old scar + square-shaped iron-flexing hammer.
 */
import { drawLegs } from "../rig.mjs";

export function draw(layer, fx, pose, pal) {
  if (pose.anim === "dead") {
    layer.rect(6, 23, 4, 4, pal.O); // Boots
    layer.rect(10, 22, 10, 5, pal.apron); // Thick torso
    layer.rect(12, 22, 2, 2, pal.scar); // Old scar
    layer.rect(14, 24, 3, 3, pal.guard); // Arm
    layer.rect(20, 22, 4, 4, pal.O); // Head
    layer.rect(22, 24, 4, 3, pal.guard); // Big hammer
    layer.hline(23, 24, 3, pal.hi);
    return;
  }

  const cx = 16 + pose.lean;
  const dy = pose.bob + pose.crouch;

  drawLegs(layer, cx, pose, 3, 4);

  // The thick and wide body and the black carbon apron (shoulder wide about 13px))
  const torsoTop = 14 + dy;
  const torsoBottom = Math.min(24, 23 + dy);
  layer.rect(cx - 6, torsoTop, 13, torsoBottom - torsoTop + 1, pal.apron);
  layer.rect(cx - 4, torsoTop + 1, 1, torsoBottom - torsoTop, pal.O);
  layer.rect(cx + 4, torsoTop + 1, 1, torsoBottom - torsoTop, pal.O);
  layer.hline(cx - 3, torsoTop + 3, 7, pal.O);

  // Crude head of five officers (y = 9.13). —)
  layer.rect(cx - 2, 9 + dy, 5, 5, pal.O);

  // 2x2 Dark red old scar with left shoulder (-x side)
  layer.rect(cx - 5, 15 + dy, 2, 2, pal.scar);

  if (pose.anim === "dash") {
    // Dash with the iron arm braced across the chest
    layer.rect(cx + 1, 16 + dy, 4, 5, pal.guard);
    layer.vline(cx + 4, 16 + dy, 4, pal.hi);
    layer.rect(cx - 4, 18 + dy, 3, 3, pal.guard);
    fx.hline(cx - 12, 17 + dy, 5, pal.hi);
    fx.hline(cx - 10, 22, 4, pal.guard);
    return;
  }

  // Double-iron-bleed arms
  const armSway = pose.anim === "walk" ? (pose.step % 2 === 0 ? -1 : 1) : 0;
  layer.rect(cx - 7, 18 + dy - armSway, 3, 4, pal.guard);
  layer.hline(cx - 7, 18 + dy - armSway, 3, pal.hi);

  if (pose.anim === "attack") {
    if (pose.step === 0) {
      // The hammer over the force
      layer.rect(cx + 1, 13 + dy, 3, 4, pal.guard);
      layer.rect(cx - 1, 10 + dy, 2, 5, pal.O);
      layer.rect(cx - 4, 7 + dy, 6, 4, pal.guard);
      layer.hline(cx - 4, 7 + dy, 6, pal.hi);
    } else if (pose.step === 1 || pose.step === 2) {
      // Reshuffle the bottom front + shock wave bright wire
      layer.rect(cx + 4, 17 + dy, 3, 4, pal.guard);
      layer.hline(cx + 5, 20 + dy, 4, pal.O);
      layer.rect(cx + 7, 21 + dy, 5, 4, pal.guard);
      layer.vline(cx + 11, 21 + dy, 4, pal.hi);
      fx.hline(cx + 6, 25, 8, pal.hi);
      fx.set(cx + 13, 23, pal.hi);
      if (pose.step === 1) fx.vline(cx + 9, 13 + dy, 6, pal.hi);
    } else {
      // - Get the signal
      layer.rect(cx + 4, 18 + dy, 3, 4, pal.guard);
      layer.rect(cx + 7, 21 + dy, 4, 3, pal.guard);
      layer.hline(cx + 7, 21 + dy, 4, pal.hi);
    }
    return;
  }

  // Normal front arm + hold the hammer
  layer.rect(cx + 4, 18 + dy + armSway, 3, 4, pal.guard);
  layer.hline(cx + 4, 18 + dy + armSway, 3, pal.hi);
  layer.hline(cx + 6, 22 + dy, 3, pal.O);
  layer.rect(cx + 7, 21 + dy, 4, 3, pal.guard);
  layer.vline(cx + 10, 21 + dy, 3, pal.hi);
}
