/**
 * 格雷（gale_smith）：身高 20px，最宽肩。
 * 厚重宽阔炭黑皮围裙 + 铁灰方形双护臂 + 左肩 2×2 暗红旧疤 + 方形锻铁大锤。
 */
import { drawLegs } from "../rig.mjs";

export function draw(layer, fx, pose, pal) {
  if (pose.anim === "dead") {
    layer.rect(6, 23, 4, 4, pal.O); // 靴
    layer.rect(10, 22, 10, 5, pal.apron); // 厚重躯干
    layer.rect(12, 22, 2, 2, pal.scar); // 旧疤
    layer.rect(14, 24, 3, 3, pal.guard); // 护臂
    layer.rect(20, 22, 4, 4, pal.O); // 头
    layer.rect(22, 24, 4, 3, pal.guard); // 大锤
    layer.hline(23, 24, 3, pal.hi);
    return;
  }

  const cx = 16 + pose.lean;
  const dy = pose.bob + pose.crouch;

  drawLegs(layer, cx, pose, 3, 4);

  // 厚重宽阔躯干与炭黑皮围裙（肩宽约 13px）
  const torsoTop = 14 + dy;
  const torsoBottom = Math.min(24, 23 + dy);
  layer.rect(cx - 6, torsoTop, 13, torsoBottom - torsoTop + 1, pal.apron);
  layer.rect(cx - 4, torsoTop + 1, 1, torsoBottom - torsoTop, pal.O);
  layer.rect(cx + 4, torsoTop + 1, 1, torsoBottom - torsoTop, pal.O);
  layer.hline(cx - 3, torsoTop + 3, 7, pal.O);

  // 粗壮无五官头颅（y = 9..13）
  layer.rect(cx - 2, 9 + dy, 5, 5, pal.O);

  // 左肩（-x 侧）2×2 暗红旧疤
  layer.rect(cx - 5, 15 + dy, 2, 2, pal.scar);

  if (pose.anim === "dash") {
    // 急步呈铁臂护胸冲撞姿
    layer.rect(cx + 1, 16 + dy, 4, 5, pal.guard);
    layer.vline(cx + 4, 16 + dy, 4, pal.hi);
    layer.rect(cx - 4, 18 + dy, 3, 3, pal.guard);
    fx.hline(cx - 12, 17 + dy, 5, pal.hi);
    fx.hline(cx - 10, 22, 4, pal.guard);
    return;
  }

  // 双铁灰方形护臂
  const armSway = pose.anim === "walk" ? (pose.step % 2 === 0 ? -1 : 1) : 0;
  layer.rect(cx - 7, 18 + dy - armSway, 3, 4, pal.guard);
  layer.hline(cx - 7, 18 + dy - armSway, 3, pal.hi);

  if (pose.anim === "attack") {
    if (pose.step === 0) {
      // 举锤过顶蓄力
      layer.rect(cx + 1, 13 + dy, 3, 4, pal.guard);
      layer.rect(cx - 1, 10 + dy, 2, 5, pal.O);
      layer.rect(cx - 4, 7 + dy, 6, 4, pal.guard);
      layer.hline(cx - 4, 7 + dy, 6, pal.hi);
    } else if (pose.step === 1 || pose.step === 2) {
      // 重砸前下方 + 冲击波亮线
      layer.rect(cx + 4, 17 + dy, 3, 4, pal.guard);
      layer.hline(cx + 5, 20 + dy, 4, pal.O);
      layer.rect(cx + 7, 21 + dy, 5, 4, pal.guard);
      layer.vline(cx + 11, 21 + dy, 4, pal.hi);
      fx.hline(cx + 6, 25, 8, pal.hi);
      fx.set(cx + 13, 23, pal.hi);
      if (pose.step === 1) fx.vline(cx + 9, 13 + dy, 6, pal.hi);
    } else {
      // 收势
      layer.rect(cx + 4, 18 + dy, 3, 4, pal.guard);
      layer.rect(cx + 7, 21 + dy, 4, 3, pal.guard);
      layer.hline(cx + 7, 21 + dy, 4, pal.hi);
    }
    return;
  }

  // 常态前护臂 + 垂持大锤
  layer.rect(cx + 4, 18 + dy + armSway, 3, 4, pal.guard);
  layer.hline(cx + 4, 18 + dy + armSway, 3, pal.hi);
  layer.hline(cx + 6, 22 + dy, 3, pal.O);
  layer.rect(cx + 7, 21 + dy, 4, 3, pal.guard);
  layer.vline(cx + 10, 21 + dy, 3, pal.hi);
}
