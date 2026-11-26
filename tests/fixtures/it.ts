import { it as nodeIt } from "node:test";

function each<T>(cases: readonly T[]) {
  return (name: (row: T) => string, run: (row: T) => void | Promise<void>) => {
    for (const row of cases) nodeIt(name(row), () => run(row));
  };
}

export const it = Object.assign(nodeIt.bind(undefined), { each });
