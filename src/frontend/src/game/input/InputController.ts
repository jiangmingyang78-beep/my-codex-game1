import Phaser from "phaser";

export interface PolledInput {
  moveX: number;
  moveY: number;
  attackPressed: boolean;
  interactPressed: boolean;
  pausePressed: boolean;
  /** Quick-use slot 1..4 pressed this frame, else null. */
  slot: number | null;
}

type Key = Phaser.Input.Keyboard.Key;

/** Reads WASD/arrow movement and edge-triggered action keys from the Phaser keyboard. */
export class InputController {
  private readonly keys: Record<string, Key>;
  private readonly slotKeys: Key[];

  constructor(scene: Phaser.Scene) {
    const kb = scene.input.keyboard;
    if (!kb) throw new Error("Keyboard input is unavailable.");
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = kb.addKeys({
      up: K.W,
      down: K.S,
      left: K.A,
      right: K.D,
      upArrow: K.UP,
      downArrow: K.DOWN,
      leftArrow: K.LEFT,
      rightArrow: K.RIGHT,
      interact: K.E,
      attack: K.SPACE,
      pause: K.ESC,
    }) as Record<string, Key>;
    this.slotKeys = [K.ONE, K.TWO, K.THREE, K.FOUR].map((code) =>
      kb.addKey(code),
    );
  }

  /** Movement is level-triggered; actions are consumed once per press. */
  poll(): PolledInput {
    const k = this.keys;
    const held = (a: string, b: string): boolean => k[a].isDown || k[b].isDown;
    const edge = (name: string): boolean =>
      Phaser.Input.Keyboard.JustDown(k[name]);
    const slotIndex = this.slotKeys.findIndex((key) =>
      Phaser.Input.Keyboard.JustDown(key),
    );
    return {
      moveX:
        (held("right", "rightArrow") ? 1 : 0) -
        (held("left", "leftArrow") ? 1 : 0),
      moveY:
        (held("down", "downArrow") ? 1 : 0) - (held("up", "upArrow") ? 1 : 0),
      attackPressed: k.attack.isDown,
      interactPressed: edge("interact"),
      pausePressed: edge("pause"),
      slot: slotIndex >= 0 ? slotIndex + 1 : null,
    };
  }

  /** Drops key state so a press made while paused is not replayed on resume. */
  flush(): void {
    this.poll();
  }
}
