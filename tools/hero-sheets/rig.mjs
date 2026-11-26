/**
 * 16 帧动作姿态表与通用腿部/基线绘制。
 * 约定：填充层最低脚底在 y = 26（外描边后最高行在 y = 27，对齐 originY = 28）。
 */
import { O } from "./palette.mjs";

export const FOOT_FILL_Y = 26;

/** 根据帧序号 0..15 返回标准动作姿态参数。 */
export function poseFor(frame) {
  if (frame < 4) {
    const bob = [0, 0, 1, 1][frame];
    return { anim: "idle", step: frame, bob, lean: 0, stride: 0, crouch: 0 };
  }
  if (frame < 8) {
    const step = frame - 4;
    const bob = [0, -1, 0, -1][step];
    const stride = [1, 0, -1, 0][step];
    return { anim: "walk", step, bob, lean: 1, stride, crouch: 0 };
  }
  if (frame < 12) {
    const step = frame - 8;
    const lean = [-1, 1, 1, 0][step];
    const bob = [0, 1, 1, 0][step];
    return { anim: "attack", step, bob, lean, stride: step === 1 || step === 2 ? 1 : 0, crouch: 0 };
  }
  if (frame < 14) {
    const step = frame - 12;
    return { anim: "dash", step, bob: 0, lean: 2, stride: 2, crouch: 3 };
  }
  if (frame === 14) {
    return { anim: "hurt", step: 0, bob: 0, lean: -1, stride: 1, crouch: 0 };
  }
  return { anim: "dead", step: 0, bob: 0, lean: 0, stride: 0, crouch: 0 };
}

/** 绘制通用剪影双腿（填充最低到 y = FOOT_FILL_Y = 26）。 */
export function drawLegs(layer, cx, pose, spread = 2, legH = 4) {
  const yTop = FOOT_FILL_Y - legH + 1;
  if (pose.anim === "walk") {
    if (pose.step === 0) {
      // 后腿蹬后、前腿迈前
      layer.rect(cx - spread - 2, yTop, 2, legH, O);
      layer.rect(cx + spread, yTop - 1, 2, legH + 1, O);
    } else if (pose.step === 1) {
      // 交叉并拢，后腿略抬
      layer.rect(cx - 1, yTop - 1, 2, legH, O);
      layer.rect(cx + 1, yTop, 2, legH, O);
    } else if (pose.step === 2) {
      // 镜像跨步
      layer.rect(cx - spread - 1, yTop - 1, 2, legH + 1, O);
      layer.rect(cx + spread + 1, yTop, 2, legH, O);
    } else {
      layer.rect(cx - 2, yTop, 2, legH, O);
      layer.rect(cx + 1, yTop - 1, 2, legH, O);
    }
    return;
  }
  if (pose.anim === "dash") {
    layer.rect(cx - spread - 3, FOOT_FILL_Y - 2, 3, 3, O);
    layer.rect(cx + spread + 1, FOOT_FILL_Y - 2, 3, 3, O);
    return;
  }
  const extra = pose.anim === "attack" ? pose.stride : pose.anim === "hurt" ? 1 : 0;
  layer.rect(cx - spread - extra, yTop, 2, legH, O);
  layer.rect(cx + spread - 1 + extra, yTop, 2, legH, O);
}
