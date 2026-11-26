/**
 * 凛（lin_tinder）：身高 18px。
 * 瘦长尖兜帽深灰斗篷 + 向后飘动暖橙长围巾 + 火把光点与细长铁矛。
 */
import { drawLegs } from "../rig.mjs";

function drawSpearRest(layer, cx, dy, pal) {
  // 铁矛斜靠身后，矛尖与矛尾均不越出基线（y <= 25）
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
    layer.rect(8, 24, 4, 3, pal.O); // 靴
    layer.rect(12, 23, 8, 4, pal.cloak); // 斗篷
    layer.rect(15, 23, 4, 2, pal.scarf); // 散落橙巾
    layer.rect(20, 23, 4, 4, pal.cloak); // 兜帽
    layer.rect(21, 24, 2, 2, pal.O); // 暗部轮廓
    layer.hline(9, 26, 15, pal.O);
    layer.set(24, 25, pal.iron);
    return;
  }

  const cx = 16 + pose.lean;
  const dy = pose.bob + pose.crouch;

  drawLegs(layer, cx, pose, 2, 4);

  // 背后斜靠铁矛（非攻击帧）
  if (pose.anim !== "attack") {
    drawSpearRest(layer, cx, dy, pal);
  }

  // 瘦长斗篷主体（宽约 8px）
  const cloakBottom = Math.min(24, 23 + dy);
  const cloakTop = 16 + dy;
  layer.rect(cx - 4, cloakTop, 8, cloakBottom - cloakTop + 1, pal.cloak);
  layer.rect(cx + 1, cloakTop + 2, 2, Math.max(2, cloakBottom - cloakTop - 2), pal.O);

  // 尖兜帽与无五官暗面
  layer.set(cx - 3, 11 + dy, pal.cloak);
  layer.hline(cx - 3, 12 + dy, 5, pal.cloak);
  layer.rect(cx - 3, 13 + dy, 6, 3, pal.cloak);
  layer.rect(cx, 13 + dy, 3, 3, pal.O);

  // 暖橙长围巾（颈部 + 向后飘动尾端）
  layer.hline(cx - 3, 16 + dy, 6, pal.scarf);
  layer.hline(cx - 2, 17 + dy, 4, pal.scarf);
  if (pose.anim === "dash") {
    // 急步拉成水平锐利橙线
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

  // 攻击或持火把动作
  if (pose.anim === "attack") {
    if (pose.step === 0) {
      // 蓄力后拉铁矛
      layer.hline(cx - 8, 18 + dy, 10, pal.O);
      layer.hline(cx - 9, 18 + dy, 2, pal.iron);
    } else if (pose.step === 1 || pose.step === 2) {
      // 前刺 + 动态亮线
      const ext = pose.step === 1 ? 12 : 11;
      layer.hline(cx + 1, 18 + dy, ext, pal.O);
      layer.hline(cx + ext - 1, 18 + dy, 3, pal.iron);
      fx.hline(cx + 5, 17 + dy, 8, pal.flame);
      fx.hline(cx + 7, 19 + dy, 6, pal.scarf);
    } else {
      // 收势
      layer.hline(cx + 2, 19 + dy, 6, pal.O);
      layer.set(cx + 8, 19 + dy, pal.iron);
    }
    return;
  }

  // 左侧/前方持火把与微光
  const handX = cx + (pose.anim === "hurt" ? 3 : 5);
  const handY = 19 + dy;
  layer.vline(handX, handY, 3, pal.O);
  layer.set(handX, handY - 1, pal.scarf);
  fx.set(handX, handY - 2, pal.flame);
  if (pose.step % 2 === 1) fx.set(handX + 1, handY - 2, pal.scarf);
  if (pose.anim === "hurt") fx.set(cx + 6, 16 + dy, pal.flame);
}
