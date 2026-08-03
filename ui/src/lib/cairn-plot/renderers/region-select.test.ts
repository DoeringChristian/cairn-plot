/**
 * Unit tests for the pure screen→texel mapping (region-select.ts) behind the
 * deep pane's "select depth from region" marquee.
 *
 *   node --experimental-strip-types --test \
 *     src/lib/cairn-plot/renderers/region-select.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeFit,
  screenToTexel,
  texelToScreen,
  screenRectToTexelRect,
  texelRectToScreenRect,
  type ScreenToTexelParams,
} from "./region-select.ts";

// A 100x50 source displayed object-contain into a 200x200 box at client (10,20):
// scale = min(200/100, 200/50) = 2 (width-limited), dispW=200, dispH=100,
// image top-left in client space = (10 + (200-200)/2, 20 + (200-100)/2) = (10, 70).
const box = { left: 10, top: 20, width: 200, height: 200 };
const p = { box, naturalWidth: 100, naturalHeight: 50 };

test("screenToTexel maps the image top-left corner to texel (0,0)", () => {
  const t = screenToTexel(10, 70, p);
  assert.ok(Math.abs(t.x - 0) < 1e-9);
  assert.ok(Math.abs(t.y - 0) < 1e-9);
});

test("screenToTexel maps a mid point through the object-contain scale", () => {
  // client (110, 120): (110-10)/2 = 50 in x; (120-70)/2 = 25 in y.
  const t = screenToTexel(110, 120, p);
  assert.ok(Math.abs(t.x - 50) < 1e-9);
  assert.ok(Math.abs(t.y - 25) < 1e-9);
});

test("screenRectToTexelRect returns an inclusive, clamped integer rect", () => {
  // Drag from client (30,90) → (150,150): x 10..70, y 10..40 (all in-bounds).
  const r = screenRectToTexelRect(30, 90, 150, 150, p)!;
  assert.deepEqual(r, { x0: 10, y0: 10, x1: 70, y1: 40 });
});

test("screenRectToTexelRect normalizes inverted drags (bottom-right → top-left)", () => {
  const a = screenRectToTexelRect(30, 90, 150, 150, p)!;
  const b = screenRectToTexelRect(150, 150, 30, 90, p)!;
  assert.deepEqual(a, b);
});

test("screenRectToTexelRect clamps a rect that spills past the image edges", () => {
  // Way outside on the right/bottom → clamped to the last texel (99,49).
  const r = screenRectToTexelRect(150, 120, 9999, 9999, p)!;
  assert.equal(r.x1, 99);
  assert.equal(r.y1, 49);
});

test("screenRectToTexelRect returns null for a rect entirely outside the image", () => {
  // Far left of the image (image spans client x in [10,210], texels via scale):
  // a tiny rect at client x≈0 maps to negative texels only.
  const r = screenRectToTexelRect(-500, -500, -400, -400, p);
  assert.equal(r, null);
});

test("screenToTexel honors a GPU sourceWindow crop (uvRect)", () => {
  // Displaying only the right half [0.5,1] of a 100-wide source into the box:
  // srcOriginX = 50, visibleW = 50. scale = min(200/50, 200/50)=4; dispW=dispH=200;
  // imgLeft=10, imgTop=20. client (10,20) → texel (50, 0).
  const t = screenToTexel(10, 20, {
    box,
    naturalWidth: 100,
    naturalHeight: 50,
    sourceWindow: { x: 0.5, y: 0, w: 0.5, h: 1 },
  });
  assert.ok(Math.abs(t.x - 50) < 1e-9);
  assert.ok(Math.abs(t.y - 0) < 1e-9);
});

test("persisted rect stays GLUED to the image region across a zoom change", () => {
  // The same image-texel rect, mapped through the image element's box at TWO
  // zoom levels (a CPU pane grows the element's box with the CSS transform).
  const rect = { x0: 10, y0: 10, x1: 40, y1: 30 };
  const box1 = { left: 10, top: 20, width: 200, height: 200 }; // 1x
  const box2 = { left: -50, top: 0, width: 400, height: 400 }; // 2x zoom + pan
  const p1 = { box: box1, naturalWidth: 100, naturalHeight: 50 };
  const p2 = { box: box2, naturalWidth: 100, naturalHeight: 50 };

  const s1 = texelRectToScreenRect(rect, p1);
  const s2 = texelRectToScreenRect(rect, p2);

  // The screen rects DIFFER (the 2x zoom doubles the on-screen size)…
  assert.ok(Math.abs(s2.width / s1.width - 2) < 1e-9, "screen width scales with zoom");
  assert.ok(Math.abs(s2.height / s1.height - 2) < 1e-9, "screen height scales with zoom");

  // …yet BOTH map back to the exact same image texels — the rect is glued to the
  // image region, not to fixed screen coordinates. The drawn box spans the FULL
  // pixels [x0, x1+1), so the far corner decodes to texel x1+1/y1+1.
  for (const [s, p] of [
    [s1, p1],
    [s2, p2],
  ] as const) {
    const a = screenToTexel(s.left, s.top, p);
    const b = screenToTexel(s.left + s.width, s.top + s.height, p);
    assert.equal(Math.round(a.x), rect.x0);
    assert.equal(Math.round(a.y), rect.y0);
    assert.equal(Math.round(b.x) - 1, rect.x1);
    assert.equal(Math.round(b.y) - 1, rect.y1);
  }
});

// --- PixelValueOverlay fit parity -----------------------------------------
// The overlay used to recompute the object-contain fit inline; it now derives
// its per-pixel placement from `computeFit` here. These lock the numerical
// identity across a grid of zoom/pan states (encoded as varying `box` for the
// CSS-transform panes and `sourceWindow` crops for the GPU panes): the overlay's
// pixel-center formula `imgLeft + (px - srcOriginX + 0.5)*scale` must equal
// `texelToScreen(px+0.5, py+0.5)`, and its clip-window inverse must equal
// `screenToTexel`.

/** The overlay's own per-pixel-center formula, fed straight from `computeFit`
 *  (client space; the component only subtracts its canvas rect afterwards). */
function overlayPixelCenter(px: number, py: number, params: ScreenToTexelParams) {
  const f = computeFit(params);
  return {
    x: f.imgLeft + (px - f.srcOriginX + 0.5) * f.scale,
    y: f.imgTop + (py - f.srcOriginY + 0.5) * f.scale,
  };
}

test("overlay pixel-center mapping is identical to region-select's texelToScreen", () => {
  const grid: ScreenToTexelParams[] = [];
  // Zoom/pan via the image element's on-screen box (CPU/CSS-transform panes).
  for (const width of [120, 200, 480]) {
    for (const height of [90, 200, 500]) {
      for (const [left, top] of [
        [0, 0],
        [10, 20],
        [-60, -15],
      ] as const) {
        grid.push({ box: { left, top, width, height }, naturalWidth: 100, naturalHeight: 50 });
        // …and the SAME with a GPU crop (sourceWindow) — the other zoom axis.
        grid.push({
          box: { left, top, width, height },
          naturalWidth: 100,
          naturalHeight: 50,
          sourceWindow: { x: 0.25, y: 0.1, w: 0.5, h: 0.7 },
        });
      }
    }
  }
  for (const params of grid) {
    for (const px of [0, 1, 37, 99]) {
      for (const py of [0, 25, 49]) {
        const overlay = overlayPixelCenter(px, py, params);
        const shared = texelToScreen(px + 0.5, py + 0.5, params);
        assert.ok(Math.abs(overlay.x - shared.x) < 1e-9, `x @ (${px},${py})`);
        assert.ok(Math.abs(overlay.y - shared.y) < 1e-9, `y @ (${px},${py})`);
      }
    }
  }
});

test("overlay fit round-trips through screenToTexel (clip-window inverse)", () => {
  const params: ScreenToTexelParams = {
    box: { left: -60, top: -15, width: 480, height: 500 },
    naturalWidth: 100,
    naturalHeight: 50,
    sourceWindow: { x: 0.25, y: 0.1, w: 0.5, h: 0.7 },
  };
  // A texel → its screen point (overlay draw dir) → back to the texel: identity,
  // so the overlay's forward placement and its clip-window inverse agree.
  for (const [tx, ty] of [
    [25, 5],
    [40.5, 20.5],
    [70, 40],
  ] as const) {
    const screen = texelToScreen(tx, ty, params);
    const back = screenToTexel(screen.x, screen.y, params);
    assert.ok(Math.abs(back.x - tx) < 1e-9);
    assert.ok(Math.abs(back.y - ty) < 1e-9);
  }
});
