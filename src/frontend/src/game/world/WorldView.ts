import type { RunState, Systems } from "@/core";
import { TILE, type World } from "@/systems";
import { ETERNAL_TEXTURE_KEY } from "@/systems/eternal/eternalWorld";
import { appearanceRevision } from "@/systems/world/worldTypes";
import type Phaser from "phaser";
import { RENDER_DEPTH, entityDepthAt } from "../renderDepth";
import {
  TEX,
  TREE_VARIANTS,
  registerWorldTexture,
} from "../textures/registerTextures";
import type { SnowPineForm } from "../textures/snowPine";
import {
  type TileArt,
  bakeWorldCanvas,
  tileHash,
} from "../textures/worldTexture";

function snowPineFormAt(world: World, tx: number, ty: number): SnowPineForm {
  const { campfire, tileSize, tiles, widthTiles, heightTiles } = world;
  const campX = Math.floor(campfire.x / tileSize);
  const campY = Math.floor(campfire.y / tileSize);
  if ((tx - campX) ** 2 + (ty - campY) ** 2 <= 49) return "camp";
  let trees = 0;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const x = tx + dx;
      const y = ty + dy;
      if (x < 0 || x >= widthTiles || y < 0 || y >= heightTiles) continue;
      const tile = tiles[y * widthTiles + x];
      if (tile === TILE.ice) return "shore";
      if (tile === TILE.tree) trees++;
    }
  }
  return trees >= 6 ? "deep" : "woodland";
}

/** Static world art (baked ground, trees, doors) plus the state-driven nodes, barrels and gates. */
export class WorldView {
  private lastState?: RunState;
  private lastRevision = -1;
  private readonly nodes = new Map<string, Phaser.GameObjects.Image>();
  private readonly barrels = new Map<string, Phaser.GameObjects.Image>();
  private readonly doors = new Map<string, Phaser.GameObjects.Image[]>();
  private readonly worldHeightPx: number;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly sys: Systems,
    art: TileArt,
  ) {
    const { world } = sys;
    this.worldHeightPx = world.heightTiles * world.tileSize;
    const key = world.textureKey ?? TEX.world;
    if (!scene.textures.exists(key))
      registerWorldTexture(scene, bakeWorldCanvas(world, art), key);
    scene.add.image(0, 0, key).setOrigin(0).setDepth(RENDER_DEPTH.ground);
    this.addTrees();
    this.addGates();
    this.addObjects();
  }

  private addTrees(): void {
    const { world } = this.sys;
    const { tiles, widthTiles, heightTiles, tileSize, textureKey } = world;
    for (let ty = 0; ty < heightTiles; ty++) {
      for (let tx = 0; tx < widthTiles; tx++) {
        if (tiles[ty * widthTiles + tx] !== TILE.tree) continue;
        const variant = Math.floor(tileHash(tx, ty, 3) * TREE_VARIANTS);
        const key =
          textureKey === ETERNAL_TEXTURE_KEY
            ? TEX.tree(variant)
            : TEX.snowPine(snowPineFormAt(world, tx, ty), variant);
        const y = (ty + 1) * tileSize - 1;
        this.scene.add
          .image(tx * tileSize + tileSize / 2, y, key)
          .setOrigin(13 / 26, 23 / 30)
          .setDepth(entityDepthAt(y, this.worldHeightPx));
      }
    }
  }

  private addGates(): void {
    const { widthTiles, tileSize, gateTiles } = this.sys.world;
    for (const [index, gateId] of gateTiles) {
      const x = (index % widthTiles) * tileSize + tileSize / 2;
      const y = Math.floor(index / widthTiles) * tileSize + tileSize / 2;
      const depth = entityDepthAt(
        y + RENDER_DEPTH.objectYOffset.door,
        this.worldHeightPx,
      );
      const door = this.scene.add.image(x, y, TEX.door).setDepth(depth);
      this.doors.set(gateId, [...(this.doors.get(gateId) ?? []), door]);
    }
  }

  private addObjects(): void {
    const { objectList, campfire } = this.sys.world;
    this.scene.add
      .image(campfire.x, campfire.y + 3, TEX.campBase)
      .setOrigin(0.5, 0.8)
      .setDepth(
        entityDepthAt(
          campfire.y + RENDER_DEPTH.objectYOffset.campBase,
          this.worldHeightPx,
        ),
      );
    for (const o of objectList) {
      const depth = entityDepthAt(o.y, this.worldHeightPx);
      if (
        o.kind === "beacon" ||
        o.kind === "relay_socket" ||
        o.kind === "mirror_lamp"
      ) {
        const img = this.scene.add
          .image(o.x, o.y + 6, TEX.brazier)
          .setOrigin(0.5, 0.9)
          .setScale(o.kind === "beacon" ? 1.25 : 1)
          .setDepth(depth);
        if (o.kind === "mirror_lamp") img.setTint(0x9be7ff);
      } else if (o.kind === "explosive_barrel") {
        const img = this.scene.add
          .image(o.x, o.y + 6, TEX.node("wood"))
          .setOrigin(0.5, 0.9)
          .setDepth(depth)
          .setTint(0xff9452);
        this.barrels.set(o.id, img);
      } else if (o.kind === "story_prop") {
        const key =
          o.spriteKey && this.scene.textures.exists(o.spriteKey)
            ? o.spriteKey
            : TEX.node("stone");
        this.scene.add
          .image(o.x, o.y + 6, key)
          .setOrigin(0.5, 0.9)
          .setDepth(depth)
          .setTint(0xe8d8a8);
      } else if (o.kind === "node") {
        const key = this.scene.textures.exists(TEX.node(o.itemId ?? ""))
          ? TEX.node(o.itemId ?? "")
          : TEX.node("stone");
        this.nodes.set(
          o.id,
          this.scene.add
            .image(o.x, o.y + 6, key)
            .setOrigin(0.5, 0.9)
            .setDepth(depth),
        );
      }
    }
  }

  /** Hides gathered nodes, detonated barrels and opened gates; after the simulation reports a visibility change. */
  sync(state: RunState): void {
    const revision = appearanceRevision(state);
    if (state === this.lastState && revision === this.lastRevision) return;
    this.lastState = state;
    this.lastRevision = revision;
    for (const [id, image] of this.nodes)
      image.setVisible(!state.changesByObjectId[id]?.gathered);
    for (const [id, image] of this.barrels)
      image.setVisible(!state.changesByObjectId[id]?.opened);
    for (const [id, images] of this.doors) {
      const open = state.changesByObjectId[id]?.opened === true;
      for (const image of images) image.setVisible(!open);
    }
  }
}
