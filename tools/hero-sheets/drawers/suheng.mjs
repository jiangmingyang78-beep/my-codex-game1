/**
 * Su, (suhung_herb): Height 18px.
 * Round-up caps + green, velvet robes + back-up bamboo platinum (top 2–3px bright green herb) + short picks sickle.
 */
import { drawLegs } from "../rig.mjs";

export function draw(layer, fx, pose, pal) {
  if (pose.anim === "dead") {
    layer.rect(8, 24, 3, 3, pal.O);
    layer.rect(11, 23, 9, 4, pal.robe);
    layer.rect(12, 22, 4, 3, pal.basket);
    layer.set(11, 22, pal.herb);
    layer.rect(20, 23, 4, 4, pal.fur);
    layer.rect(21, 24, 2, 2, pal.O);
    return;
  }

  const cx = 16 + pose.lean;
  const dy = pose.bob + pose.crouch;

  drawLegs(layer, cx, pose, 2, 3);

  // The square is brown bamboo + the top is a bright green herb
  const bx = cx - 8;
  const by = 16 + dy;
  layer.rect(bx, by, 4, 5, pal.basket);
  layer.hline(bx, by + 2, 4, pal.O);
  const leafShift = pose.anim === "idle" ? (pose.step % 2) : pose.anim === "walk" ? -1 : 0;
  layer.set(bx + 1, by - 2 + leafShift, pal.herb);
  layer.set(bx + 2, by - 1, pal.herb);
  layer.set(bx + 3, by - 2, pal.herb);

  // A green and thick bell-shaped robe (swipes down and down with the walk))
  const hemW = pose.anim === "walk" && pose.step % 2 === 0 ? 11 : 10;
  const robeBottom = Math.min(24, 24 + dy);
  layer.rect(cx - 4, 16 + dy, 8, Math.max(3, robeBottom - 18 - dy), pal.robe);
  layer.rect(cx - 5, Math.max(18 + dy, robeBottom - 3), hemW, 4, pal.robe);
  layer.hline(cx - 3, 16 + dy, 6, pal.fur); // The hair collar

  // The round is tight and the wind-proof fur hat is not dark on five officers
  layer.hline(cx - 2, 11 + dy, 5, pal.fur);
  layer.rect(cx - 3, 12 + dy, 7, 2, pal.fur);
  layer.rect(cx - 3, 14 + dy, 2, 3, pal.fur); // Side-to-Ear
  layer.rect(cx - 1, 13 + dy, 4, 3, pal.O);

  // Picking a stupor
  if (pose.anim === "attack") {
    if (pose.step === 0) {
      layer.rect(cx - 4, 17 + dy, 2, 3, pal.O);
      layer.hline(cx - 5, 16 + dy, 3, pal.fur);
    } else if (pose.step === 1 || pose.step === 2) {
      layer.hline(cx + 3, 19 + dy, 4, pal.O);
      layer.hline(cx + 6, 18 + dy, 4, pal.fur);
      layer.set(cx + 9, 19 + dy, pal.fur);
      for (let k = -2; k <= 2; k++) {
        const ax = cx + 11 - Math.abs(k);
        fx.set(ax, 18 + dy + k, pal.fur);
        fx.set(ax - 1, 18 + dy + k, pal.herb);
      }
    } else {
      layer.hline(cx + 3, 20 + dy, 3, pal.O);
      layer.set(cx + 6, 19 + dy, pal.fur);
    }
    return;
  }

  if (pose.anim === "dash") {
    fx.hline(cx - 12, 19 + dy, 4, pal.herb);
    fx.hline(cx - 10, 23, 4, pal.fur);
    return;
  }

  // Normal hand-crickets
  layer.vline(cx + 4, 19 + dy, 3, pal.O);
  layer.hline(cx + 4, 19 + dy, 3, pal.fur);
}
