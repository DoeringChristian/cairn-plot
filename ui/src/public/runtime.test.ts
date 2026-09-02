import test from "node:test";
import assert from "node:assert/strict";

import { configureRuntime } from "./runtime.ts";
import { globalResourceCache } from "../resources/cache.ts";
import { registerRuntimePolicyHook } from "../resources/runtime-policy-hooks.ts";
import {
  getExpandedUploadCacheByteLimit,
  getGpuDiffCacheLimits,
  getGpuSourceTextureLimits,
  getGpuSourceTextureRetentionLimit,
  getLiveGpuPaneLimit,
  getOffscreenCpuReleaseMs,
} from "../resources/runtime-config.ts";

test("configureRuntime applies compatible count and byte resource policy", () => {
  configureRuntime({
    decodedCacheBytes: 1024,
    expandedUploadCacheBytes: 2048,
    offscreenCpuReleaseMs: 1234,
    gpu: {
      livePaneLimit: 24,
      sourceTexturesPerPane: 12,
      activeSourceBytes: 4096,
      sharedSourceBytes: 8192,
      zeroRefSourceBytes: 1024,
      diffEntries: 256,
      diffBytes: 4096,
    },
  });
  assert.equal(getLiveGpuPaneLimit(), 24);
  assert.equal(getGpuSourceTextureRetentionLimit(), 12);
  assert.equal(getExpandedUploadCacheByteLimit(), 2048);
  assert.equal(getOffscreenCpuReleaseMs(), 1234);
  assert.deepEqual(getGpuSourceTextureLimits(), {
    activeBytes: 4096,
    sharedBytes: 8192,
    zeroRefBytes: 1024,
  });
  assert.deepEqual(getGpuDiffCacheLimits(), { maxEntries: 256, maxBytes: 4096 });
});

test("configureRuntime keeps legacy partial policies supported", () => {
  assert.doesNotThrow(() => configureRuntime({ gpu: { livePaneLimit: 10, sourceTexturesPerPane: 4 } }));
});

test("configureRuntime requires complete coupled limits", () => {
  assert.throws(() => configureRuntime({ gpu: { diffEntries: 10 } }), /configured together/);
  assert.throws(() => configureRuntime({ gpu: { activeSourceBytes: 10 } }), /configured together/);
});

test("configureRuntime validates byte budgets and timeouts", () => {
  assert.throws(() => configureRuntime({ expandedUploadCacheBytes: -1 }), /non-negative/);
  assert.throws(() => configureRuntime({ offscreenCpuReleaseMs: 1.5 }), /safe integer/);
  assert.throws(() => configureRuntime({ gpu: {
    activeSourceBytes: 1,
    sharedSourceBytes: 1,
    zeroRefSourceBytes: -1,
  } }), /non-negative/);
});

test("configureRuntime is atomic and invokes trim hooks only after full validation", () => {
  configureRuntime({
    decodedCacheBytes: 111,
    expandedUploadCacheBytes: 222,
    offscreenCpuReleaseMs: 333,
    gpu: { livePaneLimit: 7, sourceTexturesPerPane: 5 },
  });
  let hookCalls = 0;
  const unregister = registerRuntimePolicyHook(() => { hookCalls++; });
  assert.throws(() => configureRuntime({
    decodedCacheBytes: 999,
    expandedUploadCacheBytes: 888,
    offscreenCpuReleaseMs: 777,
    gpu: { livePaneLimit: 6, diffEntries: 4 },
  }), /configured together/);
  unregister();
  assert.equal(globalResourceCache.budgetBytes, 111);
  assert.equal(getExpandedUploadCacheByteLimit(), 222);
  assert.equal(getOffscreenCpuReleaseMs(), 333);
  assert.equal(getLiveGpuPaneLimit(), 7);
  assert.equal(getGpuSourceTextureRetentionLimit(), 5);
  assert.equal(hookCalls, 0);
});
