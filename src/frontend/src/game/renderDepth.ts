/** Shared depth bands for Phaser world views and screen-space overlays. */
export const RENDER_DEPTH = {
  ground: -1,
  footprints: -0.5,
  legacyTelegraph: 0,
  telegraph: 5,
  groundLoot: 6,
  interact: 7,
  entityMin: 10,
  entityMax: 1900,
  projectile: 1998,
  slash: 1999,
  combatParticles: 2000,
  combatGlow: 2001,
  campHalo: 2002,
  torchHalo: 2003,
  campFlame: 2004,
  night: 3000,
  torchEmbers: 3001,
  ambientParticles: 3010,
  ambientGlow: 3011,
  enemyHealth: 4000,
  floatingText: 9000,
  vignette: 9200,
  bossPointer: 9500,
  toast: 10000,
  entityOffset: {
    shadow: -0.5,
    dashGhost: -0.25,
    shield: 0.5,
  },
  objectYOffset: {
    campBase: -1,
    door: 7,
  },
} as const;

/** Keep one depth unit per world pixel when the map fits. Compress taller maps into the same band. */
export function entityDepthAt(worldY: number, worldHeightPx: number): number {
  const { entityMin, entityMax } = RENDER_DEPTH;
  if (
    !Number.isFinite(worldHeightPx) ||
    worldHeightPx <= 0 ||
    Number.isNaN(worldY)
  ) {
    return entityMin;
  }
  const y = Math.min(worldHeightPx, Math.max(0, worldY));
  const range = entityMax - entityMin;
  return entityMin + Math.min(range, y * Math.min(1, range / worldHeightPx));
}
