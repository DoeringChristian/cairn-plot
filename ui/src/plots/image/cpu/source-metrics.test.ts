import assert from "node:assert/strict";
import test from "node:test";
import type { FloatImageSource } from "../definition/content.ts";
import { floatValues } from "../runtime/pixel-buffer.ts";
import { computeCpuSourceMetrics } from "./source-metrics.ts";

function rgb(width: number, height: number, values: number[]): FloatImageSource {
  return {
    dtype: "float",
    shape: [height, width, 3],
    pixels: floatValues(new Float32Array(values)),
  };
}

test("CPU comparison metrics match exact native-resolution RGB math", async () => {
  const reference = rgb(2, 1, [0, 0, 0, 1, 1, 1]);
  const foreground = rgb(2, 1, [1, 0, 0, 0, 1, 1]);
  const metrics = await computeCpuSourceMetrics({ reference, foreground });
  assert.ok(metrics);
  assert.equal(metrics.mse, 2 / 6);
  assert.equal(metrics.mae, 2 / 6);
  assert.equal(metrics.psnr, 10 * Math.log10(3));
  assert.equal(metrics.ssim, undefined);
});

test("CPU comparison metrics honor aligned crop geometry", async () => {
  const reference = rgb(3, 1, [0, 0, 0, 0.5, 0.5, 0.5, 1, 1, 1]);
  const foreground = rgb(1, 1, [0.5, 0.5, 0.5]);
  const metrics = await computeCpuSourceMetrics({ reference, foreground, align: "center" });
  assert.deepEqual(metrics, { mse: 0, psnr: Infinity, mae: 0 });
});

test("CPU SSIM scalar is available when selected", async () => {
  const values = Array.from({ length: 12 * 12 * 3 }, (_, index) => (index % 17) / 16);
  const source = rgb(12, 12, values);
  const metrics = await computeCpuSourceMetrics({ reference: source, foreground: source, includeSsim: true });
  assert.ok(metrics);
  assert.equal(metrics.mse, 0);
  assert.equal(metrics.ssim, 1);
});
