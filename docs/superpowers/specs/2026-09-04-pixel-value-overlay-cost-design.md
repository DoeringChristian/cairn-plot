# Pixel-value overlay: gesture cost

Status: v1 (2026-09-04). Owner: cairn-plot. Consumer: cairn.

## 1. Problem

The per-pixel number overlay (`primitives/components/PixelValueOverlay.tsx`,
the TEV-style values) lags during zoom and pan, worst on large monitors and in
Firefox. The overlay is one device-pixel canvas over the image, shared by both
backends through `ImagePaneShell`; its inputs are the `ImageViewport`, a
sampler `(px, py, notation) => PixelSample`, and a data `version`.

Its draw runs once per animation frame during a gesture (the gesture hook
coalesces events) and each run:

1. walks every visible cell, calls the sampler and formats every channel
   value to a string;
2. clears the whole backing canvas;
3. issues one `fillText` per label line with `shadowBlur` set.

Nothing is kept between frames. Measured with a standalone page at a 4K,
DPR 2 canvas (2,040 visible cells, 8,160 label lines), one full redraw:

| Technique | Chrome (headless) | Firefox (headless) |
|---|---|---|
| `fillText` with `shadowBlur` (today) | 16 ms | 275 ms (834 ms contended) |
| `fillText`, no halo | 8 ms | 8 ms |
| `fillText` + `strokeText` halo | 14 ms | 15 ms |
| glyph atlas, one `drawImage` per glyph | 40 ms | 28 ms |
| one `drawImage` of a cached full raster | 8.5 ms | 2 ms |

Findings:

- The blurred canvas shadow is the Firefox problem: the browser rasterizes,
  blurs and composites a temporary surface per `fillText`, and Firefox does it
  in software. Removing it is a 35× win there and 2× in Chrome.
- A per-glyph atlas (tev's technique) does not transfer to canvas 2D: the
  JavaScript-to-native call count dominates, so six blits per label cost more
  than one `fillText`.
- A cached raster makes a pan almost free: one blit plus the newly exposed
  strip.
- Cell count is the multiplier. At the 30 css px threshold a 1920×1080 css
  viewport holds ~2,000 cells; a 4K monitor at DPR 1 holds ~8,000.

tev, for reference, redraws every label every frame with a blurred shadow
too, but its NanoVG font stash bakes the blur into the glyph atlas once, so
the shadow pass is more textured quads in one batched GPU draw.

## 2. Goals and non-goals

Goals:

- No `shadowBlur` anywhere in the per-frame path. Halo = `strokeText` under
  `fillText` with the same visual weight (dark, ~0.15 em).
- Formatted samples cached across frames, invalidated by sampler identity,
  notation and `version`.
- A pan never re-draws text for cells that stayed visible: blit the cached
  raster shifted, draw only the exposed strips.
- A zoom redraws crisply at most once per animation frame; when a crisp
  redraw exceeds a budget, the previous raster is blit-scaled for the frames
  in between and a crisp redraw follows when the gesture settles.
- Same props, same geometry: the overlay keeps `viewport`, `sample`,
  `notation`, `version`; both backends untouched; labels keep landing within
  1 px of texel centres (the alignment harness keeps passing).
- A self-driving harness pins the per-frame budget by counting native calls
  the way `cpu-gesture-cost` does for the image paint.

Non-goals:

- No change to the 30 px visibility threshold, font sizing, notation or
  colours (a tev-like fade-in above 50 px is a separate product decision).
- No WebGPU text pass; labels stay a shared canvas primitive.
- No DOM labels.

## 3. Design

### 3.1 `primitives/components/pixel-value-raster.ts` (pure)

```ts
export interface CellWindow { x0: number; x1: number; y0: number; y1: number;
  sxPerTexel: number; syPerTexel: number; cellScale: number; }
export function visibleCellWindow(viewport: ImageViewport, grid: { w: number; h: number }): CellWindow | null;

export class LabelCache {          // sample + format results, keyed by cell index
  constructor(gridW: number);
  key(sample: PixelSampler, notation: PixelValueNotation, version: number): void; // clears on change
  get(px: number, py: number): PixelSample | null;   // memoised call of the sampler
}

export interface RasterKey {        // what a raster was drawn for
  backing: { width: number; height: number }; quad: ViewportQuad;
  grid: { w: number; h: number }; notation: PixelValueNotation; version: number; fontH: number; }
/** Integer device-pixel shift when `next` differs from `prev` by a pan only. */
export function panShift(prev: RasterKey, next: RasterKey): { dx: number; dy: number } | null;

export const LABEL_HALO_WIDTH_FRAC = 0.15;   // stroke width in em
export function drawLabels(ctx: CanvasRenderingContext2D, win: CellWindow, viewport: ImageViewport,
  cells: Iterable<{ px: number; py: number; s: PixelSample }>, fontH: number): void;
// fill + stroke halo; no shadow; clip rect from pixelValueClipRect
```

`panShift` returns a shift only when backing, grid, notation, version and
font height are equal and the quad size is equal, i.e. only the quad origin
moved; the shift is rounded to whole device pixels and the residual
(< 0.5 device px) is absorbed by the next crisp redraw.

### 3.2 The overlay

`PixelValueOverlay` owns, besides the visible canvas, one offscreen raster
canvas of the same backing size and the `RasterKey` it was drawn for. Per draw:

1. Compute the window; if numbers are not visible, clear and report inactive
   (unchanged behaviour).
2. `panShift(prevKey, key)` non-null → `drawImage(raster, dx, dy)` into the
   visible canvas, draw the cells whose rects intersect the exposed strips,
   then copy the visible canvas back into the raster. Text calls ≈ strip cells.
3. Otherwise a crisp redraw into the raster (`drawLabels`), blit to the
   visible canvas, remember the key and the redraw duration.
4. Zoom budget (Task 3): if the previous crisp redraw took longer than
   `CRISP_BUDGET_MS = 8` and this draw is within one frame of the previous,
   blit the raster scaled by `next.quad / prev.quad` about the quad origin
   instead of step 3, and schedule a crisp redraw on the next frame with no
   viewport change (settle). Scaled text is transiently soft; it snaps to the
   capped font on settle.

`shadowBlur` is never set. The halo is `strokeText` (`lineJoin: "round"`,
`lineWidth = fontH * LABEL_HALO_WIDTH_FRAC`, colour `rgba(0,0,0,0.9)`) under
the fill.

### 3.3 Alignment harness calibration

`cpu-label-alignment` calibrates the glyph-ink bias by re-drawing the
overlay's stack with the shadow constants. It changes in the same task to
mirror the stroke halo, and calibrates at each case's real font size
(`pixelValueFontHeight(pitch, lines)`) instead of a fixed 40 px, which is
also what made the CI Linux run miss the 1 px gate by 0.2 px.

### 3.4 Cost harness

`primitives/components/__tests__/pixel-value-overlay-cost.browser.{html,ts}`:
mounts `PixelValueOverlay` directly with a synthetic 1024×1024 RGBA sampler
and a viewport from `deriveImageViewport`, installs prototype spies
(`fillText`, `strokeText`, `drawImage`, the `shadowBlur` setter), and drives
30 pan frames and 30 zoom frames by replacing the viewport prop each frame.
Gates: `shadowBlur` never set non-zero; pan frames issue text calls for at
most 40 % of the visible cells (the exposed strips); every frame issues at most one crisp redraw;
zoom frames never exceed one `drawLabels` per frame. Durations are reported
as diagnostics.

## 4. Testing

- node:test for `visibleCellWindow`, `LabelCache` invalidation, `panShift`
  (equal keys, pan only, size change, version change, sub-pixel residual).
- Cost harness as above; `cpu-label-alignment` and `-dpr1` keep passing with
  the new calibration; `cpu-gesture-cost` unchanged.

## 5. Compatibility

No API change. Visual: halo is a stroke instead of a blur (slightly crisper
edge, same weight); during a heavy zoom labels are transiently scaled.
