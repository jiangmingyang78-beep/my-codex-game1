import type { Systems } from "@/core";
import type Phaser from "phaser";
import { zoomFor } from "../config";

/**
 * Bounds the main camera to the world, picks an integer pixel zoom for the current window
 * and follows `target` when given. Returns a cleanup that removes the resize listener.
 */
export function configureCamera(
  scene: Phaser.Scene,
  sys: Systems,
  target?: Phaser.GameObjects.GameObject,
): () => void {
  const cam = scene.cameras.main;
  const { world } = sys;
  cam.setBounds(
    0,
    0,
    world.widthTiles * world.tileSize,
    world.heightTiles * world.tileSize,
  );
  cam.setRoundPixels(true);
  const fit = (): void => {
    const { width, height } = scene.scale;
    cam.setSize(width, height);
    cam.setZoom(zoomFor(width, height));
  };
  fit();
  if (target) cam.startFollow(target, true, 0.2, 0.2);
  scene.scale.on("resize", fit);
  return () => {
    scene.scale.off("resize", fit);
  };
}
