# Pixel-Value Overlay Gesture Cost Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the TEV-style number overlay cheap per frame: no blurred shadow, cached formatted samples, blit-and-strip pans, budgeted crisp redraws on zoom, all pinned by a self-driving harness.

**Architecture:** The overlay stays one shared canvas primitive with the same props. A new pure module holds the cell window, the sample cache, the pan-shift test and the halo draw. The component adds an offscreen raster of the last crisp draw and decides per frame between blit-and-strip, crisp redraw, or (over budget) a scaled blit with a settle redraw. Neither backend changes.

**Tech Stack:** TypeScript, React, canvas 2D, node:test (`--experimental-strip-types`), the parity-harness runner (`node scripts/test-harness.mjs --only <id>`), all from `ui/`.

**Spec:** `docs/superpowers/specs/2026-09-04-pixel-value-overlay-cost-design.md`

## Global Constraints

- `shadowBlur` must never be set to a non-zero value anywhere in the overlay's per-frame path.
- `PixelValueOverlay` props are unchanged: `viewport`, `sample`, `notation`, `version`, `onActiveChange`, `onSampleDemandChange`, `sourceDims`.
- Geometry comes only from `ImageViewport` (`box`, `backing`, `quad`, `natural`); no element measurement.
- Labels must keep landing within 1 px of texel centres: `cpu-label-alignment` and `cpu-label-alignment-dpr1` must pass after every task.
- No backend file changes (`plots/image/cpu/**`, `plots/image/webgpu/**`) except the alignment harness under `cpu/__tests__/`.
- Commit trailers: every commit ends with
  `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and
  `Claude-Session: https://claude.ai/code/session_018R6F9Ys9R5Htmq6K7oL6gf`.

---

### Task 1: Pure raster module

**Files:**
- Create: `ui/src/primitives/components/pixel-value-raster.ts`
- Create: `ui/src/primitives/components/pixel-value-raster.test.ts`

**Interfaces:**
- Consumes: `ImageViewport`, `ViewportQuad` from `../../plots/image/components/image-viewport.ts`; `PixelSample`, `PixelSampler`, `PixelValueNotation` from `./PixelValueOverlay.tsx` (types only; move `PixelSample`/`PixelSampler` type exports into this module and re-export them from `PixelValueOverlay.tsx` so the module does not import the component); `pixelValueClipRect`, `pixelValueNumbersVisible`, `PIXEL_VALUE_LINE_H_FRAC` from `./pixel-value-size.ts`.
- Produces (used by Tasks 2–4):
  ```ts
  export interface CellWindow { x0: number; x1: number; y0: number; y1: number; sxPerTexel: number; syPerTexel: number; cellScale: number }
  export function visibleCellWindow(viewport: Pick<ImageViewport, "box" | "quad">, grid: { w: number; h: number }): CellWindow | null;
  export class LabelCache { constructor(); key(sample: PixelSampler, notation: PixelValueNotation, version: number, gridW: number): void; get(px: number, py: number): PixelSample | null; readonly size: number }
  export interface RasterKey { backing: { width: number; height: number }; quad: ViewportQuad; grid: { w: number; h: number }; notation: PixelValueNotation; version: number; fontH: number }
  export function panShift(prev: RasterKey, next: RasterKey, dpr: number): { dx: number; dy: number } | null;
  export const LABEL_HALO_WIDTH_FRAC = 0.15;
  export const LABEL_HALO_COLOR = "rgba(0,0,0,0.9)";
  export function drawLabels(ctx: CanvasRenderingContext2D, win: CellWindow, viewport: Pick<ImageViewport, "box" | "backing" | "quad">, cells: Iterable<LabelCell>, fontH: number): void;
  export interface LabelCell { px: number; py: number; s: PixelSample }
  ```

- [ ] **Step 1: Write the failing tests**

`ui/src/primitives/components/pixel-value-raster.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { LabelCache, panShift, visibleCellWindow, type RasterKey } from "./pixel-value-raster.ts";

const quad = (left: number, top: number, width: number, height: number) => ({ left, top, width, height });

test("visibleCellWindow covers exactly the texels under the box", () => {
  // 100x50 image shown at 4 css px per texel, origin at (-40, 10): columns 10.. and rows 0..
  const win = visibleCellWindow({ box: { width: 200, height: 100 }, quad: quad(-40, 10, 400, 200) }, { w: 100, h: 50 });
  assert.ok(win);
  assert.equal(win.sxPerTexel, 4);
  assert.equal(win.syPerTexel, 4);
  assert.equal(win.cellScale, 4);
  assert.deepEqual([win.x0, win.x1, win.y0, win.y1], [10, 60, 0, 23]);
});

test("visibleCellWindow is null for an empty box or grid", () => {
  assert.equal(visibleCellWindow({ box: { width: 0, height: 100 }, quad: quad(0, 0, 400, 200) }, { w: 100, h: 50 }), null);
  assert.equal(visibleCellWindow({ box: { width: 200, height: 100 }, quad: quad(0, 0, 400, 200) }, { w: 0, h: 50 }), null);
  // quad entirely left of the box
  assert.equal(visibleCellWindow({ box: { width: 200, height: 100 }, quad: quad(-500, 0, 400, 200) }, { w: 100, h: 50 }), null);
});

test("LabelCache memoises per cell and clears on key change", () => {
  let calls = 0;
  const sample = (px: number, py: number) => { calls++; return { lines: [`${px},${py}`] }; };
  const cache = new LabelCache();
  cache.key(sample, "decimal", 1, 100);
  assert.deepEqual(cache.get(3, 4), { lines: ["3,4"] });
  assert.deepEqual(cache.get(3, 4), { lines: ["3,4"] });
  assert.equal(calls, 1);
  cache.key(sample, "decimal", 1, 100);      // same key: keeps entries
  cache.get(3, 4);
  assert.equal(calls, 1);
  cache.key(sample, "decimal", 2, 100);      // version bump: cleared
  cache.get(3, 4);
  assert.equal(calls, 2);
  cache.key(sample, "int", 2, 100);          // notation change: cleared
  cache.get(3, 4);
  assert.equal(calls, 3);
  cache.key((px, py) => ({ lines: ["x"] }), "int", 2, 100); // sampler identity: cleared
  assert.deepEqual(cache.get(3, 4), { lines: ["x"] });
});

const base: RasterKey = {
  backing: { width: 800, height: 600 }, quad: quad(10.25, 20.5, 400, 300),
  grid: { w: 100, h: 75 }, notation: "decimal", version: 1, fontH: 12,
};

test("panShift returns a whole-device-pixel shift for a pan-only change", () => {
  assert.deepEqual(panShift(base, { ...base, quad: quad(13.25, 18.5, 400, 300) }, 2), { dx: 6, dy: -4 });
  assert.deepEqual(panShift(base, base, 2), { dx: 0, dy: 0 });
  // sub-device-pixel residual rounds
  assert.deepEqual(panShift(base, { ...base, quad: quad(10.45, 20.5, 400, 300) }, 2), { dx: 0, dy: 0 });
});

test("panShift is null when anything but the quad origin changed", () => {
  assert.equal(panShift(base, { ...base, quad: quad(10.25, 20.5, 401, 300) }, 2), null);
  assert.equal(panShift(base, { ...base, version: 2 }, 2), null);
  assert.equal(panShift(base, { ...base, notation: "int" }, 2), null);
  assert.equal(panShift(base, { ...base, fontH: 13 }, 2), null);
  assert.equal(panShift(base, { ...base, backing: { width: 801, height: 600 } }, 2), null);
  assert.equal(panShift(base, { ...base, grid: { w: 101, h: 75 } }, 2), null);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `ui/`): `node --experimental-strip-types --test src/primitives/components/pixel-value-raster.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write the module**

`ui/src/primitives/components/pixel-value-raster.ts`:

```ts
// ---------------------------------------------------------------------------
// Pure pieces of the pixel-value (TEV-style number) overlay: the visible cell
// window, the sample/format cache, the pan-shift test and the halo draw. No
// React, no DOM lookups: everything is derived from the `ImageViewport` and a
// sampler, so `PixelValueOverlay` can decide per frame between a blit, a
// strip draw and a crisp redraw. NO `shadowBlur` anywhere here — a blurred
// canvas shadow is rasterized and blurred per fillText (Firefox: ~35x the
// cost of the text itself); the halo is a strokeText under the fill instead.
// ---------------------------------------------------------------------------

import type { ImageViewport, ViewportQuad } from "../../plots/image/components/image-viewport.ts";
import { pixelValueClipRect, PIXEL_VALUE_LINE_H_FRAC } from "./pixel-value-size.ts";

export type PixelValueNotation = (typeof import("../../public/builder/validate.ts"))["PIXEL_VALUE_NOTATIONS"][number];

export interface PixelSample {
  lines: string[];
  colors?: (string | null)[];
}
export type PixelSampler = (px: number, py: number, notation: PixelValueNotation) => PixelSample | null;

export interface CellWindow {
  x0: number; x1: number; y0: number; y1: number;
  sxPerTexel: number; syPerTexel: number; cellScale: number;
}

export function visibleCellWindow(
  viewport: Pick<ImageViewport, "box" | "quad">,
  grid: { w: number; h: number },
): CellWindow | null {
  const { box, quad } = viewport;
  if (box.width <= 0 || box.height <= 0 || grid.w <= 0 || grid.h <= 0) return null;
  const sxPerTexel = quad.width / grid.w;
  const syPerTexel = quad.height / grid.h;
  if (!(sxPerTexel > 0) || !(syPerTexel > 0)) return null;
  const x0 = Math.max(0, Math.floor((0 - quad.left) / sxPerTexel));
  const x1 = Math.min(grid.w, Math.ceil((box.width - quad.left) / sxPerTexel));
  const y0 = Math.max(0, Math.floor((0 - quad.top) / syPerTexel));
  const y1 = Math.min(grid.h, Math.ceil((box.height - quad.top) / syPerTexel));
  if (x1 <= x0 || y1 <= y0) return null;
  return { x0, x1, y0, y1, sxPerTexel, syPerTexel, cellScale: Math.min(sxPerTexel, syPerTexel) };
}

/** Memoised sampler results, keyed by cell index; cleared whenever the sampler
 *  identity, the notation or the data version changes. */
export class LabelCache {
  private sample: PixelSampler | null = null;
  private notation: PixelValueNotation = "decimal";
  private version = -1;
  private gridW = 0;
  private entries = new Map<number, PixelSample | null>();

  key(sample: PixelSampler, notation: PixelValueNotation, version: number, gridW: number): void {
    if (sample === this.sample && notation === this.notation && version === this.version && gridW === this.gridW) return;
    this.sample = sample;
    this.notation = notation;
    this.version = version;
    this.gridW = gridW;
    this.entries = new Map();
  }

  get(px: number, py: number): PixelSample | null {
    const k = py * this.gridW + px;
    const hit = this.entries.get(k);
    if (hit !== undefined) return hit;
    const s = this.sample ? this.sample(px, py, this.notation) : null;
    this.entries.set(k, s);
    return s;
  }

  get size(): number {
    return this.entries.size;
  }
}

/** Everything a crisp raster was drawn for; two keys that differ only in the
 *  quad ORIGIN describe a pan of the same picture. */
export interface RasterKey {
  backing: { width: number; height: number };
  quad: ViewportQuad;
  grid: { w: number; h: number };
  notation: PixelValueNotation;
  version: number;
  fontH: number;
}

/** Whole-device-pixel shift from `prev` to `next` when only the quad origin
 *  moved, else null. The sub-pixel residual (< 0.5 device px) is absorbed by
 *  the next crisp redraw. */
export function panShift(prev: RasterKey, next: RasterKey, dpr: number): { dx: number; dy: number } | null {
  if (
    prev.backing.width !== next.backing.width || prev.backing.height !== next.backing.height ||
    prev.grid.w !== next.grid.w || prev.grid.h !== next.grid.h ||
    prev.notation !== next.notation || prev.version !== next.version || prev.fontH !== next.fontH ||
    prev.quad.width !== next.quad.width || prev.quad.height !== next.quad.height
  ) return null;
  return {
    dx: Math.round((next.quad.left - prev.quad.left) * dpr),
    dy: Math.round((next.quad.top - prev.quad.top) * dpr),
  };
}

export const LABEL_HALO_WIDTH_FRAC = 0.15;
export const LABEL_HALO_COLOR = "rgba(0,0,0,0.9)";
export const CHANNEL_COLORS = ["#ff5a5a", "#39d353", "#5b9bff", "#ffffff"] as const;
export const NEUTRAL_LABEL_COLOR = "#ffffff";

export interface LabelCell { px: number; py: number; s: PixelSample }

/** Draw labels for `cells` in css-px space (the caller has set the transform
 *  `backing/box`). Halo = strokeText under fillText; never a shadow. */
export function drawLabels(
  ctx: CanvasRenderingContext2D,
  win: CellWindow,
  viewport: Pick<ImageViewport, "box" | "backing" | "quad">,
  cells: Iterable<LabelCell>,
  fontH: number,
): void {
  const { quad } = viewport;
  const clip = pixelValueClipRect(
    { left: quad.left, top: quad.top, right: quad.left + quad.width, bottom: quad.top + quad.height },
    fontH,
  );
  ctx.save();
  ctx.beginPath();
  ctx.rect(clip.left, clip.top, clip.right - clip.left, clip.bottom - clip.top);
  ctx.clip();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${fontH}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(1, fontH * LABEL_HALO_WIDTH_FRAC);
  ctx.strokeStyle = LABEL_HALO_COLOR;
  const lineH = fontH * PIXEL_VALUE_LINE_H_FRAC;
  for (const { px, py, s } of cells) {
    const cx = quad.left + (px + 0.5) * win.sxPerTexel;
    const cy = quad.top + (py + 0.5) * win.syPerTexel;
    let ly = cy - (s.lines.length * lineH) / 2 + lineH / 2;
    for (let k = 0; k < s.lines.length; k++) {
      const ln = s.lines[k]!;
      ctx.strokeText(ln, cx, ly);
      ctx.fillStyle = s.colors?.[k] ?? NEUTRAL_LABEL_COLOR;
      ctx.fillText(ln, cx, ly);
      ly += lineH;
    }
  }
  ctx.restore();
}
```

In `PixelValueOverlay.tsx` delete the local `PixelSample`, `PixelSampler`, `PixelValueNotation`, `CHANNEL_COLORS`, `NEUTRAL_LABEL_COLOR` definitions and re-export them from the new module (`export { CHANNEL_COLORS, NEUTRAL_LABEL_COLOR } from "./pixel-value-raster"; export type { PixelSample, PixelSampler, PixelValueNotation } from "./pixel-value-raster";`) so every existing importer keeps working. Do not change the draw function in this task.

- [ ] **Step 4: Run tests and typecheck**

Run (from `ui/`): `npm test && npm run typecheck`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add ui/src/primitives/components/pixel-value-raster.ts ui/src/primitives/components/pixel-value-raster.test.ts ui/src/primitives/components/PixelValueOverlay.tsx
git commit -m "Add the pure pixel-value raster module"
```

---

### Task 2: Overlay uses the cache, the stroke halo and blit-and-strip pans; alignment harness calibration follows

**Files:**
- Modify: `ui/src/primitives/components/PixelValueOverlay.tsx` (the `draw` callback and the refs around it)
- Modify: `ui/src/plots/image/cpu/__tests__/cpu-label-alignment.browser.ts` (`calibrateInkBias`, its call sites in `measure`)

**Interfaces:**
- Consumes: everything from Task 1.
- Produces: no new exports. Internal refs: `rasterRef: HTMLCanvasElement | null`, `rasterKeyRef: RasterKey | null`, `cacheRef: LabelCache`, `lastCrispMsRef: number`.

- [ ] **Step 1: Rewrite `draw`**

Replace the body of the `draw` callback from `const { box, backing } = viewport;` to the end of the `ctx.restore()` with:

```ts
    const { box, backing, dpr } = viewport;
    const grid = { w: sourceDims?.w ?? viewport.natural.w, h: sourceDims?.h ?? viewport.natural.h };
    if (canvas.width !== backing.width) canvas.width = backing.width;
    if (canvas.height !== backing.height) canvas.height = backing.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const off = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, backing.width, backing.height);
      rasterKeyRef.current = null;
      reportSampleDemand(false);
      reportActive(false);
    };
    const win = visibleCellWindow(viewport, grid);
    if (!win || !pixelValueNumbersVisible(win.cellScale)) { off(); return; }
    reportSampleDemand(true);

    cacheRef.current.key(sample, notation, version, grid.w);
    const cache = cacheRef.current;
    let maxLineChars = 1;
    let maxLineCount = 1;
    const cellsIn = (x0: number, x1: number, y0: number, y1: number): LabelCell[] => {
      const out: LabelCell[] = [];
      for (let py = y0; py < y1; py++) for (let px = x0; px < x1; px++) {
        const s = cache.get(px, py);
        if (!s || s.lines.length === 0) continue;
        if (s.lines.length > maxLineCount) maxLineCount = s.lines.length;
        for (const ln of s.lines) if (ln.length > maxLineChars) maxLineChars = ln.length;
        out.push({ px, py, s });
      }
      return out;
    };
    const all = cellsIn(win.x0, win.x1, win.y0, win.y1);
    if (all.length === 0) { off(); return; }
    const fontH = pixelValueFontHeight(win.cellScale, maxLineCount, maxLineChars);
    if (fontH < PIXEL_VALUE_MIN_FONT_PX) { off(); return; }
    reportActive(true);

    const key: RasterKey = { backing: { ...backing }, quad: { ...viewport.quad }, grid, notation, version, fontH };
    const raster = rasterRef.current ??= document.createElement("canvas");
    if (raster.width !== backing.width) raster.width = backing.width;
    if (raster.height !== backing.height) raster.height = backing.height;
    const rctx = raster.getContext("2d")!;
    const prev = rasterKeyRef.current;
    const shift = prev ? panShift(prev, key, dpr) : null;

    if (shift) {
      // PAN: move the last crisp raster and draw only the exposed strips.
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, backing.width, backing.height);
      ctx.drawImage(raster, shift.dx, shift.dy);
      ctx.setTransform(backing.width / box.width, 0, 0, backing.height / box.height, 0, 0);
      const sx = shift.dx / dpr, sy = shift.dy / dpr;            // css px the picture moved
      const exposedCols = Math.ceil(Math.abs(sx) / win.sxPerTexel) + 1;
      const exposedRows = Math.ceil(Math.abs(sy) / win.syPerTexel) + 1;
      const strip: LabelCell[] = [];
      if (sx > 0) strip.push(...cellsIn(win.x0, Math.min(win.x1, win.x0 + exposedCols), win.y0, win.y1));
      if (sx < 0) strip.push(...cellsIn(Math.max(win.x0, win.x1 - exposedCols), win.x1, win.y0, win.y1));
      if (sy > 0) strip.push(...cellsIn(win.x0, win.x1, win.y0, Math.min(win.y1, win.y0 + exposedRows)));
      if (sy < 0) strip.push(...cellsIn(win.x0, win.x1, Math.max(win.y0, win.y1 - exposedRows), win.y1));
      drawLabels(ctx, win, viewport, strip, fontH);
      rctx.setTransform(1, 0, 0, 1, 0, 0);
      rctx.clearRect(0, 0, backing.width, backing.height);
      rctx.drawImage(canvas, 0, 0);
      rasterKeyRef.current = key;
      return;
    }

    // CRISP: full redraw into the raster, then one blit.
    const t0 = performance.now();
    rctx.setTransform(backing.width / box.width, 0, 0, backing.height / box.height, 0, 0);
    rctx.clearRect(0, 0, box.width, box.height);
    drawLabels(rctx, win, viewport, all, fontH);
    lastCrispMsRef.current = performance.now() - t0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, backing.width, backing.height);
    ctx.drawImage(raster, 0, 0);
    rasterKeyRef.current = key;
```

Add the refs next to `canvasRef`:

```ts
  const rasterRef = useRef<HTMLCanvasElement | null>(null);
  const rasterKeyRef = useRef<RasterKey | null>(null);
  const cacheRef = useRef(new LabelCache());
  const lastCrispMsRef = useRef(0);
```

Imports: `LabelCache, drawLabels, panShift, visibleCellWindow, type LabelCell, type RasterKey` from `./pixel-value-raster`. Remove the four `LABEL_SHADOW_*` constants and every `ctx.shadow*` assignment. Keep `pixelValueFontHeight`, `PIXEL_VALUE_MIN_FONT_PX`, `pixelValueNumbersVisible` imports. Update the file header comment: the halo is a stroke, the raster is cached, a pan is a blit plus strips.

Note on the strip: a pan by more than one cell exposes several columns; `exposedCols` covers them. Cells drawn in the strip that were already present are drawn twice at identical positions, which is harmless (same pixels).

- [ ] **Step 2: Alignment harness calibration mirrors the halo and the case font size**

In `cpu-label-alignment.browser.ts`, `calibrateInkBias` currently takes no argument and applies the shadow constants. Change it to `calibrateInkBias(fontH: number)`: `const F = fontH;`, delete the four `ctx.shadow*` lines, and insert the halo before the fill loop:

```ts
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(1, F * 0.15);      // mirrors LABEL_HALO_WIDTH_FRAC
  ctx.strokeStyle = "rgba(0,0,0,0.9)";         // mirrors LABEL_HALO_COLOR
  for (const line of lines) { ctx.strokeText(line, cx, ly); ctx.fillText(line, cx, ly); ly += lineH; }
```

(replace the existing `for (const line of lines) { ctx.fillText(...); ly += lineH; }`). Update the comment above it to name `pixel-value-raster.ts` as the source of the two constants. Replace the module-level `const INK_BIAS = calibrateInkBias();` with a memo `const inkBiasFor = (() => { const m = new Map<number, ReturnType<typeof calibrateInkBias>>(); return (fontH: number) => { const k = Math.round(fontH * 4) / 4; let v = m.get(k); if (!v) { v = calibrateInkBias(k); m.set(k, v); } return v; }; })();` and at the two call sites in `measure` (`compareAxis(..., INK_BIAS.x)` / `INK_BIAS.y`) compute the case font size first: `const fontH = pixelValueFontHeight(pitch, 4, 5);` (4 lines, 5 reference chars: the RGBA uint8 cells print up to `0.502`), `const bias = inkBiasFor(fontH);` and pass `bias.x` / `bias.y`. Import `pixelValueFontHeight` from `../../../../primitives/components/pixel-value-size.ts`. Report the calibration line (`bias.note`) once per distinct font size via `report(true, "BENCH: " + note)` so the numbers stay visible.

- [ ] **Step 3: Verify**

Run (from `ui/`): `npm test && npm run typecheck && node scripts/test-harness.mjs --only cpu-label-alignment && node scripts/test-harness.mjs --only cpu-gesture-cost`.
Expected: unit tests and typecheck PASS; both alignment harnesses (`cpu-label-alignment`, `cpu-label-alignment-dpr1`) PASS with label-vs-texel max ≤ 1 px on the CPU cases; gesture-cost PASS. Also grep: `grep -rn "shadowBlur" ui/src/primitives/components/` must return nothing outside comments.

- [ ] **Step 4: Commit**

```bash
git add ui/src/primitives/components/PixelValueOverlay.tsx ui/src/plots/image/cpu/__tests__/cpu-label-alignment.browser.ts
git commit -m "Cache pixel-value labels and pan them by blitting"
```

---

### Task 3: Zoom budget — scaled blit while over budget, crisp redraw on settle

**Files:**
- Modify: `ui/src/primitives/components/PixelValueOverlay.tsx`

**Interfaces:**
- Consumes: `lastCrispMsRef`, `rasterKeyRef`, `rasterRef` from Task 2.
- Produces: `export const CRISP_BUDGET_MS = 8;` and a `data-pixel-value-overlay-mode="crisp" | "pan" | "scaled"` attribute on the canvas, set per draw (the harness reads it).

- [ ] **Step 1: Add the budgeted path**

Before the CRISP block from Task 2 insert:

```ts
    const now = performance.now();
    const withinGesture = now - lastDrawAtRef.current < 50;   // consecutive frames of one gesture
    lastDrawAtRef.current = now;
    if (prev && withinGesture && lastCrispMsRef.current > CRISP_BUDGET_MS &&
        prev.grid.w === key.grid.w && prev.grid.h === key.grid.h && prev.version === key.version && prev.notation === key.notation &&
        prev.backing.width === key.backing.width && prev.backing.height === key.backing.height) {
      // SCALED: too slow to redraw crisply every frame — show the last raster
      // mapped from its quad onto the new quad, and settle to a crisp draw when
      // the gesture pauses. Text is transiently soft; positions stay exact.
      const sx = key.quad.width / prev.quad.width, sy = key.quad.height / prev.quad.height;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, backing.width, backing.height);
      ctx.drawImage(raster,
        (key.quad.left - prev.quad.left * sx) * dpr, (key.quad.top - prev.quad.top * sy) * dpr,
        backing.width * sx, backing.height * sy);
      canvas.dataset.pixelValueOverlayMode = "scaled";
      if (settleRef.current) cancelAnimationFrame(settleRef.current);
      settleRef.current = requestAnimationFrame(() => {
        settleRef.current = 0;
        lastCrispMsRef.current = 0;     // force the crisp path
        drawRef.current?.();
      });
      return;                            // rasterKeyRef stays at `prev` (the raster is still prev's)
    }
```

with refs `const lastDrawAtRef = useRef(0); const settleRef = useRef(0); const drawRef = useRef<(() => void) | null>(null);` and `drawRef.current = draw;` right after `draw` is defined. Set `canvas.dataset.pixelValueOverlayMode = "pan"` in the PAN block and `"crisp"` in the CRISP block. Cancel a pending settle frame in the CRISP block (`if (settleRef.current) { cancelAnimationFrame(settleRef.current); settleRef.current = 0; }`) and in the component's unmount effect.

The settle draw runs one frame later; if the gesture continued, that draw is itself a fresh `draw()` call which re-enters the budget test with `lastCrispMsRef = 0`, so it draws crisply once and re-measures.

- [ ] **Step 2: Verify**

Run (from `ui/`): `npm run typecheck && node scripts/test-harness.mjs --only cpu-label-alignment`. Expected: PASS (the alignment cases settle before measuring, so they hit the crisp path).

- [ ] **Step 3: Commit**

```bash
git add ui/src/primitives/components/PixelValueOverlay.tsx
git commit -m "Budget crisp label redraws during zoom"
```

---

### Task 4: Overlay cost harness

**Files:**
- Create: `ui/src/primitives/components/__tests__/pixel-value-overlay-cost.browser.html`
- Create: `ui/src/primitives/components/__tests__/pixel-value-overlay-cost.browser.ts`

**Interfaces:**
- Consumes: `PixelValueOverlay` default export; `deriveImageViewport` from `../../../plots/image/components/image-viewport.ts`; `report`/`setOverallStatus` helpers — copy the pattern from `toolbar-menu-portal.browser.ts` in the same directory (boot marker, `report(ok, msg)` printing `PASS:`/`FAIL:`, `setOverallStatus`).
- Produces: a harness the runner auto-discovers (same attributes as `toolbar-menu-portal.browser.html`).

- [ ] **Step 1: The page**

Copy `toolbar-menu-portal.browser.html`, rename the script to `./pixel-value-overlay-cost.browser.bundle.js`, keep `data-cairn-harness` attributes identical, body `<div id="root" style="position:relative;width:1200px;height:800px"></div>`.

- [ ] **Step 2: The harness**

```ts
import { createRoot } from "react-dom/client";
import { createElement as h, useState } from "react";
import PixelValueOverlay, { CRISP_BUDGET_MS } from "../PixelValueOverlay.tsx";
import { deriveImageViewport } from "../../../plots/image/components/image-viewport.ts";
import type { ImageViewState } from "../../../host/hooks/use-image-gestures";
// report/setOverallStatus: copy from ./toolbar-menu-portal.browser.ts

const GRID = { w: 1024, h: 1024 };
const BOX = { width: 1200, height: 800 };
const sample = (px: number, py: number) => ({
  lines: [((px * 7) % 256 / 255).toFixed(3), ((py * 5) % 256 / 255).toFixed(3), (((px + py) % 256) / 255).toFixed(3), "1"],
  colors: ["#ff5a5a", "#39d353", "#5b9bff", "#ffffff"],
});
const viewportFor = (view: ImageViewState) => deriveImageViewport({
  box: BOX, backing: { width: BOX.width * 2, height: BOX.height * 2 }, view, natural: GRID, interpolation: "auto",
});

// prototype spies (installed after mount, restored in finally)
const counts = { fill: 0, stroke: 0, drawImage: 0, shadowSets: 0 };
function spy() {
  const P = CanvasRenderingContext2D.prototype;
  const oFill = P.fillText, oStroke = P.strokeText, oDraw = P.drawImage;
  const sb = Object.getOwnPropertyDescriptor(P, "shadowBlur")!;
  P.fillText = function (...a) { counts.fill++; return oFill.apply(this, a as never); } as never;
  P.strokeText = function (...a) { counts.stroke++; return oStroke.apply(this, a as never); } as never;
  P.drawImage = function (...a) { counts.drawImage++; return oDraw.apply(this, a as never); } as never;
  Object.defineProperty(P, "shadowBlur", { configurable: true, get: sb.get, set(v: number) { if (v > 0) counts.shadowSets++; sb.set!.call(this, v); } });
  return () => { P.fillText = oFill; P.strokeText = oStroke; P.drawImage = oDraw; Object.defineProperty(P, "shadowBlur", sb); };
}

let setView: (v: ImageViewState) => void = () => {};
function Host() {
  const [view, sv] = useState<ImageViewState>({ zoom: 60, pan: { x: -20000, y: -20000 } }); // ~57 css px per texel → numbers on
  setView = sv;
  return h(PixelValueOverlay, { viewport: viewportFor(view), sample, version: 1, notation: "decimal" });
}

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
async function run() {
  report(true, "harness module loaded (boot marker)");
  createRoot(document.getElementById("root")!).render(h(Host));
  await frame(); await frame();
  const canvas = document.querySelector<HTMLCanvasElement>("canvas[data-pixel-value-overlay]")!;
  report(!!canvas, "the overlay mounts its canvas");
  const win = viewportFor({ zoom: 60, pan: { x: -20000, y: -20000 } });
  const visibleCells = Math.ceil(BOX.width / win.pxPerTexel + 1) * Math.ceil(BOX.height / win.pxPerTexel + 1);
  const restore = spy();
  try {
    // PAN: 30 frames of 3 css px steps → text calls must cover only the exposed strip
    let panTextMax = 0; let panDrawImage = 0;
    for (let i = 1; i <= 30; i++) {
      counts.fill = counts.stroke = counts.drawImage = 0;
      setView({ zoom: 60, pan: { x: -20000 + 3 * i, y: -20000 + 2 * i } });
      await frame();
      panTextMax = Math.max(panTextMax, counts.fill);
      panDrawImage += counts.drawImage;
      report(canvas.dataset.pixelValueOverlayMode === "pan", `pan frame ${i}: mode pan (got ${canvas.dataset.pixelValueOverlayMode})`);
    }
    report(panTextMax <= 0.4 * visibleCells * 4, `BENCH: pan: max ${panTextMax} fillText per frame for ${visibleCells} visible cells (≤ 40% of ${visibleCells * 4} lines: the exposed strips, never a full redraw)`);
    report(panDrawImage >= 30, `BENCH: pan: ${panDrawImage} blits over 30 frames (≥ 1 per frame)`);
    // ZOOM: 30 frames; never more than one crisp redraw per frame; never a shadow
    let crisp = 0; let scaled = 0; const ms: number[] = [];
    for (let i = 1; i <= 30; i++) {
      counts.fill = 0;
      const t0 = performance.now();
      setView({ zoom: 60 * (1 + 0.01 * i), pan: { x: -20000 - 50 * i, y: -20000 - 40 * i } });
      await frame();
      ms.push(performance.now() - t0);
      const mode = canvas.dataset.pixelValueOverlayMode;
      if (mode === "crisp") crisp++; else if (mode === "scaled") scaled++;
      report(counts.fill <= visibleCells * 4 * 1.2, `zoom frame ${i}: ≤ one crisp redraw of text (${counts.fill} fillText, mode ${mode})`);
    }
    await frame(); await frame();
    report(canvas.dataset.pixelValueOverlayMode === "crisp", `after the gesture settles the overlay is crisp (got ${canvas.dataset.pixelValueOverlayMode})`);
    report(true, `BENCH: zoom: ${crisp} crisp / ${scaled} scaled frames; frame ms median ${ms.sort((a, b) => a - b)[15]!.toFixed(1)} max ${ms[29]!.toFixed(1)}; budget ${CRISP_BUDGET_MS} ms`);
    report(counts.shadowSets === 0, `shadowBlur never set non-zero (got ${counts.shadowSets})`);
  } finally {
    restore();
  }
}
run().then(setOverallStatus).catch((e) => { report(false, String(e)); setOverallStatus(false); });
```

`counts.shadowSets` is never reset during the run so it counts every set since the spy was installed.

- [ ] **Step 3: Run it**

Run (from `ui/`): `node scripts/test-harness.mjs --only pixel-value-overlay-cost`. Expected: PASS with the BENCH lines printed. Then the full auto set: `npm run test:harness`; expected: no new failures beyond the known `compare-pass`.

- [ ] **Step 4: Commit**

```bash
git add ui/src/primitives/components/__tests__/pixel-value-overlay-cost.browser.html ui/src/primitives/components/__tests__/pixel-value-overlay-cost.browser.ts
git commit -m "Gate pixel-value overlay gesture cost with a harness"
```
