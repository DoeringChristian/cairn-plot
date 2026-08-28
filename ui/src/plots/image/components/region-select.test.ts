/**
 * Unit tests for the pure screen→texel mapping (region-select.ts) behind the
 * deep pane's "select depth from region" marquee.
 *
 *   node --experimental-strip-types --test \
 *     src/plots/image/components/region-select.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeFit,
  computeSourceFit,
  screenToTexel,
  texelToScreen,
  sourceTexelCenter,
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

// --- fill-stretch per-side placement (compare split, mismatched resolution) --
// `computeSourceFit`/`sourceTexelCenter` place a SAMPLED source of its OWN dims
// inside the framing quad. The compare split shader samples both operands through
// ONE normalized uv window, each scaled by its own `textureDimensions`, so the
// non-primary (reference) side fills the framing quad with its own texel count —
// exactly the fill-stretch model here.

/** The compare split shader's OWN placement of a sampled source's texel center,
 *  derived independently of `computeFit` — from the normalized uv window
 *  (`viewToUvRect`) + the box fraction the fragment maps to. Ground truth. */
function viewportUvRect(
  zoom: number,
  pan: { x: number; y: number },
  box: { width: number; height: number },
  framingW: number,
  framingH: number,
) {
  const s = Math.min(box.width / framingW, box.height / framingH);
  const dispW = framingW * s;
  const dispH = framingH * s;
  const imgLeft = (box.width - dispW) / 2;
  const imgTop = (box.height - dispH) / 2;
  const z = Math.max(zoom, 1e-6);
  return {
    x: -imgLeft / dispW - pan.x / (z * dispW),
    y: -imgTop / dispH - pan.y / (z * dispH),
    w: box.width / (z * dispW),
    h: box.height / (z * dispH),
  };
}
function shaderTexelCenter(
  box: { left: number; top: number; width: number; height: number },
  uv: { x: number; y: number; w: number; h: number },
  srcW: number,
  srcH: number,
  px: number,
  py: number,
) {
  const fracX = ((px + 0.5) / srcW - uv.x) / uv.w;
  const fracY = ((py + 0.5) / srcH - uv.y) / uv.h;
  return { x: box.left + fracX * box.width, y: box.top + fracY * box.height };
}

test("sourceTexelCenter reduces to texelToScreen(px+0.5) when sourceDims omitted", () => {
  const params: ScreenToTexelParams = {
    box: { left: -30, top: 12, width: 640, height: 360 },
    naturalWidth: 100,
    naturalHeight: 70,
    sourceWindow: { x: 0.2, y: 0.15, w: 0.4, h: 0.5 },
  };
  for (const px of [0, 3, 41, 99]) {
    for (const py of [0, 20, 69]) {
      const a = sourceTexelCenter(px, py, params);
      const b = texelToScreen(px + 0.5, py + 0.5, params);
      assert.ok(Math.abs(a.x - b.x) < 1e-9, `x @ (${px},${py})`);
      assert.ok(Math.abs(a.y - b.y) < 1e-9, `y @ (${px},${py})`);
      // sourceDims === framing dims is the identity, too.
      const c = sourceTexelCenter(px, py, params, { w: 100, h: 70 });
      assert.ok(Math.abs(a.x - c.x) < 1e-9);
      assert.ok(Math.abs(a.y - c.y) < 1e-9);
    }
  }
});

test("sourceTexelCenter matches the split shader for a MISMATCHED-resolution side", () => {
  // Foreground/primary (framing) = 100x70; reference = 64x48 (different aspect).
  const framingW = 100;
  const framingH = 70;
  const refW = 64;
  const refH = 48;
  for (const zoom of [1, 2.5, 8]) {
    for (const pan of [{ x: 0, y: 0 }, { x: -120, y: 40 }, { x: 300, y: -90 }]) {
      const box = { left: 17, top: 9, width: 800, height: 300 };
      const uv = viewportUvRect(zoom, pan, box, framingW, framingH);
      const params: ScreenToTexelParams = {
        box,
        naturalWidth: framingW,
        naturalHeight: framingH,
        sourceWindow: uv,
      };
      for (const px of [0, 1, 31, 63]) {
        for (const py of [0, 24, 47]) {
          const got = sourceTexelCenter(px, py, params, { w: refW, h: refH });
          const truth = shaderTexelCenter(box, uv, refW, refH, px, py);
          assert.ok(Math.abs(got.x - truth.x) < 1e-6, `x @ (${px},${py}) z=${zoom}`);
          assert.ok(Math.abs(got.y - truth.y) < 1e-6, `y @ (${px},${py}) z=${zoom}`);
        }
      }
    }
  }
});

test("the OLD primary-grid placement drifts off the reference pixels, growing with index", () => {
  // Reproduces the reported bug numerically: placing the reference side's texel on
  // the PRIMARY's grid (framing dims) — what the pane did before the fix — puts the
  // number progressively further from the pixel the shader draws, worst at large
  // resolution. The per-side `sourceDims` mapping removes it.
  const framingW = 2048;
  const framingH = 1536;
  const refW = 2000; // slightly smaller reference (a common crop/resample mismatch)
  const refH = 1500;
  const box = { left: 0, top: 0, width: 1200, height: 900 };
  // Zoom in enough that ~1 texel is many px (numbers are visible at this zoom).
  const zoom = 60;
  const pan = { x: -720, y: -540 };
  const uv = viewportUvRect(zoom, pan, box, framingW, framingH);
  const params: ScreenToTexelParams = { box, naturalWidth: framingW, naturalHeight: framingH, sourceWindow: uv };
  const nearTexel = { x: 12, y: 9 };
  const farTexel = { x: 1990, y: 1490 };
  const errOld = (t: { x: number; y: number }) => {
    // OLD: reference texel placed via the FRAMING (primary) grid — sourceDims omitted.
    const old = sourceTexelCenter(t.x, t.y, params);
    const truth = shaderTexelCenter(box, uv, refW, refH, t.x, t.y);
    return Math.hypot(old.x - truth.x, old.y - truth.y);
  };
  const errNew = (t: { x: number; y: number }) => {
    const fixed = sourceTexelCenter(t.x, t.y, params, { w: refW, h: refH });
    const truth = shaderTexelCenter(box, uv, refW, refH, t.x, t.y);
    return Math.hypot(fixed.x - truth.x, fixed.y - truth.y);
  };
  // The OLD placement drifts, and the drift GROWS with texel index.
  assert.ok(errOld(farTexel) > errOld(nearTexel) + 5, `old drift grows: near=${errOld(nearTexel)} far=${errOld(farTexel)}`);
  assert.ok(errOld(farTexel) > 20, `old far-corner drift is large: ${errOld(farTexel)}`);
  // The FIXED placement sits on the shader's pixel center everywhere (sub-px).
  assert.ok(errNew(nearTexel) < 1e-6, `new near err: ${errNew(nearTexel)}`);
  assert.ok(errNew(farTexel) < 1e-6, `new far err: ${errNew(farTexel)}`);
});

test("computeSourceFit rectangular cells: per-axis screen-per-texel spans the quad", () => {
  const params: ScreenToTexelParams = {
    box: { left: 5, top: 5, width: 500, height: 500 },
    naturalWidth: 100,
    naturalHeight: 100,
  };
  const sf = computeSourceFit(params, { w: 40, h: 80 });
  // The framing quad (full 100x100 image, object-contain into 500x500) is 500x500.
  assert.ok(Math.abs(sf.quadW - 500) < 1e-9);
  assert.ok(Math.abs(sf.quadH - 500) < 1e-9);
  // Its own grid spreads across the SAME quad: 40 cols, 80 rows.
  assert.ok(Math.abs(sf.sxPerTexel - 500 / 40) < 1e-9);
  assert.ok(Math.abs(sf.syPerTexel - 500 / 80) < 1e-9);
  assert.equal(sf.gridW, 40);
  assert.equal(sf.gridH, 80);
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
