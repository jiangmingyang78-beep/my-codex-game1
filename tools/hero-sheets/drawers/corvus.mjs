/**
 * 鸦羽（corvus_hunt）：身高 19px，修长尖锐。
 * 贴身墨黑猎装 + 锐利冰蓝滚边 + 锯齿下摆寒鸦羽短氅 + 亮银弧形剥皮弯刃。
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
    // 急步压低拉成黑鸦掠影
    layer.rect(cx - 6, 17 + dy, 12, 5, pal.suit);
    layer.rect(cx, 14 + dy, 4, 4, pal.O);
    layer.hline(cx - 9, 18 + dy, 14, pal.trim);
    layer.hline(cx + 5, 19 + dy, 4, pal.blade);
    fx.hline(cx - 13, 17 + dy, 5, pal.trim);
    fx.hline(cx - 11, 21 + dy, 4, pal.blade);
    return;
  }

  // 贴身墨黑猎装（宽约 7px）与锯齿状羽氅下摆
  const capeBottom = Math.min(24, 22 + dy);
  layer.rect(cx - 3, 15 + dy, 7, Math.max(4, capeBottom - 15 - dy), pal.suit);
  // 肩部尖羽刺
  layer.hline(cx - 6, 15 + dy, 3, pal.suit);
  layer.set(cx - 5, 14 + dy, pal.suit);
  layer.set(cx - 7, 16 + dy, pal.suit);
  // 锯齿状下摆（交替 1px 尖齿）
  const jag = pose.anim === "walk" ? pose.step % 2 : 0;
  layer.set(cx - 4 + jag, capeBottom, pal.suit);
  layer.set(cx - 2, capeBottom + 1, pal.suit);
  layer.set(cx + 1, capeBottom, pal.suit);
  layer.set(cx + 3 - jag, capeBottom + 1, pal.suit);

  // 锐利冰蓝滚边（V 领与前襟）
  layer.set(cx - 2, 15 + dy, pal.trim);
  layer.set(cx - 1, 16 + dy, pal.trim);
  layer.vline(cx, 16 + dy, 4, pal.trim);
  layer.set(cx + 2, 15 + dy, pal.trim);
  layer.set(cx + 1, 16 + dy, pal.trim);

  // 修长无五官黑头（y = 10..14）
  layer.rect(cx - 2, 10 + dy, 4, 5, pal.O);

  // 亮银弧形剥皮弯刃
  if (pose.anim === "attack") {
    if (pose.step === 0) {
      layer.hline(cx - 6, 17 + dy, 3, pal.blade);
      layer.set(cx - 7, 16 + dy, pal.blade);
    } else if (pose.step === 1 || pose.step === 2) {
      // 反手疾掠，拉长冰白刃弧
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
