/**
 * `cpu/bitmap-cache.ts` — the bounded store of ready-to-blit CPU frames.
 *
 * This is an LRU with two deliberate differences from `resources/lru-map.ts`,
 * both about the same hazard: a value here is an `ImageBitmap` (or an offscreen
 * canvas) that a MOUNTED pane has committed and will `drawImage` again on the
 * next viewport change. So:
 *
 *   1. **Nothing is destroyed on eviction.** There is no `onEvict` hook and no
 *      `close()`. Dropping the reference costs a re-decode the next time the key
 *      is wanted; DETACHING a bitmap a pane still holds is an `InvalidStateError`
 *      thrown from inside a layout effect. A leaked bitmap is bounded by
 *      `maxEntries` and is collected once nothing references it.
 *   2. **A resident entry is never displaced** (`claim`, not `set`). Two panes on
 *      the same url (a grid repeat, a compare whose operands are equal), a
 *      StrictMode double mount whose cancelled first run resolves last, or any
 *      producer racing itself must all converge on the ONE entry the first
 *      committer painted, rather than each overwriting the other's.
 */
import { createLruMap } from "../resources/lru-map.ts";

export interface BitmapCache<T> {
  get(key: string): T | undefined;
  /**
   * Return the resident entry for `key`, storing `value` first if there is
   * none. NEVER replaces: on a hit the caller's freshly-produced `value` is
   * discarded (unreferenced, so it is collected) and the incumbent — the one a
   * mounted pane may already be painting — is returned.
   */
  claim(key: string, value: T): T;
  readonly size: number;
}

export function createBitmapCache<T>(maxEntries: number): BitmapCache<T> {
  const map = createLruMap<T>(maxEntries);
  return {
    get(key) {
      return map.get(key);
    },
    claim(key, value) {
      const resident = map.get(key);
      if (resident !== undefined) return resident;
      map.set(key, value);
      return value;
    },
    get size() {
      return map.size;
    },
  };
}
