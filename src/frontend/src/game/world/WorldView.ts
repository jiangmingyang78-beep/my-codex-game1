import type { RunState, Systems } from "@/core";
import { TILE } from "@/systems";
import type Phaser from "phaser";
import {
  TEX,
  TREE_VARIANTS,
  registerWorldTexture,
} from "../textures/registerTextures";
import {
  type TileArt,
  bakeWorldCanvas,
  tileHash,
} from "../textures/worldTexture";

/** Static world art (baked ground, trees, doors) plus the state-driven nodes and gates. */
export class WorldView {
  private readonly nodes = new Map<string, Phaser.GameObjects.Image>();
  private readonly doors = new Map<string, Phaser.GameObjects.Image[]>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly sys: Systems,
    art: TileArt,
  ) {
    const { world } = sys;
    if (!scene.textures.exists(TEX.world))
      registerWorldTexture(scene, bakeWorldCanvas(world, art));
    scene.add.image(0, 0, TEX.world).setOrigin(0).setDepth(-1);
    this.addTrees();
    this.addGates();
    this.addObjects();
  }

  private addTrees(): void {
    const { tiles, widthTiles, heightTiles, tileSize } = this.sys.world;
    for (let ty = 0; ty < heightTiles; ty++) {
      for (let tx = 0; tx < widthTiles; tx++) {
        if (tiles[ty * widthTiles + tx] !== TILE.tree) continue;
        const variant = Math.floor(tileHash(tx, ty, 3) * TREE_VARIANTS);
        const key = TEX.tree(variant);
        const y = (ty + 1) * tileSize - 1;
        this.scene.add
          .image(tx * tileSize + tileSize / 2, y, key)
          .setOrigin(13 / 26, 23 / 30)
          .setDepth(y);
      }
    }
  }

  private addGates(): void {
    const { widthTiles, tileSize, gateTiles } = this.sys.world;
    for (const [index, gateId] of gateTiles) {
      const x = (index % widthTiles) * tileSize + tileSize / 2;
      const y = Math.floor(index / widthTiles) * tileSize + tileSize / 2;
      const door = this.scene.add.image(x, y, TEX.door).setDepth(y + 7);
      this.doors.set(gateId, [...(this.doors.get(gateId) ?? []), door]);
    }
  }

  private addObjects(): void {
    const { objectList, campfire } = this.sys.world;
    this.scene.add
      .image(campfire.x, campfire.y + 3, TEX.campBase)
      .setOrigin(0.5, 0.8)
      .setDepth(campfire.y - 1);
    for (const o of objectList) {
      if (o.kind === "relay_socket") {
        this.scene.add
          .image(o.x, o.y + 6, TEX.brazier)
          .setOrigin(0.5, 0.9)
          .setDepth(o.y);
      } else if (o.kind === "node") {
        const key = this.scene.textures.exists(TEX.node(o.itemId ?? ""))
          ? TEX.node(o.itemId ?? "")
          : TEX.node("stone");
        this.nodes.set(
          o.id,
          this.scene.add
            .image(o.x, o.y + 6, key)
            .setOrigin(0.5, 0.9)
            .setDepth(o.y),
        );
      }
    }
  }

  /** Hides gathered nodes and opened gates; cheap enough to run every frame. */
  sync(state: RunState): void {
    for (const [id, image] of this.nodes)
      image.setVisible(!state.changesByObjectId[id]?.gathered);
    for (const [id, images] of this.doors) {
      const open = state.changesByObjectId[id]?.opened === true;
      for (const image of images) image.setVisible(!open);
    }
  }
}
