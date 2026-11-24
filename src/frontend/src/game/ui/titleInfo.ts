import {
  CAMP_NOTE_TEXT,
  type GameData,
  type HeroUnlock,
  getBrowserStorage,
  getSystems,
  isHeroUnlocked,
  loadMeta,
  loadRun,
} from "@/core";
import {
  META_UNLOCK_DEFS,
  readCrossModeUnlocks,
} from "@/shared/metaUnlocks.js";
import { uiStore } from "./store";

/** Reads the save and camp notes once so the menu can enable Continue (works without Phaser). */
export function refreshTitleInfo(): void {
  try {
    const storage = getBrowserStorage();
    const sys = getSystems();
    const { data } = sys;
    const load = loadRun(storage, sys);
    const meta = loadMeta(storage);
    const notes = meta.notes.map((id) => ({
      id,
      ...(CAMP_NOTE_TEXT[id] ?? { title: id, body: "" }),
    }));
    const unlocked = readCrossModeUnlocks(storage);
    const survivalUnlocks = META_UNLOCK_DEFS.filter(
      (rule) => rule.targetMode === "survival",
    );
    uiStore.set({
      title: {
        crossModeUnlockCount: survivalUnlocks.filter(({ id }) =>
          unlocked.has(id),
        ).length,
        crossModeUnlockTotal: survivalUnlocks.length,
        hasSave: load.snapshot !== null,
        eternalBestSec: meta.eternalBestSec,
        eternalBestKills: meta.eternalBestKills,
        notice: load.notice,
        notes,
        worldTagline: data.lore.worldTagline,
        heroes: [...data.heroes.values()].map((definition) => ({
          definition,
          unlocked: isHeroUnlocked(meta, definition.id),
          unlockText: unlockDescription(data, definition.unlock),
        })),
        selectedHeroId:
          uiStore.get().title.selectedHeroId || data.defaultHeroId,
      },
    });
  } catch (error) {
    console.error(error);
  }
}

function unlockDescription(data: GameData, unlock: HeroUnlock): string {
  switch (unlock.type) {
    case "default":
      return "默认解锁";
    case "boss_defeated":
      return `击败${data.enemies.get(unlock.enemyId)?.name ?? unlock.enemyId}`;
    case "consumables_crafted":
      return `累计制作 ${unlock.count} 次食物、药品或消耗品`;
    case "kills":
      return `累计击败 ${unlock.count} 只怪物`;
    case "camp_notes":
      return `收集 ${unlock.count} 条营地笔记`;
  }
}

export function selectTitleHero(heroId: string): void {
  const { screen, title } = uiStore.get();
  if (
    screen !== "title" ||
    !title.heroes.some(({ definition }) => definition.id === heroId)
  )
    return;
  uiStore.set({ title: { ...title, selectedHeroId: heroId } });
}
