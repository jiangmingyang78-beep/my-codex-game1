import type { StepInputState } from "@/core/types";
import {
  COMBAT_FEEL_PRESETS,
  type InputBufferPreset,
} from "./combatFeelPresets";

export interface ActionAvailability {
  canAttack: boolean;
  canDash: boolean;
  canInteract: boolean;
}

export class CombatInputBuffer {
  private readonly windows: InputBufferPreset;
  private attackLeftMs = 0;
  private dashLeftMs = 0;
  private interactLeftMs = 0;
  private prevAttack = false;
  private prevDash = false;
  private prevInteract = false;

  constructor(windows: Partial<InputBufferPreset> = {}) {
    this.windows = { ...COMBAT_FEEL_PRESETS.inputBuffer, ...windows };
  }

  record(raw: StepInputState, dtMs: number): void {
    const dt = Math.max(0, dtMs);
    this.attackLeftMs = Math.max(0, this.attackLeftMs - dt);
    this.dashLeftMs = Math.max(0, this.dashLeftMs - dt);
    this.interactLeftMs = Math.max(0, this.interactLeftMs - dt);

    const a = raw.attackPressed === true;
    const d = raw.dashPressed === true;
    const i = raw.interactPressed === true;

    if (a && !this.prevAttack) {
      this.attackLeftMs = this.windows.attackMs;
    }
    if (d && !this.prevDash) {
      this.dashLeftMs = this.windows.dashMs;
    }
    if (i && !this.prevInteract) {
      this.interactLeftMs = this.windows.interactMs;
    }

    this.prevAttack = a;
    this.prevDash = d;
    this.prevInteract = i;
  }

  resolve(
    raw: StepInputState,
    availability: ActionAvailability,
  ): StepInputState {
    const out: StepInputState = { ...raw };

    if (this.attackLeftMs > 0 && availability.canAttack) {
      out.attackPressed = true;
      this.attackLeftMs = 0;
    }
    if (this.dashLeftMs > 0 && availability.canDash) {
      out.dashPressed = true;
      this.dashLeftMs = 0;
    }
    if (this.interactLeftMs > 0 && availability.canInteract) {
      out.interactPressed = true;
      this.interactLeftMs = 0;
    }

    return out;
  }

  clear(): void {
    this.attackLeftMs = 0;
    this.dashLeftMs = 0;
    this.interactLeftMs = 0;
  }
}
