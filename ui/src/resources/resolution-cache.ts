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
} from "./scheduler.ts";
import {
  globalResourceCache,
  type ResourceLease,
} from "./cache.ts";

const idMap = new WeakMap<object, string>();
const contentIdMap = new WeakMap<object, string | null>();
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

/** Order-independent JSON text — the shared fallback identity for authored
 *  content. Exported so a plot definition's own `contentId` can canonicalise the
 *  small remainder of its data without re-implementing the rules. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalJson(record[key])}`
    ).join(",")}}`;
  }
  return JSON.stringify(value);
}

/** Looks a plot type's own content identity up in the registry. Injected via
 *  {@link setContentIdResolver} because the plot layer sits ABOVE this one and
 *  must not be imported from here (`check:plot-boundary`). Returns `undefined`
 *  when `type` is not registered (yet), which is distinct from a registered kind
 *  that declines to summarise this data (`{ contentId: null }`). */
export type ContentIdResolver = (
  type: string,
  data: unknown,
) => { readonly contentId: string | null } | undefined;

let contentIdResolver: ContentIdResolver | undefined;

/** Install the plot-registry lookup used by {@link resolutionKey}. */
export function setContentIdResolver(resolver: ContentIdResolver | undefined): void {
  contentIdResolver = resolver;
}

/** Content identity for durable plot descriptors. Presentation-only props and
 * settings are deliberately excluded: changing exposure/labels must not decode
 * again. Structurally equivalent descriptor objects therefore share the same
 * prepared payload — essential for host-authored iteration sliders that recreate
 * a leaf object when revisiting an already-seen artifact.
 *
 * A plot definition may summarise its own data far more cheaply than canonical
 * JSON can (scalar's inline samples are the motivating case), so the registry is
 * consulted FIRST. A key derived while the type was still unregistered is NOT
 * memoised: lazily-registered kinds must be free to adopt their own id on the
 * registration re-render, after which the memo makes the key stable. */
function descriptorContentId(node: object): string | null {
  if (contentIdMap.has(node)) return contentIdMap.get(node) ?? null;
  const record = node as Record<string, unknown>;
  let key: string | null = null;
  // A key derived from an unregistered plot type is provisional — see above.
  let memoisable = true;
  if (record.kind === "plot" && typeof record.type === "string" && record.data != null) {
    const resolved = contentIdResolver?.(record.type, record.data);
    memoisable = resolved !== undefined;
    // Namespaced because a resolver's id is only unique WITHIN its plot type:
    // two types that both summarise their data as, say, "n=100:x0..x99" must
    // not collide on one cache entry. Canonical JSON is the fallback for BOTH
    // "not registered yet" (`resolved === undefined`) and "registered but
    // declines to summarise this data" (`contentId === null`) — the second is
    // the common case (every plot type without a `contentId()`, and scalar's
    // non-inline data), and keying those on the literal `null` would collapse
    // every image node in a document onto one entry.
    key = `plot:${record.type}:${resolved?.contentId ?? canonicalJson(record.data)}`;
  } else if (record.kind === "compare" && typeof record.type === "string" && Array.isArray(record.operands)) {
    key = `compare:${record.type}:${String(record.presentation ?? "")}:${String(record.strategy ?? "")}:${String(record.referenceIndex ?? "")}:${canonicalJson(record.operands)}`;
  }
  if (memoisable) contentIdMap.set(node, key);
  return key;
}

/** Cache namespace for authored content resolved through a particular source. */
export function resolutionKey(source: object, node: object, suffix = ""): string {
  return `${sourceKey(source)}|${descriptorContentId(node) ?? sourceKey(node)}${suffix}`;
}

const errors = new Map<string, string>();
const resolving = new Map<string, Promise<void>>();

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
  return globalResourceCache.peek<T>(key);
}

/** Pin a resolved payload while it is visible. */
export function acquireResolved<T>(key: string): ResourceLease<T> | undefined {
  return globalResourceCache.acquire<T>(key);
}

/** The cached error for `key`, if the last resolve failed. */
export function peekResolveError(key: string): string | undefined {
  return errors.get(key);
}

/** Resolve `key` via `run` exactly once and cache the result; concurrent/repeat
 *  callers share the in-flight promise. Resolves to the cached payload. */
export function resolveCached<T>(
  key: string,
  run: () => Promise<T>,
  priority: PreparationPriority = "foreground",
): Promise<T> {
  const hit = globalResourceCache.peek<T>(key);
  if (hit !== undefined) return Promise.resolve(hit);
  const existing = resolving.get(key);
  if (existing) {
    // This may promote a queued preload. The scheduler returns the same work;
    // the cache keeps its single completion/notification path below.
    void globalPreparationScheduler.schedule(key, priority, run).catch(() => {});
    return existing.then(() => globalResourceCache.peek<T>(key) as T);
  }
  const promise = globalResourceCache.getOrCreate(key, async () => {
    const value = await globalPreparationScheduler.schedule(key, priority, run);
    return { value, bytes: estimateResolvedBytes(value) };
  }).then(
    (lease) => {
      lease.release();
      errors.delete(key);
      resolving.delete(key);
      notifyResolveCache(); // wake subscribed leaves — they re-read peekResolved(key)
    },
    (err) => {
      // Background failures are diagnostics only. A later foreground request
      // retries and becomes visible only if it also fails.
      if (priority === "foreground") {
        errors.set(key, err instanceof Error ? err.message : String(err));
        notifyResolveCache();
      }
      resolving.delete(key);
      throw err;
    },
  );
  resolving.set(key, promise);
  return promise.then(() => globalResourceCache.peek<T>(key) as T);
}

/** Warm several sources in the background (a stacked viewport calls this on mount
 *  so every tab is ready before the user flips). Failures are swallowed — the
 *  leaf surfaces them if/when that tab is actually shown. */
export function prefetchResolved(entries: Array<{ key: string; run: () => Promise<unknown> }>): void {
  for (const { key, run } of entries) {
    if (globalResourceCache.has(key)) continue;
    void resolveCached(key, run, "preload").catch(() => {});
  }
}

/** Test seam only — drop all cached resolutions (the `sourceKey` WeakMap is left
 *  intact; ids stay stable). */
export function __resetResolveCacheForTest(): void {
  globalResourceCache.clear();
  errors.clear();
  resolving.clear();
  notifyResolveCache();
}

/** Conservative retained-byte estimate for decoded resolution payloads. */
export function estimateResolvedBytes(value: unknown): number {
  const seen = new Set<object>();
  const visit = (current: unknown): number => {
    if (current == null) return 0;
    if (typeof current === "string") return current.length * 2;
    if (typeof current !== "object") return 8;
    if (seen.has(current)) return 0;
    seen.add(current);
    if (current instanceof ArrayBuffer) return current.byteLength;
    if (ArrayBuffer.isView(current)) return current.byteLength;
    if (typeof Blob !== "undefined" && current instanceof Blob) return current.size;
    if (Array.isArray(current)) return current.reduce((sum, item) => sum + visit(item), 0);
    return Object.entries(current as Record<string, unknown>)
      .reduce((sum, [key, item]) => sum + key.length * 2 + visit(item), 0);
  };
  return Math.max(1, visit(value));
}
