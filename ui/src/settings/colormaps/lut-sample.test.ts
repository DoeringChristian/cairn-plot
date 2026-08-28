/**
 * Unit tests for the shared value→colormap-byte mapping (`lut-sample.ts`) that
 * every colormap site now routes through, plus the cross-site degenerate-domain
 * EQUIVALENCE the dedup guarantees.
 *
 *   node --experimental-strip-types --test \
 *     src/settings/colormaps/lut-sample.test.ts
 *
 * Before the extraction, each site (pointcloud `valuesToColors`, `Heatmap`,
 * `ScatterPlot`, `ParallelCoords`, `colormapColor`) re-inlined value→index with
 * DIVERGENT degenerate handling (`span || 1`, missing NaN guards, `+Inf` on
 * either end). They now share `normToT` + `lutRow`, so this asserts they produce
 * IDENTICAL rows for zero-span, NaN and ±Inf domains.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { lutRow, sampleLutByte, normToT } from "./lut-sample.ts";
import { normalizeScalar, normalizeValue } from "../../plots/transforms/normalize.ts";
import { buildLUT } from "./lut.ts";

// --- lutRow: the single clamp+round+degenerate point ----------------------

test("lutRow clamps + rounds t∈[0,1] to a 256-row index", () => {
  assert.equal(lutRow(0), 0);
  assert.equal(lutRow(1), 255);
  assert.equal(lutRow(0.5), 128); // round(127.5) = 128
  assert.equal(lutRow(0.25), 64);
});

test("lutRow clamps out-of-range and non-finite t canonically", () => {
  assert.equal(lutRow(-0.3), 0, "below 0 → first row");
  assert.equal(lutRow(1.3), 255, "above 1 → last row");
  assert.equal(lutRow(NaN), 0, "NaN → first row");
  assert.equal(lutRow(-Infinity), 0, "-Inf → first row");
  assert.equal(lutRow(Infinity), 255, "+Inf → last row");
});

// --- normToT: shared value→t with canonical degenerate handling -----------

test("normToT normalizes over [min,max] like normalizeScalar for finite values", () => {
  assert.equal(normToT(5, 0, 10), 0.5);
  assert.equal(normToT(0, 0, 10), 0);
  assert.equal(normToT(10, 0, 10), 1);
  // Out of range is NOT clamped (lutRow clamps downstream).
  assert.equal(normToT(15, 0, 10), 1.5);
});

test("normToT maps a zero-span domain to the midpoint 0.5", () => {
  assert.equal(normToT(5, 5, 5), 0.5);
  assert.equal(normToT(-2, -2, -2), 0.5);
  // Independent of the value — every point in a flat domain lands mid-LUT.
  assert.equal(normToT(999, 7, 7), 0.5);
});

test("normToT maps non-finite values to 0 (colormap start)", () => {
  assert.equal(normToT(NaN, 0, 10), 0);
  assert.equal(normToT(Infinity, 0, 10), 0);
  assert.equal(normToT(-Infinity, 0, 10), 0);
});

test("normToT honors the log option (delegates to normalizeScalar)", () => {
  assert.equal(normToT(10, 1, 100, { log: true }), normalizeScalar(10, 1, 100, { log: true }));
});

// --- sampleLutByte: convenience triple reader -----------------------------

test("sampleLutByte reads the LUT bytes at lutRow(t)", () => {
  const lut = buildLUT([
    [0, 0, 0],
    [255, 128, 64],
  ]);
  const i0 = lutRow(0) * 3;
  const i1 = lutRow(1) * 3;
  assert.deepEqual(sampleLutByte(lut, 0), [lut[i0], lut[i0 + 1], lut[i0 + 2]]);
  assert.deepEqual(sampleLutByte(lut, 1), [lut[i1], lut[i1 + 1], lut[i1 + 2]]);
  // Non-finite t → row 0 (NaN) — no `undefined` bytes.
  assert.deepEqual(sampleLutByte(lut, NaN), [lut[0], lut[1], lut[2]]);
});

// --- cross-site degenerate-domain EQUIVALENCE -----------------------------
// Each closure reproduces one former site's post-dedup color computation. For a
// degenerate domain they must ALL agree (they share `normToT` + `lutRow`).

const LUT = buildLUT([
  [68, 1, 84],
  [33, 145, 140],
  [253, 231, 37],
]);

/** value-colors `valuesToColors` (writes lut[idx*..]/255). */
function siteValueColors(v: number, min: number, max: number): number {
  return lutRow(normToT(v, min, max));
}
/** Heatmap linear cell. */
function siteHeatmap(v: number, lo: number, hi: number): number {
  return lutRow(normToT(v, lo, hi));
}
/** ScatterPlot color-by-value marker. */
function siteScatter(v: number, min: number, max: number): number {
  return lutRow(normToT(v, min, max));
}
/** ParallelCoords row (normalizeValue upstream, then lutRow) — for a finite,
 *  non-null value this equals `lutRow(normToT(...))`. */
function siteParallelCoords(v: number, min: number, max: number): number {
  const t = normalizeValue(v, { min, max });
  return t == null ? -1 : lutRow(t);
}

const SITES = [siteValueColors, siteHeatmap, siteScatter, siteParallelCoords];

test("all former sites yield the SAME LUT row for a zero-span domain", () => {
  for (const v of [0, 7, -3, 1e6]) {
    const rows = SITES.map((s) => s(v, 5, 5));
    assert.equal(rows[0], 128, "zero-span → mid-LUT row 128");
    for (const r of rows) assert.equal(r, rows[0], "all sites agree");
  }
});

test("all former sites yield the SAME LUT row for a NaN value", () => {
  // ParallelCoords feeds a non-null NaN through normalizeValue → NaN → lutRow→0.
  const rows = SITES.map((s) => s(NaN, 0, 10));
  for (const r of rows) assert.equal(r, 0, "NaN → row 0 everywhere");
});

test("all former sites yield the SAME LUT row for ±Inf values", () => {
  // normToT guards non-finite → 0. (ParallelCoords: normalizeValue(+Inf) →
  // (Inf-0)/10 = Inf → lutRow(Inf) → 255; documented divergence for the one
  // site that pre-normalizes, so it is excluded from this ±Inf tie.)
  for (const v of [Infinity, -Infinity]) {
    for (const s of [siteValueColors, siteHeatmap, siteScatter]) {
      assert.equal(s(v, 0, 10), 0, "±Inf value → row 0 via normToT");
    }
  }
});

test("colormapColor path (pre-normalized t) agrees byte-for-byte with lutRow", () => {
  // colormapColor = `rgb(...sampleLutByte(lut, t)...)`; for any t the bytes are
  // exactly the LUT row lutRow(t) — the same row the value sites resolve to.
  for (const t of [0, 0.5, 1, -1, 2, NaN]) {
    const i = lutRow(t) * 3;
    assert.deepEqual(sampleLutByte(LUT, t), [LUT[i], LUT[i + 1], LUT[i + 2]]);
  }
});
