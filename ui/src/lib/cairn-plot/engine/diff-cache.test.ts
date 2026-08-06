/**
 * Regression guard for the FLIP-lag bug (per-device diff-cache thrash).
 *
 * A multi-pane run-comparison card mounts one compare pane per run, and each
 * pane keeps TWO entries in the shared per-device `DiffCache` (its displayed
 * diff RESULT + the `ssim` metrics entry). All panes share ONE card view, so
 * panning/zooming re-renders every pane and every pane re-`ensureDiff`s on the
 * SAME frame. If the entry cap is smaller than the number of live entries the
 * LRU evicts an entry another pane re-requests that very frame → a cache MISS →
 * the expensive kernel recomputes for every pane on every interaction (the
 * reported freeze). The old cap of 8 thrashed at ~4 panes.
 *
 * These tests drive the extracted `DiffCache` directly (no WebGPU, no kernels)
 * so they run in the `npm test` gate.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Texture, TextureFormat } from "./types.ts";
import { DiffCache, DEFAULT_MAX_ENTRIES, DEFAULT_MAX_BYTES, type DiffCacheEntry } from "./diff-cache.ts";

let destroyed = 0;
function mockTexture(): Texture {
  return {
    width: 8,
    height: 8,
    format: "rgba16float" as TextureFormat,
    write() {},
    destroy() {
      destroyed++;
    },
  };
}

function entry(bytes: number): DiffCacheEntry {
  return { texture: mockTexture(), width: 8, height: 8, displayRange: "unit", bytes };
}

test("default entry cap holds a realistic multi-pane working set with no eviction", () => {
  const cache = new DiffCache();
  // ~20 panes × 2 entries (diff RESULT + ssim) = 40 keys — well over the old cap
  // of 8, comfortably under the current one — and each tiny so the byte budget
  // is irrelevant here (this isolates the ENTRY-count behavior).
  const N = 40;
  assert.ok(N <= DEFAULT_MAX_ENTRIES, "test working set must fit the entry cap");
  for (let i = 0; i < N; i++) cache.set(`k${i}`, entry(1024));
  assert.equal(cache.size, N, "all entries resident — no eviction (would fail at the old cap of 8)");
  // Re-access every key: each is a hit (present), so a pane re-rendering finds
  // its cached result — no recompute needed.
  for (let i = 0; i < N; i++) assert.ok(cache.get(`k${i}`), `entry k${i} still cached (survives re-render)`);
});

test("entry cap still evicts (LRU) once the working set exceeds it", () => {
  const cache = new DiffCache(4, DEFAULT_MAX_BYTES); // small cap to exercise eviction
  for (let i = 0; i < 6; i++) cache.set(`k${i}`, entry(1024));
  assert.equal(cache.size, 4, "capped at maxEntries");
  assert.equal(cache.get("k0"), undefined, "oldest evicted");
  assert.equal(cache.get("k1"), undefined, "2nd-oldest evicted");
  assert.ok(cache.get("k5"), "newest retained");
});

test("byte budget is the real memory guard (evicts by bytes even under the entry cap)", () => {
  const cache = new DiffCache(DEFAULT_MAX_ENTRIES, 4 * 1024); // 4 KB budget
  for (let i = 0; i < 10; i++) cache.set(`k${i}`, entry(1024)); // 10 KB total
  assert.ok(cache.size < 10, "byte budget forced eviction below the entry count");
  assert.ok(cache.size >= 1, "always keeps at least one entry for the current view");
});

test("LRU get() bumps recency so a re-rendered pane is not the eviction victim", () => {
  const cache = new DiffCache(3, DEFAULT_MAX_BYTES);
  cache.set("a", entry(1));
  cache.set("b", entry(1));
  cache.set("c", entry(1));
  cache.get("a"); // touch 'a' → now most-recently-used
  cache.set("d", entry(1)); // evicts the true LRU ('b'), not the just-touched 'a'
  assert.ok(cache.get("a"), "recently-touched entry survives");
  assert.equal(cache.get("b"), undefined, "least-recently-used evicted");
});
