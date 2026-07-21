/**
 * The LOCAL content-addressed blob store (design spec §5).
 *
 * A page-level registry — `window.__cairnPlotStore` — keyed by content hash
 * to `{ mime, b64 }`, so multiple plots on ONE page (e.g. several notebook
 * cells sharing the page DOM) dedup + share their baked binary blobs (an
 * image referenced by two plots is stored once). Registration is
 * additive/idempotent (`Object.assign`), so N cells contribute to ONE store
 * and a repeated hash is a no-op.
 *
 * The store carries only LARGE binary artifacts (image bytes, npy/npz) that
 * benefit from dedup; small 2D JSON contracts (Series/points/matrix) are
 * inlined directly in the plot descriptor, not here.
 *
 * This module is the ONE definition of the store shape + LOCAL `DataSource`,
 * shared by the plot bootstrap (`plot-main.tsx`) and Phase C's Python-emitted
 * pages (which emit the inline `<script>` that seeds `window.__cairnPlotStore`
 * and then rely on this reader). The Python emitter and this reader MUST agree
 * on the shape below.
 */
import type { DataSource } from "./data-sources";

/** One stored blob: its MIME type and base64-encoded bytes.
 *
 * `encoding` tags how `b64` was packed by the Python emitter
 * (`cairn_plot.shapers._store_entry`). Absent/`"raw"` = the base64 IS the blob
 * bytes (every `image/*` container — PNG/JPEG/… — stays raw: already
 * compressed, and consumed synchronously as a `data:` URL). `"deflate"` = the
 * base64 is RAW-DEFLATE-compressed bytes (wbits -15, no zlib header) that
 * `bytes()` inflates via `DecompressionStream("deflate-raw")` — used for the
 * highly-compressible `application/octet-stream` float/HDR `.npy` and
 * mesh/point-cloud/volume/boxes `.npz` payloads, all consumed via the async
 * `bytes()` seam. Absent tag keeps existing pages/tests valid. */
export interface PlotStoreEntry {
  mime: string;
  b64: string;
  encoding?: "raw" | "deflate";
}

/** hash -> blob. The value written to `window.__cairnPlotStore`. */
export type PlotStore = Record<string, PlotStoreEntry>;

declare global {
  interface Window {
    __cairnPlotStore?: PlotStore;
  }
}

/** The DOM id of the inline `<script application/cairn-plot-store+json>` blob
 *  a Python-emitted page carries (design spec §5). */
export const PLOT_STORE_SCRIPT_ID = "__cairn_plot_store__";

/**
 * Idempotently merge `entries` into the page-level `window.__cairnPlotStore`
 * (creating it if absent) and return the live store. Mirrors the inline
 * `Object.assign(window.__cairnPlotStore ||= {}, ...)` a Python-emitted page
 * runs — exposed here so the bootstrap (and tests) can register a store the
 * same way without hand-writing the global.
 */
export function registerPlotStore(entries: PlotStore): PlotStore {
  const store: PlotStore = (window.__cairnPlotStore ??= {});
  Object.assign(store, entries);
  return store;
}

/**
 * Read + register the store baked into the page's inline
 * `<script id="__cairn_plot_store__" type="application/cairn-plot-store+json">`
 * blob, if present. No-op-safe (returns the live/empty store) when the script
 * tag is missing or unparseable — a descriptor may reference no binary blobs
 * (pure 2D JSON) and thus ship no store.
 */
export function loadPlotStoreFromDom(
  doc: Document = document,
): PlotStore {
  const el = doc.getElementById(PLOT_STORE_SCRIPT_ID);
  if (el?.textContent) {
    try {
      registerPlotStore(JSON.parse(el.textContent) as PlotStore);
    } catch {
      // Leave the existing store untouched on a malformed blob.
    }
  }
  return (window.__cairnPlotStore ??= {});
}

/** Decode a base64 string to an `ArrayBuffer` (browser `atob`). */
function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

/**
 * Inflate one store entry to its original bytes. A `"deflate"`-tagged entry is
 * RAW-DEFLATE-decompressed via the browser's `DecompressionStream("deflate-raw")`
 * (mirroring the Python emitter's `zlib` wbits -15 — the SAME container the npz
 * reader already uses, `transforms/parse-npz.ts`); any other/absent tag returns
 * the base64 bytes verbatim (backward-compatible raw entries).
 */
async function inflateEntry(entry: PlotStoreEntry): Promise<ArrayBuffer> {
  const buf = base64ToArrayBuffer(entry.b64);
  if (entry.encoding !== "deflate") return buf;
  const ds = new DecompressionStream("deflate-raw");
  const stream = new Response(buf).body!.pipeThrough(ds);
  return new Response(stream).arrayBuffer();
}

/**
 * The LOCAL `DataSource` (design spec §5) — resolves a content hash against
 * the page-level `window.__cairnPlotStore` with NO network:
 *  - `artifactUrl(hash)` = `data:${mime};base64,${b64}` (an `<img src>` /
 *    fetch target that inlines the bytes);
 *  - `bytes(hash)` = base64-decode the stored blob (for npy/npz parsers).
 * This is the LOCAL counterpart to `createEndpointDataSource`; the plot
 * bootstrap picks one or the other by `descriptor.mode`, and every downstream
 * `resolve*`/`fetch*` core in `data-sources.ts` works unchanged against it.
 */
export function createLocalDataSource(
  store: PlotStore = window.__cairnPlotStore ?? {},
): DataSource {
  const get = (hash: string): PlotStoreEntry => {
    const entry = store[hash];
    if (!entry) throw new Error(`plot store missing blob for hash ${hash}`);
    return entry;
  };
  return {
    artifactUrl(hash: string): string {
      const { mime, b64, encoding } = get(hash);
      // A `data:` URL inlines the base64 verbatim, so it only works for RAW
      // entries. The emitter only ever deflates `application/octet-stream`
      // payloads — all consumed via the async `bytes()` seam — so a deflated
      // entry reaching this SYNC path would be a wiring bug, not garbage output.
      if (encoding === "deflate") {
        throw new Error(
          `plot store blob ${hash} is deflate-encoded; resolve it via bytes(), ` +
            `not artifactUrl() (a data: URL cannot inflate it)`,
        );
      }
      return `data:${mime};base64,${b64}`;
    },
    async bytes(hash: string): Promise<ArrayBuffer> {
      return inflateEntry(get(hash));
    },
  };
}
