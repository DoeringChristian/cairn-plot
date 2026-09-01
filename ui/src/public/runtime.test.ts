import test from "node:test";
import assert from "node:assert/strict";

import { configureRuntime } from "./runtime.ts";
import {
  getGpuDiffCacheLimits,
  getGpuSourceTextureRetentionLimit,
  getLiveGpuPaneLimit,
} from "../resources/runtime-config.ts";

test("configureRuntime applies one host resource policy", () => {
  configureRuntime({
    decodedCacheBytes: 1024,
    gpu: {
      livePaneLimit: 24,
      sourceTexturesPerPane: 12,
      diffEntries: 256,
      diffBytes: 4096,
    },
  });
  assert.equal(getLiveGpuPaneLimit(), 24);
  assert.equal(getGpuSourceTextureRetentionLimit(), 12);
  assert.deepEqual(getGpuDiffCacheLimits(), { maxEntries: 256, maxBytes: 4096 });
});

test("configureRuntime requires complete diff limits", () => {
  assert.throws(() => configureRuntime({ gpu: { diffEntries: 10 } }));
});
