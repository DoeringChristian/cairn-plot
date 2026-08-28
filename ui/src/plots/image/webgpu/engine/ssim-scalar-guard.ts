/**
 * One-in-flight + result guard for the mean-SSIM metrics-chip scalar.
 *
 * WHY THIS EXISTS (the reported "SSIM hang"): the metrics-chip effect calls the
 * SSIM scalar sourcing on every source/mapped-region change. If that effect ever
 * re-fires in a tight loop — an unstable dep, a parent re-render storm, a
 * StrictMode double-invoke — each firing used to START a fresh SSIM computation:
 * a GPU multipass + readback, or (on the GPU-throw path) the ~hundreds-of-ms CPU
 * reference. Stacking hundreds of those hard-wedges the main thread for tens of
 * seconds (a single CPU run is only ~250ms; the wedge is the STACKING).
 *
 * This guard collapses ALL calls for a given `(device, key)` — key = the
 * content+mapping identity — to ONE in-flight promise: the first call runs the
 * compute, every concurrent/repeat call awaits the SAME promise, and the settled
 * value is cached. So even an infinite effect loop triggers at most ONE compute
 * per content+mapping. A REJECTED attempt is evicted (not cached forever) so a
 * genuinely-later change can retry, while the concurrent burst riding the failed
 * promise still doesn't each kick off its own recompute.
 *
 * Kept as a standalone module (only a type-only `Device` import) so it is unit-
 * testable under Node's `--experimental-strip-types` without pulling in the
 * whole kernel/diff graph.
 */
import type { Device } from "./webgpu/device-contract";

const cache = new WeakMap<Device, Map<string, Promise<number>>>();

// Count of SSIM scalar computations actually STARTED (guard misses). The pane /
// tests assert this moves exactly ONCE per content+mapping no matter how many
// times the effect fires — proof the guard defeats the loop.
let ssimComputeCount = 0;

/** Number of SSIM scalar computations started so far (monotonic). */
export function getSsimComputeCount(): number {
  return ssimComputeCount;
}

/**
 * Run `compute` for `(device, key)` at most once concurrently, caching the
 * settled value; a burst of calls all share the single in-flight promise. On
 * rejection the entry is dropped so a later call can retry.
 */
export function guardedSsimScalar(
  device: Device,
  key: string,
  compute: () => Promise<number>,
): Promise<number> {
  let byKey = cache.get(device);
  if (!byKey) {
    byKey = new Map();
    cache.set(device, byKey);
  }
  const inflight = byKey.get(key);
  if (inflight) return inflight;

  ssimComputeCount++;
  const promise = compute().catch((err) => {
    if (byKey!.get(key) === promise) byKey!.delete(key);
    throw err;
  });
  byKey.set(key, promise);
  return promise;
}
