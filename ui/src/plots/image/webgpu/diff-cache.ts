/**
 * The content-keyed LRU that memoizes diff RESULT textures, extracted from
 * `diff-engine.ts` so it can be unit-tested WITHOUT the WebGPU/kernels graph
 * (this module has no value import from the `./kernels` barrel, so it loads
 * under Node's `--experimental-strip-types` test runner — `diff-cache.test.ts`).
 *
 * The cache is per-DEVICE and therefore shared by EVERY compare pane on the
 * page (`caches`, a `WeakMap<Device, DiffCache>`). It evicts by BOTH an entry
 * count and a byte budget; the reasoning for the (deliberately generous) caps
 * lives on `DEFAULT_MAX_ENTRIES` below.
 */
import type { Device, Texture } from "./device/device-contract";
// Type-only imports — fully erased by the type stripper, so they do NOT pull the
// `./kernels` value barrel (which is a directory import Node's strip-only mode
// rejects) into this module's runtime graph.
import type { ImageDisplayRange } from "../definition/fields.ts";
import type { DiffMetrics } from "./image-engine";

export interface DiffCacheEntry {
  texture: Texture;
  width: number;
  height: number;
  displayRange: ImageDisplayRange;
  bytes: number;
  /** Lazily-computed + cached MSE/PSNR/MAE over the SOURCES (kernel-independent). */
  scalars?: DiffMetrics;
  scalarsPending?: Promise<DiffMetrics>;
  /**
   * Lazily-computed + cached MEAN SSIM (metrics chip). Present only on the
   * `ssim` kernel's entry — the mean of `SSIM = 1 − (1−SSIM)` over the RESULT
   * grid (this entry's `width*height`, the mapped/compared region). Memoized so
   * repeat metric-effect runs don't re-average the readback.
   */
  ssimMean?: number;
  ssimMeanPending?: Promise<number>;
  /**
   * Lazily-read-back RGBA-float samples of the diff RESULT texture (row-major at
   * result resolution, 4 floats/pixel, top-left origin — same coord convention
   * the TEV overlay samples). Computed on demand the first time the overlay needs
   * a per-pixel metric value and cached here, so zoom/pan/colormap NEVER re-read
   * and `getDiffComputeCount()` never moves. Dropped when the entry is evicted
   * (the whole entry — texture + this array — is released together).
   */
  resultSamples?: Float32Array;
  resultSamplesPending?: Promise<Float32Array>;
}

// The cache is per-DEVICE and shared by EVERY compare pane on the page. A
// multi-pane run-comparison card mounts one pane per run, and each pane holds
// TWO entries here — its displayed diff RESULT plus the separate `ssim` entry
// the metrics chip inserts. All panes share ONE card view, so panning/zooming
// re-renders every pane and every pane re-`ensureDiff`s on the SAME frame. If
// the entry cap is smaller than the number of live entries (≈ 2 × panes), the
// LRU evicts an entry another pane re-requests that very frame → a cache MISS →
// the expensive kernel (multi-pass FLIP: one fullscreen pass PER exposure)
// recomputes for every pane on every interaction — the reported "FLIP starts to
// lag" freeze. The old cap of 8 thrashed at just ~4 panes. Size the ENTRY cap
// well above realistic pane counts so it is never the binding constraint; the
// BYTE budget is the real VRAM/RAM guard (it evicts by actual bytes, so a few
// huge HDR pairs still can't blow memory).
export const DEFAULT_MAX_ENTRIES = 128;
export const DEFAULT_MAX_BYTES = 512 * 1024 * 1024; // 512 MB

export class DiffCache {
  private readonly map = new Map<string, DiffCacheEntry>(); // insertion-order = LRU order
  /** Entries currently presented by a live pane. They are not eviction
   * candidates: evicting a visible result makes the next presentation-only
   * update (exposure/offset/encoding) recompute the metric. */
  private readonly pins = new Map<DiffCacheEntry, number>();
  private totalBytes = 0;
  // Explicit fields (NOT constructor parameter-properties) so this module stays
  // importable under Node's `--experimental-strip-types` strip-only mode, which
  // `npm test` uses (parameter-properties emit runtime code and are rejected).
  private readonly maxEntries: number;
  private readonly maxBytes: number;
  constructor(maxEntries = DEFAULT_MAX_ENTRIES, maxBytes = DEFAULT_MAX_BYTES) {
    this.maxEntries = maxEntries;
    this.maxBytes = maxBytes;
  }

  get(key: string): DiffCacheEntry | undefined {
    const e = this.map.get(key);
    if (e) {
      // bump to most-recently-used
      this.map.delete(key);
      this.map.set(key, e);
    }
    return e;
  }

  /**
   * NON-mutating residency peek — does the cache currently hold a result for
   * `key`? Unlike {@link get} it does NOT bump LRU order (a residency probe on
   * every render must not perturb eviction). Used by the pane's paint-atomic
   * flip path to decide, BEFORE painting, whether a cached diff's result is
   * already resident (so its flip can render pre-paint without a multi-pass
   * recompute on the critical path).
   */
  has(key: string): boolean {
    return this.map.has(key);
  }

  set(key: string, entry: DiffCacheEntry): void {
    const existing = this.map.get(key);
    if (existing) {
      this.totalBytes -= existing.bytes;
      this.pins.delete(existing);
      existing.texture.destroy();
      this.map.delete(key);
    }
    this.map.set(key, entry);
    this.totalBytes += entry.bytes;
    // `ensureDiff` returns this entry to the presenting pane, which leases it
    // immediately. Do not destroy the just-computed texture in the narrow gap
    // before that lease is installed when all older entries are already pinned.
    this.evict(entry);
  }

  /** Keep a result resident while a live pane presents it. This is a lease, not
   * permanent cache state: the pool releases it when the pane changes content,
   * switches away from a cached metric, parks, or disposes. */
  retain(entry: DiffCacheEntry): void {
    let resident = false;
    for (const candidate of this.map.values()) {
      if (candidate === entry) {
        resident = true;
        break;
      }
    }
    if (!resident) return;
    this.pins.set(entry, (this.pins.get(entry) ?? 0) + 1);
  }

  /** Release one live-pane lease and immediately enforce the memory budget. */
  release(entry: DiffCacheEntry): void {
    const count = this.pins.get(entry) ?? 0;
    if (count <= 1) this.pins.delete(entry);
    else this.pins.set(entry, count - 1);
    this.evict();
  }

  /**
   * Charge a lazily-read-back RESULT `Float32Array` against the byte budget once
   * it resolves: its `byteLength` (a full-frame RGBA-f32 array, ~33MB for a 2K
   * frame) is added to BOTH the entry's accounted bytes and the running total,
   * then re-evicted — so up to `maxEntries` uncounted readbacks can't accumulate
   * invisibly. Eviction subtracts `entry.bytes` (now texture + readback), so the
   * charge is released with the entry. No-op if the entry was already evicted
   * (its budget is gone — double-charging would corrupt the total).
   */
  accountReadbackBytes(entry: DiffCacheEntry, bytes: number): void {
    let resident = false;
    for (const e of this.map.values()) {
      if (e === entry) {
        resident = true;
        break;
      }
    }
    if (!resident) return;
    entry.bytes += bytes;
    this.totalBytes += bytes;
    this.evict();
  }

  private evict(exclude?: DiffCacheEntry): void {
    while (this.map.size > this.maxEntries || this.totalBytes > this.maxBytes) {
      // Oldest UNPINNED entry. A live pane's currently displayed result is part
      // of the active working set, even when that set exceeds the soft budget.
      // Destroying it would turn every display-slider event into a cache miss.
      let victim: [string, DiffCacheEntry] | undefined;
      for (const candidate of this.map) {
        if (candidate[1] !== exclude && !this.pins.has(candidate[1])) {
          victim = candidate;
          break;
        }
      }
      if (!victim) break;
      // Never evict the single entry that is over budget on its own — keep at
      // least one so the current view still has a result.
      if (this.map.size === 1) break;
      const [oldestKey, e] = victim;
      this.map.delete(oldestKey);
      this.totalBytes -= e.bytes;
      e.texture.destroy();
    }
  }

  clear(): void {
    for (const e of this.map.values()) e.texture.destroy();
    this.map.clear();
    this.pins.clear();
    this.totalBytes = 0;
  }

  get size(): number {
    return this.map.size;
  }
}

const caches = new WeakMap<Device, DiffCache>();
export function cacheFor(device: Device): DiffCache {
  let c = caches.get(device);
  if (!c) {
    c = new DiffCache();
    caches.set(device, c);
  }
  return c;
}
