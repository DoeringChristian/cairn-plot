/**
 * resolve-cache — a tiny content-agnostic memo for "resolve a descriptor node's
 * DATA once, reuse it forever". It exists so a STACKED viewport (one renderer,
 * many source slots) can flip between tabs with NO "Loading…" flash: a slot the
 * user has visited — or that `prefetchResolved` warmed on mount — resolves
 * SYNCHRONOUSLY via `peekResolved`, so the leaf renders the new source in the
 * same commit instead of dropping to a loading state.
 *
 * The key is DATA identity, not settings: display settings (colormap/tonemap/
 * exposure/…) live on the shared viewport and are applied per-frame, never part of
 * a source's resolution — so a stable per-descriptor-node id is a correct cache
 * key. `sourceKey` hands out that id via a `WeakMap` on the node OBJECT (the
 * descriptor objects are stable across re-renders — the grid holds the same child
 * node instances), so entries are collected when the descriptor is dropped and
 * two genuinely-distinct nodes never collide.
 *
 * Deliberately framework-free (no React) and generic over the resolved payload —
 * the caller supplies the async `run`, so this module never imports the (bundle-
 * split) resolvers. Unit-testable without a DOM.
 */

import {
  globalPreparationScheduler,
  type PreparationPriority,
} from "../../resources/scheduler.ts";

const idMap = new WeakMap<object, string>();
let counter = 0;

/** A stable id for a descriptor node/object — same object ⇒ same id, forever. */
export function sourceKey(obj: object): string {
  let id = idMap.get(obj);
  if (!id) {
    id = `src${counter++}`;
    idMap.set(obj, id);
  }
  return id;
}

/** Cache namespace for authored content resolved through a particular source. */
export function resolutionKey(source: object, node: object, suffix = ""): string {
  return `${sourceKey(source)}|${sourceKey(node)}${suffix}`;
}

interface Entry<T> {
  data?: T;
  error?: string;
  promise?: Promise<void>;
}

const cache = new Map<string, Entry<unknown>>();

// SUBSCRIBABLE STORE. The cache is a tiny external store a React leaf reads via
// `useSyncExternalStore`: the resolved value for a key is then a PURE FUNCTION of the
// key (+ this version), never a component-held `state` cell that can lag a flip by a
// commit. `version` bumps whenever ANY key resolves or errors; a subscriber re-reads
// `peekResolved(itsKey)` during the notified render. Still framework-free (a plain
// listener set — no React import).
let version = 0;
const listeners = new Set<() => void>();
function notifyResolveCache(): void {
  version++;
  for (const l of listeners) l();
}
/** Subscribe to cache changes (a key resolved/errored). Returns an unsubscribe. */
export function subscribeResolveCache(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
/** A monotonic version that bumps on every resolution/error — the `getSnapshot` for
 *  `useSyncExternalStore`. Stable ref (a plain number); reads are per-key via
 *  `peekResolved`/`peekResolveError` during the notified render. */
export function resolveCacheVersion(): number {
  return version;
}

/** The resolved payload for `key`, or `undefined` if not yet resolved (or errored).
 *  Synchronous — a leaf reads the new source in the SAME commit on a cache hit. */
export function peekResolved<T>(key: string): T | undefined {
  return cache.get(key)?.data as T | undefined;
}

/** The cached error for `key`, if the last resolve failed. */
export function peekResolveError(key: string): string | undefined {
  return cache.get(key)?.error;
}

/** Resolve `key` via `run` exactly once and cache the result; concurrent/repeat
 *  callers share the in-flight promise. Resolves to the cached payload. */
export function resolveCached<T>(
  key: string,
  run: () => Promise<T>,
  priority: PreparationPriority = "foreground",
): Promise<T> {
  const existing = cache.get(key) as Entry<T> | undefined;
  if (existing?.data !== undefined) return Promise.resolve(existing.data);
  if (existing?.promise) {
    // This may promote a queued preload. The scheduler returns the same work;
    // the cache keeps its single completion/notification path below.
    void globalPreparationScheduler.schedule(key, priority, run).catch(() => {});
    return existing.promise.then(() => cache.get(key)!.data as T);
  }
  const entry: Entry<T> = {};
  entry.promise = globalPreparationScheduler.schedule(key, priority, run).then(
    (data) => {
      entry.data = data;
      entry.error = undefined;
      entry.promise = undefined;
      notifyResolveCache(); // wake subscribed leaves — they re-read peekResolved(key)
    },
    (err) => {
      entry.error = err instanceof Error ? err.message : String(err);
      entry.promise = undefined;
      notifyResolveCache();
      throw err;
    },
  );
  cache.set(key, entry as Entry<unknown>);
  return entry.promise.then(() => cache.get(key)!.data as T);
}

/** Warm several sources in the background (a stacked viewport calls this on mount
 *  so every tab is ready before the user flips). Failures are swallowed — the
 *  leaf surfaces them if/when that tab is actually shown. */
export function prefetchResolved(entries: Array<{ key: string; run: () => Promise<unknown> }>): void {
  for (const { key, run } of entries) {
    if (cache.get(key)?.data !== undefined) continue;
    void resolveCached(key, run, "preload").catch(() => {});
  }
}

/** Test seam only — drop all cached resolutions (the `sourceKey` WeakMap is left
 *  intact; ids stay stable). */
export function __resetResolveCacheForTest(): void {
  cache.clear();
  notifyResolveCache();
}
