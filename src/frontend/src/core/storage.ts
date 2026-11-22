/** Minimal storage surface (subset of the Web Storage API) so tests can inject memory storage. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** In-memory storage for tests and for browsers where localStorage is blocked. */
export function createMemoryStorage(
  initial: Record<string, string> = {},
): StorageLike {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

/** localStorage when readable and writable, otherwise null (private mode, blocked, SSR). */
export function getBrowserStorage(): StorageLike | null {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return null;
    const probe = "emberwood-torch:probe";
    storage.setItem(probe, "1");
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}
