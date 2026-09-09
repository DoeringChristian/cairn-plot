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
  type ScheduleOptions,
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

/**
 * How long a cached resolve FAILURE suppresses a retry (H2). Consumers guard
 * their resolve effect with `peekResolveError(key) !== undefined`, and the old
 * error map only ever forgot an entry on a later SUCCESS of the same key — which
 * that very guard prevented, so one transient failure (a decode timeout, a
 * dropped fetch) wedged the pane permanently. An error is now a short-lived
 * backoff: after the TTL the key is forgotten and the next render retries.
 */
export const RESOLVE_ERROR_TTL_MS = 2000;

/** The live TTL — {@link RESOLVE_ERROR_TTL_MS} except while a test shortens it. */
let resolveErrorTtlMs: number = RESOLVE_ERROR_TTL_MS;

/** Test seam only — shorten the error backoff so a test need not wait 2 s.
 *  Pass `undefined` to restore {@link RESOLVE_ERROR_TTL_MS}. */
export function __setResolveErrorTtlForTest(ms: number | undefined): void {
  resolveErrorTtlMs = ms ?? RESOLVE_ERROR_TTL_MS;
}

/**
 * How long `resolveCached` keeps its own lease on a freshly resolved entry
 * (H12). The resolver used to release immediately, leaving the entry at zero
 * leases until the consumer's passive effect ran a commit later — a window in
 * which `evictToBudget` could (and under a tight budget did) throw the payload
 * away, producing a resolve → evict → resolve loop that never converged. The
 * grace lease hands the entry over: it is released when the consumer acquires
 * it, or after this long, whichever comes first.
 */
export const RESOLVE_HANDOFF_MS = 5000;

interface CachedResolveError {
  readonly message: string;
  /** Fires at the end of the backoff: forgets the entry AND notifies, so the
   *  subscribed leaf re-renders and its resolve effect (which depends on the
   *  error) runs again. Without this wake-up the TTL would be inert — nothing
   *  else re-renders an idle pane. */
  readonly expiry: ReturnType<typeof setTimeout>;
}

const errors = new Map<string, CachedResolveError>();
const resolving = new Map<string, Promise<void>>();
/** Grace leases held by `resolveCached` between resolution and consumer handoff. */
const handoffs = new Map<string, { lease: ResourceLease<unknown>; timer: ReturnType<typeof setTimeout> }>();

/** Release the resolver's grace lease for `key`, if it still holds one. */
function releaseHandoff(key: string): void {
  const held = handoffs.get(key);
  if (!held) return;
  handoffs.delete(key);
  clearTimeout(held.timer);
  held.lease.release();
}

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

/** Pin a resolved payload while it is visible. Acquiring COMPLETES the handoff
 *  from {@link resolveCached}: the resolver's grace lease is dropped only once
 *  the consumer holds its own, so the entry is never momentarily unleased. */
export function acquireResolved<T>(key: string): ResourceLease<T> | undefined {
  const lease = globalResourceCache.acquire<T>(key);
  if (lease) releaseHandoff(key);
  return lease;
}

/** The cached error for `key`, if the last resolve failed within the backoff
 *  window. A PURE read — the entry is dropped by its own expiry timer, never
 *  as a side effect of a render. See {@link RESOLVE_ERROR_TTL_MS}. */
export function peekResolveError(key: string): string | undefined {
  return errors.get(key)?.message;
}

/** Forget the cached failure for `key` so the next request retries at once —
 *  for callers that KNOW the cause is gone (a node change, a manual retry) and
 *  should not wait out {@link RESOLVE_ERROR_TTL_MS}. Deliberately does NOT
 *  notify: every caller is about to re-request the key itself. */
export function clearResolveError(key: string): void {
  const entry = errors.get(key);
  if (!entry) return;
  clearTimeout(entry.expiry);
  errors.delete(key);
}

/** Resolve `key` via `run` exactly once and cache the result; concurrent/repeat
 *  callers share the in-flight promise. Resolves to the cached payload. */
export function resolveCached<T>(
  key: string,
  run: () => Promise<T>,
  priority: PreparationPriority = "foreground",
  options?: ScheduleOptions,
): Promise<T> {
  const hit = globalResourceCache.peek<T>(key);
  if (hit !== undefined) return Promise.resolve(hit);
  const existing = resolving.get(key);
  if (existing) {
    // PROMOTE ONLY. Work for this key is already in flight, so this must never
    // start a second run — and `schedule` would, whenever the watchdog has
    // released the running task's slot (it drops the key→promise mapping so a
    // genuinely NEW request can proceed). `promote` touches a still-QUEUED task
    // and is a no-op once it has started.
    globalPreparationScheduler.promote(key, priority, options);
    return existing.then(() => globalResourceCache.peek<T>(key) as T);
  }
  const promise = globalResourceCache.getOrCreate(key, async () => {
    const value = await globalPreparationScheduler.schedule(key, priority, run, options);
    return { value, bytes: estimateResolvedBytes(value) };
  }).then(
    (lease) => {
      // HANDOFF (H12): hold this lease until the consumer acquires its own (or
      // the grace window lapses) so a tight budget cannot evict the payload in
      // the gap between resolution and the pane's passive lease effect.
      releaseHandoff(key);
      const timer = setTimeout(() => releaseHandoff(key), RESOLVE_HANDOFF_MS);
      (timer as unknown as { unref?: () => void }).unref?.();
      handoffs.set(key, { lease: lease as ResourceLease<unknown>, timer });
      clearResolveError(key);
      resolving.delete(key);
      notifyResolveCache(); // wake subscribed leaves — they re-read peekResolved(key)
    },
    (err) => {
      // Background failures are diagnostics only. A later foreground request
      // retries and becomes visible only if it also fails.
      if (priority === "foreground") {
        clearResolveError(key);
        // The backoff must END in a retry, not merely stop reporting: the
        // expiry timer forgets the entry and NOTIFIES, which re-renders the
        // subscribed leaf whose resolve effect depends on the error state.
        const expiry = setTimeout(() => {
          if (errors.delete(key)) notifyResolveCache();
        }, resolveErrorTtlMs);
        (expiry as unknown as { unref?: () => void }).unref?.();
        errors.set(key, {
          message: err instanceof Error ? err.message : String(err),
          expiry,
        });
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
    // Explicitly NOT visible: a warm-ahead never overtakes an on-screen pane's
    // work inside the preload band.
    void resolveCached(key, run, "preload", { visible: false }).catch(() => {});
  }
}

/** Test seam only — drop all cached resolutions (the `sourceKey` WeakMap is left
 *  intact; ids stay stable). */
export function __resetResolveCacheForTest(): void {
  for (const key of [...handoffs.keys()]) releaseHandoff(key);
  for (const key of [...errors.keys()]) clearResolveError(key);
  globalResourceCache.clear();
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
