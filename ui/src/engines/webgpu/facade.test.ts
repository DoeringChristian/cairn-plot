import assert from "node:assert/strict";
import test from "node:test";

import { createWebGpuEngineContext } from "./facade.ts";

test("WebGPU context centralizes surface creation and readback", async () => {
  const calls: unknown[] = [];
  const surface = {};
  const device = {
    capabilities: { hdr: true, compute: true, float16: true },
    createSurface(canvas: unknown, options: unknown) {
      calls.push(["surface", canvas, options]);
      return surface;
    },
    readback(value: unknown) {
      calls.push(["read", value]);
      return Promise.resolve(new Uint8Array([1]));
    },
  };
  const context = createWebGpuEngineContext(device as never);
  const canvas = {} as HTMLCanvasElement;
  assert.equal(context.createSurface(canvas, { hdr: true }), surface);
  assert.deepEqual(await context.readSurface(surface as never), new Uint8Array([1]));
  assert.deepEqual(calls, [
    ["surface", canvas, { hdr: true }],
    ["read", surface],
  ]);
  assert.equal(context.capabilities.hdr, true);
});
