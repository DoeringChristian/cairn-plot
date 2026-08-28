/**
 * The RUNTIME blob store — the JS-side companion to the LOCAL content store
 * (`local-store.ts`, `window.__cairnPlotStore`).
 *
 * The LOCAL store carries base64-packed bytes baked by the PYTHON emitter. When
 * a plot is authored FROM JAVASCRIPT (the `window.cairnPlot` builder surface),
 * the data already lives in memory as `ArrayBuffer`/`TypedArray`/`ImageData`,
 * so base64-encoding it into the DOM would be pure waste. This registry lets
 * JS-provided data ride BY REFERENCE: the builder registers the in-memory value
 * under a runtime hash, the descriptor references that hash (schema-unchanged —
 * `runtime:*` is just an opaque hash string), and `createLocalDataSource`
 * consults THIS registry BEFORE the base64 store.
 *
 * Two entry shapes cover the JS inputs:
 *  - `bytes`  — already-encoded image container bytes (PNG/JPEG/…) + MIME.
 *    `artifactUrl()` serves them as a `blob:` object URL (NO base64), and
 *    `bytes()` returns the `ArrayBuffer` verbatim.
 *  - `float`  — a `Float32Array` (or `Uint16Array` of f16 bit-patterns) + shape
 *    for the true float-HDR path. `DataSource.runtime()` hands it STRAIGHT to
 *    the `imagehdr` renderer's `hdr` prop (`plot-descriptor.ts`), skipping the
 *    `.npy` encode/parse the Python-baked path takes — zero copy, zero decode.
 *
 * The registry is a page-level `window.__cairnPlotRuntimeStore` (like the LOCAL
 * store) so multiple plots on one page share it. It is DOM-free-safe: every
 * accessor guards `typeof window` so the Node test runner (no `window`) simply
 * sees an empty registry.
 */
import type { Precision } from "../../plots/image/model/half.ts";

/** An already-encoded image container (PNG/JPEG/WebP/…) carried by reference. */
export interface RuntimeBytesEntry {
  kind: "bytes";
  bytes: ArrayBuffer;
  mime: string;
}

/** A float-HDR sample buffer carried by reference (the `imagehdr` path). */
export interface RuntimeFloatEntry {
  kind: "float";
  /** Row-major samples: `Float32Array` (`precision:"f32"`) or a `Uint16Array`
   *  of IEEE-754 binary16 bit patterns (`precision:"f16-bits"`). */
  data: Float32Array | Uint16Array;
  /** `[H,W]` | `[H,W,C]` with `C∈{1,3,4}`. */
  shape: number[];
  /** Numpy dtype string mirroring the baked path (`"<f4"` / `"<f2"`). */
  dtype: string;
  precision: Precision;
}

export type RuntimeStoreEntry = RuntimeBytesEntry | RuntimeFloatEntry;
export type RuntimeStore = Map<string, RuntimeStoreEntry>;

declare global {
  interface Window {
    __cairnPlotRuntimeStore?: RuntimeStore;
  }
}

/** The live page-level registry (created on first use). `null` with no `window`
 *  (Node) — callers treat that as "no runtime entries". */
function storeOrNull(): RuntimeStore | null {
  if (typeof window === "undefined") return null;
  return (window.__cairnPlotRuntimeStore ??= new Map());
}

/** The live registry, creating it when a `window` exists (empty Map otherwise so
 *  callers never branch on `null`). */
export function getRuntimeStore(): RuntimeStore {
  return storeOrNull() ?? new Map();
}

/** Merge `entries` into the page-level registry (idempotent per hash) and return
 *  the live registry. A no-op-safe fallback (a detached Map) with no `window`. */
export function registerRuntimeEntries(
  entries: Iterable<[string, RuntimeStoreEntry]> | Record<string, RuntimeStoreEntry>,
): RuntimeStore {
  const store = storeOrNull() ?? new Map();
  const iter: Iterable<[string, RuntimeStoreEntry]> = Array.isArray(entries)
    ? entries
    : entries instanceof Map
      ? entries
      : (Object.entries(entries) as [string, RuntimeStoreEntry][]);
  for (const [hash, entry] of iter) store.set(hash, entry);
  return store;
}

/** The runtime entry for `hash`, or `undefined` (incl. no `window`). */
export function getRuntimeEntry(hash: string): RuntimeStoreEntry | undefined {
  return storeOrNull()?.get(hash);
}

// Per-hash `blob:` object-URL cache, so repeated `artifactUrl(hash)` for the
// same bytes entry returns ONE stable URL (an `<img src>` re-resolve is a hit,
// and we never leak N URLs for N renders). Keyed by hash — a runtime hash is
// minted once per registration, so this is effectively keyed by the value.
const objectUrlCache = new Map<string, string>();

/**
 * A `blob:` object URL for a runtime BYTES entry (NO base64). Cached per hash.
 * Throws for a FLOAT entry — a float buffer has no image container to serve as
 * a URL; it is consumed through `DataSource.runtime()` → the `hdr` prop instead.
 */
export function runtimeArtifactUrl(hash: string, entry: RuntimeStoreEntry): string {
  if (entry.kind !== "bytes") {
    throw new Error(
      `cairn-plot runtime blob ${hash} is a float entry; resolve it via the ` +
        `float-source path (DataSource.runtime()), not artifactUrl().`,
    );
  }
  const cached = objectUrlCache.get(hash);
  if (cached) return cached;
  const url = URL.createObjectURL(new Blob([entry.bytes], { type: entry.mime }));
  objectUrlCache.set(hash, url);
  return url;
}

let _counter = 0;

/** Mint a unique, opaque runtime hash (`runtime:<n>-<rand>`). Uniqueness — not
 *  content-addressing — is all that's needed: JS data rides by reference, so a
 *  fresh id per registration is correct and collision-free within a page. */
export function mintRuntimeHash(): string {
  _counter += 1;
  const rand = Math.random().toString(36).slice(2, 10);
  return `runtime:${_counter}-${rand}`;
}
