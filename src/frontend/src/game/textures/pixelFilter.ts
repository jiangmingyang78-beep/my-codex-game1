import Phaser from "phaser";

/** 将现有及后续新增的全部纹理锁定为最近邻采样，返回解除监听的清理函数。 */
export function lockNearestFilter(scene: Phaser.Scene): () => void {
  const mgr = scene.textures;
  const apply = (key: string): void => {
    if (mgr.exists(key)) {
      mgr.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  };
  for (const key of mgr.getTextureKeys()) apply(key);
  mgr.on(Phaser.Textures.Events.ADD, apply);
  return () => {
    mgr.off(Phaser.Textures.Events.ADD, apply);
  };
}
