/**
 * IMAGE LOAD COST — what opening a run full of 8-bit image cards actually costs.
 *
 * This harness measures ONE moment: mount. A report page is a gallery of image
 * panes that all appear at once, and the complaint it exists to quantify is that
 * that moment is slow on BOTH backends. The costs are invisible to every other
 * test in the tree — they are native calls inside the decode path, not DOM state
 * — so they are counted here with prototype spies:
 *
 *   HTMLImageElement.prototype.src   — an ELEMENT decode. It is the FALLBACK
 *                                      path now (`decoded-image.ts` uses it only
 *                                      when `fetch` or `createImageBitmap`
 *                                      cannot serve the URL), so on this page —
 *                                      same-origin `data:` sources — it must
 *                                      never fire. Before the fix it ran twice
 *                                      per image on the CPU backend: once in
 *                                      `loadImageData` and once more for the
 *                                      paint source.
 *   createImageBitmap                — the cheap decode, counted BY SOURCE TYPE
 *                                      (`Blob` / `HTMLImageElement` / `ImageData`),
 *                                      because "decoded from a Blob" and
 *                                      "re-encoded from an element that was
 *                                      already decoded" cost very different
 *                                      things.
 *   getImageData (2D + Offscreen)    — the full-frame READBACK. Counted in
 *                                      megapixels, not just calls: one 2048²
 *                                      readback is 16 MB of main-thread copy.
 *                                      Calls whose canvas IS a pane's own
 *                                      presentation canvas are EXCLUDED — those
 *                                      are this harness's own paint probe and
 *                                      the pane's pixel-value overlay, not load
 *                                      cost.
 *   GPUQueue.writeTexture            — bytes uploaded as raw buffers, split by
 *                                      the COPY EXTENT: a write of more than one
 *                                      row is an image, a single-row write is a
 *                                      colormap LUT (`image-engine.ts`
 *                                      `buildColormapTexture`: a 256x1 ramp, or
 *                                      the 1x1 placeholder every render passes).
 *                                      Every SOURCE byte here is a CPU-side
 *                                      expansion the GPU could have decoded
 *                                      itself; the LUT rows are not source data
 *                                      and are reported, not gated.
 *   GPUQueue.copyExternalImageToTexture — the upload that does NOT go through a
 *                                      CPU buffer: the queue copies the decoded
 *                                      bitmap straight into the texture.
 *   sceneConversionCount()           — `imageDataToSceneField` calls, from
 *                                      `resources/scene-field.ts`. Each one
 *                                      builds a `w*h*4` Float32Array one pixel
 *                                      at a time; on the WebGPU comparison path
 *                                      that is pure waste, since `textureLoad`
 *                                      on an sRGB texture returns linear values
 *                                      already.
 *
 * WHAT IS GATED. The numbers are ASSERTIONS now, not baselines (design §3.5):
 * the load path is fixed, and these gates are what keep it fixed. Per backend
 * phase:
 *
 *   - all twelve image panes paint inside the phase's deadline;
 *   - ELEMENT DECODES 0 — nothing on this page reaches the fallback path;
 *   - `createImageBitmap` calls == the phase's DISTINCT URL COUNT, every one of
 *     them from a `Blob`: one decode per image, off the main thread, and none
 *     of them re-encoding an already-decoded element;
 *   - `getImageData` exactly 1 at mount — the ONE wide pane whose histogram
 *     panel is open — and exactly ONE MORE after the per-pixel numbers are
 *     toggled on one narrow pane, and none after that. A readback happens
 *     when, and only when, something on screen asks for pixels;
 *   - SCENE CONVERSIONS 0: `imageDataToSceneField` has left both backends'
 *     mount paths (it survives only for the CPU false-colour and metrics
 *     callers, which this page does not exercise);
 *   - GPU only: `writeTexture` uploads ZERO source bytes, and
 *     `copyExternalImageToTexture` runs once per distinct uploaded texture.
 *
 * Plus, after both phases: the gamma-tagged and translucent fixtures read back
 * BYTE-IDENTICAL through `decodedImage(...).imageData()` (the product path) and
 * through an `<img>` element decoded and drawn by this harness (the path the
 * product used to take) — the proof that moving to `createImageBitmap(Blob)`
 * did not change anyone's pixels.
 *
 * The `BENCH:` lines that remain are measurements with no budget attached
 * (elapsed ms, megapixels, MB) plus the before/after summary in `costRatio()`.
 *
 * TWO THINGS THE LAYOUT HAS TO GET RIGHT.
 *  1. `window.__cairnPlotEagerMount = true` (see `host/lazy-mount.ts`) — without
 *     it the viewport gate holds most panes back and the page measures the
 *     IntersectionObserver, not the loader.
 *  2. Every pane must be ON SCREEN. The WebGPU pane pool never admits an
 *     offscreen pane to a swapchain slot, so a page that scrolls would measure
 *     parking. `#stage` is pinned to the viewport and sized so all fourteen
 *     hosts fit at once; see the page's stylesheet.
 *
 * ONE PANE WITH ITS HISTOGRAM OPEN. An open info panel forces a full readback,
 * and a report page always has at least one card wide enough to get one, so the
 * gallery's realistic shape is reproduced: eleven 300 px cards and one 620 px
 * card that carries `"panel.info": true`. See `WIDE_W` for why that setting is
 * spelled out instead of being reached by making the card wider.
 *
 * TWELVE DISTINCT URLS PER PHASE, AND WHY. Every cache on the load path
 * (`resources/decoded-image.ts`, `resources/cache.ts`, the GPU upload cache)
 * is keyed by URL and lives for the document. Two panes sharing a URL
 * therefore share ONE decode and ONE upload — which is a real and wanted
 * property, but it is not the one being gated here: with two URLs behind
 * twelve cards, "one decode per image" and "one decode per PAGE" print the
 * same number, and eleven twelfths of the cost would be invisible. So each
 * pane gets its OWN url (`#cpu-p0`…`#cpu-p11`, `#gpu-p0`…), the two comparison
 * cards get two further ones (`#gpu-cmp-a` / `#gpu-cmp-b`), and the gates
 * measure PER-PANE cost. The same fragments keep the two backend phases
 * independent: without them the GPU phase would measure the CPU phase's warm
 * cache and report near-zero.
 *
 * The payloads are still encoded ONCE (that is the expensive part) and handed
 * out under distinct FRAGMENTS, which a `data:` URL decoder ignores but every
 * cache key includes.
 */
import { createRoot, type Root } from "react-dom/client";
import { createElement } from "react";
import { PlotApp } from "../../../host/bootstrap";
import { registerCoreRenderers } from "../../register-core";
import type { PlotSpec } from "../../../../../packages/spec/src/spec.ts";
import { sceneConversionCount } from "../resources/scene-field.ts";
import { decodedImage } from "../resources/decoded-image.ts";
import { getCanvasPresentationStateForTest } from "../webgpu/pool.ts";
import { getRegisteredPane } from "../../../state/selection/pane-registry.ts";
import { PIXEL_VALUE_MIN_SCREEN_PX } from "../../../primitives/components/pixel-value-size.ts";
import { createHarness, sleep, waitFor } from "../../../testing/harness";

const { report, setOverallStatus } = createHarness({
  title: "IMAGE-LOAD-COST",
  colors: { pass: "#6f6", fail: "#f66" },
});

/** Image panes per backend phase — the gallery size the gate is written against. */
const PANE_COUNT = 12;
/** Side of the two big fixtures. 2048² = 4 Mpx = 16 MB per RGBA readback. */
const IMAGE_N = 2048;
/**
 * The eleven ordinary cards. The HOST is 300 px wide, but a pane's viewport
 * takes the CONTENT aspect (`[data-cairn-content-aspect-frame]`), so a square
 * 2048² source in a 300x130 host measures ~122 px — comfortably below the
 * auto-open threshold, which is the property that matters here. Pane size does
 * not affect decode or readback cost, so the small height costs the measurement
 * nothing and buys the room the wide card below needs.
 */
const NARROW_W = 300;
const NARROW_H = 130;
/**
 * The one wide card: the pane whose histogram panel is OPEN at mount, and which
 * therefore pays for the full readback the panel demands.
 *
 * `ImagePaneShell` opens that panel automatically when the viewport is at least
 * `4 × INFO_PANEL_W` (896 px) wide — but for a SQUARE source that width is
 * unreachable in this window, so the card asks for the panel by name instead
 * (`settings: { "panel.info": true }`, which `infoOpen` honours ahead of the
 * auto rule). The reason is `ContentAspectFrame`: it caps the drawable box at
 * `window.innerHeight - VIEWPORT_HEIGHT_MARGIN` so a portrait or square image
 * always fits one screenful, and a square box capped in height is capped in
 * width too. Measured in the runner's window (`innerHeight` 913): a 1040x170
 * host gives a 162 px viewport, and 940x940 and 960x960 hosts BOTH give 889 px
 * — the cap, seven pixels short of the threshold. Sizing alone cannot open this
 * panel, and a harness that only sized the host would have measured a page with
 * no open histogram at all while claiming otherwise.
 */
const WIDE_W = 620;
const WIDE_H = 620;
/**
 * Per-phase paint deadline. The runner's whole-page budget is
 * `HARNESS_TIMEOUT_MS` (60 s by default) and this page runs TWO phases plus the
 * fixture readbacks inside it, so neither phase may claim the whole 60 s.
 */
const PAINT_TIMEOUT_MS = 24_000;
/**
 * The on-screen cell size (screen px per source texel) the numbers toggle aims
 * for. `PIXEL_VALUE_MIN_SCREEN_PX` (30) is where the overlay starts asking for
 * samples; this leaves a comfortable margin above it so a pixel of rounding in
 * the measured viewport box cannot land the pane on the wrong side of the one
 * gate that makes the second readback happen.
 */
const NUMBERS_CELL_PX = 44;

/**
 * The 2D `getImageData` as it was BEFORE any spy — the paint probe below calls
 * a full-frame-readback API twelve times a poll, and routing that through the
 * spy would drown the very number this harness reports.
 */
const ORIGINAL_GET_IMAGE_DATA = CanvasRenderingContext2D.prototype.getImageData;

/** A pane's OWN presentation canvas. Reads of it are presentation, not load. */
const PANE_CANVAS_SELECTOR = "[data-cpu-image-canvas], [data-gpu-image-canvas]";

// ---------------------------------------------------------------------------
// Small tagged / translucent fixtures
// ---------------------------------------------------------------------------
/**
 * 64×64 RGBA checkerboard carrying a `gAMA` chunk of 1/2.2. A decoder that
 * honours the tag returns different bytes from one that ignores it, so this is
 * the fixture that catches a decode path swapped for one with different colour
 * management (see `fixtureIdentity`).
 */
const TAGGED_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAABGdBTUEAALGPC/xhBQAAAIJJREFUeNrt2LEVABAQRMErRagsRSpCEXqhA2JuAuEFJvpvY/a6Tq+0cXyv3wcAAAAAAACQGOD3D97uAQAAAAAAgMwAShAAAAAAAACwByhBAAAAAAAAwB6gBAEAAAAAAAB7gBIEAAAAAAAA7AFKEAAAAAAAALAHKEEAAAAAAADgO4AN6NPySuoHhxgAAAAASUVORK5CYII=";
/**
 * 64×64 RGBA checkerboard with two DIFFERENT alpha levels (64 and 192). Alpha is
 * where the element path and `createImageBitmap` most easily disagree, because
 * one premultiplies and the other need not.
 */
const TRANSLUCENT_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAgUlEQVR42u3YMREAIAwEQeREBjpQi5CIwQHUJFtQpmCrmx+Ra99expq39/v9AAAAAAAAABoDVP/g6x4AAAAAAADoDKAEAQAAAAAAAHuAEgQAAAAAAADsAUoQAAAAAAAAsAcoQQAAAAAAAMAeoAQBAAAAAAAAe4ASBAAAAAAAAMoBHO+b4bSoumtLAAAAAElFTkSuQmCC";

// ---------------------------------------------------------------------------
// The two large sources
// ---------------------------------------------------------------------------
/** A smooth 2048² gradient — PNG-compressible, so the data URL stays small
 *  while the DECODED buffer is a full 16 MB. */
function gradientPng(): string {
  const c = document.createElement("canvas");
  c.width = IMAGE_N;
  c.height = IMAGE_N;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, IMAGE_N, IMAGE_N);
  g.addColorStop(0, "#0d1b2a");
  g.addColorStop(0.5, "#c1440e");
  g.addColorStop(1, "#25d0a5");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, IMAGE_N, IMAGE_N);
  return c.toDataURL("image/png");
}

/** A 2048² checkerboard — a DIFFERENT image from the gradient, so the two
 *  operands of the comparison panes really differ and the diff is not a
 *  degenerate all-zero frame the backend might shortcut. */
function checkerPng(): string {
  const c = document.createElement("canvas");
  c.width = IMAGE_N;
  c.height = IMAGE_N;
  const ctx = c.getContext("2d")!;
  const cell = 64;
  for (let y = 0; y < IMAGE_N; y += cell) {
    for (let x = 0; x < IMAGE_N; x += cell) {
      ctx.fillStyle = ((x / cell + y / cell) & 1) === 0 ? "#e8e1d2" : "#31415a";
      ctx.fillRect(x, y, cell, cell);
    }
  }
  return c.toDataURL("image/png");
}

// ---------------------------------------------------------------------------
// Counters
// ---------------------------------------------------------------------------
interface Counters {
  elementDecodes: number;
  bitmapTotal: number;
  bitmapBySource: Record<string, number>;
  getImageDataCalls: number;
  getImageDataPixels: number;
  writeTextureCalls: number;
  /** Bytes written into a MULTI-ROW copy extent — an image, and the number the
   *  GPU gate holds at zero. */
  writeTextureSourceBytes: number;
  /** Bytes written into a SINGLE-ROW extent — a colormap LUT (256x1) or the
   *  1x1 placeholder. Reported, never gated: no image travels this way. */
  writeTextureRowBytes: number;
  copyExternalImage: number;
}

function zeroCounters(): Counters {
  return {
    elementDecodes: 0,
    bitmapTotal: 0,
    bitmapBySource: {},
    getImageDataCalls: 0,
    getImageDataPixels: 0,
    writeTextureCalls: 0,
    writeTextureSourceBytes: 0,
    writeTextureRowBytes: 0,
    copyExternalImage: 0,
  };
}

/** Rows covered by a `writeTexture` copy extent (`GPUExtent3D`: an object with
 *  `height`, or a `[w, h, d]` array — the spec allows both). One row is a LUT;
 *  more than one is an image. */
function copyRows(size: unknown): number {
  if (Array.isArray(size)) return Number(size[1] ?? 1);
  return Number((size as { height?: number } | null)?.height ?? 1);
}

let counters = zeroCounters();

/** True for a pane's own presentation canvas — an `OffscreenCanvas` has no
 *  `matches`, which is exactly right: it is never a pane canvas. */
function isPaneCanvas(canvas: unknown): boolean {
  const el = canvas as { matches?: (selector: string) => boolean } | null;
  return typeof el?.matches === "function" && el.matches(PANE_CANVAS_SELECTOR);
}

function recordGetImageData(canvas: unknown, args: unknown[]): void {
  if (isPaneCanvas(canvas)) return;
  counters.getImageDataCalls++;
  const w = Number(args[2]);
  const h = Number(args[3]);
  if (Number.isFinite(w) && Number.isFinite(h)) counters.getImageDataPixels += w * h;
}

/** Install every spy; returns the restore function (call it in a `finally`). */
function installSpies(): () => void {
  const c2d = CanvasRenderingContext2D.prototype;
  const origGet = c2d.getImageData;
  const offProto =
    typeof OffscreenCanvasRenderingContext2D !== "undefined"
      ? OffscreenCanvasRenderingContext2D.prototype
      : null;
  const origOffGet = offProto?.getImageData;
  const origBitmap = window.createImageBitmap;
  const srcDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src")!;
  const queue = typeof GPUQueue !== "undefined" ? GPUQueue.prototype : null;
  const origWrite = queue?.writeTexture;
  const origCopy = queue?.copyExternalImageToTexture;

  c2d.getImageData = function (this: CanvasRenderingContext2D, ...args: unknown[]) {
    recordGetImageData(this.canvas, args);
    return (origGet as unknown as (...a: unknown[]) => ImageData).apply(this, args);
  } as typeof c2d.getImageData;

  if (offProto && origOffGet) {
    offProto.getImageData = function (this: OffscreenCanvasRenderingContext2D, ...args: unknown[]) {
      recordGetImageData(this.canvas, args);
      return (origOffGet as unknown as (...a: unknown[]) => ImageData).apply(this, args);
    } as typeof offProto.getImageData;
  }

  window.createImageBitmap = function (...args: unknown[]) {
    counters.bitmapTotal++;
    const kind = (args[0] as { constructor?: { name?: string } } | null)?.constructor?.name ?? "unknown";
    counters.bitmapBySource[kind] = (counters.bitmapBySource[kind] ?? 0) + 1;
    return (origBitmap as unknown as (...a: unknown[]) => Promise<ImageBitmap>).apply(window, args);
  } as typeof window.createImageBitmap;

  Object.defineProperty(HTMLImageElement.prototype, "src", {
    ...srcDesc,
    set(this: HTMLImageElement, value: string) {
      counters.elementDecodes++;
      srcDesc.set!.call(this, value);
    },
  });

  if (queue && origWrite && origCopy) {
    queue.writeTexture = function (this: GPUQueue, ...args: unknown[]) {
      counters.writeTextureCalls++;
      const data = args[1] as { byteLength?: number } | null;
      const bytes = Number(data?.byteLength ?? 0);
      if (copyRows(args[3]) > 1) counters.writeTextureSourceBytes += bytes;
      else counters.writeTextureRowBytes += bytes;
      return (origWrite as unknown as (...a: unknown[]) => void).apply(this, args);
    } as typeof queue.writeTexture;
    queue.copyExternalImageToTexture = function (this: GPUQueue, ...args: unknown[]) {
      counters.copyExternalImage++;
      return (origCopy as unknown as (...a: unknown[]) => void).apply(this, args);
    } as typeof queue.copyExternalImageToTexture;
  }

  return () => {
    c2d.getImageData = origGet;
    if (offProto && origOffGet) offProto.getImageData = origOffGet;
    window.createImageBitmap = origBitmap;
    Object.defineProperty(HTMLImageElement.prototype, "src", srcDesc);
    if (queue && origWrite && origCopy) {
      queue.writeTexture = origWrite;
      queue.copyExternalImageToTexture = origCopy;
    }
  };
}

// ---------------------------------------------------------------------------
// Specs and hosts
// ---------------------------------------------------------------------------
function imageSpec(src: string, label: string, settings?: Record<string, unknown>): PlotSpec {
  return {
    mode: "local",
    root: {
      kind: "plot",
      type: "image",
      data: { kind: "url", src },
      ...(settings ? { settings } : {}),
      props: { label, toolbar: true },
    },
  } as unknown as PlotSpec;
}

/** A two-operand absolute-difference card — the shape that used to drag every
 *  operand through `imageDataToSceneField` and upload it as rgba32float, and
 *  now uploads each operand once as an `rgba8unorm-srgb` bitmap. */
function compareSpec(a: string, b: string, label: string): PlotSpec {
  return {
    mode: "local",
    root: {
      kind: "compare",
      type: "image",
      presentation: "difference",
      operands: [
        { kind: "url", src: a },
        { kind: "url", src: b },
      ],
      strategy: "reference",
      referenceIndex: 0,
      settings: { "compare.operation": "absolute" },
      props: { label, toolbar: true },
    },
  } as unknown as PlotSpec;
}

function stage(): HTMLElement {
  return document.getElementById("stage")!;
}

/** `data-hist-total` for every open info panel on the stage — the number of
 *  samples its histogram actually binned. */
function histogramTotals(): number[] {
  return Array.from(stage().querySelectorAll("[data-cairn-info-panel]")).map((el) =>
    Number(el.getAttribute("data-hist-total") ?? "0"),
  );
}

/** Two columns inside the pinned stage: the tall wide card, then everything
 *  else wrapped beside it. See the page's stylesheet for why. */
function buildColumns(): { wide: HTMLElement; rest: HTMLElement } {
  const s = stage();
  s.replaceChildren();
  const wide = document.createElement("div");
  wide.style.cssText = `flex:0 0 ${WIDE_W}px`;
  const rest = document.createElement("div");
  rest.style.cssText = "flex:1 1 auto;min-width:0";
  s.append(wide, rest);
  return { wide, rest };
}

function addHost(
  column: HTMLElement,
  role: "image" | "compare",
  width: number,
  height: number,
): HTMLElement {
  const el = document.createElement("div");
  el.dataset.benchRole = role;
  el.style.width = `${width}px`;
  el.style.height = `${height}px`;
  column.appendChild(el);
  return el;
}

// ---------------------------------------------------------------------------
// Paint probes
// ---------------------------------------------------------------------------
/** CPU: the pane blits its content into ONE presentation canvas, so a non-blank
 *  centre pixel is the honest "this pane is on screen" signal. Read through the
 *  SAVED original `getImageData` so the probe is not counted as load cost. */
function cpuPainted(host: HTMLElement): boolean {
  const canvas = host.querySelector<HTMLCanvasElement>("canvas[data-cpu-image-canvas]");
  if (!canvas || canvas.width === 0 || canvas.height === 0) return false;
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  const px = ORIGINAL_GET_IMAGE_DATA.call(
    ctx,
    Math.floor(canvas.width / 2),
    Math.floor(canvas.height / 2),
    1,
    1,
  ).data;
  return px[3]! > 0 && (px[0]! > 0 || px[1]! > 0 || px[2]! > 0);
}

/**
 * GPU: a WebGPU canvas has no 2D context to read, and the pool's swapchain cap
 * (`MAX_LIVE_SWAPCHAINS`) parks panes after they present — so the honest signal
 * is the pool's own MONOTONE `everPresented`, not the momentary `presented`.
 */
function gpuPainted(host: HTMLElement): boolean {
  const canvas = host.querySelector<HTMLCanvasElement>("canvas[data-gpu-image-canvas]");
  if (!canvas) return false;
  return getCanvasPresentationStateForTest(canvas)?.everPresented === true;
}

// ---------------------------------------------------------------------------
// The numbers toggle — the SECOND demand for pixels
// ---------------------------------------------------------------------------
/**
 * True once the pixel-value overlay has drawn anything at all. Read through the
 * SAVED original `getImageData` (the overlay canvas is not one of the two pane
 * canvases the spy excludes, so the live one would count this probe as load
 * cost).
 */
function overlayInked(host: HTMLElement): boolean {
  const canvas = host.querySelector<HTMLCanvasElement>("canvas[data-pixel-value-overlay]");
  if (!canvas || canvas.width === 0 || canvas.height === 0) return false;
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  const px = ORIGINAL_GET_IMAGE_DATA.call(ctx, 0, 0, canvas.width, canvas.height).data;
  for (let i = 3; i < px.length; i += 4) if (px[i]! > 0) return true;
  return false;
}

interface NumbersToggle {
  /** The `image.view` zoom published to the pane. */
  zoom: number;
  /** Screen px per source texel at that zoom — must clear the overlay gate. */
  cellPx: number;
  /** The overlay actually drew numbers (so the demand really was made). */
  inked: boolean;
}

/**
 * Turn the per-pixel numbers ON for one pane, the way a user does: by ZOOMING
 * IN. There is no "numbers" switch — `PixelValueOverlay` reports demand
 * (`onSampleDemandChange`) the moment one source texel covers
 * `PIXEL_VALUE_MIN_SCREEN_PX` screen px, and it is that report which makes a
 * demand-driven backend read its pixels back. So this publishes an
 * `"image.view"` zoom through the pane's own registered settings accessor
 * (`state/selection/pane-registry.ts` — the same external-write seam a linked
 * peer writes through), which is the ONE write path a gesture would take too.
 *
 * The zoom is DERIVED from the pane's measured viewport instead of hard-coded:
 * the source is square, so the contain-fit side is `min(box.w, box.h)`, one
 * texel covers `zoom * side / IMAGE_N` screen px, and the zoom that puts that
 * at `NUMBERS_CELL_PX` falls out. Pan stays at the origin — `viewToQuad` scales
 * the fitted rect about the box origin, so the top-left texels stay in view at
 * any zoom and the overlay always has a non-empty window to draw.
 */
async function toggleNumbers(host: HTMLElement): Promise<NumbersToggle> {
  const surface = host.querySelector<HTMLElement>(
    "[data-cpu-image-surface], [data-gpu-image-surface]",
  );
  const paneId = host.querySelector<HTMLElement>("[data-plot-pane-id]")?.dataset.plotPaneId;
  const settings = paneId ? getRegisteredPane(paneId)?.settings : undefined;
  if (!surface || !settings) {
    throw new Error("image-load-cost: no registered pane to zoom (numbers toggle)");
  }
  const box = surface.getBoundingClientRect();
  const side = Math.min(box.width, box.height);
  if (side <= 0) throw new Error("image-load-cost: the pane to zoom has no measured viewport");
  const zoom = (NUMBERS_CELL_PX * IMAGE_N) / side;
  settings.set({ "image.view": { zoom, pan: { x: 0, y: 0 } } });
  const inked = await waitFor(() => overlayInked(host), 10_000, 50);
  return { zoom, cellPx: (zoom * side) / IMAGE_N, inked };
}

// ---------------------------------------------------------------------------
// One backend phase
// ---------------------------------------------------------------------------
const mib = (bytes: number): string => (bytes / (1024 * 1024)).toFixed(1);
const mpx = (pixels: number): string => (pixels / 1e6).toFixed(1);

function bySource(counts: Record<string, number>): string {
  const keys = Object.keys(counts).sort();
  return keys.length === 0 ? "none" : keys.map((k) => `${k} ${counts[k]}`).join(", ");
}

interface PhaseOptions {
  name: "cpu" | "gpu";
  renderMode: "cpu" | "gpu";
  /** One URL per image card — twelve DISTINCT ones (see the file header). */
  paneUrls: readonly string[];
  /** The two operands shared by every comparison card, distinct from all of
   *  the above. */
  compareUrls: readonly [string, string];
  compareCards: number;
}

/**
 * The GPU upload gate's expected `copyExternalImageToTexture` count: one per
 * DISTINCT source texture. The twelve image cards hold twelve distinct URLs, so
 * twelve; the comparison cards hold two more, and each is uploaded once per
 * FORMAT it is needed in — `rgba8unorm` for a plain pane, `rgba8unorm-srgb` for
 * a comparison operand (`expanded-upload-cache.ts` keys on the format) — but
 * these two URLs appear only inside comparison cards, so one upload each. Both
 * comparison cards name the SAME two URLs, and the upload cache is keyed by
 * content, so the second card re-leases the first card's textures rather than
 * uploading its own: two cards, two uploads, not four.
 */
function expectedCopies(paneCount: number, compareCards: number): number {
  return paneCount + (compareCards > 0 ? 2 : 0);
}

async function runPhase(opts: PhaseOptions): Promise<boolean> {
  stage().replaceChildren();
  const w = window as unknown as { __cairnPlotRenderMode?: string; __cairnPlotEagerMount?: boolean };
  w.__cairnPlotRenderMode = opts.renderMode;
  // Before ANY mount: the lazy viewport gate would otherwise decide what this
  // page measures.
  w.__cairnPlotEagerMount = true;

  // Left column: the wide card (the one with its histogram open). Right column:
  // the eleven ordinary cards and any comparison cards. All inside the pinned,
  // non-scrolling stage, so every one of them is on screen at once.
  const columns = buildColumns();
  const wideHost = addHost(columns.wide, "image", WIDE_W, WIDE_H);
  const narrowHosts = Array.from({ length: PANE_COUNT - 1 }, () =>
    addHost(columns.rest, "image", NARROW_W, NARROW_H),
  );
  const compareHosts = Array.from({ length: opts.compareCards }, () =>
    addHost(columns.rest, "compare", NARROW_W, NARROW_H),
  );
  const imageHosts = [wideHost, ...narrowHosts];

  const distinctUrls = PANE_COUNT + (opts.compareCards > 0 ? 2 : 0);

  counters = zeroCounters();
  const conversionsBefore = sceneConversionCount();
  const restore = installSpies();
  const roots: Root[] = [];
  let painted = 0;
  let elapsed = 0;
  // `getImageData` calls at the end of MOUNT — before anything on screen asks
  // for pixels a second time.
  let readbacksAtMount = -1;
  let histogramBinned = false;
  let toggle: NumbersToggle | null = null;
  let readbacksAfterToggle = -1;
  let readbacksSettled = -1;
  try {
    const started = performance.now();
    imageHosts.forEach((host, i) => {
      const root = createRoot(host);
      root.render(
        createElement(PlotApp, {
          spec: imageSpec(
            opts.paneUrls[i]!,
            `card-${i}`,
            // Index 0 IS `wideHost` (it heads `imageHosts`).
            i === 0 ? { "panel.info": true } : undefined,
          ),
        }),
      );
      roots.push(root);
    });
    compareHosts.forEach((host, i) => {
      const root = createRoot(host);
      root.render(
        createElement(PlotApp, {
          spec: compareSpec(opts.compareUrls[0], opts.compareUrls[1], `diff-${i}`),
        }),
      );
      roots.push(root);
    });

    const isPainted = opts.name === "cpu" ? cpuPainted : gpuPainted;
    const paintedCount = () => imageHosts.filter((h) => isPainted(h)).length;
    await waitFor(() => paintedCount() === PANE_COUNT, PAINT_TIMEOUT_MS, 50);
    elapsed = performance.now() - started;
    painted = paintedCount();
    // The wide card's histogram panel opens a commit or two AFTER its first
    // paint, and on the CPU backend the readback it needs is a whole round trip
    // behind that again (the panel's `onHistogramDemandChange` → the pane's
    // demand effect → `imageData()` → a version bump). That readback IS part of
    // the load cost being measured, so wait for it here, INSIDE the spied
    // window, rather than counting it afterwards.
    // A panel with a non-zero sample total is the proof that the readback
    // actually REACHED the histogram — on the CPU backend those pixels now
    // arrive only because the panel asked for them (`onHistogramDemandChange`),
    // so an open panel binning nothing would mean the one `getImageData` gated
    // below was counted for a histogram that never got its data.
    histogramBinned = await waitFor(() => histogramTotals().some((t) => t > 0), 8_000, 50);
    // Settle before latching the mount count: a readback that arrives a tick
    // after the histogram's would otherwise be attributed to the toggle.
    await sleep(400);
    readbacksAtMount = counters.getImageDataCalls;

    // ── the second demand ────────────────────────────────────────────────────
    // Zoom ONE narrow pane past the numbers threshold. Its pixels were never
    // read at mount (nothing was showing them), so this is the whole point of
    // the demand-driven readback: exactly one more full-frame read, for the one
    // pane that now needs it, and nothing for the ten that do not.
    toggle = await toggleNumbers(narrowHosts[0]!);
    await waitFor(() => counters.getImageDataCalls > readbacksAtMount, 10_000, 50);
    readbacksAfterToggle = counters.getImageDataCalls;
    // And it must STAY at one more: a pane that re-reads its frame on every
    // redraw would pass the check above and still be the defect.
    await sleep(600);
    readbacksSettled = counters.getImageDataCalls;
  } finally {
    restore();
  }

  const c = counters;
  const conversions = sceneConversionCount() - conversionsBefore;
  let ok = painted === PANE_COUNT;
  report(
    ok,
    `${opts.name}: ${painted}/${PANE_COUNT} image panes painted within ${(PAINT_TIMEOUT_MS / 1000).toFixed(0)} s`,
  );

  // The wide card exists precisely so ONE pane has its histogram open and pays
  // for the readback that demands. If this ever stops holding, the harness has
  // stopped measuring the case it was built for and the readback gates below
  // are quietly the wrong shape — so it is a GATE, not a note.
  const panels = stage().querySelectorAll("[data-cairn-info-panel]").length;
  // The shell spreads `surfaceAttrs` onto the ONE measured viewport element, so
  // this is exactly the `paneW` the auto-open rule would compare against —
  // printed to show how far short of 896 px it stays (see `WIDE_W`).
  const wideBox =
    wideHost
      .querySelector("[data-cpu-image-surface], [data-gpu-image-surface]")
      ?.getBoundingClientRect().width ?? 0;
  const panelOk = panels === 1 && histogramBinned;
  ok = ok && panelOk;
  report(
    panelOk,
    `${opts.name}: exactly one histogram panel open and binning (the ${WIDE_W}x${WIDE_H} card, ` +
      `viewport ${wideBox.toFixed(0)} px; the ${NARROW_W}x${NARROW_H} cards must not), ` +
      `panels ${panels}, binned samples ${histogramTotals().join("/") || "none"}`,
  );

  const elementOk = c.elementDecodes === 0;
  ok = ok && elementOk;
  report(
    elementOk,
    `${opts.name}: ${c.elementDecodes} element decode(s) — the <img> fallback must never run on ` +
      `same-origin data (expected 0)`,
  );

  const blobs = c.bitmapBySource["Blob"] ?? 0;
  const bitmapOk = c.bitmapTotal === distinctUrls && blobs === distinctUrls;
  ok = ok && bitmapOk;
  report(
    bitmapOk,
    `${opts.name}: createImageBitmap ${c.bitmapTotal} (${bySource(c.bitmapBySource)}) — one decode ` +
      `per distinct URL, all from a Blob (expected ${distinctUrls} = ${PANE_COUNT} cards` +
      (opts.compareCards > 0 ? " + 2 comparison operands" : "") +
      `)`,
  );

  const mountReadbackOk = readbacksAtMount === 1;
  ok = ok && mountReadbackOk;
  report(
    mountReadbackOk,
    `${opts.name}: ${readbacksAtMount} full-frame readback(s) at mount — only the open histogram's ` +
      `(expected 1; ${mpx(c.getImageDataPixels)} Mpx read in total by the end of the phase)`,
  );

  const toggleOk =
    !!toggle &&
    toggle.inked &&
    toggle.cellPx >= PIXEL_VALUE_MIN_SCREEN_PX &&
    readbacksAfterToggle === readbacksAtMount + 1 &&
    readbacksSettled === readbacksAtMount + 1;
  ok = ok && toggleOk;
  report(
    toggleOk,
    `${opts.name}: numbers on ONE narrow pane (zoom ${toggle?.zoom.toFixed(0) ?? "-"}, ` +
      `${toggle?.cellPx.toFixed(1) ?? "-"} px per texel ≥ ${PIXEL_VALUE_MIN_SCREEN_PX}, overlay ` +
      `inked ${toggle?.inked ?? false}) cost exactly one more readback: ` +
      `${readbacksAtMount} → ${readbacksAfterToggle}, still ${readbacksSettled} after settling`,
  );

  const conversionsOk = conversions === 0;
  ok = ok && conversionsOk;
  report(
    conversionsOk,
    `${opts.name}: ${conversions} imageDataToSceneField conversion(s) — no scalar sRGB expansion on ` +
      `either mount path (expected 0)`,
  );

  if (opts.name === "gpu") {
    const uploadOk = c.writeTextureSourceBytes === 0;
    ok = ok && uploadOk;
    report(
      uploadOk,
      `gpu: writeTexture uploaded ${c.writeTextureSourceBytes} source byte(s) — no image travels ` +
        `through a CPU buffer (expected 0; the ${c.writeTextureCalls} call(s) left are ` +
        `${c.writeTextureRowBytes}-byte single-row colormap LUTs)`,
    );
    const want = expectedCopies(PANE_COUNT, opts.compareCards);
    const copyOk = c.copyExternalImage === want;
    ok = ok && copyOk;
    report(
      copyOk,
      `gpu: copyExternalImageToTexture ${c.copyExternalImage} — one bitmap upload per distinct ` +
        `source texture (expected ${want})`,
    );
  }

  report(
    true,
    `BENCH: ${opts.name} ${PANE_COUNT} panes` +
      (opts.compareCards > 0 ? ` + ${opts.compareCards} compare` : "") +
      `: all painted in ${elapsed.toFixed(0)} ms; element decodes ${c.elementDecodes}, ` +
      `createImageBitmap ${c.bitmapTotal} (${bySource(c.bitmapBySource)}), ` +
      `getImageData ${c.getImageDataCalls} (${mpx(c.getImageDataPixels)} Mpx), ` +
      `scene conversions ${conversions}` +
      (opts.name === "gpu"
        ? `, writeTexture ${mib(c.writeTextureSourceBytes)} MB of sources + ` +
          `${c.writeTextureRowBytes} B of LUT rows in ${c.writeTextureCalls} call(s), ` +
          `copyExternalImageToTexture ${c.copyExternalImage}`
        : ""),
  );

  roots.forEach((r) => r.unmount());
  stage().replaceChildren();
  await sleep(60);
  return ok;
}

// ---------------------------------------------------------------------------
// Fixture byte-identity
// ---------------------------------------------------------------------------
/** FNV-1a over the decoded bytes — a stable, comparable stand-in for "these two
 *  paths produced the same pixels". */
function digest(data: Uint8ClampedArray): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) {
    h ^= data[i]!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

function readBack(source: CanvasImageSource, w: number, h: number): Uint8ClampedArray {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(source, 0, 0);
  return ORIGINAL_GET_IMAGE_DATA.call(ctx, 0, 0, w, h).data;
}

/**
 * GATE: the pixels the PRODUCT now hands to a histogram, to the pixel-value
 * numbers and to a CPU processing pass — `decodedImage(url).imageData()`, the
 * `fetch` → `Blob` → `createImageBitmap` path — are byte-for-byte the pixels
 * the product used to produce by decoding an `<img>` and drawing it to a
 * scratch canvas (still done here, by hand, as the reference).
 *
 * Two fixtures, chosen for the two ways a decode swap silently changes colour:
 * a `gAMA`-tagged PNG (colour management) and a two-alpha-level PNG
 * (premultiplication). `decodedImage` decodes with
 * `colorSpaceConversion: "default"` and `premultiplyAlpha: "none"` precisely so
 * both stay identical; this is the assertion that says so.
 */
async function fixtureIdentity(name: string, url: string): Promise<boolean> {
  const img = new Image();
  img.src = url;
  await img.decode();
  const viaElement = readBack(img, img.naturalWidth, img.naturalHeight);
  const decoded = await decodedImage(url);
  const pixels = decoded ? await decoded.imageData() : null;
  const sameDims =
    !!pixels && pixels.width === img.naturalWidth && pixels.height === img.naturalHeight;
  const elementDigest = digest(viaElement);
  const productDigest = pixels ? digest(pixels.data) : "none";
  const same = sameDims && elementDigest === productDigest;
  report(
    same,
    `${name} ${img.naturalWidth}x${img.naturalHeight} fixture reads back identical through ` +
      `decodedImage().imageData() and through the <img> element path: element ${elementDigest}, ` +
      `decodedImage ${productDigest}` +
      (sameDims ? "" : ` (dims ${pixels ? `${pixels.width}x${pixels.height}` : "null"})`),
  );
  return same;
}

/**
 * The BEFORE/AFTER summary, per image, as one BENCH line.
 *
 * The "before" figures are the per-image costs of the code at the plan's Task 0
 * commit (`ff7cf32`), read off ITS harness run — not re-measured here: the
 * branch is linear, that code is gone, and re-running it would mean rewriting
 * history. Task 0 measured twelve panes sharing TWO urls; the per-image costs
 * below are what its aggregate decomposes into, and its GPU byte total is the
 * arithmetic proof of the decomposition: 2 plain images x 16 MB (rgba8unorm)
 * + 2 comparison operands x 64 MB (rgba32float) = the 160 MB it reported.
 */
function costRatio(): void {
  const frame = IMAGE_N * IMAGE_N * 4;
  report(
    true,
    `BENCH: per image, before → after: CPU 2 element decodes + 1 createImageBitmap(element) + ` +
      `1 unconditional ${mib(frame)} MB readback → 1 createImageBitmap(Blob) + 0 readbacks ` +
      `(4 native decode/readback calls → 1, and ${mib(frame)} MB → 0 B of main-thread copy); ` +
      `GPU 1 element decode + 1 ${mib(frame)} MB readback + ${mib(frame)} MB writeTexture → ` +
      `1 createImageBitmap(Blob) + 1 copyExternalImageToTexture (0 B through a CPU buffer); ` +
      `per comparison operand 1 scalar rgba32float scene conversion + ${mib(frame * 4)} MB ` +
      `writeTexture → 0 conversions and an rgba8unorm-srgb bitmap upload. Readbacks are now ` +
      `demand-driven: this page pays exactly 1 at mount (the open histogram) instead of 12.`,
  );
}

// ---------------------------------------------------------------------------
async function run(): Promise<boolean> {
  registerCoreRenderers();

  // Encoded ONCE. Each phase gets its own URL fragment so the document-scoped
  // decode cache cannot make the second phase look free (see the file header).
  const gradient = gradientPng();
  const checker = checkerPng();
  report(
    true,
    `BENCH: fixtures: ${IMAGE_N}x${IMAGE_N} gradient ${mib(gradient.length)} MB and ` +
      `checker ${mib(checker.length)} MB as PNG data URLs; ${mib(IMAGE_N * IMAGE_N * 4)} MB each decoded`,
  );

  // One URL PER PANE (see the file header): the payload alternates so no two
  // neighbouring cards show the same picture, but every card has a cache key of
  // its own, so twelve cards cost twelve decodes and the gates measure per-pane
  // work rather than per-page work.
  const paneUrls = (phase: string): string[] =>
    Array.from(
      { length: PANE_COUNT },
      (_, i) => `${i % 2 === 0 ? gradient : checker}#${phase}-p${i}`,
    );
  // The comparison cards' two operands: distinct from the twelve AND from each
  // other, so `absolute` difference has something to compute.
  const compareUrls = (phase: string): [string, string] => [
    `${gradient}#${phase}-cmp-a`,
    `${checker}#${phase}-cmp-b`,
  ];

  let ok = await runPhase({
    name: "cpu",
    renderMode: "cpu",
    paneUrls: paneUrls("cpu"),
    compareUrls: compareUrls("cpu"),
    compareCards: 0,
  });

  if (navigator.gpu) {
    ok =
      (await runPhase({
        name: "gpu",
        renderMode: "gpu",
        paneUrls: paneUrls("gpu"),
        compareUrls: compareUrls("gpu"),
        compareCards: 2,
      })) && ok;
  } else {
    // Not a gate: the runner already reports a GPU-less environment loudly, and
    // a FAIL here would only make "no adapter" indistinguishable from "slow".
    report(true, "BENCH: gpu phase SKIPPED — navigator.gpu is absent");
  }

  // Unspied, after both phases: the two decode paths must agree byte for byte.
  ok = (await fixtureIdentity("gamma-tagged", TAGGED_PNG)) && ok;
  ok = (await fixtureIdentity("translucent", TRANSLUCENT_PNG)) && ok;
  costRatio();
  return ok;
}

run()
  .then(setOverallStatus)
  .catch((e) => {
    report(false, `threw: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`);
    setOverallStatus(false);
  });
