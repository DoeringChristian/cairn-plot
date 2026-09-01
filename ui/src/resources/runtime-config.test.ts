// node --experimental-strip-types --test
import assert from "node:assert/strict";
import test from "node:test";
import {
  getGpuDiffCacheLimits,
  getGpuSourceTextureRetentionLimit,
  setGpuDiffCacheLimits,
  setGpuSourceTextureRetentionLimit,
} from "./runtime-config.ts";

test("hosts can expand iteration and metric GPU retention", () => {
  setGpuSourceTextureRetentionLimit(32);
  setGpuDiffCacheLimits(1024, 2 * 1024 * 1024 * 1024);
  assert.equal(getGpuSourceTextureRetentionLimit(), 32);
  assert.deepEqual(getGpuDiffCacheLimits(), {
    maxEntries: 1024,
    maxBytes: 2 * 1024 * 1024 * 1024,
  });
});

test("GPU retention rejects invalid limits", () => {
  assert.throws(() => setGpuSourceTextureRetentionLimit(0));
  assert.throws(() => setGpuDiffCacheLimits(0, 1));
  assert.throws(() => setGpuDiffCacheLimits(1, 0));
});
