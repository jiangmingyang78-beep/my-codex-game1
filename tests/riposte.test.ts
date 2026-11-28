import assert from "node:assert/strict";
import test from "node:test";
import { EVT } from "@/core/events";
import type { GameEvent, Systems } from "@/core/types";
import { stepCombat } from "@/systems/combat/combat";
import { currentWeapon, heroAttack } from "@/systems/combat/heroAttack";
import {
  RIPOSTE_CONFIG,
  getRiposteState,
  tickRiposte,
} from "@/systems/combat/riposte";
import { getDashCooldownState, moveHero } from "@/systems/movement";
import { damageHero, resetBucklerCooldown } from "@/systems/survival";
import { solidAt } from "@/systems/world/collision";
import {
  addTestEnemy,
  createTestRun,
  getTestSystems,
  makeStepInput,
} from "./fixtures/testFactories";

function findWallAdjacentSpot(
  sys: Systems,
  changes: Record<string, { opened?: boolean }>,
): { x: number; y: number; dirX: number; dirY: number; wallTileX: number; wallTileY: number } {
  const { widthTiles, heightTiles } = sys.world;
  const tile = sys.data.tileSize;
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;
  for (let ty = 1; ty < heightTiles - 1; ty++) {
    for (let tx = 1; tx < widthTiles - 1; tx++) {
      if (solidAt(sys.world, changes, tx, ty)) continue;
      for (const [dx, dy] of dirs) {
        const wtx = tx + dx;
        const wty = ty + dy;
        if (solidAt(sys.world, changes, wtx, wty)) {
          return {
            x: (tx + 0.5) * tile,
            y: (ty + 0.5) * tile,
            dirX: dx,
            dirY: dy,
            wallTileX: wtx,
            wallTileY: wty,
          };
        }
      }
    }
  }
  throw new Error("No passable cells were found in the world map, adjacent to the solid wall");
}

test("Ember Jamee.. the enemy enters the end of RDup and the attack is ready and the cooling is immediately zero", () => {
  const sys = getTestSystems();

  // The non-last-stage (remaining rock > / OceanicSec) sprint is not triggered
  const earlyState = createTestRun({
    systems: sys,
    hero: { attackCooldownSec: 0.35, hunger: 80 },
  });
  const earlyEvents: GameEvent[] = [];
  addTestEnemy(earlyState, sys, "snow_weasel", {
    x: earlyState.hero.x + 24,
    y: earlyState.hero.y,
    phase: "windup",
    phaseSec: RIPOSTE_CONFIG.telegraphCommitSec + 0.15,
    dirX: -1,
    dirY: 0,
  });
  moveHero(earlyState, sys, { moveX: -1, moveY: 0, dashPressed: true }, 0.016);
  stepCombat(earlyState, sys, makeStepInput(), 0.016, earlyEvents);
  assert.equal(getRiposteState(earlyState).armed, false);

  // The last paragraph (remaining rock < / / /Comp) is ready to jump off the risk zone. Comp
  const state = createTestRun({
    systems: sys,
    hero: { attackCooldownSec: 0.35, hunger: 80 },
  });
  const events: GameEvent[] = [];
  addTestEnemy(state, sys, "snow_weasel", {
    x: state.hero.x + 24,
    y: state.hero.y,
    phase: "windup",
    phaseSec: Math.max(0.05, RIPOSTE_CONFIG.telegraphCommitSec - 0.05),
    dirX: -1,
    dirY: 0,
  });
  moveHero(state, sys, { moveX: -1, moveY: 0, dashPressed: true }, 0.016);
  stepCombat(state, sys, makeStepInput(), 0.016, events);

  const snap = getRiposteState(state);
  assert.equal(snap.armed, true);
  assert.equal(snap.triggerKind, "telegraph_dash");
  assert.equal(state.hero.attackCooldownSec, 0);
  const armedEv = events.find((e) => e.type === EVT.COMBAT_RIPOSTE_ARMED);
  assert.ok(armedEv);
  assert.equal(armedEv.payload.trigger, "telegraph_dash");
  assert.equal(armedEv.payload.durationSec, RIPOSTE_CONFIG.windowSec);
});

test("Ember Jamee. Circle shield to shield and sprint under invincible frames triggers the attack and does not repeat the trigger inside `s ICD '.  s s s s ICD", () => {
  const sys = getTestSystems();

  // * Double intercept during circle shield + ICD period
  const shieldState = createTestRun({
    systems: sys,
    inventory: { iron_buckler: 1 },
    hero: { hp: 8, hunger: 80, attackCooldownSec: 0.4 },
  });
  resetBucklerCooldown(shieldState);
  const shieldEvents: GameEvent[] = [];

  const blocked = damageHero(shieldState, sys, 2, shieldEvents, "ash_wolf", {
    x: shieldState.hero.x + 16,
    y: shieldState.hero.y,
  });
  assert.equal(blocked, false);
  assert.ok(shieldEvents.some((e) => e.type === EVT.blocked));
  assert.equal(getRiposteState(shieldState).armed, true);
  assert.equal(getRiposteState(shieldState).triggerKind, "buckler_block");
  assert.equal(shieldState.hero.attackCooldownSec, 0);

  // The ICD period uses a hedge frame to intercept the injury again without triggering the COMBAT_RIPOSTE_ARAM. —
  moveHero(shieldState, sys, { moveX: 1, moveY: 0, dashPressed: true }, 0.016);
  damageHero(shieldState, sys, 2, shieldEvents, "ash_wolf", {
    x: shieldState.hero.x + 16,
    y: shieldState.hero.y,
  });
  assert.equal(
    shieldEvents.filter((e) => e.type === EVT.COMBAT_RIPOSTE_ARMED).length,
    1,
  );

  // * The trigger for the impenetrable frame is triggered by the expiry of + ~s ICD. + s ICD
  const dashState = createTestRun({
    systems: sys,
    hero: { hp: 8, hunger: 80, attackCooldownSec: 0.4 },
  });
  const dashEvents: GameEvent[] = [];
  moveHero(dashState, sys, { moveX: 1, moveY: 0, dashPressed: true }, 0.016);
  const dodged = damageHero(dashState, sys, 2, dashEvents, "snow_weasel", {
    x: dashState.hero.x + 20,
    y: dashState.hero.y,
  });
  assert.equal(dodged, false);
  assert.equal(dashState.hero.hp, 8);
  assert.equal(getRiposteState(dashState).triggerKind, "dash_iframe");

  tickRiposte(dashState, 0.5, sys);
  damageHero(dashState, sys, 2, dashEvents, "snow_weasel", {
    x: dashState.hero.x + 20,
    y: dashState.hero.y,
  });
  assert.equal(
    dashEvents.filter((e) => e.type === EVT.COMBAT_RIPOSTE_ARMED).length,
    1,
  );

  tickRiposte(dashState, RIPOSTE_CONFIG.icdSec, sys);
  moveHero(dashState, sys, { moveX: 1, moveY: 0, dashPressed: true }, 1.6);
  damageHero(dashState, sys, 2, dashEvents, "snow_weasel", {
    x: dashState.hero.x + 20,
    y: dashState.hero.y,
  });
  assert.equal(
    dashEvents.filter((e) => e.type === EVT.COMBAT_RIPOSTE_ARMED).length,
    2,
  );
});

test("Ember Jaime.. pre-surgent attack without a wall, range and injury up, short invincible frame and light", () => {
  const sys = getTestSystems();
  const state = createTestRun({
    systems: sys,
    hero: { hp: 8, light: 40, hunger: 80, facingX: 1, facingY: 0 },
  });
  const events: GameEvent[] = [];
  const startX = state.hero.x;
  const weapon = currentWeapon(state, sys);
  // Places where ordinary beams are not available but where stomping + extended range hits
  const enemy = addTestEnemy(state, sys, "ash_wolf", {
    x:
      startX +
      (weapon.rangeTiles + RIPOSTE_CONFIG.lungeTiles + 0.35) * sys.data.tileSize,
    y: state.hero.y,
    hp: 20,
  });

  moveHero(state, sys, { moveX: 1, moveY: 0, dashPressed: true }, 0.016);
  damageHero(state, sys, 1, events, "ash_wolf", { x: enemy.x, y: enemy.y });
  const cdBefore = getDashCooldownState(state, sys).remainingSec;
  const expectedDamage = Math.ceil(weapon.damage * RIPOSTE_CONFIG.damageMult);

  assert.equal(heroAttack(state, sys, events), true);
  assert.equal(getRiposteState(state).armed, false);
  assert.ok(state.hero.x > startX);
  assert.ok(state.hero.invulnerableSec >= RIPOSTE_CONFIG.thrustInvulnSec);
  assert.equal(enemy.hp, 20 - expectedDamage);
  assert.equal(state.hero.light, 40 + RIPOSTE_CONFIG.lightOnHit);
  assert.ok(getDashCooldownState(state, sys).remainingSec < cdBefore);

  const strikeEv = events.find((e) => e.type === EVT.COMBAT_RIPOSTE_STRIKE);
  assert.ok(strikeEv);
  assert.equal(strikeEv.payload.hitCount, 1);
  assert.equal(strikeEv.payload.damage, expectedDamage);
  assert.equal(strikeEv.payload.lightRestored, RIPOSTE_CONFIG.lightOnHit);

  // Wall-in-wall security checks
  const wallSpot = findWallAdjacentSpot(sys, state.changesByObjectId);
  const wallState = createTestRun({
    systems: sys,
    hero: {
      x: wallSpot.x,
      y: wallSpot.y,
      facingX: wallSpot.dirX,
      facingY: wallSpot.dirY,
      hunger: 80,
    },
  });
  const wallEvents: GameEvent[] = [];
  addTestEnemy(wallState, sys, "snow_weasel", {
    x: wallSpot.x,
    y: wallSpot.y,
    phase: "windup",
    phaseSec: 0.1,
    dirX: 1,
    dirY: 0,
  });
  moveHero(wallState, sys, { moveX: 0, moveY: 0, dashPressed: true }, 0.016);
  stepCombat(wallState, sys, makeStepInput(), 0.016, wallEvents);
  // The re-entry towards the face-to-face wall is restored and the penetration is not verified into the solid wall
  wallState.hero.facingX = wallSpot.dirX;
  wallState.hero.facingY = wallSpot.dirY;
  assert.equal(getRiposteState(wallState).armed, true);
  heroAttack(wallState, sys, wallEvents);
  const tx = Math.floor(wallState.hero.x / sys.data.tileSize);
  const ty = Math.floor(wallState.hero.y / sys.data.tileSize);
  assert.equal(solidAt(sys.world, wallState.changesByObjectId, tx, ty), false);
});

test("Ember Jamee.. over....was not automatically expired and the next attack resumed normal swipe", () => {
  const sys = getTestSystems();
  const state = createTestRun({
    systems: sys,
    hero: { hp: 8, light: 40, hunger: 80, facingX: 1, facingY: 0 },
  });
  const events: GameEvent[] = [];

  moveHero(state, sys, { moveX: 1, moveY: 0, dashPressed: true }, 0.016);
  damageHero(state, sys, 1, events, "snow_weasel", {
    x: state.hero.x + 20,
    y: state.hero.y,
  });
  assert.equal(getRiposteState(state).armed, true);

  // (c) Pushing beyond the periSec (1.4s)
  tickRiposte(state, RIPOSTE_CONFIG.windowSec + 0.05, sys);
  assert.equal(getRiposteState(state).armed, false);
  assert.equal(getRiposteState(state).triggerKind, null);

  const preAttackX = state.hero.x;
  const weapon = currentWeapon(state, sys);
  const enemy = addTestEnemy(state, sys, "ash_wolf", {
    x: preAttackX + sys.data.tileSize * 0.8,
    y: state.hero.y,
    hp: 20,
  });

  assert.equal(heroAttack(state, sys, events), true);
  assert.equal(state.hero.x, preAttackX);
  assert.equal(enemy.hp, 20 - weapon.damage);
  assert.equal(state.hero.light, 40);
  assert.equal(
    events.some((e) => e.type === EVT.COMBAT_RIPOSTE_STRIKE),
    false,
  );
  assert.ok(events.some((e) => e.type === EVT.swing));
});
