import test from "node:test";
import assert from "node:assert/strict";

// Node has no WebGPU globals. Importing the shared public runtime must still be
// safe so browsers without WebGPU can reach the CPU fallback path.
import { configureHDRSurface, configureSDRSurface } from "./surface.ts";

test("WebGPU surface helpers do not read GPU globals during module import", () => {
  assert.equal(typeof configureSDRSurface, "function");
  assert.equal(typeof configureHDRSurface, "function");
  assert.equal(typeof (globalThis as { GPUTextureUsage?: unknown }).GPUTextureUsage, "undefined");
});
