import { lookupEnemy, type Attack } from "./state/derivedMetrics";
import { scenarioDefaults } from "./state/ruleConfig";
import { selected, type Session } from "./state/selection";
import { CELL_PX, type Camera } from "./mapRenderer";

export function combatOverlay(ctx: CanvasRenderingContext2D, s: Session, cam: Camera) {
  const p = selected(s),
    hero = s.map.spawns.find((p) => p.kind === "hero");
  const scale = CELL_PX * cam.zoom;
  const at = (point: { tx: number; ty: number }) =>
    [
      ctx.canvas.width / 2 + (point.tx + 0.5 - cam.cx) * scale,
      ctx.canvas.height / 2 + (point.ty + 0.5 - cam.cy) * scale,
    ] as const;
  const circle = (
    point: { tx: number; ty: number },
    radius: number,
    color: string,
    dash: number[] = [],
    angle = 360,
  ) => {
    if (!Number.isFinite(radius) || radius <= 0) return;
    const [x, y] = at(point),
      a = (Math.max(0, Math.min(360, angle)) * Math.PI) / 360;
    ctx.beginPath();
    ctx.setLineDash(dash);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    if (angle < 360) ctx.moveTo(x, y);
    ctx.arc(x, y, radius * scale, -a, a);
    if (angle < 360) {
      ctx.closePath();
      ctx.fillStyle = color + "38";
      ctx.fill();
    }
    ctx.stroke();
  };
  ctx.save();
  if (hero && (s.tab === "hero" || p?.kind === "hero")) {
    const b = s.store.draft["balance.json"];
    const traits = s.store.draft["heroes.json"].heroes.find((h) => h.id === s.heroId)?.traits;
    circle(hero, b.hero.attackRangeTiles, "#ff9e63", [], b.hero.attackArcDegrees);
    Object.values(b.camp.radiiTilesByLevel).forEach((r, i) =>
      circle(hero, r * (traits?.lightRadiusMult ?? 1), ["#f7cd76", "#dca866", "#ae7954"][i], [4, 3]),
    );
  } else if (p && "enemyId" in p && p.enemyId) {
    const e = lookupEnemy(s.store.draft, p.enemyId),
      per = s.store.draft["encounters.json"].perception;
    const a = e?.attack ?? e?.phases?.[s.phase]?.overrides.attack ?? e?.phases?.[0]?.overrides.attack;
    circle(p, per?.aggroTiles ?? scenarioDefaults.perception.aggroTiles, "#91dcf7", [5, 3]);
    if (s.leash) circle(p, per?.leashTiles ?? scenarioDefaults.perception.leashTiles, "#b6bcc4", [2, 4]);
    const attack = (a: Attack) => {
      const radius =
        a.rangeTiles ??
        a.reachTiles ??
        a.distanceTiles ??
        (a.projectileLifetimeSec && a.projectileSpeedPxPerSec
          ? (a.projectileLifetimeSec * a.projectileSpeedPxPerSec) / s.map.tileSize
          : undefined) ??
        a.preferredTiles ??
        a.triggerRangeTiles ??
        a.triggerTiles ??
        0;
      circle(p, radius, "#ff9e63", [], a.arcDegrees ?? 360);
    };
    if (a) for (const move of a.moves ?? [a]) attack(move);
  }
  ctx.restore();
}
