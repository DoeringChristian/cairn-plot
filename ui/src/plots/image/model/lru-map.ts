/**
 * `image/lru-map.ts` — a tiny bounded LRU map.
 *
 * Backed by a `Map`, whose iteration order is insertion order. `get` bumps a
 * key to the most-recently-used end (delete + re-set); `set` evicts the
 * least-recently-used (the first key) once `maxEntries` is exceeded. So a key
 * that keeps being READ survives even as newer keys arrive — the property a
 * plain FIFO lacks (a FIFO evicts by INSERTION age, discarding hot-but-old
 * keys). `onEvict` fires with each evicted entry (e.g. to free GPU/CPU buffers).
 *
 * NOTE (follow-up, other owners): the LRUs in `engine/diff-engine.ts` and the
 * context/`pool.ts` pools are their owners' and are NOT consolidated here.
 */
export interface LruMap<T> {
  get(key: string): T | undefined;
  set(key: string, value: T): void;
  has(key: string): boolean;
  readonly size: number;
}

export interface LruMapOptions<T> {
  /** Evicted `(key, value)` pairs — LRU eviction and overwrite of an existing
   *  key both notify (so a caller can release the displaced value's resources). */
  onEvict?: (key: string, value: T) => void;
}

export function createLruMap<T>(maxEntries: number, opts?: LruMapOptions<T>): LruMap<T> {
  const map = new Map<string, T>();
  const onEvict = opts?.onEvict;
  return {
    get(key: string): T | undefined {
      const value = map.get(key);
      if (value === undefined) return undefined;
      // Bump to most-recently-used: re-insert at the tail.
      map.delete(key);
      map.set(key, value);
      return value;
    },
    set(key: string, value: T): void {
      // Overwriting an existing key: drop the old entry first so it re-inserts
      // at the tail (and its displaced value is released).
      const prev = map.get(key);
      if (prev !== undefined) {
        map.delete(key);
        onEvict?.(key, prev);
      }
      map.set(key, value);
      // Evict least-recently-used (front of the Map) until within bounds.
      while (map.size > maxEntries) {
        const oldestKey = map.keys().next().value;
        if (oldestKey === undefined) break;
        const oldest = map.get(oldestKey)!;
        map.delete(oldestKey);
        onEvict?.(oldestKey, oldest);
      }
    },
    has(key: string): boolean {
      return map.has(key);
    },
    get size(): number {
      return map.size;
    },
  };
}
