/**
 * Alvin_sfaire: Height 18px, thin. —.
 * Deep-blue coats + box of the back + hot-gold lens points on the chest + white-coloured scab bottles in front of the left hand.
 */
import { drawLegs } from "../rig.mjs";

export function draw(layer, fx, pose, pal) {
  if (pose.anim === "dead") {
    layer.rect(8, 24, 4, 3, pal.O);
    layer.rect(12, 23, 8, 4, pal.coat);
    layer.rect(13, 22, 4, 3, pal.case);
    layer.set(18, 24, pal.gold);
    layer.rect(20, 23, 4, 4, pal.O);
    layer.rect(24, 24, 2, 2, pal.vial);
    fx.set(25, 23, pal.glow);
    return;
  }

  const cx = 16 + (pose.anim === "attack" && (pose.step === 1 || pose.step === 2) ? -1 : pose.lean);
  const dy = pose.bob + pose.crouch;

  drawLegs(layer, cx, pose, 2, 4);

  // The thick brown box behind the back
  layer.rect(cx - 7, 15 + dy, 4, 6, pal.case);
  layer.vline(cx - 4, 15 + dy, 6, pal.O);

  // Dark blue coats (approx. 8px, down to knee))
  const coatBottom = Math.min(24, 23 + dy);
  layer.rect(cx - 4, 15 + dy, 8, coatBottom - 15 - dy + 1, pal.coat);
  layer.rect(cx - 1, 16 + dy, 2, 6, pal.O); // The fork is open

  // 1-2px warm gold lens points on the chest
  layer.hline(cx + 1, 16 + dy, 2, pal.gold);

  // Five officials headlessly (y = 11.14))
  layer.rect(cx - 1, 11 + dy, 4, 4, pal.O);

  if (pose.anim === "attack") {
    // A little bit of a stun gun
    if (pose.step === 0) {
      layer.hline(cx - 5, 19 + dy, 8, pal.case);
      layer.hline(cx + 3, 19 + dy, 2, pal.gold);
    } else if (pose.step === 1 || pose.step === 2) {
      const reach = pose.step === 1 ? 10 : 9;
      layer.hline(cx - 1, 18 + dy, reach, pal.case);
      layer.hline(cx + reach - 1, 18 + dy, 2, pal.gold);
      fx.hline(cx + reach + 1, 18 + dy, 3, pal.vial);
      fx.set(cx + reach, 17 + dy, pal.glow);
    } else {
      layer.hline(cx + 1, 19 + dy, 6, pal.case);
      layer.set(cx + 7, 19 + dy, pal.gold);
    }
    return;
  }

  // The left hand is filled with a white and residual bottle + a breath of light and dizziness
  const vx = cx + (pose.anim === "dash" ? 6 : 5);
  const vy = 17 + dy;
  layer.hline(cx + 3, vy + 2, 3, pal.O);
  layer.rect(vx, vy, 2, 2, pal.vial);

  const pulse = pose.anim === "idle" ? [0, 1, 2, 1][pose.step] : 1;
  if (pulse >= 1) {
    fx.set(vx, vy - 2, pal.glow);
    fx.set(vx + 1, vy - 2, pal.glow);
    fx.set(vx + 3, vy, pal.glow);
    fx.set(vx + 3, vy + 1, pal.glow);
  }
  if (pulse >= 2) {
    fx.set(vx - 1, vy - 2, pal.glow);
    fx.set(vx + 2, vy - 2, pal.glow);
    fx.set(vx + 3, vy - 1, pal.glow);
    fx.set(vx + 4, vy, pal.glow);
    fx.set(vx + 1, vy + 3, pal.glow);
  }
  if (pose.anim === "dash") {
    fx.hline(cx - 11, 18 + dy, 4, pal.vial);
  }
}
