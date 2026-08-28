/**
 * Pure unit tests for the content-aspect packing geometry (`pack-grid.ts`).
 * Runs under Node's built-in test runner with TypeScript type-stripping — no
 * DOM/React:
 *
 *   node --experimental-strip-types --test \
 *     src/layout/pack-grid.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fitContentBox,
  packContentGrid,
  representativeAspect,
  DEFAULT_STAGE_GAP,
} from "./pack-grid.ts";

const approx = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol;

// --- fitContentBox -----------------------------------------------------------

test("fitContentBox: wide box + square content → height-limited square, centred margins on width", () => {
  const box = fitContentBox(200, 100, 1);
  assert.ok(approx(box.width, 100), `width ${box.width}`);
  assert.ok(approx(box.height, 100), `height ${box.height}`);
  // The fitted box is square (content aspect), NOT the 2:1 available box.
  assert.ok(approx(box.width / box.height, 1));
});

test("fitContentBox: tall box + wide content → width-limited", () => {
  const box = fitContentBox(100, 400, 2); // content 2:1
  assert.ok(approx(box.width, 100));
  assert.ok(approx(box.height, 50));
  assert.ok(approx(box.width / box.height, 2));
});

test("fitContentBox: matching aspect fills the box exactly", () => {
  const box = fitContentBox(300, 150, 2);
  assert.ok(approx(box.width, 300));
  assert.ok(approx(box.height, 150));
});

test("fitContentBox: the fitted box never exceeds the available box on either axis", () => {
  for (const [w, h, a] of [
    [640, 480, 1],
    [640, 480, 3],
    [200, 900, 0.5],
    [1000, 300, 4],
  ] as const) {
    const box = fitContentBox(w, h, a);
    assert.ok(box.width <= w + 1e-9 && box.height <= h + 1e-9, `fit ${w}x${h}@${a} → ${box.width}x${box.height}`);
    assert.ok(approx(box.width / box.height, a, 1e-6), "fitted box carries the content aspect");
  }
});

test("fitContentBox: degenerate inputs are safe", () => {
  assert.deepEqual(fitContentBox(0, 100, 1), { width: 0, height: 0 });
  assert.deepEqual(fitContentBox(100, 0, 1), { width: 0, height: 0 });
  // Non-finite / non-positive aspect falls back to the available box's aspect.
  const box = fitContentBox(200, 100, 0);
  assert.ok(approx(box.width, 200) && approx(box.height, 100));
});

// --- representativeAspect ----------------------------------------------------

test("representativeAspect: median of the valid aspects, fallback when empty", () => {
  assert.equal(representativeAspect([]), 1);
  assert.equal(representativeAspect([2, 2, 2]), 2);
  assert.equal(representativeAspect([1, 2, 3]), 2);
  assert.equal(representativeAspect([1, 3]), 2);
  // Non-finite / non-positive values are ignored.
  assert.equal(representativeAspect([NaN, -1, 0, 4]), 4);
  assert.equal(representativeAspect([], 1.5), 1.5);
});

// --- packContentGrid ---------------------------------------------------------

test("packContentGrid: a SINGLE cell fills the stage at its CONTENT aspect (no letterbox)", () => {
  // A square image in a landscape stage → the largest square that fits, centred —
  // NOT the stage box (which would object-contain letterbox to checkerboard).
  const p = packContentGrid({ count: 1, width: 1000, height: 600, aspect: 1 });
  assert.equal(p.rects.length, 1);
  assert.deepEqual(p.rects[0], { left: 200, top: 0, width: 600, height: 600 });
  assert.ok(approx(p.rects[0].width / p.rects[0].height, 1, 1e-6), "cell is content-aspect (square)");
  assert.equal(p.cols, 1);
  assert.equal(p.rows, 1);
});

test("packContentGrid: multi-cell cells are UNIFORM (every cell the same size)", () => {
  // A grid is a uniform layout: every cell is the representative-aspect slot, so
  // all cells are identical (a mismatched image letterboxes WITHIN its cell,
  // and a synced zoom/pan lines up pixel-for-pixel across cells).
  const p = packContentGrid({ count: 3, width: 1000, height: 400, aspect: 2, gap: 8 });
  assert.equal(p.rects.length, 3);
  for (const r of p.rects) {
    assert.ok(approx(r.width, p.rects[0].width, 1e-6), `uniform width ${r.width} vs ${p.rects[0].width}`);
    assert.ok(approx(r.height, p.rects[0].height, 1e-6), `uniform height ${r.height} vs ${p.rects[0].height}`);
    assert.ok(approx(r.width / r.height, 2, 1e-6), "cell carries the representative aspect");
  }
});

test("packContentGrid: 4 squares in a landscape stage → 2x2 SQUARE cells, centrally clustered with small gaps", () => {
  const W = 1000, H = 600, gap = 8;
  const p = packContentGrid({ count: 4, width: W, height: H, aspect: 1, gap });
  assert.equal(p.cols, 2);
  assert.equal(p.rows, 2);
  assert.equal(p.rects.length, 4);

  // Every cell is SQUARE (content aspect), not stretched to a quadrant.
  for (const r of p.rects) {
    assert.ok(approx(r.width / r.height, 1, 1e-6), `cell aspect ${r.width / r.height}`);
  }

  // Height binds (landscape stage): cell side = (H - gap) / 2.
  const side = (H - gap) / 2;
  assert.ok(approx(p.cellWidth, side) && approx(p.cellHeight, side), `cell ${p.cellWidth}x${p.cellHeight}`);

  // The cells do NOT fill the stage width — they cluster centrally, leaving equal
  // left/right margins (the "no empty cross in the middle" requirement).
  const clusterW = 2 * side + gap;
  const leftMargin = p.rects[0].left;
  const rightMargin = W - (p.rects[1].left + p.rects[1].width);
  assert.ok(clusterW < W, "cluster is narrower than the stage");
  assert.ok(approx(leftMargin, rightMargin, 1e-6), `centred horizontally (${leftMargin} vs ${rightMargin})`);
  assert.ok(leftMargin > 1, "there IS a centring side margin (cells are not stretched to the edges)");

  // Adjacent cells are exactly `gap` apart (small inter-pane distance).
  const hGap = p.rects[1].left - (p.rects[0].left + p.rects[0].width);
  const vGap = p.rects[2].top - (p.rects[0].top + p.rects[0].height);
  assert.ok(approx(hGap, gap) && approx(vGap, gap), `gaps ${hGap}/${vGap}`);

  // The cluster is centred vertically too.
  const clusterH = 2 * side + gap;
  assert.ok(approx(p.rects[0].top, (H - clusterH) / 2, 1e-6), "centred vertically");
});

test("packContentGrid: 4 squares — cluster is NOT the full quadrant fill (the regression this fixes)", () => {
  const W = 1000, H = 600;
  const p = packContentGrid({ count: 4, width: W, height: H, aspect: 1 });
  // The OLD behaviour (repeat(2, 1fr) + gridAutoRows 1fr) would give ~500-wide,
  // ~300-tall cells filling the quadrants. Content-aspect square cells are much
  // smaller in width than a stretched quadrant.
  assert.ok(p.cellWidth < W / 2 - 10, `square cell (${p.cellWidth}) is narrower than a stretched quadrant (${W / 2})`);
  assert.ok(approx(p.cellWidth, p.cellHeight), "and it is square, not a 5:3 quadrant");
});

test("packContentGrid: 2 wide (2:1) images → one row of two 2:1 cells", () => {
  const p = packContentGrid({ count: 2, width: 1200, height: 800, aspect: 2, gap: 10 });
  assert.equal(p.cols, 2);
  assert.equal(p.rows, 1);
  for (const r of p.rects) assert.ok(approx(r.width / r.height, 2, 1e-6));
  // Two cells on one row, same top.
  assert.ok(approx(p.rects[0].top, p.rects[1].top));
});

test("packContentGrid: 3 cells → 2 cols, partial last row is centred on its own", () => {
  const W = 900, H = 600;
  const p = packContentGrid({ count: 3, width: W, height: H, aspect: 1 });
  assert.equal(p.cols, 2);
  assert.equal(p.rows, 2);
  // Row 0 has two cells; row 1 has ONE cell centred horizontally in the stage.
  const lone = p.rects[2];
  const loneCentreX = lone.left + lone.width / 2;
  assert.ok(approx(loneCentreX, W / 2, 1e-6), `lone last-row cell centred (${loneCentreX} vs ${W / 2})`);
});

test("packContentGrid: cluster stays within the stage bounds on both axes", () => {
  for (const count of [2, 3, 4, 5, 6, 9]) {
    const p = packContentGrid({ count, width: 800, height: 500, aspect: 1.5 });
    for (const r of p.rects) {
      assert.ok(r.left >= -1e-6 && r.top >= -1e-6, `cell inside (top-left) for count ${count}`);
      assert.ok(r.left + r.width <= 800 + 1e-6, `cell inside (right) for count ${count}`);
      assert.ok(r.top + r.height <= 500 + 1e-6, `cell inside (bottom) for count ${count}`);
      assert.ok(approx(r.width / r.height, 1.5, 1e-6), "content aspect held");
    }
  }
});

test("packContentGrid: default gap is DEFAULT_STAGE_GAP", () => {
  const p = packContentGrid({ count: 4, width: 1000, height: 600, aspect: 1 });
  const hGap = p.rects[1].left - (p.rects[0].left + p.rects[0].width);
  assert.ok(approx(hGap, DEFAULT_STAGE_GAP), `default gap ${hGap}`);
});
