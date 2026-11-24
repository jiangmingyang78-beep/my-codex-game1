/** Item and recipe configuration types split from dataTypes.ts to keep files compact. */

export type OwnedStatName =
  | "maxHp"
  | "attackDamage"
  | "coldResist"
  | "damageReduction"
  | "moveSpeedBonus"
  | "dashCooldownReductionSec"
  | "immunityBonusSec";

export type ItemEffect =
  | {
      trigger: "use";
      type: "restore_stat";
      stat: "hunger" | "hp" | "light";
      amount: number;
      requiresBelowMax?: boolean;
    }
  | {
      trigger: "use" | "owned";
      type: "night_light_drain_multiplier";
      multiplier: number;
      durationSec?: number;
      reapply?: "refresh_duration";
    }
  | {
      trigger: "owned";
      type: "set_combat_stat";
      stat: "attackDamage" | "attackRangeTiles";
      value: number;
    }
  | {
      trigger: "owned";
      type: "add_owned_stat";
      stat: OwnedStatName;
      value: number;
    }
  | {
      trigger: "owned";
      type: "periodic_block";
      cooldownSec: number;
    }
  | {
      trigger: "owned";
      type: "light_radius_multiplier";
      multiplier: number;
    }
  | {
      trigger: "place";
      type: "ignite_relay";
      targetType: string;
      radiusTiles: number;
      consumeCount: number;
    }
  | {
      trigger: "owned" | "interact";
      type: "quest_requirement" | "ignite_beacon";
      targetId: string;
      requiredCount: number;
    };

export interface ItemDef {
  id: string;
  name: string;
  type: string;
  maxStack: number;
  effects: ItemEffect[];
  description: string;
}

export type RecipeOutput =
  | { type: "item"; id: string; count: number }
  | { type: "camp_level"; level: number };

export interface RecipeDef {
  id: string;
  name: string;
  stationId: string;
  minCampLevel: number;
  inputs: Record<string, number>;
  output: RecipeOutput;
  constraints?: {
    uniqueOutput?: boolean;
    inventoryCapSource?: string;
    exactCampLevel?: number;
  };
}
