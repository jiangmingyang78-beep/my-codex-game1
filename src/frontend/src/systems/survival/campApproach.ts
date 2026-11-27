interface Cell {
  x: number;
  y: number;
}

/** Breadth-first paths back to the hearth. Solid terrain/closed gates split the frontier. */
export function campApproaches(
  camp: Cell,
  radius: number,
  walkable: (x: number, y: number) => boolean,
) {
  const key = (x: number, y: number) => `${x},${y}`;
  const queue = [camp];
  const parents = new Map<string, Cell | null>([[key(camp.x, camp.y), null]]);
  for (let i = 0; i < queue.length; i++) {
    const here = queue[i];
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const x = here.x + dx;
      const y = here.y + dy;
      const k = key(x, y);
      if (
        parents.has(k) ||
        Math.hypot(x - camp.x, y - camp.y) > radius ||
        !walkable(x, y)
      )
        continue;
      parents.set(k, here);
      queue.push({ x, y });
    }
  }
  return parents;
}
