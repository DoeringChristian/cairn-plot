/**
 * Unit tests for `reframeViewportForResize` — the center-preserving viewport
 * math (Bug 5). Deterministic; no DOM. The invariants proven here are the exact
 * ones the live `enlarge-viewport.browser.ts` harness asserts on a real pane:
 *   - the SOURCE TEXEL under the viewport center is unchanged across a box
 *     resize, and
 *   - the on-screen texel size `P = zoom * homeScale(box)` is unchanged.
 *
 *   node --experimental-strip-types --test src/lib/cairn-plot/viewport/reframe.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { reframeViewportForResize } from "./reframe.ts";

type Box = { width: number; height: number };

/** homeScale = px-per-texel at zoom 1 (object-contain fit), mirroring
 *  `viewportToUvRect` / `adaptiveMaxZoom`. */
function homeScale(box: Box, nW: number, nH: number): number {
  return Math.min(box.width / nW, box.height / nH);
}

/** The SOURCE-TEXEL coordinate under the viewport CENTER, derived straight from
 *  `GpuImagePane.viewportToUvRect` (the ground-truth render mapping):
 *  u_center = x + 0.5*w, texel = u_center * natural. */
function centerTexel(
  vp: { zoom: number; pan: { x: number; y: number } },
  box: Box,
  nW: number,
  nH: number,
): { x: number; y: number } {
  const scale = homeScale(box, nW, nH);
  const dispW = nW * scale;
  const dispH = nH * scale;
  const imgLeft = (box.width - dispW) / 2;
  const imgTop = (box.height - dispH) / 2;
  const z = Math.max(vp.zoom, 1e-6);
  const x = -imgLeft / dispW - vp.pan.x / (z * dispW);
  const w = box.width / (z * dispW);
  const y = -imgTop / dispH - vp.pan.y / (z * dispH);
  const hgt = box.height / (z * dispH);
  return { x: (x + 0.5 * w) * nW, y: (y + 0.5 * hgt) * nH };
}

const NW = 256;
const NH = 128;

test("HOME (untouched) is returned unchanged so it re-fits the new box", () => {
  const home = { zoom: 1, pan: { x: 0, y: 0 } };
  const out = reframeViewportForResize(home, { width: 400, height: 300 }, { width: 900, height: 700 }, NW, NH);
  assert.deepEqual(out, home);
});

test("zoomed/panned view: center TEXEL and texel SIZE are preserved on grow", () => {
  const oldBox: Box = { width: 420, height: 260 };
  const newBox: Box = { width: 1200, height: 820 }; // enlarge — different aspect
  const vp = { zoom: 2.5, pan: { x: -80, y: 40 } };

  const before = centerTexel(vp, oldBox, NW, NH);
  const out = reframeViewportForResize(vp, oldBox, newBox, NW, NH);
  const after = centerTexel(out, newBox, NW, NH);

  // Same source texel at the center (well under 1px of a texel).
  assert.ok(Math.abs(after.x - before.x) < 1e-6, `center texel x drifted: ${before.x} -> ${after.x}`);
  assert.ok(Math.abs(after.y - before.y) < 1e-6, `center texel y drifted: ${before.y} -> ${after.y}`);

  // Same on-screen texel size P = zoom * homeScale.
  const pBefore = vp.zoom * homeScale(oldBox, NW, NH);
  const pAfter = out.zoom * homeScale(newBox, NW, NH);
  assert.ok(Math.abs(pAfter - pBefore) < 1e-9, `texel size changed: ${pBefore} -> ${pAfter}`);
});

test("shrink back to the original box is the exact inverse (round-trips)", () => {
  const a: Box = { width: 420, height: 260 };
  const b: Box = { width: 1200, height: 820 };
  const vp = { zoom: 3.1, pan: { x: 55, y: -120 } };
  const grown = reframeViewportForResize(vp, a, b, NW, NH);
  const back = reframeViewportForResize(grown, b, a, NW, NH);
  assert.ok(Math.abs(back.zoom - vp.zoom) < 1e-9);
  assert.ok(Math.abs(back.pan.x - vp.pan.x) < 1e-6);
  assert.ok(Math.abs(back.pan.y - vp.pan.y) < 1e-6);
});

test("center preserved on a width-only and a height-only change (both axes)", () => {
  const base: Box = { width: 500, height: 500 };
  const vp = { zoom: 2, pan: { x: -30, y: -70 } };
  for (const newBox of [
    { width: 900, height: 500 }, // width only
    { width: 500, height: 900 }, // height only
  ] as Box[]) {
    const before = centerTexel(vp, base, NW, NH);
    const out = reframeViewportForResize(vp, base, newBox, NW, NH);
    const after = centerTexel(out, newBox, NW, NH);
    assert.ok(Math.abs(after.x - before.x) < 1e-6, `x drift on ${JSON.stringify(newBox)}`);
    assert.ok(Math.abs(after.y - before.y) < 1e-6, `y drift on ${JSON.stringify(newBox)}`);
  }
});

test("unknown natural size falls back to the simple center-hold (pan += size delta/2)", () => {
  const vp = { zoom: 2, pan: { x: 10, y: 20 } };
  const out = reframeViewportForResize(vp, { width: 400, height: 300 }, { width: 600, height: 500 });
  assert.equal(out.zoom, 2);
  assert.equal(out.pan.x, 10 + (600 - 400) / 2);
  assert.equal(out.pan.y, 20 + (500 - 300) / 2);
});

test("degenerate boxes are a no-op", () => {
  const vp = { zoom: 2, pan: { x: 1, y: 2 } };
  assert.deepEqual(reframeViewportForResize(vp, { width: 0, height: 0 }, { width: 10, height: 10 }, NW, NH), vp);
});
