/**
 * 艾尔文（alvin_scribe）：身高 18px，偏瘦微倾。
 * 深靛蓝长摆外套 + 背后方书匣 + 胸前暖金镜片点 + 左手前托发光青白余烬瓶。
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

  // 背后厚重棕色方书匣
  layer.rect(cx - 7, 15 + dy, 4, 6, pal.case);
  layer.vline(cx - 4, 15 + dy, 6, pal.O);

  // 深靛蓝长摆外套（宽约 8px，下摆至膝下）
  const coatBottom = Math.min(24, 23 + dy);
  layer.rect(cx - 4, 15 + dy, 8, coatBottom - 15 - dy + 1, pal.coat);
  layer.rect(cx - 1, 16 + dy, 2, 6, pal.O); // 前襟开叉

  // 胸前 1–2px 暖金镜片点
  layer.hline(cx + 1, 16 + dy, 2, pal.gold);

  // 微前倾无五官头部（y = 11..14）
  layer.rect(cx - 1, 11 + dy, 4, 4, pal.O);

  if (pose.anim === "attack") {
    // 略后仰吃力平刺铁矛
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

  // 左手前托发光青白余烬瓶 + 呼吸光晕
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
