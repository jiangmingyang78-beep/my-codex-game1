/** Deterministic mulberry32 generator. State is a uint32 so it can be saved in RunState. */
export function nextRandom(state: number): { value: number; state: number } {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, state: next };
}

export type Rng = () => number;

/** Stateful generator closure for world generation (not saved). */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    const r = nextRandom(state);
    state = r.state;
    return r.value;
  };
}

export function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Draws a number in [0,1) from the run's own RNG state and advances it. */
export function rollRun(run: { rngState: number }): number {
  const r = nextRandom(run.rngState);
  run.rngState = r.state;
  return r.value;
}
