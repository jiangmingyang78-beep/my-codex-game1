/** Shared constants for the Phaser client. Rule values live in the JSON data, not here. */

export const SCENE = {
  boot: "Boot",
  title: "Title",
  game: "Game",
} as const;

export const REGISTRY = {
  textureGenerator: "textureGenerator",
} as const;

/** Render depths. World objects sort by their y pixel (0..1024); layers below stay above that. */
export const DEPTH = {
  ground: 0,
  fxBody: 2000,
  fxGlow: 2001,
  night: 3000,
} as const;

/** Visible world pixels the camera aims for before the integer zoom is chosen. */
const TARGET_VIEW_W = 400;
const TARGET_VIEW_H = 225;

/** Integer zoom keeps pixel art crisp; larger windows see a bit more world. */
export function zoomFor(width: number, height: number): number {
  const fit = Math.floor(
    Math.min(width / TARGET_VIEW_W, height / TARGET_VIEW_H),
  );
  return Math.max(2, Math.min(5, fit));
}

export const MUTE_STORAGE_KEY = "emberwood-torch:muted";

/** Seconds of real time between HUD model refreshes. */
export const HUD_REFRESH_SEC = 0.1;
