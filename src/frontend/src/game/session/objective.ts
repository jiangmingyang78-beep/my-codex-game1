import type { RunState, Systems } from "@/core";

/** One-line Chinese objective derived from run progress; always ends with the seal count. */
export function objectiveLine(state: RunState, sys: Systems): string {
  const seals = `炉印 ${state.seals.length}/2`;
  const millGate = sys.data.regions.get("old_mill")?.entry.gateId;
  const gateOpen = millGate
    ? state.changesByObjectId[millGate]?.opened === true
    : false;
  if (state.campLevel < 2)
    return `目标：采集木材与石料，升级二级营火 · ${seals}`;
  if (!gateOpen) return `目标：前往东侧废磨坊，打开大门 · ${seals}`;
  if (state.seals.includes("old_mill_ember_seal"))
    return `当前地图目标已完成 · ${seals}`;
  return `目标：在废磨坊击败守卫，取得炉印 · ${seals}`;
}
