/**
 * Node test: the GPU REDUCTION FAMILY's pure surface (`reduce/registry.ts`) —
 * the parts testable WITHOUT a GPU:
 *   - the CPU twins (`cpuReduce`) reproduce the EXACT hand-written JS loops they
 *     replace (`meanSsimFromErrorMap`; `computeMetrics`' sumSq/sumAbs loop), so
 *     the loops are pinned as the family's parity reference;
 *   - `foldReducePartials` (the host tail that finishes the GPU's per-workgroup
 *     partials) composes to the same scalar as a single `cpuReduce`;
 *   - NaN PROPAGATES through `sum`/`mean` (the documented policy);
 *   - odd / non-power-of-two regions reduce correctly;
 *   - the WGSL assembler emits the declared bindings/lanes per variant.
 * The GPU↔CPU parity on a real device is the browser harness
 * (`__tests__/reduce.browser.ts`).
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     src/plots/image/engine/reduce/registry.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assembleReduceWGSL,
  cpuReduce,
  foldReducePartials,
  getReduceOp,
  getReduceProgram,
  listReduceOps,
  listReducePrograms,
  REDUCE_WORKGROUP_SIZE,
} from "./registry.ts";
import { meanSsimFromErrorMap } from "../ssim-metric.ts";

const CHANNEL = getReduceProgram("channel")!;
const DIFF = getReduceProgram("diffSqAbs")!;
const SUM = getReduceOp("sum")!;
const MEAN = getReduceOp("mean")!;

/** Build an RGBA loader over a flat row-major Float32Array (4 floats/pixel). */
function rgbaLoader(...srcs: Float32Array[]) {
  return (i: number, x: number, y: number, width: number): readonly number[] => {
    const s = srcs[i]!;
    const o = (y * width + x) * 4;
    return [s[o] ?? 0, s[o + 1] ?? 0, s[o + 2] ?? 0, s[o + 3] ?? 0];
  };
}

function makeRGBA(width: number, height: number, seed: number): Float32Array {
  const out = new Float32Array(width * height * 4);
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < width * height; i++) {
    out[i * 4] = rnd();
    out[i * 4 + 1] = rnd();
    out[i * 4 + 2] = rnd();
    out[i * 4 + 3] = 1;
  }
  return out;
}

test("registry declares exactly the consumed entries (no speculative ops)", () => {
  assert.deepEqual(
    listReduceOps().map((o) => o.id).sort(),
    ["mean", "sum"],
  );
  assert.deepEqual(
    listReducePrograms().map((p) => p.id).sort(),
    ["channel", "diffSqAbs"],
  );
});

test("channel/mean CPU twin == meanSsimFromErrorMap's loop (the replaced JS)", () => {
  const W = 20;
  const H = 18;
  const err = makeRGBA(W, H, 7); // R = 1-SSIM per pixel (any float field works)
  const load = rgbaLoader(err);
  const [mean] = cpuReduce(CHANNEL, MEAN, (i, x, y) => load(i, x, y, W), W, H, { channel: 0 });
  const ssimFromReduce = 1 - mean!;
  const ssimFromLoop = meanSsimFromErrorMap(err, W, H);
  assert.ok(Math.abs(ssimFromReduce - ssimFromLoop) < 1e-12, `${ssimFromReduce} vs ${ssimFromLoop}`);
});

test("diffSqAbs/sum CPU twin == computeMetrics' hand sumSq/sumAbs loop", () => {
  const W = 24;
  const H = 20;
  const a = makeRGBA(W, H, 3);
  const b = makeRGBA(W, H, 99);
  const load = rgbaLoader(a, b);
  // The reference: exactly the loop in image-engine.ts's computeMetrics.
  let sumSq = 0;
  let sumAbs = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const av = load(0, x, y, W);
      const bv = load(1, x, y, W);
      for (let c = 0; c < 3; c++) {
        const d = av[c]! - bv[c]!;
        sumSq += d * d;
        sumAbs += Math.abs(d);
      }
    }
  }
  const [rSq, rAbs] = cpuReduce(DIFF, SUM, (i, x, y) => load(i, x, y, W), W, H);
  assert.ok(Math.abs(rSq! - sumSq) < 1e-9, `sumSq ${rSq} vs ${sumSq}`);
  assert.ok(Math.abs(rAbs! - sumAbs) < 1e-9, `sumAbs ${rAbs} vs ${sumAbs}`);
});

test("foldReducePartials composes GPU per-workgroup partials to one scalar", () => {
  // Emulate the GPU: tile the region into WORKGROUP_SIZE chunks, sum each lane
  // per chunk into a partial, then fold. Must equal a single cpuReduce.
  const W = 37; // non-power-of-two on purpose
  const H = 11;
  const err = makeRGBA(W, H, 5);
  const load = (i: number, x: number, y: number) => rgbaLoader(err)(i, x, y, W);
  const count = W * H;
  const numWorkgroups = Math.max(1, Math.ceil(count / REDUCE_WORKGROUP_SIZE));
  // channel/mean, lanes=1.
  const partial = new Float32Array(numWorkgroups * 1);
  for (let idx = 0; idx < count; idx++) {
    const x = idx % W;
    const y = Math.floor(idx / W);
    const wg = Math.floor(idx / REDUCE_WORKGROUP_SIZE);
    partial[wg] = (partial[wg] ?? 0) + (load(0, x, y)[0] ?? 0);
  }
  const [folded] = foldReducePartials(partial, numWorkgroups, 1, MEAN, count);
  const [direct] = cpuReduce(CHANNEL, MEAN, load, W, H, { channel: 0 });
  // Tiled partial folding reorders the float adds vs the linear reduce (exactly
  // as the GPU does), so equality is up to float accumulation order, not exact.
  assert.ok(Math.abs(folded! - direct!) < 1e-6, `${folded} vs ${direct}`);
});

test("NaN policy: sum/mean PROPAGATE a NaN sample (matches replaced loops)", () => {
  const W = 8;
  const H = 8;
  const err = makeRGBA(W, H, 1);
  err[(3 * W + 4) * 4] = NaN; // one NaN in the R channel
  const load = (i: number, x: number, y: number) => rgbaLoader(err)(i, x, y, W);
  const [mean] = cpuReduce(CHANNEL, MEAN, load, W, H, { channel: 0 });
  assert.ok(Number.isNaN(mean!), "GPU-twin mean propagates NaN");
  assert.ok(Number.isNaN(meanSsimFromErrorMap(err, W, H)), "the replaced loop also propagates NaN");
});

test("mean of an empty region → NaN; sum of empty → 0", () => {
  const load = () => [0, 0, 0, 0];
  assert.ok(Number.isNaN(cpuReduce(CHANNEL, MEAN, load, 0, 0, { channel: 0 })[0]!));
  assert.equal(cpuReduce(DIFF, SUM, load, 0, 0)[0], 0);
});

test("odd / non-power-of-two regions reduce exactly (channel mean & diff sums)", () => {
  for (const [W, H] of [
    [1, 1],
    [3, 5],
    [17, 1],
    [37, 11],
    [255, 3],
    [257, 2],
  ] as const) {
    const a = makeRGBA(W, H, W * 131 + H);
    const b = makeRGBA(W, H, W + H * 977);
    const load = (i: number, x: number, y: number) => rgbaLoader(a, b)(i, x, y, W);
    // Brute-force reference.
    let sR = 0;
    let sSq = 0;
    let sAbs = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        sR += load(0, x, y)[0]!;
        for (let c = 0; c < 3; c++) {
          const d = load(0, x, y)[c]! - load(1, x, y)[c]!;
          sSq += d * d;
          sAbs += Math.abs(d);
        }
      }
    }
    const [mean] = cpuReduce(CHANNEL, MEAN, load, W, H, { channel: 0 });
    const [rSq, rAbs] = cpuReduce(DIFF, SUM, load, W, H);
    assert.ok(Math.abs(mean! - sR / (W * H)) < 1e-9, `${W}x${H} mean`);
    assert.ok(Math.abs(rSq! - sSq) < 1e-6, `${W}x${H} sumSq`);
    assert.ok(Math.abs(rAbs! - sAbs) < 1e-6, `${W}x${H} sumAbs`);
  }
});

test("assembler emits declared bindings/lanes per variant", () => {
  const chan = assembleReduceWGSL(CHANNEL, MEAN);
  // 1 texture → t0 at 0, storage at 1, uniform at 2; 1 shared lane array.
  assert.match(chan, /@binding\(0\) var t0: texture_2d<f32>;/);
  assert.doesNotMatch(chan, /var t1:/);
  assert.match(chan, /@binding\(1\) var<storage, read_write> partial/);
  assert.match(chan, /@binding\(2\) var<uniform> dims/);
  assert.match(chan, /texel\[dims\.channel\]/);
  assert.match(chan, /shared0:/);
  assert.doesNotMatch(chan, /shared1:/);

  const diff = assembleReduceWGSL(DIFF, SUM);
  // 2 textures → t0,t1 at 0,1; storage at 2, uniform at 3; 2 shared lanes.
  assert.match(diff, /@binding\(0\) var t0: texture_2d<f32>;/);
  assert.match(diff, /@binding\(1\) var t1: texture_2d<f32>;/);
  assert.match(diff, /@binding\(2\) var<storage, read_write> partial/);
  assert.match(diff, /@binding\(3\) var<uniform> dims/);
  assert.match(diff, /shared0:/);
  assert.match(diff, /shared1:/);
  assert.match(diff, /@workgroup_size\(256\)/);
});
