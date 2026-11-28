/**
 * Corvus_hunt: Height 19px, sharp fix.
 * Close-morning black hunting suit + sharp ice-blue edge + short-cut twig-feat, + bright silver arc skinning the blade.
 */
import { drawLegs } from "../rig.mjs";

export function draw(layer, fx, pose, pal) {
  if (pose.anim === "dead") {
    layer.rect(7, 24, 4, 3, pal.O);
    layer.rect(11, 23, 9, 4, pal.suit);
    layer.hline(12, 23, 7, pal.trim);
    layer.rect(20, 23, 4, 4, pal.O);
    layer.hline(20, 26, 5, pal.blade);
    return;
  }

  const cx = 16 + pose.lean;
  const dy = pose.bob + pose.crouch;

  drawLegs(layer, cx, pose, 2, 4);

  if (pose.anim === "dash") {
    // The storm is a black crow
    layer.rect(cx - 6, 17 + dy, 12, 5, pal.suit);
    layer.rect(cx, 14 + dy, 4, 4, pal.O);
    layer.hline(cx - 9, 18 + dy, 14, pal.trim);
    layer.hline(cx + 5, 19 + dy, 4, pal.blade);
    fx.hline(cx - 13, 17 + dy, 5, pal.trim);
    fx.hline(cx - 11, 21 + dy, 4, pal.blade);
    return;
  }

  // Close-in-knit black hunting suit (approximately 7px) with serrated feathers, down
  const capeBottom = Math.min(24, 22 + dy);
  layer.rect(cx - 3, 15 + dy, 7, Math.max(4, capeBottom - 15 - dy), pal.suit);
  // The shoulder stump
  layer.hline(cx - 6, 15 + dy, 3, pal.suit);
  layer.set(cx - 5, 14 + dy, pal.suit);
  layer.set(cx - 7, 16 + dy, pal.suit);
  // Sawing under the tooth (interruptible 1px sharp teeth))
  const jag = pose.anim === "walk" ? pose.step % 2 : 0;
  layer.set(cx - 4 + jag, capeBottom, pal.suit);
  layer.set(cx - 2, capeBottom + 1, pal.suit);
  layer.set(cx + 1, capeBottom, pal.suit);
  layer.set(cx + 3 - jag, capeBottom + 1, pal.suit);

  // The sharp ice blue roller (V collar with the ex-flap))
  layer.set(cx - 2, 15 + dy, pal.trim);
  layer.set(cx - 1, 16 + dy, pal.trim);
  layer.vline(cx, 16 + dy, 4, pal.trim);
  layer.set(cx + 2, 15 + dy, pal.trim);
  layer.set(cx + 1, 16 + dy, pal.trim);

  // He's got five officers. 10.14. —)
  layer.rect(cx - 2, 10 + dy, 4, 5, pal.O);

  // The silver arc is skin-blanked
  if (pose.anim === "attack") {
    if (pose.step === 0) {
      layer.hline(cx - 6, 17 + dy, 3, pal.blade);
      layer.set(cx - 7, 16 + dy, pal.blade);
    } else if (pose.step === 1 || pose.step === 2) {
      // Reverse hands are swept away, ice-cold-cuts are pulled
      layer.hline(cx + 3, 18 + dy, 4, pal.O);
      layer.hline(cx + 6, 17 + dy, 4, pal.blade);
      layer.set(cx + 10, 16 + dy, pal.blade);
      for (let k = -3; k <= 3; k++) {
        const ax = cx + 11 - Math.floor((k * k) / 3);
        fx.set(ax, 17 + dy + k, pal.blade);
        fx.set(ax - 1, 17 + dy + k, pal.trim);
      }
    } else {
      layer.hline(cx + 3, 19 + dy, 3, pal.blade);
      layer.set(cx + 6, 18 + dy, pal.blade);
    }
    return;
  }

  layer.hline(cx + 3, 20 + dy, 3, pal.blade);
  layer.set(cx + 6, 19 + dy, pal.blade);
}
