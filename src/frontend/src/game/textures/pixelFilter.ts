import Phaser from "phaser";

/** Locks all existing and subsequent textures into the nearest neighbour sample, returns the cleanup function that unheard. */
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
