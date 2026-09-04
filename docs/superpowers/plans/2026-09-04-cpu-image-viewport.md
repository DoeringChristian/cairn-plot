# Image Viewport Geometry and CPU Viewport Canvas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make painted texels and every derived layer (labels, marquee, region rect, cursor, boxes) agree by construction on both image backends, by giving each pane one measured viewport, one geometry object, and a CPU backend that paints into a device-pixel canvas instead of a CSS-transformed layout.

**Architecture:** The viewport composition (`viewToQuad` / `viewToUvRect`) joins the existing fit primitive in `components/region-select.ts`. A shared `useImageViewport` hook owns the single `ResizeObserver` per pane and returns one memoized `ImageViewport`. `ImagePaneShell` has one viewport element and one `viewport` prop. The CPU backend resolves one content pipeline into a cached `ImageBitmap` and paints it with `drawImage` in a layout effect; the GPU backend consumes the same `ImageViewport`. The pixel axes feature and every CSS-transform image path are removed.

**Tech Stack:** TypeScript, React 18, Canvas 2D, WebGPU (unchanged), Node `node:test` unit tests, headless-Chromium browser harnesses (`ui/scripts/test-harness.mjs`), Python (pydantic builders, pytest), Vite IIFE bundles.

**Spec:** `docs/superpowers/specs/2026-09-03-cpu-image-viewport-design.md`

## Global Constraints

- Work on branch `cpu-viewport-canvas`; `main` stays untouched (user wants a clean revert path). Commit after every task with the trailer lines the repository requires (`Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and the `Claude-Session:` line from the session reminder).
- Never modify: `ui/src/plots/image/webgpu/shaders/**`, `ui/src/plots/image/webgpu/pool.ts`, `ui/src/host/hooks/use-image-gestures.ts` gesture math, `ui/src/plots/image/runtime/reframe-view.ts`, decode/tone-map/colormap/diff/metric code.
- Performance rules from spec §3.9 are binding: content effects depend only on content identity and scalar display parameters; the paint depends on `viewport`, `source`, `version`; backing size assigned only on change; exactly one `ResizeObserver` per pane; no `getImageData` on source bitmaps; no `desynchronized` context; no CSS `image-rendering` on image canvases; presentation backing clamped to 16384 per axis and 2^28 pixels.
- Unit tests run with `cd ui && npm test` (`node --experimental-strip-types --test "src/**/*.test.ts"`); typecheck with `cd ui && npm run typecheck`. Both must pass at every commit except where a task explicitly says the commit spans two tasks.
- Browser harnesses: `cd ui && npm run test:harness` (default self-driving set) and `npm run test:harness -- --only <substr>`.
- The 3D `show_axes` (PointCloud, Mesh, Volume, Boxes) and `examples/*.py` are not touched.

---

### Task 1: Viewport composition in `region-select.ts`

**Files:**
- Modify: `ui/src/plots/image/components/region-select.ts` (append after `texelRectToScreenRect`)
- Modify: `ui/src/plots/image/components/region-select.test.ts` (append)
- Modify: `ui/src/plots/image/webgpu/view.tsx:286-392` (delete `viewToUvRect` and `screenPxPerTexel` definitions; import them)
- Modify: `ui/src/plots/image/components/interp-auto.ts` (delete file after Task 5; here only leave untouched)

**Interfaces:**
- Consumes: `computeFit`, `screenPerTexel` from `region-select.ts`; `ImageViewState` from `host/hooks/use-image-gestures.ts`; `Interpolation` from `plots/types.ts`.
- Produces:
  - `viewToUvRect(view: ImageViewState, box: {width,height}, naturalW, naturalH): SourceWindow`
  - `viewToQuad(view: ImageViewState, box: {width,height}, naturalW, naturalH): { left, top, width, height }`
  - `screenPxPerTexel(uv: {w,h}, box: {width,height}, naturalW, naturalH): number`
  - `magnificationFilter(interpolation: Interpolation, pxPerTexel: number, threshold: number): "nearest" | "linear"`
  - `export type MagnificationFilter = "nearest" | "linear"`

- [ ] **Step 1: Write the failing tests**

Append to `ui/src/plots/image/components/region-select.test.ts`:

```ts
import {
  viewToUvRect,
  viewToQuad,
  screenPxPerTexel,
  magnificationFilter,
} from "./region-select.ts";

const closeRel = (a: number, b: number, rel: number) =>
  Math.abs(a - b) <= rel * Math.max(1, Math.abs(a), Math.abs(b));

test("viewToQuad at home equals the object-contain rect", () => {
  const q = viewToQuad({ zoom: 1, pan: { x: 0, y: 0 } }, { width: 642, height: 277.5 }, 512, 512);
  // scale = min(642/512, 277.5/512) = 0.54199…, width = height = 277.5, left = (642-277.5)/2
  assert.ok(Math.abs(q.width - 277.5) < 1e-9);
  assert.ok(Math.abs(q.height - 277.5) < 1e-9);
  assert.ok(Math.abs(q.left - 182.25) < 1e-9);
  assert.ok(Math.abs(q.top - 0) < 1e-9);
});

test("viewToQuad reproduces the measured cairn viewport", () => {
  const box = { width: 642, height: 277.5 };
  const view = { zoom: 242.257, pan: { x: -44091.4, y: -40039.9 } };
  const q = viewToQuad(view, box, 512, 512);
  const texel = q.width / 512;
  // Measured in the live card: left ≈ 59.94, texel ≈ 131.30.
  assert.ok(Math.abs(q.left - (-44091.4 + 242.257 * 182.25)) < 1e-9);
  assert.ok(Math.abs(texel - 242.257 * (277.5 / 512)) < 1e-9);
});

test("viewToQuad reproduces the v1 display-geometry case", () => {
  const q = viewToQuad(
    { zoom: 183.934, pan: { x: 78.5184, y: -42_274.7 } },
    { width: 355, height: 402.5 },
    512,
    512,
  );
  assert.ok(Math.abs(q.left - 78.5184) < 1e-9);
  assert.ok(Math.abs(q.width - 65_296.57) < 1e-6);
  const step = q.width / 512;
  assert.ok(Math.abs(q.left + step / 2 - 142.284581640625) < 1e-6);
});

test("computeSourceFit over viewToUvRect returns viewToQuad (inverse property)", () => {
  const cases = [
    { view: { zoom: 1, pan: { x: 0, y: 0 } }, box: { width: 642, height: 277.5 }, n: [512, 512] },
    { view: { zoom: 242.257, pan: { x: -44091.4, y: -40039.9 } }, box: { width: 642, height: 277.5 }, n: [512, 512] },
    { view: { zoom: 183.934, pan: { x: 78.5184, y: -42_274.7 } }, box: { width: 355, height: 402.5 }, n: [512, 512] },
    { view: { zoom: 250, pan: { x: -900_000, y: -120_000 } }, box: { width: 1920, height: 1080 }, n: [4096, 2160] },
    { view: { zoom: 0.4, pan: { x: 30, y: -10 } }, box: { width: 300, height: 700 }, n: [1000, 300] },
  ] as const;
  for (const c of cases) {
    const uv = viewToUvRect(c.view, c.box, c.n[0], c.n[1]);
    const quad = viewToQuad(c.view, c.box, c.n[0], c.n[1]);
    const sf = computeSourceFit({
      box: { left: 0, top: 0, width: c.box.width, height: c.box.height },
      naturalWidth: c.n[0],
      naturalHeight: c.n[1],
      sourceWindow: uv,
    });
    const rel = 1e-9 * Math.max(1, Math.abs(c.view.pan.x), Math.abs(c.view.pan.y));
    assert.ok(closeRel(sf.quadLeft, quad.left, rel), `left ${sf.quadLeft} vs ${quad.left}`);
    assert.ok(closeRel(sf.quadTop, quad.top, rel), `top ${sf.quadTop} vs ${quad.top}`);
    assert.ok(closeRel(sf.quadW, quad.width, rel), `w ${sf.quadW} vs ${quad.width}`);
    assert.ok(closeRel(sf.quadH, quad.height, rel), `h ${sf.quadH} vs ${quad.height}`);
    assert.ok(closeRel(sf.sxPerTexel, quad.width / c.n[0], rel));
    assert.ok(closeRel(screenPxPerTexel(uv, c.box, c.n[0], c.n[1]), quad.width / c.n[0], rel));
  }
});

test("viewToUvRect and viewToQuad reject degenerate boxes", () => {
  assert.deepEqual(viewToUvRect({ zoom: 1, pan: { x: 0, y: 0 } }, { width: 0, height: 10 }, 8, 4), { x: 0, y: 0, w: 1, h: 1 });
  assert.equal(viewToQuad({ zoom: 1, pan: { x: 0, y: 0 } }, { width: 0, height: 10 }, 8, 4), null);
  assert.equal(viewToQuad({ zoom: 1, pan: { x: 0, y: 0 } }, { width: 10, height: 10 }, 0, 4), null);
});

test("magnificationFilter: explicit pixelated/crisp-edges force nearest; auto uses the threshold", () => {
  assert.equal(magnificationFilter("pixelated", 1, 30), "nearest");
  assert.equal(magnificationFilter("crisp-edges", 1, 30), "nearest");
  assert.equal(magnificationFilter("auto", 29.99, 30), "linear");
  assert.equal(magnificationFilter("auto", 30, 30), "nearest");
  assert.equal(magnificationFilter("auto", 0, 30), "linear");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd ui && node --experimental-strip-types --test src/plots/image/components/region-select.test.ts`
Expected: FAIL, `viewToUvRect` is not exported.

- [ ] **Step 3: Implement in `region-select.ts`**

Append to `ui/src/plots/image/components/region-select.ts`:

```ts
import type { ImageViewState } from "../../../host/hooks/use-image-gestures";
import type { Interpolation } from "../../types";

/** A pane-local rect in CSS px (origin = the viewport element's top-left). */
export interface ViewportQuad {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * The user transform is `screen = pan + zoom * world` about the viewport's
 * top-left (the convention `useImageGestures`' wheel handler and
 * `reframeViewForResize` already use). World space is the object-contain home
 * fit of the full image into `box`: scale `S = min(W/N, H/M)`, letterbox
 * offset `L = (W - N*S)/2`, `T = (H - M*S)/2`. The image's on-screen rect is
 * therefore `left = pan.x + zoom*L`, `width = zoom*N*S`, and the same for y.
 * `viewToUvRect` is the inverse view of the same numbers: the source window
 * (in [0,1] image fractions) that the viewport box shows. `computeSourceFit`
 * over that window returns exactly this quad (see region-select.test.ts).
 */
export function viewToQuad(
  view: ImageViewState,
  box: { width: number; height: number },
  naturalW: number,
  naturalH: number,
): ViewportQuad | null {
  if (naturalW <= 0 || naturalH <= 0 || box.width <= 0 || box.height <= 0) return null;
  if (!Number.isFinite(view.zoom) || view.zoom <= 0) return null;
  if (!Number.isFinite(view.pan.x) || !Number.isFinite(view.pan.y)) return null;
  const f = computeFit({
    box: { left: 0, top: 0, width: box.width, height: box.height },
    naturalWidth: naturalW,
    naturalHeight: naturalH,
  });
  return {
    left: view.pan.x + view.zoom * f.imgLeft,
    top: view.pan.y + view.zoom * f.imgTop,
    width: view.zoom * naturalW * f.scale,
    height: view.zoom * naturalH * f.scale,
  };
}

/**
 * The source-space `[0,1]` window the viewport box displays under `view`
 * (the GPU sampler's uvRect; the overlay's `sourceWindow`). Derivation: at rest
 * `uv.x = -L/dispW`, `uv.w = W/dispW`; composing with `translate(pan)
 * scale(zoom)` about the origin gives `w = W/(z*dispW)`,
 * `x = -L/dispW - pan.x/(z*dispW)`. Degenerate input returns the whole image.
 */
export function viewToUvRect(
  view: ImageViewState,
  box: { width: number; height: number },
  naturalW: number,
  naturalH: number,
): SourceWindow {
  if (naturalW <= 0 || naturalH <= 0 || box.width <= 0 || box.height <= 0) {
    return { x: 0, y: 0, w: 1, h: 1 };
  }
  const f = computeFit({
    box: { left: 0, top: 0, width: box.width, height: box.height },
    naturalWidth: naturalW,
    naturalHeight: naturalH,
  });
  const dispW = naturalW * f.scale;
  const dispH = naturalH * f.scale;
  const z = Math.max(view.zoom, 1e-6);
  return {
    x: -f.imgLeft / dispW - view.pan.x / (z * dispW),
    y: -f.imgTop / dispH - view.pan.y / (z * dispH),
    w: box.width / (z * dispW),
    h: box.height / (z * dispH),
  };
}

/** Screen px covered by one source texel for the displayed `uv` window
 *  (the object-contain scale of that crop into `box`). 0 for degenerate input. */
export function screenPxPerTexel(
  uv: { w: number; h: number },
  box: { width: number; height: number },
  naturalW: number,
  naturalH: number,
): number {
  const visibleW = uv.w * naturalW;
  const visibleH = uv.h * naturalH;
  if (visibleW <= 0 || visibleH <= 0 || box.width <= 0 || box.height <= 0) return 0;
  return screenPerTexel({
    box: { left: 0, top: 0, width: box.width, height: box.height },
    naturalWidth: naturalW,
    naturalHeight: naturalH,
    sourceWindow: { x: 0, y: 0, w: uv.w, h: uv.h },
  });
}

export type MagnificationFilter = "nearest" | "linear";

/**
 * The one interpolation rule for both backends. An explicit `pixelated` /
 * `crisp-edges` forces nearest; `auto` switches to nearest once a source texel
 * covers `threshold` screen px (pass `PIXEL_VALUE_MIN_SCREEN_PX`, the same
 * point at which per-texel numbers appear), linear below it.
 */
export function magnificationFilter(
  interpolation: Interpolation,
  pxPerTexel: number,
  threshold: number,
): MagnificationFilter {
  if (interpolation === "pixelated" || interpolation === "crisp-edges") return "nearest";
  return pxPerTexel >= threshold ? "nearest" : "linear";
}
```

Put the two new `import type` lines at the top of the file with the existing import.

- [ ] **Step 4: Move the GPU view onto the shared functions**

In `ui/src/plots/image/webgpu/view.tsx`:
- Delete the `viewToUvRect` function (the block starting at the `/** Converts the CSS-px ... */` doc comment, lines 286-363) and the `screenPxPerTexel` function (lines 365-392).
- Change the import at line 86 to:
  `import { sourceTexelCenter, computeFit, screenPerTexel, viewToUvRect, screenPxPerTexel } from "../components/region-select";`
  then remove `computeFit` and `screenPerTexel` from that import if nothing else in the file uses them (grep; `computeFit` was only used inside the deleted `viewToUvRect`).
- Any other module importing `viewToUvRect` from `../webgpu/view` (grep `viewToUvRect` across `ui/src`; expected only the harness `plots/image/compare/__tests__/gpu-compare-split-numbers.browser.ts`) is re-pointed to `../components/region-select`.

- [ ] **Step 5: Run tests and typecheck**

Run: `cd ui && npm test && npm run typecheck`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add ui/src/plots/image/components/region-select.ts ui/src/plots/image/components/region-select.test.ts ui/src/plots/image/webgpu/view.tsx ui/src/plots/image/compare/__tests__/gpu-compare-split-numbers.browser.ts
git commit -m "Move viewport composition into the shared image geometry module"
```

---

### Task 2: `useImageViewport` hook

**Files:**
- Create: `ui/src/plots/image/components/image-viewport.ts` (pure derivation + types)
- Create: `ui/src/plots/image/components/image-viewport.test.ts`
- Create: `ui/src/plots/image/components/use-image-viewport.ts` (the React hook)

**Interfaces:**
- Consumes: Task 1 functions; `useDevicePixelRatio` from `host/hooks/use-device-pixel-ratio.ts`; `PIXEL_VALUE_MIN_SCREEN_PX` from `primitives/components/pixel-value-size.ts`.
- Produces:

```ts
export interface ImageViewport {
  readonly box: { readonly width: number; readonly height: number };      // fractional CSS px
  readonly backing: { readonly width: number; readonly height: number };  // device px
  readonly dpr: number;                          // backing.width / box.width
  readonly natural: { readonly w: number; readonly h: number };
  readonly uv: SourceWindow;
  readonly quad: ViewportQuad;
  readonly pxPerTexel: number;
  readonly filter: MagnificationFilter;
}
export function deriveImageViewport(input: {
  box: { width: number; height: number };
  backing: { width: number; height: number };
  view: ImageViewState;
  natural: { w: number; h: number } | null;
  interpolation: Interpolation;
}): ImageViewport | null;
export function clampBacking(w: number, h: number): { width: number; height: number };
export function useImageViewport(args: {
  viewportRef: RefObject<HTMLElement | null>;
  zoom: number;
  pan: { x: number; y: number };
  naturalDims: { w: number; h: number } | null;
  interpolation: Interpolation;
}): ImageViewport | null;
```

- [ ] **Step 1: Write the failing tests** (`image-viewport.test.ts`)

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveImageViewport, clampBacking } from "./image-viewport.ts";

test("deriveImageViewport is null until dims and a positive box exist", () => {
  assert.equal(deriveImageViewport({ box: { width: 0, height: 0 }, backing: { width: 0, height: 0 }, view: { zoom: 1, pan: { x: 0, y: 0 } }, natural: { w: 8, h: 4 }, interpolation: "auto" }), null);
  assert.equal(deriveImageViewport({ box: { width: 100, height: 50 }, backing: { width: 200, height: 100 }, view: { zoom: 1, pan: { x: 0, y: 0 } }, natural: null, interpolation: "auto" }), null);
});

test("deriveImageViewport composes quad, uv, texel size, filter and dpr", () => {
  const v = deriveImageViewport({
    box: { width: 642, height: 277.5 },
    backing: { width: 1284, height: 555 },
    view: { zoom: 242.257, pan: { x: -44091.4, y: -40039.9 } },
    natural: { w: 512, h: 512 },
    interpolation: "auto",
  })!;
  assert.ok(Math.abs(v.dpr - 2) < 1e-12);
  assert.ok(Math.abs(v.quad.left - (-44091.4 + 242.257 * 182.25)) < 1e-9);
  assert.ok(Math.abs(v.pxPerTexel - 242.257 * (277.5 / 512)) < 1e-9);
  assert.equal(v.filter, "nearest");
  assert.ok(Math.abs(v.uv.w - 642 / (242.257 * 277.5)) < 1e-12);
});

test("deriveImageViewport picks linear below the threshold and nearest for explicit pixelated", () => {
  const base = { box: { width: 640, height: 480 }, backing: { width: 640, height: 480 }, natural: { w: 512, h: 512 } };
  assert.equal(deriveImageViewport({ ...base, view: { zoom: 1, pan: { x: 0, y: 0 } }, interpolation: "auto" })!.filter, "linear");
  assert.equal(deriveImageViewport({ ...base, view: { zoom: 1, pan: { x: 0, y: 0 } }, interpolation: "pixelated" })!.filter, "nearest");
  assert.equal(deriveImageViewport({ ...base, view: { zoom: 40, pan: { x: 0, y: 0 } }, interpolation: "auto" })!.filter, "nearest");
});

test("clampBacking bounds each axis to 16384 and the area to 2^28", () => {
  assert.deepEqual(clampBacking(1284, 555), { width: 1284, height: 555 });
  assert.deepEqual(clampBacking(20000, 100), { width: 16384, height: 100 });
  const big = clampBacking(16384, 16384);
  assert.ok(big.width * big.height <= 2 ** 28);
  assert.deepEqual(clampBacking(0, 0), { width: 1, height: 1 });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd ui && node --experimental-strip-types --test src/plots/image/components/image-viewport.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `image-viewport.ts`**

```ts
import type { ImageViewState } from "../../../host/hooks/use-image-gestures";
import type { Interpolation } from "../../types";
import { PIXEL_VALUE_MIN_SCREEN_PX } from "../../../primitives/components/pixel-value-size";
import {
  magnificationFilter,
  screenPxPerTexel,
  viewToQuad,
  viewToUvRect,
  type MagnificationFilter,
  type SourceWindow,
  type ViewportQuad,
} from "./region-select.ts";

/** One pane's measured viewport plus everything derived from it. Immutable;
 *  a new object is produced only when an input changes. */
export interface ImageViewport {
  readonly box: { readonly width: number; readonly height: number };
  readonly backing: { readonly width: number; readonly height: number };
  readonly dpr: number;
  readonly natural: { readonly w: number; readonly h: number };
  readonly uv: SourceWindow;
  readonly quad: ViewportQuad;
  readonly pxPerTexel: number;
  readonly filter: MagnificationFilter;
}

export const MAX_BACKING_AXIS = 16384;
export const MAX_BACKING_AREA = 2 ** 28;

/** Clamp a device-pixel backing size to what a 2D canvas can allocate. */
export function clampBacking(w: number, h: number): { width: number; height: number } {
  let width = Math.max(1, Math.min(MAX_BACKING_AXIS, Math.round(w)));
  let height = Math.max(1, Math.min(MAX_BACKING_AXIS, Math.round(h)));
  if (width * height > MAX_BACKING_AREA) {
    const s = Math.sqrt(MAX_BACKING_AREA / (width * height));
    width = Math.max(1, Math.floor(width * s));
    height = Math.max(1, Math.floor(height * s));
  }
  return { width, height };
}

export function deriveImageViewport(input: {
  box: { width: number; height: number };
  backing: { width: number; height: number };
  view: ImageViewState;
  natural: { w: number; h: number } | null;
  interpolation: Interpolation;
}): ImageViewport | null {
  const { box, view, natural, interpolation } = input;
  if (!natural || box.width <= 0 || box.height <= 0) return null;
  const quad = viewToQuad(view, box, natural.w, natural.h);
  if (!quad) return null;
  const backing = clampBacking(input.backing.width, input.backing.height);
  const uv = viewToUvRect(view, box, natural.w, natural.h);
  const pxPerTexel = screenPxPerTexel(uv, box, natural.w, natural.h);
  return Object.freeze({
    box: Object.freeze({ width: box.width, height: box.height }),
    backing: Object.freeze(backing),
    dpr: backing.width / box.width,
    natural: Object.freeze({ w: natural.w, h: natural.h }),
    uv: Object.freeze(uv),
    quad: Object.freeze(quad),
    pxPerTexel,
    filter: magnificationFilter(interpolation, pxPerTexel, PIXEL_VALUE_MIN_SCREEN_PX),
  });
}
```

- [ ] **Step 4: Implement `use-image-viewport.ts`**

```ts
import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useDevicePixelRatio } from "../../../host/hooks/use-device-pixel-ratio";
import type { Interpolation } from "../../types";
import { deriveImageViewport, type ImageViewport } from "./image-viewport.ts";

interface Measured {
  box: { width: number; height: number };
  backing: { width: number; height: number };
}

function same(a: Measured | null, b: Measured): boolean {
  return !!a && a.box.width === b.box.width && a.box.height === b.box.height
    && a.backing.width === b.backing.width && a.backing.height === b.backing.height;
}

/**
 * The ONE measurement of an image pane's viewport element and the ONE
 * geometry derived from it (spec §3.2). Both backends call this with the
 * viewport ref the shell attaches; the result flows to the paint and, via the
 * shell's `viewport` prop, to every overlay. Exactly one ResizeObserver per
 * pane lives here. The device-pixel box is taken from
 * `devicePixelContentBoxSize` where the browser supports it (the snapped size
 * the browser will paint the element at), falling back to
 * `round(rect * devicePixelRatio)`.
 */
export function useImageViewport(args: {
  viewportRef: RefObject<HTMLElement | null>;
  zoom: number;
  pan: { x: number; y: number };
  naturalDims: { w: number; h: number } | null;
  interpolation: Interpolation;
}): ImageViewport | null {
  const { viewportRef, zoom, pan, naturalDims, interpolation } = args;
  const dpr = useDevicePixelRatio();
  const [measured, setMeasured] = useState<Measured | null>(null);
  const lastRef = useRef<Measured | null>(null);

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const apply = (next: Measured) => {
      if (same(lastRef.current, next)) return;
      lastRef.current = next;
      setMeasured(next);
    };
    const fallback = () => {
      const r = el.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      apply({
        box: { width: r.width, height: r.height },
        backing: { width: Math.round(r.width * ratio), height: Math.round(r.height * ratio) },
      });
    };
    fallback(); // synchronous first measure so the first commit can paint
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (!entry) return;
      const cr = entry.contentRect;
      const dp = entry.devicePixelContentBoxSize?.[0];
      if (dp) {
        apply({
          box: { width: cr.width, height: cr.height },
          backing: { width: dp.inlineSize, height: dp.blockSize },
        });
      } else {
        fallback();
      }
    });
    try {
      ro.observe(el, { box: "device-pixel-content-box" });
    } catch {
      ro.observe(el);
    }
    return () => ro.disconnect();
  }, [viewportRef, dpr]);

  const nw = naturalDims?.w ?? 0;
  const nh = naturalDims?.h ?? 0;
  return useMemo(
    () => measured
      ? deriveImageViewport({
          box: measured.box,
          backing: measured.backing,
          view: { zoom, pan: { x: pan.x, y: pan.y } },
          natural: nw > 0 && nh > 0 ? { w: nw, h: nh } : null,
          interpolation,
        })
      : null,
    [measured, zoom, pan.x, pan.y, nw, nh, interpolation],
  );
}
```

Note on `dpr` in the effect deps: a DPR change re-runs the effect, which re-measures (the fallback path) and re-observes; the `device-pixel-content-box` path also fires on its own.

- [ ] **Step 5: Run tests and typecheck**

Run: `cd ui && npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add ui/src/plots/image/components/image-viewport.ts ui/src/plots/image/components/image-viewport.test.ts ui/src/plots/image/components/use-image-viewport.ts
git commit -m "Add the shared image viewport hook"
```

---

### Task 3: `ImageOverlay` becomes a viewport canvas layer

**Files:**
- Create: `ui/src/plots/image/components/image-overlay-placement.ts` (pure box placement)
- Create: `ui/src/plots/image/components/image-overlay-placement.test.ts`
- Modify: `ui/src/plots/image/components/ImageOverlay.tsx` (rewrite)

**Interfaces:**
- Consumes: `ImageViewport` from Task 2; `OverlayBox`, `ImageOverlayData`, `ImageOverlaySettings`, `overlayClassColor` from `plots/types.ts`.
- Produces:
  - `placeBox(box: OverlayBox, quad: ViewportQuad, natural: {w,h}): { left, top, width, height }` (CSS px, pane-local)
  - `ImageOverlay` props become `{ data, settings, viewport: ImageViewport }`; keeps `data-image-overlay=""` on its root.

- [ ] **Step 1: Write the failing test** (`image-overlay-placement.test.ts`)

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { placeBox } from "./image-overlay-placement.ts";

const quad = { left: 10, top: 20, width: 200, height: 100 };
const natural = { w: 100, h: 50 };

test("placeBox maps a fraction-domain box onto the quad", () => {
  const r = placeBox({ position: { minX: 0.25, minY: 0.5, maxX: 0.75, maxY: 1 }, class_id: 1 }, quad, natural);
  assert.deepEqual(r, { left: 60, top: 70, width: 100, height: 50 });
});

test("placeBox maps a pixel-domain box through the texel size", () => {
  const r = placeBox({ position: { minX: 10, minY: 5, maxX: 20, maxY: 25 }, domain: "pixel", class_id: 1 }, quad, natural);
  assert.deepEqual(r, { left: 30, top: 30, width: 20, height: 40 });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd ui && node --experimental-strip-types --test src/plots/image/components/image-overlay-placement.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `image-overlay-placement.ts`**

```ts
import type { OverlayBox } from "../../types";
import type { ViewportQuad } from "./region-select.ts";

/** A detection box's pane-local rect (CSS px) on the current viewport quad. */
export function placeBox(
  box: OverlayBox,
  quad: ViewportQuad,
  natural: { w: number; h: number },
): { left: number; top: number; width: number; height: number } {
  const fx = box.domain === "pixel" ? quad.width / natural.w : quad.width;
  const fy = box.domain === "pixel" ? quad.height / natural.h : quad.height;
  const left = quad.left + box.position.minX * fx;
  const top = quad.top + box.position.minY * fy;
  return {
    left,
    top,
    width: (box.position.maxX - box.position.minX) * fx,
    height: (box.position.maxY - box.position.minY) * fy,
  };
}
```

- [ ] **Step 4: Rewrite `ImageOverlay.tsx`**

Keep the mask decode logic (the `useEffect` that decodes each mask PNG and colorizes it into a native-resolution canvas) but hold that canvas in a ref that is NOT in the DOM (`useRef<HTMLCanvasElement>(document.createElement("canvas"))`, created lazily). Replace the rendered tree with one drawing canvas plus HTML label chips:

```tsx
export interface ImageOverlayProps {
  data: ImageOverlayData;
  settings: ImageOverlaySettings;
  viewport: ImageViewport;
}

export default function ImageOverlay({ data, settings, viewport }: ImageOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskSourceRef = useRef<HTMLCanvasElement | null>(null);
  const [maskVersion, setMaskVersion] = useState(0);
  const hidden = useMemo(() => new Set(settings.hiddenClasses), [settings.hiddenClasses]);
  const { natural, quad, backing, dpr } = viewport;

  // Mask decode (unchanged math): writes into maskSourceRef (offscreen) and
  // bumps maskVersion when done. Keyed on masks / natural dims / hidden classes.
  // ... existing decode effect body, targeting `maskSourceRef.current` (create
  // it with document.createElement("canvas") on first use), ending with
  // `setMaskVersion((v) => v + 1)` instead of `ctx.putImageData` into a DOM canvas.

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (canvas.width !== backing.width || canvas.height !== backing.height) {
      canvas.width = backing.width;
      canvas.height = backing.height;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const sx = backing.width / viewport.box.width;
    const sy = backing.height / viewport.box.height;
    const showMasks = settings.showMasks && !!data.masks && data.masks.length > 0;
    if (showMasks && maskSourceRef.current) {
      ctx.globalAlpha = settings.maskOpacity;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(maskSourceRef.current, quad.left * sx, quad.top * sy, quad.width * sx, quad.height * sy);
      ctx.globalAlpha = 1;
    }
    const boxes = data.boxes ?? [];
    if (settings.showBoxes && boxes.length > 0) {
      ctx.lineWidth = 2 * dpr;
      for (const box of boxes) {
        if (!boxVisible(box, settings, hidden)) continue;
        const r = placeBox(box, quad, natural);
        ctx.strokeStyle = overlayClassColor(box.class_id);
        ctx.strokeRect(r.left * sx, r.top * sy, r.width * sx, r.height * sy);
      }
    }
  }, [viewport, data, settings, hidden, maskVersion, natural, quad, backing, dpr]);

  const boxes = data.boxes ?? [];
  const classLabels = data.class_labels ?? {};
  return (
    <div data-image-overlay="" className="absolute inset-0 pointer-events-none overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" aria-hidden />
      {settings.showBoxes && boxes.map((box, i) => {
        if (!boxVisible(box, settings, hidden)) return null;
        const r = placeBox(box, quad, natural);
        const name = box.label ?? classLabels[String(box.class_id)] ?? `#${box.class_id}`;
        const scoreTxt = box.score != null ? ` ${(box.score * 100).toFixed(0)}%` : "";
        if (!name && !scoreTxt) return null;
        return (
          <span key={i} className="absolute whitespace-nowrap rounded px-1 text-[10px] leading-tight text-white"
            style={{ left: r.left, top: r.top, transform: "translateY(-100%)", backgroundColor: overlayClassColor(box.class_id) }}>
            <span className="mono">{name}{scoreTxt}</span>
          </span>
        );
      })}
    </div>
  );
}
```

Delete the `useContainerSize` import and the `rect` memo; `computeFit` is no longer imported here.

- [ ] **Step 5: Run tests and typecheck**

Run: `cd ui && npm test && npm run typecheck`
Expected: unit tests PASS; typecheck FAILS only in the three callers of `ImageOverlay` (`cpu/view.tsx` x2, `webgpu/view.tsx`) because the props changed. That is expected; Tasks 4 and 5 fix them. Do not commit yet unless typecheck is green: proceed to Task 4 and commit Tasks 3-5 together at the end of Task 5.

---

### Task 4: Shell with one viewport element, `viewport` prop, overlays on `ImageViewport`, GPU wiring

**Files:**
- Modify: `ui/src/plots/image/components/ImagePaneShell.tsx`
- Modify: `ui/src/primitives/components/PixelValueOverlay.tsx`
- Modify: `ui/src/plots/image/webgpu/view.tsx`
- Modify: `ui/src/plots/image/components/pixel-overlay-stacking.test.ts` (only if its string probes change; check after the edit)

**Interfaces:**
- Consumes: `ImageViewport`, `useImageViewport` (Task 2); `ImageOverlay` (Task 3).
- Produces (the new shell contract):

```ts
export type ImagePaneOverlaySpec =
  | {
      readonly sample: PixelSampler;
      readonly version: number;
      readonly onActiveChange?: (active: boolean) => void;
      readonly onSampleDemandChange?: (demanded: boolean) => void;
    }
  | { readonly render: (ctx: ImagePaneOverlayContext) => ReactNode };

export interface ImagePaneShellProps {
  paneAttrs: PaneDataAttrs;
  surfaceAttrs: PaneDataAttrs;
  toolbar: boolean;
  /** The single measured viewport element: gestures, controller, reframe, hook, overlays. */
  viewportRef: RefObject<HTMLDivElement>;
  viewport: ImageViewport | null;
  zoom: number;
  pan: { x: number; y: number };
  onViewChange?: (v: ImageViewState) => void;
  naturalDims: { w: number; h: number } | null;
  /** The pane's presentation canvas (+ split divider). Rendered `absolute inset-0` inside the viewport. */
  surface: ReactNode;
  overlay: ImagePaneOverlaySpec;
  /** Detection boxes/masks (both backends); the shell renders `ImageOverlay`. */
  imageOverlay?: { data: ImageOverlayData; settings: ImageOverlaySettings };
  notationSeed: PixelValueNotation;
  exportCanvasRef?: RefObject<HTMLCanvasElement | null>;
  requestRender: () => void;
  // ... toolbar/menus/sliders/regionSelect/enlargeControl/histogram/chips props unchanged
}
```

  and `PixelValueOverlay` props:

```ts
export interface PixelValueOverlayProps {
  viewport: ImageViewport;
  sample: PixelSampler;
  notation?: PixelValueNotation;
  version?: number;
  onActiveChange?: (active: boolean) => void;
  onSampleDemandChange?: (demanded: boolean) => void;
  /** Sampled grid when it differs from the framing dims (compare foreground side). */
  sourceDims?: { w: number; h: number };
}
```

- [ ] **Step 1: Rewrite `PixelValueOverlay`'s geometry and sizing**

In `PixelValueOverlay.tsx`:
- Replace props `imageElRef`, `naturalWidth`, `naturalHeight`, `zoom`, `pan`, `sourceWindow`, `displayGeometry` with `viewport: ImageViewport` (import type from `../../plots/image/components/image-viewport`). Keep `sample`, `notation`, `version`, `onActiveChange`, `onSampleDemandChange`, `sourceDims`.
- In `draw()`:
  - Replace the `cssW/cssH = canvas.clientWidth/Height` block and the `canvas.width = round(cssW*dpr)` sizing with:
    ```ts
    const { box, backing } = viewport;
    if (canvas.width !== backing.width) canvas.width = backing.width;
    if (canvas.height !== backing.height) canvas.height = backing.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(backing.width / box.width, 0, 0, backing.height / box.height, 0, 0);
    ctx.clearRect(0, 0, box.width, box.height);
    const cssW = box.width, cssH = box.height;
    ```
  - Replace the `imgEl`/`getBoundingClientRect`/`computeSourceFit` block with:
    ```ts
    const gridW = sourceDims?.w ?? viewport.natural.w;
    const gridH = sourceDims?.h ?? viewport.natural.h;
    const quadLeft = viewport.quad.left, quadTop = viewport.quad.top;
    const quadW = viewport.quad.width, quadH = viewport.quad.height;
    const sxPerTexel = quadW / gridW, syPerTexel = quadH / gridH;
    const visibleW = gridW, visibleH = gridH;
    ```
    and keep everything after (`cellScale`, the visible-window clip, passes 1 and 2, `pixelValueClipRect` with `{left: quadLeft, top: quadTop, right: quadLeft + quadW, bottom: quadTop + quadH}`) unchanged.
  - Delete the `useDevicePixelRatio` import and the `ResizeObserver` effect (`useEffect(() => { const ro = new ResizeObserver(...)`). The layout effect deps become `[draw, viewport, version, notation, sourceDims]`.
  - Delete the imports of `computeSourceFit`/`ScreenToTexelParams`.
- Add `data-pixel-value-overlay=""` to the rendered `<canvas>`.
- Keep the re-export of `PIXEL_VALUE_MIN_SCREEN_PX` and all formatting helpers.

- [ ] **Step 2: Rewrite the shell's viewport structure**

In `ImagePaneShell.tsx`:
- Props: delete `paneRef`, `wrapperRef`, `checkerboard`, `wrapperClassName`, `wrapperStyle`, `viewportPadding`, `header`, `showAxes`, `overlayNode`; add `viewportRef`, `viewport`, `imageOverlay`; make `requestRender` required. Update the module doc block accordingly (remove the axes/wrapper/transform paragraphs).
- Replace every `paneRef` use (`useImageGestures({containerRef: paneRef ...})`, `useReframeViewportOnResize({containerRef: paneRef ...})`, `useImageController({rootRef: paneRef ...})`, the `paneW` measurement) with `viewportRef`. Delete the `paneW` ResizeObserver effect and derive `paneW` from `viewport?.box.width ?? 0` (the info-panel auto rule).
- Delete the `PixelAxes` import and its render.
- `trackHistCursor`: replace the `getBoundingClientRect`/`screenToTexel` body with
  ```ts
  if (!infoOpen || !histogramAvailable || !viewport) return;
  const r = viewportRef.current?.getBoundingClientRect();
  if (!r) return;
  const x = e.clientX - r.left, y = e.clientY - r.top;
  const px = Math.floor((x - viewport.quad.left) / viewport.quad.width * viewport.natural.w);
  const py = Math.floor((y - viewport.quad.top) / viewport.quad.height * viewport.natural.h);
  ```
  (one `getBoundingClientRect` on pointer move is acceptable; it is not per frame).
- Render tree (replacing lines 711-775):
  ```tsx
  <div className={`relative isolate flex flex-col h-full${toolbar ? " group" : ""}`} {...paneAttrs}>
    {toolbar && <PlotToolbar controller={controller} config={toolbarConfig} />}
    <div className="relative flex-1 min-h-0 min-w-0 p-1">
      <div
        ref={viewportRef}
        className="relative w-full h-full overflow-hidden rounded cairn-checkerboard"
        style={viewportProps.style}
        data-cairn-view-zoom={zoom}
        data-cairn-view-pan={`${pan.x},${pan.y}`}
        onPointerDown={viewportProps.onPointerDown}
        onPointerMove={(e) => { viewportProps.onPointerMove?.(e); trackHistCursor(e); }}
        onPointerUp={viewportProps.onPointerUp}
        onPointerCancel={viewportProps.onPointerCancel}
        onPointerLeave={() => setHistCursor((prev) => (prev === null ? prev : null))}
        onDoubleClick={resetView}
        {...surfaceAttrs}
      >
        {surface}
        {viewport && imageOverlay && (
          <ImageOverlay data={imageOverlay.data} settings={imageOverlay.settings} viewport={viewport} />
        )}
        {pixelOverlay}
        {!toolbar && overlayActive && <PixelNotationToggle notation={notation} onChange={setNotation} />}
        {regionActive && regionSelect && singleOverlay && viewport && (
          <RegionSelectLayer viewport={viewport} onQueryLive={...} onSelect={...} onExit={...} />
        )}
        {!regionActive && regionSelect?.rect && singleOverlay && viewport && (
          <RegionRectOverlay rect={regionSelect.rect} viewport={viewport} onQueryLive={...} onCommit={...} onRemove={...} />
        )}
        {infoOpen && histogram && singleOverlay && naturalDims && (<ImageInfoPanel ... />)}
      </div>
    </div>
    {showLabelChip && <LabelChip ... />}
    {extraChips}
  </div>
  ```
  The `p-1` wrapper is the 4 px inset outside the viewport (spec §3.3). `pixelOverlay` becomes:
  ```tsx
  const pixelOverlay = "render" in overlay
    ? overlay.render({ notation, setOverlayActive })
    : viewport ? (
        <PixelValueOverlay viewport={viewport} sample={overlay.sample} notation={notation} version={overlay.version}
          onActiveChange={(a) => { setOverlayActive(a); overlay.onActiveChange?.(a); }}
          onSampleDemandChange={overlay.onSampleDemandChange} />
      ) : null;
  ```
- `RegionSelectLayer`: props become `{ viewport, onQueryLive, onSelect, onExit }`. `bandToTexel` maps client points to pane-local via the layer's own rect (`layerRef.current.getBoundingClientRect()`, the layer is `absolute inset-0` of the viewport) and calls `screenRectToTexelRect(ax, ay, bx, by, { box: { left: layerBox.left + viewport.quad.left, top: layerBox.top + viewport.quad.top, width: viewport.quad.width, height: viewport.quad.height }, naturalWidth: viewport.natural.w, naturalHeight: viewport.natural.h })`. Delete the `imageElRef`/`sourceWindow`/`displayGeometry` props and branches.
- `RegionRectOverlay`: props become `{ rect, viewport, onQueryLive, onCommit, onRemove }`. The `box` is computed synchronously in the render body (no layout effect, no ResizeObserver): `texelRectToScreenRect(activeRect, { box: { left: viewport.quad.left, top: viewport.quad.top, width: viewport.quad.width, height: viewport.quad.height }, naturalWidth: viewport.natural.w, naturalHeight: viewport.natural.h })` gives pane-local coordinates directly. In `onDragMove`, `scale = viewport.pxPerTexel`.
- Delete the `screenToTexel`/`screenPerTexel` imports that are no longer used.

- [ ] **Step 3: Wire the GPU view to the hook and the new shell contract**

In `webgpu/view.tsx`:
- Replace `paneRef` and `imgWrapperRef` with one `viewportRef = useRef<HTMLDivElement>(null)`.
- Add `const viewport = useImageViewport({ viewportRef, zoom, pan, naturalDims, interpolation: props.interpolation ?? "auto" })` near the other hooks (after `naturalDims` state exists).
- Delete: the `containerTick` state and its ResizeObserver effect (lines 1061-1067); `overlayWindow` state and `setOverlayWindow`; the `useDevicePixelRatio` call if only the render pass used it.
- In `renderPass`: replace the `measureEl/wrapBox/rawUv/handle.resize/filter` block with
  ```ts
  if (!viewport) return false;
  const uv = viewport.uv;
  handle.resize(viewport.backing.width, viewport.backing.height);
  const filter = viewport.filter;
  ```
  and add `viewport` to the `renderPass` `useCallback` deps (replacing `zoom, pan.x, pan.y, dpr, containerTick`) and to the effect that invokes it.
- Delete `imgRendering` (the CSS `image-rendering` style on the canvas) and the `showAxes` variable.
- Shell call: pass `viewportRef`, `viewport`, `surface` (the canvas now `className="absolute inset-0 w-full h-full block" data-gpu-image-canvas` plus the divider), `imageOverlay={overlay && overlaySettings?.enabled && ((overlay.boxes?.length ?? 0) > 0 || (overlay.masks?.length ?? 0) > 0) ? { data: overlay, settings: overlaySettings } : undefined}`, `requestRender={() => { renderPass(); }}`; drop `paneRef`, `wrapperRef`, `checkerboard`, `wrapperClassName`, `viewportPadding`, `showAxes`, `overlayNode`.
- The compositor per-side overlays (`overlay.render` branch) become `<PixelValueOverlay viewport={viewport} sourceDims={naturalDims} sample={samplePixel} .../>` and `<PixelValueOverlay viewport={viewport} sourceDims={refDims} sample={sampleForeground} .../>` inside the same clip-path divs; the single-image branch becomes `{ sample: diffMode ? sampleDiffPixel : samplePixel, version: ..., onSampleDemandChange: setDiffOverlayDemanded }`. Guard the render branch with `viewport &&`.

- [ ] **Step 4: Typecheck**

Run: `cd ui && npm run typecheck`
Expected: errors remain ONLY in `ui/src/plots/image/cpu/view.tsx` (and any test importing deleted shell props). Proceed to Task 5.

---

### Task 5: CPU backend: content hook, processing pass, viewport paint, single-shell split

**Files:**
- Create: `ui/src/plots/image/cpu/processing.ts` + `processing.test.ts`
- Create: `ui/src/plots/image/cpu/paint.ts` + `paint.test.ts`
- Create: `ui/src/plots/image/cpu/use-cpu-content.ts`
- Modify: `ui/src/plots/image/cpu/view.tsx` (major rewrite)
- Delete: `ui/src/plots/image/cpu/display-geometry.ts`, `display-geometry.test.ts`, `ui/src/plots/image/components/interp-auto.ts`, `interp-auto.test.ts`
- Modify: `ui/src/plots/image/compare/post-processing.tsx` (delete file; see Step 6)

**Interfaces:**
- Consumes: `ImageViewport`, `useImageViewport`; `applyDisplayAdjust1` from `runtime/tonemap.ts`; `getCachedImageData/setCachedImageData` from `resources/cache.ts`; `loadImageData`; existing `tonemapToImageData`, `sdrTransferToImageData`, `computeDiff`, `webglRenderDiffToCanvas`, `applyColormap`.
- Produces:

```ts
// processing.ts
export function applyProcessingToImageData(src: ImageData, p: ImageProcessing): ImageData; // returns src when identity
export function isIdentityProcessing(p: ImageProcessing): boolean;

// paint.ts
export interface PaintSource { bitmap: CanvasImageSource; width: number; height: number }
export function visibleTexelWindow(quad: ViewportQuad, box: {width,height}, grid: {w,h}): { x0, y0, x1, y1 } | null;
export function paintViewport(ctx: CanvasRenderingContext2D, viewport: ImageViewport, source: PaintSource,
  opts?: { clipFraction?: [number, number]; grid?: { w: number; h: number } }): void;

// use-cpu-content.ts
export interface CpuContent { source: PaintSource | null; version: number; dims: {w,h} | null; foreground?: PaintSource | null; foregroundDims?: {w,h} | null }
```

- [ ] **Step 1: `processing.ts` with tests**

Test (`processing.test.ts`):

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyProcessingToImageData, isIdentityProcessing } from "./processing.ts";

const IDENTITY = { brightness: 0, contrast: 0, gamma: 1, exposure: 0, offset: 0, flipSign: false };
const px = (r: number, g: number, b: number, a = 255) => ({ data: new Uint8ClampedArray([r, g, b, a]), width: 1, height: 1 } as ImageData);

test("identity processing returns the same object", () => {
  const src = px(10, 20, 30);
  assert.equal(isIdentityProcessing(IDENTITY), true);
  assert.equal(applyProcessingToImageData(src, IDENTITY), src);
});

test("brightness, contrast and flipSign follow applyDisplayAdjust1", () => {
  const out = applyProcessingToImageData(px(128, 128, 128), { ...IDENTITY, brightness: 0.5 });
  assert.equal(out.data[0], 192); // 128/255*1.5 = 0.7529 -> 192
  const inv = applyProcessingToImageData(px(0, 255, 100), { ...IDENTITY, flipSign: true });
  assert.deepEqual([...inv.data.slice(0, 3)], [255, 0, 155]);
  const con = applyProcessingToImageData(px(255, 0, 128), { ...IDENTITY, contrast: 1 });
  assert.deepEqual([...con.data.slice(0, 3)], [255, 0, 128]); // (x-0.5)*2+0.5 clamps at the ends, 128 stays ~128
});

test("gamma and offset follow feComponentTransfer gamma (amplitude 1, exponent 1/gamma)", () => {
  const out = applyProcessingToImageData(px(64, 64, 64), { ...IDENTITY, gamma: 2, offset: 0.1 });
  const expected = Math.round(255 * (Math.pow(64 / 255, 1 / 2) + 0.1));
  assert.equal(out.data[0], expected);
  assert.equal(out.data[3], 255);
});
```

Implementation (`processing.ts`):

```ts
import type { ImageProcessing } from "../../types";
import { applyDisplayAdjust1 } from "../runtime/tonemap";

/** True when the block is a no-op. `exposure`/`offset` here are legacy slots
 *  (lifted top-level on the unified path); they are still honoured for
 *  completeness so an authored block renders as before. */
export function isIdentityProcessing(p: ImageProcessing): boolean {
  return p.brightness === 0 && p.contrast === 0 && p.gamma === 1 && p.exposure === 0 && p.offset === 0 && !p.flipSign;
}

/**
 * The display-space `processing` block as a per-pixel pass on 8-bit sRGB
 * pixels, replacing the CSS/SVG filter chain (`url(#gamma) brightness()
 * contrast() invert()`) with the same math the GPU shader applies
 * (`cairnDisplayAdjust`, ported from `applyDisplayAdjust1`), plus the SVG
 * `feComponentTransfer type="gamma"` stage (amplitude 1, exponent 1/gamma,
 * offset) that CSS has no function for. Order matches the old filter list:
 * gamma/offset first, then brightness (with 2^exposure folded in), contrast,
 * invert. Alpha passes through.
 */
export function applyProcessingToImageData(src: ImageData, p: ImageProcessing): ImageData {
  if (isIdentityProcessing(p)) return src;
  const out = new Uint8ClampedArray(src.data.length);
  const d = src.data;
  const adjust = { brightness: (1 + p.brightness) * Math.pow(2, p.exposure) - 1, contrast: p.contrast, flipSign: p.flipSign };
  const exponent = 1 / p.gamma;
  const lut = new Float64Array(256);
  for (let i = 0; i < 256; i++) {
    let v = i / 255;
    if (p.gamma !== 1 || p.offset !== 0) v = Math.pow(v, exponent) + p.offset;
    lut[i] = 255 * applyDisplayAdjust1(v, adjust);
  }
  for (let i = 0; i < d.length; i += 4) {
    out[i] = lut[d[i]!]!;
    out[i + 1] = lut[d[i + 1]!]!;
    out[i + 2] = lut[d[i + 2]!]!;
    out[i + 3] = d[i + 3]!;
  }
  return new ImageData(out, src.width, src.height);
}
```

Note: `Uint8ClampedArray` assignment rounds and clamps, matching the CSS rasterization clamp. Node has no `ImageData` global: in the test, construct plain objects as shown and, in `processing.ts`, build the result with `new ImageData(...)` only when the global exists, otherwise return `{ data: out, width, height } as ImageData` (add a tiny `makeImageData` helper in the same file).

- [ ] **Step 2: `paint.ts` with tests**

Test (`paint.test.ts`) covers the pure window function and the paint against a recording context:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { visibleTexelWindow, paintViewport } from "./paint.ts";
import { deriveImageViewport } from "../components/image-viewport.ts";

test("visibleTexelWindow clips to the texels intersecting the box", () => {
  const quad = { left: -437.83, top: -380.37, width: 1517.66, height: 1011.77 }; // 12x8 grid, ~126.5 px texels
  const w = visibleTexelWindow(quad, { width: 642, height: 250 }, { w: 12, h: 8 })!;
  assert.deepEqual(w, { x0: 3, y0: 3, x1: 9, y1: 5 });
  assert.equal(visibleTexelWindow({ left: 1000, top: 0, width: 10, height: 10 }, { width: 100, height: 100 }, { w: 2, h: 2 }), null);
});

test("paintViewport issues one drawImage with integer source texels and device-px destination", () => {
  const viewport = deriveImageViewport({
    box: { width: 642, height: 277.5 }, backing: { width: 1284, height: 555 },
    view: { zoom: 242.257, pan: { x: -44091.4, y: -40039.9 } }, natural: { w: 512, h: 512 }, interpolation: "auto",
  })!;
  const calls: unknown[][] = [];
  const ctx = {
    imageSmoothingEnabled: true, imageSmoothingQuality: "low",
    setTransform: (...a: unknown[]) => calls.push(["setTransform", ...a]),
    clearRect: (...a: unknown[]) => calls.push(["clearRect", ...a]),
    save: () => calls.push(["save"]), restore: () => calls.push(["restore"]),
    beginPath: () => {}, rect: (...a: unknown[]) => calls.push(["rect", ...a]), clip: () => calls.push(["clip"]),
    drawImage: (...a: unknown[]) => calls.push(["drawImage", ...a]),
  } as unknown as CanvasRenderingContext2D;
  paintViewport(ctx, viewport, { bitmap: {} as CanvasImageSource, width: 512, height: 512 });
  const draw = calls.find((c) => c[0] === "drawImage")!;
  const [, , sx, sy, sw, sh, dx, dy, dw, dh] = draw as [string, unknown, number, number, number, number, number, number, number, number];
  assert.ok(Number.isInteger(sx) && Number.isInteger(sy) && Number.isInteger(sw) && Number.isInteger(sh));
  assert.ok(Math.abs(dx - (viewport.quad.left + sx * viewport.pxPerTexel) * 2) < 1e-6);
  assert.ok(dw <= 1284 + 2 * viewport.pxPerTexel * 2 + 1);
  assert.equal(ctx.imageSmoothingEnabled, false); // nearest at this zoom
  assert.equal(calls.filter((c) => c[0] === "drawImage").length, 1);
});
```

Implementation (`paint.ts`):

```ts
import type { ImageViewport } from "../components/image-viewport.ts";
import type { ViewportQuad } from "../components/region-select.ts";

export interface PaintSource {
  bitmap: CanvasImageSource;
  width: number;
  height: number;
}

/** Integer texel window of `grid` intersecting `box` when the full image
 *  occupies `quad` (pane CSS px). Null when nothing is visible. */
export function visibleTexelWindow(
  quad: ViewportQuad,
  box: { width: number; height: number },
  grid: { w: number; h: number },
): { x0: number; y0: number; x1: number; y1: number } | null {
  const sx = quad.width / grid.w;
  const sy = quad.height / grid.h;
  const x0 = Math.max(0, Math.floor(-quad.left / sx));
  const y0 = Math.max(0, Math.floor(-quad.top / sy));
  const x1 = Math.min(grid.w, Math.ceil((box.width - quad.left) / sx));
  const y1 = Math.min(grid.h, Math.ceil((box.height - quad.top) / sy));
  if (x1 <= x0 || y1 <= y0) return null;
  return { x0, y0, x1, y1 };
}

/**
 * Paint `source` into a presentation canvas whose backing store is
 * `viewport.backing`. Identity transform, destination in device pixels computed
 * in doubles, source rect on integer texels clipped to the visible window (so
 * Skia's float32 destination rects never see a 30M-px quad). `grid` lets a
 * foreground of a different resolution fill the same quad (compare split);
 * `clipFraction` restricts the paint to a horizontal band of the box.
 */
export function paintViewport(
  ctx: CanvasRenderingContext2D,
  viewport: ImageViewport,
  source: PaintSource,
  opts: { clipFraction?: [number, number]; grid?: { w: number; h: number }; clear?: boolean } = {},
): void {
  const { quad, box, backing, filter } = viewport;
  const grid = opts.grid ?? { w: source.width, h: source.height };
  const sx = backing.width / box.width;
  const sy = backing.height / box.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (opts.clear !== false) ctx.clearRect(0, 0, backing.width, backing.height);
  const win = visibleTexelWindow(quad, box, grid);
  if (!win) return;
  ctx.imageSmoothingEnabled = filter === "linear";
  ctx.imageSmoothingQuality = "high";
  const tx = quad.width / grid.w;
  const ty = quad.height / grid.h;
  ctx.save();
  if (opts.clipFraction) {
    const [a, b] = opts.clipFraction;
    ctx.beginPath();
    ctx.rect(a * backing.width, 0, (b - a) * backing.width, backing.height);
    ctx.clip();
  }
  ctx.drawImage(
    source.bitmap,
    win.x0, win.y0, win.x1 - win.x0, win.y1 - win.y0,
    (quad.left + win.x0 * tx) * sx, (quad.top + win.y0 * ty) * sy,
    (win.x1 - win.x0) * tx * sx, (win.y1 - win.y0) * ty * sy,
  );
  ctx.restore();
}
```

- [ ] **Step 3: `use-cpu-content.ts`**

This hook is the former effects of `CpuSdrImagePane` / `CpuHdrImagePane` with their outputs redirected into `ImageBitmap`s and a version counter. Signature:

```ts
export interface CpuContentInput {
  kind: "sdr" | "hdr";
  // sdr
  imageUrl?: string | null;
  baselineUrl?: string | null;
  isBaseline?: boolean;
  diffMode?: DiffMode | "none";
  processing?: ImageProcessing;
  sdrTransfer?: DisplayCurveId;
  // hdr
  hdr?: FloatImageData;
  tonemapOp?: DisplayCurveId;
  // shared display params (scalars only)
  colormap: Colormap | null;
  tonemapGamma: number;
  effectiveExposure: number;
  effectiveOffset: number;
  effectiveReduce: ReduceMode;
  colorBounds: readonly [number, number] | null;
  boundsEngaged?: boolean;
}
export interface CpuContent {
  source: PaintSource | null;
  version: number;              // bumps when `source` changes
  dims: { w: number; h: number } | null;
  status: "ready" | "loading" | "empty";
  statusText?: string;          // "computing diff…" etc. for the shell placeholder
}
export function useCpuContent(input: CpuContentInput): CpuContent;
```

Rules (copy the bodies from `cpu/view.tsx` lines 617-687 (false-color), 698-729 (transfer), 783-877 (diff), 1282-1329 (HDR tone-map), 739-756 (raw decode stays in the view for sampling)):
- Each pipeline's effect keeps exactly its current dependency list (scalars + content identity). It produces an `ImageData` (existing functions), applies `applyProcessingToImageData` for SDR, then obtains a bitmap via a shared helper:
  ```ts
  async function bitmapFor(key: string, produce: () => Promise<ImageData | null>): Promise<PaintSource | null>
  ```
  which consults `getCachedImageData(key)` first, calls `produce()` on a miss, stores the ImageData with `setCachedImageData`, and returns `{ bitmap: await createImageBitmap(imageData), width, height }`. Bitmaps are memoized per key in a module-level `createLruMap<PaintSource>(50)` (from `resources/lru-map.ts`) and `close()`d on eviction.
- The WebGL diff path (`webglRenderDiffToCanvas`) renders into an offscreen `document.createElement("canvas")`; use that canvas directly as the bitmap (`{ bitmap: canvas, width, height }`) after it succeeds.
- On every successful pipeline completion: `setState({ source, dims, status: "ready" }); setVersion(v => v + 1)`. On input change before completion: `status: "loading"` but `source` is left as the previous value (hold the previous frame).
- No `getImageData` on the produced bitmaps; the raw decode for label sampling stays in the view (`valueDataRef` via `loadImageData`, which reads back its own throwaway canvas as today).

- [ ] **Step 4: Rewrite `cpu/view.tsx`**

Keep: the module doc (updated), `tonemapToImageData`, `sdrTransferToImageData`, the settings/encoding plumbing of both branches (`usePaneEncoding`, `changeX` callbacks, toolbar menus/sliders), `samplePixel`, `histogramSource`, `useDeepFlatten`, `cpuCompareChrome`, `useCpuCompareMetrics`, `useCpuComparisonInput`, `cpuCompareModeMenu`, `CpuMetricsChip`, the `data-cpu-comparison-result` attribute.

Delete: `useCpuDisplayPresentation`, all `surfaceStyle`/`imgRendering`/`displayGeometry` code, the four DOM surfaces and `setCanvasEl/setFalseColorEl/setTransferEl/setImgEl/displayElRef`, the `useGammaFilter`/`GammaFilterSvg` usage and `header`, `CpuSplitComparePane`, `PixelAxes`/`showAxes`, `wrapperRef`, and the imports of `interp-auto`, `display-geometry`, `post-processing`, `PixelAxes`.

Add a shared presentation component used by both branches:

```tsx
function CpuPresentation({
  content, viewport, canvasRef, foreground, split,
}: {
  content: CpuContent;
  viewport: ImageViewport | null;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  /** Split compare: the foreground source drawn right of the divider on the reference quad. */
  foreground?: CpuContent;
  split?: number;
}) {
  const appliedRef = useRef<{ width: number; height: number } | null>(null);
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !viewport) return;
    const { backing } = viewport;
    if (!appliedRef.current || appliedRef.current.width !== backing.width || appliedRef.current.height !== backing.height) {
      canvas.width = backing.width;
      canvas.height = backing.height;
      appliedRef.current = { width: backing.width, height: backing.height };
    }
    if (!content.source) return; // hold the previous frame
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (foreground?.source && split != null) {
      paintViewport(ctx, viewport, content.source, { clipFraction: [0, split] });
      paintViewport(ctx, viewport, foreground.source, { clipFraction: [split, 1], grid: { w: foreground.source.width, h: foreground.source.height }, clear: false });
    } else {
      paintViewport(ctx, viewport, content.source);
    }
  }, [viewport, content.source, content.version, foreground?.source, foreground?.version, split, canvasRef]);
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" data-cpu-image-canvas="" aria-hidden />;
}
```

Each branch:

```tsx
const viewportRef = useRef<HTMLDivElement>(null);
const canvasRef = useRef<HTMLCanvasElement | null>(null);
const content = useCpuContent({...});                 // dims come from here
const viewport = useImageViewport({ viewportRef, zoom, pan, naturalDims: content.dims, interpolation });
const requestRender = useCallback(() => { /* paint is synchronous in the layout effect; nothing to do */ }, []);
...
<ImagePaneShell
  paneAttrs={...} surfaceAttrs={{ "data-cpu-image-surface": "" }} toolbar={toolbar}
  viewportRef={viewportRef} viewport={viewport} zoom={zoom} pan={pan} onViewChange={onViewChange}
  naturalDims={content.dims}
  surface={<>
    <CpuPresentation content={content} viewport={viewport} canvasRef={canvasRef} />
    {content.status === "loading" && content.statusText && (
      <span className="absolute inset-0 flex items-center justify-center text-xs text-fg-muted motion-safe:animate-pulse">{content.statusText}</span>
    )}
  </>}
  overlay={{ sample: samplePixel, version: pixelDataVersion, }}
  imageOverlay={overlay && overlaySettings?.enabled && ((overlay.boxes?.length ?? 0) > 0 || (overlay.masks?.length ?? 0) > 0) ? { data: overlay, settings: overlaySettings } : undefined}
  notationSeed={pixelValueNotation}
  exportCanvasRef={canvasRef}
  requestRender={requestRender}
  ... (menus, sliders, reset, chips as before)
/>
```

Split compare (`compareSource.mode === "split"`) is handled INSIDE the same pane: `CpuImagePane` computes `content` for `source` and `foregroundContent` for `compareSource.b` (a second `useCpuContent` call with the same display params), passes both to `CpuPresentation` with `split={compareSource.splitPosition ?? 0.5}`, renders the `SplitDivider` inside `surface` after the canvas, and supplies `overlay={{ render: ({notation, setOverlayActive}) => viewport && (<>
  <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ clipPath: `inset(0 ${(1 - split) * 100}% 0 0)` }}><PixelValueOverlay viewport={viewport} sample={samplePixel} notation={notation} version={pixelDataVersion} /></div>
  <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ clipPath: `inset(0 0 0 ${split * 100}%)` }}><PixelValueOverlay viewport={viewport} sourceDims={foregroundContent.dims ?? undefined} sample={sampleForeground} notation={notation} version={foregroundPixelVersion} onActiveChange={setOverlayActive} /></div>
</>) }}`. `sampleForeground` reads the foreground's raw buffer (decode it with `loadImageData` for uint8, or the float pixels for float, exactly as `samplePixel` does for the primary). `useSplitFlipKeys(viewportRef, "split", ...)` moves into this branch. The split divider's `onChange` and the compare chrome/menus are reused from `cpuCompareChrome`/`cpuCompareModeMenu`. Mismatched resolutions use the reference quad with the foreground's own grid, matching the GPU compositor.

- [ ] **Step 5: Delete replaced modules**

```bash
git rm ui/src/plots/image/cpu/display-geometry.ts ui/src/plots/image/cpu/display-geometry.test.ts ui/src/plots/image/components/interp-auto.ts ui/src/plots/image/components/interp-auto.test.ts
```

- [ ] **Step 6: Delete `post-processing.tsx`**

`ui/src/plots/image/compare/post-processing.tsx` (`buildProcessingFilterList`, `useGammaFilter`, `GammaFilterSvg`) has no consumer after this task and Task 7. Grep for `post-processing` and `useGammaFilter`; the compositor's use goes in Task 7. If Task 7 has not run yet, leave the file and delete it in Task 7.

- [ ] **Step 7: Run tests and typecheck**

Run: `cd ui && npm test && npm run typecheck`
Expected: PASS (both). If `pixel-overlay-stacking.test.ts` fails on its `isolate` probe (it greps the shell/compositor source text for `isolate` and the overlay's `z-10`), adjust its probe to the new shell root string.

- [ ] **Step 8: Quick browser sanity check**

Run: `cd ui && npm run test:harness -- --only pane-enlarge` and `--only pane-histogram` (both self-driving, CPU-based).
Expected: PASS.

- [ ] **Step 9: Commit (spans Tasks 3, 4, 5)**

```bash
git add -A ui/src
git commit -m "Paint CPU images through the shared viewport geometry"
```

---

### Task 6: Remove the image pixel axes end to end

**Files:**
- Delete: `ui/src/primitives/components/PixelAxes.tsx`
- Modify: `ui/src/primitives/components/index.ts` (drop the export)
- Modify: `ui/src/plots/image/runtime/contracts.ts:85,163,365,470,503`; `runtime/presentation.ts:28`; `runtime/comparison-plan.ts:56`; `runtime/view.tsx:107`; `runtime/host-adapter.tsx:307` (comment); `compare/compare-settings.ts:90`; `runtime/compare-compositor.tsx:702,774,899,1020`
- Modify: `ui/src/public/builder/builders.ts:96,119,157`
- Modify: `packages/python/src/cairn_plot/components.py` (lines 748, 754, 775-776, 858, 867, 904-905, 988, 1034, 1120, 1167, 1173, 1230, 1996, 2038)
- Modify: `docs/API.md:132,506`
- Modify: `tests/test_toolbar_host_seam.py:65-69`

- [ ] **Step 1: Write the failing Python test**

Append to `tests/test_toolbar_host_seam.py`:

```python
def test_image_show_axes_is_gone() -> None:
    with pytest.raises(TypeError):
        cp.Image(_sdr(), show_axes=True)  # type: ignore[call-arg]
    with pytest.raises(TypeError):
        cp.Compare(cp.Image(_sdr()), cp.Image(_sdr()), show_axes=True)  # type: ignore[call-arg]
```

and change `test_image_sdr_toolbar_coexists_with_display_props` to `cp.Image(_sdr(), toolbar=False, colormap="turbo")` with the `showAxes` assert removed.

- [ ] **Step 2: Run to verify failure**

Run: `uv run pytest tests/test_toolbar_host_seam.py -q`
Expected: the new test FAILS (no TypeError).

- [ ] **Step 3: Remove from Python**

In `components.py`: remove the `show_axes` parameter and its `if show_axes is not None: props["showAxes"] = ...` in `_image_display_props` (748-776) and `_image_hdr_props` (858-905); remove the `show_axes` parameter and every `show_axes=show_axes` pass-through in `Image.__init__` (1034, 1120, 1173, 1230) and `Compare.__init__` (1996, 2038); edit the docstrings at 754, 867, 988 and the warning string at 1167 to drop `showAxes`. Do not touch lines 1328-1746 (3D classes).

- [ ] **Step 4: Remove from TypeScript**

Delete `showAxes` at each listed TS location; delete `PixelAxes.tsx` and its export; in `builders.ts` remove `showAxes` from the destructuring and both `if (showAxes != null)` lines.

- [ ] **Step 5: Docs**

`docs/API.md:132`: drop `showAxes` from the `cairnPlot.image` option list. `docs/API.md:506`: change the row to `| Interpolation / notation | interpolation / pixelValueNotation | read straight from props | — |`.

- [ ] **Step 6: Verify**

Run: `cd ui && npm test && npm run typecheck && cd .. && uv run pytest tests/ -q`
Expected: PASS. Also `grep -rn "showAxes\|PixelAxes" ui/src packages/python docs` returns nothing outside `ui/src/plots/three/**` (which uses `showAxes` for 3D).

- [ ] **Step 7: Commit**

```bash
git add -A ui/src packages/python docs/API.md tests/test_toolbar_host_seam.py
git commit -m "Remove the image viewer pixel axes"
```

---

### Task 7: Slim the compare compositor

**Files:**
- Modify: `ui/src/plots/image/runtime/compare-compositor.tsx`
- Modify: `ui/src/plots/image/compare/index.ts:82-89`
- Modify: `ui/src/plots/image/compare/split-divider.test.ts:49`, `ui/src/primitives/components/label-chip.test.ts:58,106`, `ui/src/primitives/components/ref-badge.test.ts:57`, `ui/src/primitives/components/pane-unavailable.test.ts:39`
- Delete: `ui/src/plots/image/compare/post-processing.tsx` (if still present)
- Modify doc comments naming `MediaComparePane`: `ui/src/layout/natural-size.ts:27`, `ui/src/primitives/components/LabelChip.tsx:5`, `ui/src/plots/image/compare/SplitDivider.tsx:3`, `ui/src/plots/image/compare/compare-captions.ts:4`, `ui/src/plots/image/compare/use-split-flip-keys.ts:10,45,50`, `ui/src/plots/image/compare/cross-type-align.ts:10`, `ui/src/primitives/components/PaneUnavailable.tsx:10`

- [ ] **Step 1: Update the source-text tests first**

In `split-divider.test.ts`, `label-chip.test.ts`, `ref-badge.test.ts`: replace the `compare-compositor.tsx` consumer entry with `plots/image/cpu/view.tsx`. In `pane-unavailable.test.ts`: drop the compositor from `CONSUMERS`. Run `cd ui && npm test`; these now FAIL against the current compositor only if the compositor was the sole consumer; either way they pass once Step 2 lands.

- [ ] **Step 2: Rewrite `CompositeMediaPane`**

Keep `resolveGpuImagePane`, `useGpuCompareReadyTick`, `compareFloatToDecoded`, `CompositeMediaPaneProps` (minus `showAxes`), the viewport-store wiring (lines 821-833), and `CrossTypeCompositeMediaPane`. Replace the body of `CompositeMediaPane` from the `hasBaseline` gate onward with:

```tsx
const Pane: ImageBackendView = resolveGpuImagePane() ?? CpuImagePane;
const foreground = imageFloat ? compareFloatToDecoded(imageFloat) : urlSource(imageUrl!);
if (!hasBaseline || effectiveMode === "normal") {
  return <Pane source={foreground} toolbar={toolbar} interpolation={interpolation} processing={processing}
    zoom={zoom} pan={pan} onViewChange={onViewChange} label={foregroundLabel ?? label}
    pixelValueNotation={pixelValueNotation} syncedSettings={settings} setSyncedSettings={setSettings} />;
}
const reference = baselineFloat ? compareFloatToDecoded(baselineFloat) : urlSource(baselineUrl!);
return <Pane source={reference} compareSource={compareSourceFor(effectiveMode, foreground, /* existing builder at 859-887 */)}
  toolbar={toolbar} interpolation={interpolation} processing={processing} zoom={zoom} pan={pan}
  onViewChange={onViewChange} label="" pixelValueNotation={pixelValueNotation}
  syncedSettings={settings} setSyncedSettings={setSettings} />;
```

using the exact `compareSource` object the GPU branch already constructs (lines 859-887) so both backends receive the same contract. Delete `MediaComparePane`, `MediaComparePaneProps`, `CpuFloatComparePane`, `floatSourceToDataUrl`, `CompareCpuNotice`, `isEngineOnlyDiff`, `CompareFloatUnsupportedError`, `DEFAULT_PROCESSING`, and every now-unused import.

- [ ] **Step 3: Barrel and comments**

`compare/index.ts`: drop `MediaComparePane`, `MediaComparePaneProps`, `CompareFloatUnsupportedError`. Update the seven doc comments to name `CpuImagePane`'s split instead.

- [ ] **Step 4: Verify**

Run: `cd ui && npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A ui/src
git commit -m "Slim the compare compositor to a backend adapter"
```

---

### Task 8: Harness runner fix, DPR override, alignment and gesture-cost harnesses

**Files:**
- Modify: `ui/scripts/test-harness.mjs:104-106` (parity filter) and the navigation block near line 505 (DPR override)
- Create: `ui/src/plots/image/cpu/__tests__/cpu-label-alignment.browser.html`, `.browser.ts`
- Create: `ui/src/plots/image/cpu/__tests__/cpu-gesture-cost.browser.html`, `.browser.ts`
- Create: `ui/src/plots/image/cpu/__tests__/harness-style.css` (copy of `ui/src/plots/image/compare/__tests__/harness-style.css`)

- [ ] **Step 1: Fix the parity filter**

In `test-harness.mjs` line 105 change `"/engine/__tests__/"` to `"/webgpu/__tests__/"`. Run `cd ui && npm run test:harness` once; expect the WebGPU parity pages to appear in the run list (they may SKIP LOUDLY without an adapter; that is the runner's documented behaviour).

- [ ] **Step 2: Add the DPR override**

In `discoverHarnesses`, parse `data-cairn-harness-dpr="2"` into `dpr: number | null` on the harness record. Before `Page.navigate` (line 505), when `h.dpr` is set:
```js
await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: h.dpr, mobile: false }, sessionId);
```
and `Emulation.clearDeviceMetricsOverride` after the page settles. Document the attribute in the runner header comment next to `data-cairn-harness-query`.

- [ ] **Step 3: Alignment harness**

`cpu-label-alignment.browser.html` (self-driving, `data-cairn-harness-dpr="2"`): the standard skeleton with one host `<div id="host">`. `cpu-label-alignment.browser.ts`:

```ts
import { createRoot } from "react-dom/client";
import { createElement as h, useState } from "react";
import CpuImagePane from "../view.tsx";
import type { ImageViewState } from "../../../../host/hooks/use-image-gestures";
import { createHarness, waitFor } from "../../../../testing/harness";
import { viewToQuad } from "../../components/region-select.ts";

const { report, setOverallStatus } = createHarness({ title: "CPU-LABEL-ALIGNMENT" });
(window as unknown as { __cairnPlotRenderMode?: string }).__cairnPlotRenderMode = "cpu";

/** 512x512 PNG whose texel colour encodes its index: R = x & 255, G = y & 255, B = (x >> 8) * 16 + (y >> 8). */
function indexImageUrl(n = 512): string {
  const c = document.createElement("canvas");
  c.width = n; c.height = n;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(n, n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = (y * n + x) * 4;
    img.data[i] = x & 255; img.data[i + 1] = y & 255; img.data[i + 2] = (x >> 8) * 16 + (y >> 8); img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL("image/png");
}

/** Device-px positions where the painted colour changes along one scanline. */
function edges(data: Uint8ClampedArray, length: number, stride: number, channel: number): number[] {
  const out: number[] = [];
  for (let i = 1; i < length; i++) {
    if (data[i * stride + 3]! < 128 || data[(i - 1) * stride + 3]! < 128) continue;
    if (data[i * stride + channel] !== data[(i - 1) * stride + channel]) out.push(i);
  }
  return out;
}

/** Midpoints of ink clusters along an axis of the label canvas (alpha > 0 runs separated by ≥ gap px). */
function inkMidpoints(sums: Float64Array, gap: number): number[] {
  const out: number[] = []; let s = -1, last = -1;
  for (let i = 0; i < sums.length; i++) {
    if (sums[i]! > 0) { if (s < 0) s = i; last = i; }
    else if (s >= 0 && i - last > gap) { out.push((s + last) / 2); s = -1; }
  }
  if (s >= 0) out.push((s + last) / 2);
  return out;
}

async function measure(hostW: number, hostH: number, view: ImageViewState): Promise<{ maxErr: number; pitchErr: number; cells: number }> {
  const host = document.getElementById("host")!;
  host.style.cssText = `width:${hostW}px;height:${hostH}px;position:relative;background:#222`;
  const control: { set: (v: ImageViewState) => void } = { set: () => {} };
  function H() {
    const [v, setV] = useState<ImageViewState>({ zoom: 1, pan: { x: 0, y: 0 } });
    control.set = setV;
    return h(CpuImagePane, { source: { dtype: "uint8", url: indexImageUrl() }, zoom: v.zoom, pan: v.pan, onViewChange: setV, label: "", toolbar: false });
  }
  const root = createRoot(host);
  root.render(h(H));
  const ok = await waitFor(() => !!host.querySelector("canvas[data-cpu-image-canvas]") && !!host.querySelector("[data-pixel-value-overlay]"), 6000, 20);
  if (!ok) throw new Error("pane did not mount");
  control.set(view);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const paint = host.querySelector<HTMLCanvasElement>("canvas[data-cpu-image-canvas]")!;
  const labels = host.querySelector<HTMLCanvasElement>("canvas[data-pixel-value-overlay]")!;
  const viewportEl = host.querySelector<HTMLElement>("[data-cpu-image-surface]")!;
  const box = viewportEl.getBoundingClientRect();
  const dpr = paint.width / box.width;
  const pctx = paint.getContext("2d")!;
  const midRow = Math.floor(paint.height / 2), midCol = Math.floor(paint.width / 2);
  const row = pctx.getImageData(0, midRow, paint.width, 1).data;
  const col = pctx.getImageData(midCol, 0, 1, paint.height).data;
  const xEdges = edges(row, paint.width, 4, 0);      // R changes per texel column
  const yEdges = edges(col, paint.height, 4, 1);     // G changes per texel row
  const lctx = labels.getContext("2d")!;
  const L = lctx.getImageData(0, 0, labels.width, labels.height).data;
  const colSum = new Float64Array(labels.width), rowSum = new Float64Array(labels.height);
  for (let y = 0; y < labels.height; y++) for (let x = 0; x < labels.width; x++) {
    if (L[(y * labels.width + x) * 4 + 3]! > 128) { colSum[x]! += 1; rowSum[y]! += 1; }
  }
  const quad = viewToQuad(view, { width: box.width, height: box.height }, 512, 512)!;
  const pitch = quad.width / 512 * dpr;
  const xMids = inkMidpoints(colSum, 8 * dpr), yMids = inkMidpoints(rowSum, 6 * dpr);
  let maxErr = 0, cells = 0;
  const check = (mids: number[], edg: number[]) => {
    for (let i = 0; i + 1 < edg.length; i++) {
      const center = (edg[i]! + edg[i + 1]!) / 2;
      const m = mids.reduce((best, v) => Math.abs(v - center) < Math.abs(best - center) ? v : best, Infinity);
      if (!Number.isFinite(m)) continue;
      maxErr = Math.max(maxErr, Math.abs(m - center) / dpr); cells++;
    }
  };
  check(xMids, xEdges); check(yMids, yEdges);
  let pitchErr = 0;
  for (let i = 0; i + 1 < xEdges.length; i++) pitchErr = Math.max(pitchErr, Math.abs(xEdges[i + 1]! - xEdges[i]! - pitch) / dpr);
  root.unmount();
  return { maxErr, pitchErr, cells };
}

async function run(): Promise<boolean> {
  let ok = true;
  const cases: [number, number, ImageViewState][] = [
    [642, 277.5, { zoom: 242.257, pan: { x: -44091.4, y: -40039.9 } }],
    [355, 402.5, { zoom: 183.934, pan: { x: 78.5184, y: -42274.7 } }],
    [500, 333.3, { zoom: 120, pan: { x: -20000, y: -15000.25 } }],
    [800, 601.5, { zoom: 64, pan: { x: -9000.5, y: -12000 } }],
  ];
  for (const [w, hgt, view] of cases) {
    const r = await measure(w, hgt, view);
    const pass = r.cells >= 2 && r.maxErr <= 1 && r.pitchErr <= 1;
    report(pass, `${w}x${hgt} zoom ${view.zoom}: ${r.cells} cells, label-vs-texel max ${r.maxErr.toFixed(2)} px, pitch err ${r.pitchErr.toFixed(2)} px`);
    ok = ok && pass;
  }
  return ok;
}
run().then(setOverallStatus).catch((e) => { report(false, String(e)); setOverallStatus(false); });
```

The GPU variant: the same `measure` with `GpuImagePane` from `../../webgpu/view.tsx` and `canvas[data-gpu-image-canvas]`, guarded by `navigator.gpu` (report a loud SKIP line and do not fail when absent). Note: the pitch tolerance is 1 px rather than the spec's 0.05 px because edge detection on the hardware nearest sampler is quantized to 1/256 texel; the pitch check still pins `viewToQuad` to the paint.

- [ ] **Step 4: Gesture-cost harness**

`cpu-gesture-cost.browser.ts` (self-driving): mount two `CpuImagePane`s (a 4096x4096 uint8 data-URL made from a canvas, and a 2048x2048 float `{dtype:"float", pixels, shape:[2048,2048,3]}`), wrap prototypes before the gesture:

```ts
const counts = { put: 0, draw: 0, widthSets: 0, observe: 0, decode: 0 };
const P = CanvasRenderingContext2D.prototype;
const origPut = P.putImageData; P.putImageData = function (...a) { counts.put++; return origPut.apply(this, a as never); } as typeof P.putImageData;
const origDraw = P.drawImage; P.drawImage = function (...a) { if ((this.canvas as HTMLCanvasElement).dataset?.cpuImageCanvas !== undefined) counts.draw++; return origDraw.apply(this, a as never); } as typeof P.drawImage;
const wdesc = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, "width")!;
Object.defineProperty(HTMLCanvasElement.prototype, "width", { ...wdesc, set(v: number) { if (this.dataset?.cpuImageCanvas !== undefined) counts.widthSets++; wdesc.set!.call(this, v); } });
const origObserve = ResizeObserver.prototype.observe; ResizeObserver.prototype.observe = function (...a) { counts.observe++; return origObserve.apply(this, a as never); };
```

Then: 60 `wheel` events with `ctrlKey` (one per rAF) and 120 `pointermove` events under a captured `pointerdown`, counting frames with a parallel rAF loop; then a 30-step loop that sets `host.style.width` and awaits two frames per step. Assert: `counts.put === 0`, `counts.decode === 0` (spy `loadImageData` via a module-level counter exported for tests, or spy `HTMLImageElement.prototype.decode`), `counts.draw <= frames + 2` during gestures, `widthSets === 0` during gestures and `widthSets === 30` (±2 for coalesced frames) during the resize loop, `counts.observe === 0` after the initial mount. Report the mean/max rAF interval as diagnostic lines only. Restore all prototypes at the end.

- [ ] **Step 5: Run**

Run: `cd ui && npm run test:harness -- --only cpu-label-alignment && npm run test:harness -- --only cpu-gesture-cost`
Expected: PASS for both.

- [ ] **Step 6: Commit**

```bash
git add ui/scripts/test-harness.mjs ui/src/plots/image/cpu/__tests__
git commit -m "Add CPU alignment and gesture-cost harnesses; run WebGPU parity proofs again"
```

---

### Task 9: Update existing harnesses to the new DOM

**Files (line references from the review):**
- `ui/src/public/__tests__/public-host.browser.ts:43-44,66-67,90-91,107-124`
- `ui/src/plots/image/compare/__tests__/cpu-compare-fallback.browser.ts` (rewrite cases 1-6)
- `ui/src/testing/browser/renderers/selection-stage.browser.ts:255-263,299-302,513-544`
- `ui/src/testing/browser/renderers/page-wide-selection.browser.ts:145-146`
- `ui/src/testing/browser/renderers/content-aspect-frame.browser.ts:81-83`
- `ui/src/testing/browser/renderers/engine-fallback.browser.ts:146-154,240-242`
- `ui/src/layout/stack/__tests__/grid-stacked.browser.ts:26-29,223-260,326-361,400-413`

- [ ] **Step 1: Shared replacements**

- "an image pane rendered" probes `img[src^='data:image/png']` → `[data-cpu-image-pane] canvas[data-cpu-image-canvas]` (count the same way).
- "the pane is zoomed" probes `style.transform` containing `scale(` → read `Number(viewportEl.dataset.cairnViewZoom)` on `[data-cpu-image-surface]` (and `dataset.cairnViewPan`), compare before/after and between panes A and B.
- Pixel checks on a native canvas → `getImageData(Math.floor(canvas.width/2), Math.floor(canvas.height/2), 1, 1)` on the presentation canvas (the centre lies inside the quad at home view).
- `canvas.width === 8` in `cpu-compare-fallback` case 6 → assert `!!result.querySelector("canvas[data-cpu-image-canvas]")` and the centre pixel is magenta.
- `cpu-compare-fallback` cases 1-4: float diff → wait for `[data-cpu-comparison-result]`; float split and uint8 split → wait for one `[data-cpu-image-pane]` containing two `[data-pixel-value-overlay]` canvases (the per-side overlays) and a `[data-cairn-split-divider]`/`SplitDivider` element (use the divider's existing selector; grep `SplitDivider.tsx` for its `data-` attribute); assert no `[data-cairn-compare-cpu-notice]` exists. The `putImageData` repaint assertion becomes the prototype spy from Task 8 (count across the whole document during 8 wheel events; expect 0).

- [ ] **Step 2: Run the default set**

Run: `cd ui && npm run test:harness && npm run test:harness:public`
Expected: PASS. Then the human-run ones touched here: `npm run test:harness -- --all --only engine-fallback`.

- [ ] **Step 3: Commit**

```bash
git add -A ui/src
git commit -m "Update browser harnesses to the viewport canvas DOM"
```

---

### Task 10: Docs, bundle, checks

**Files:**
- Modify: `docs/design.md` ("Image rendering" section), `docs/architecture.md` (Plot cells paragraph on image slots if it mentions the transform), `docs/API.md` (image runtime section), `docs/plot-type-authoring.md` image layout block (mention `components/` holds the shared geometry)
- Regenerate: `ui/dist/plot-inline/*`, `packages/python/src/cairn_plot/_assets/plot-inline/*`

- [ ] **Step 1: Docs**

In `docs/design.md` "Image rendering", add one bullet: "both backends share one measured viewport and one geometry object (`components/region-select.ts`, `use-image-viewport.ts`); the CPU backend paints into a device-pixel canvas, never through a CSS transform, because layout snapping is magnified by zoom." Remove any mention of pixel axes.

- [ ] **Step 2: Build and sync**

Run: `cd ui && npm run check:plot-schema && npm run check:plot-boundary && npm run build:plot-inline && npm run check:plot-bundles && npm run sync:plot-assets && npm run check:plot-assets && npm run smoke:plot && npm run smoke:js`
Expected: all PASS.

- [ ] **Step 3: Python**

Run: `uv run pytest tests/ -q`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add docs ui/dist packages/python/src/cairn_plot/_assets
git commit -m "Document the shared image viewport model and sync bundles"
```

---

### Task 11: cairn rollout and live verification

**Files (in /Users/doeringc/workspace/cairn):**
- `vendor/cairn-plot` (submodule pointer)
- `tests/unit/test_plot_components.py:250-269,485-488` (drop `show_axes` on `cp.Image`)
- `cairn/ui/dist/**` (rebuilt by hand)

- [ ] **Step 1: Bump and build**

```bash
cd /Users/doeringc/workspace/cairn
git -C vendor/cairn-plot fetch origin && git -C vendor/cairn-plot checkout <cairn-plot2 branch sha>
cd cairn/ui && npm run typecheck && npm run build && cd ../..
uv run pytest tests/unit/test_plot_components.py tests/unit/test_ui_cairn_plot_card_contract.py -q
```

- [ ] **Step 2: Live verification (user's setup)**

```bash
uv run cairn ui --repo cairn://fermat:4300 --no-webgpu --port 4302 --no-open-browser
```

In Chrome: open project `glints4`, run `783d44796945860ff6b181d63aac2edf`, card `eval.error`; zoom to the earlier state and run the centroid measurement (label centroids vs painted edges within 1 px); open and close the card's settings modal; drag a column-span resize with six image cards visible and watch for jank; scrub the step slider; select a pane and confirm the outline.

- [ ] **Step 3: Commit in cairn only after the user confirms**

The cairn commit ("Ship viewport-canvas CPU images") bumps the submodule, stages `cairn/ui/dist`, and updates the two tests. Do not commit until the user has seen the live result.
