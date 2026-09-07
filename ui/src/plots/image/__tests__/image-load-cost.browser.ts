/**
 * IMAGE LOAD COST — what opening a run full of 8-bit image cards actually costs.
 *
 * This harness measures ONE moment: mount. A report page is a gallery of image
 * panes that all appear at once, and the complaint it exists to quantify is that
 * that moment is slow on BOTH backends. The costs are invisible to every other
 * test in the tree — they are native calls inside the decode path, not DOM state
 * — so they are counted here with prototype spies:
 *
 *   HTMLImageElement.prototype.src   — an ELEMENT decode. `loadImageData`
 *                                      decodes every source through an `<img>`,
 *                                      draws it to a scratch canvas and reads
 *                                      the whole thing back, at mount, for every
 *                                      pane; the CPU backend then decodes the
 *                                      same URL a SECOND time for its paint
 *                                      source.
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
 *   GPUQueue.writeTexture            — bytes uploaded as raw buffers. Every byte
 *                                      here is a CPU-side expansion the GPU
 *                                      could have decoded itself.
 *   GPUQueue.copyExternalImageToTexture — the upload that does NOT go through a
 *                                      CPU buffer. Today: zero.
 *   sceneConversionCount()           — `imageDataToSceneField` calls, from
 *                                      `resources/scene-field.ts`. Each one
 *                                      builds a `w*h*4` Float32Array one pixel
 *                                      at a time; on the WebGPU comparison path
 *                                      that is pure waste, since `textureLoad`
 *                                      on an sRGB texture returns linear values
 *                                      already.
 *
 * WHAT IS GATED, AND WHAT IS NOT. Only one thing is asserted today: all twelve
 * image panes paint, on each backend, inside the runner's timeout. Every
 * measurement is emitted as `report(true, "BENCH: …")` — a BASELINE, not a
 * budget. That is deliberate: this harness is written BEFORE the fixes, so the
 * numbers it prints are the numbers to beat, and pinning them as assertions now
 * would only pin in the defect. The later tasks in this plan turn the BENCH
 * lines into gates (element decodes 0, `createImageBitmap` == distinct URLs,
 * `getImageData` == 1, `writeTexture` bytes 0, scene conversions 0).
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
 * PHASE INDEPENDENCE. The decoded-`ImageData` cache (`resources/cache.ts`) is
 * keyed by URL and lives for the document, so if the two backend phases shared
 * URLs the GPU phase would measure a warm cache and report near-zero cost. The
 * two 2048² PNG payloads are therefore encoded ONCE (the expensive part) and
 * handed to each phase under a distinct URL FRAGMENT (`#cpu` / `#gpu`), which a
 * data: URL decoder ignores but every cache key includes.
 */
import { createRoot, type Root } from "react-dom/client";
import { createElement } from "react";
import { PlotApp } from "../../../host/bootstrap";
import { registerCoreRenderers } from "../../register-core";
import type { PlotSpec } from "../../../../../packages/spec/src/spec.ts";
import { sceneConversionCount } from "../resources/scene-field.ts";
import { getCanvasPresentationStateForTest } from "../webgpu/pool.ts";
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
 * management. Baseline digests are printed below; the byte-identity GATE lands
 * with the decode rewrite.
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
  writeTextureBytes: number;
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
    writeTextureBytes: 0,
    copyExternalImage: 0,
  };
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
      counters.writeTextureBytes += Number(data?.byteLength ?? 0);
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

/** A two-operand absolute-difference card — the shape that drags every operand
 *  through `imageDataToSceneField` on the WebGPU path today. */
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
  gradient: string;
  checker: string;
  compareCards: number;
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

  counters = zeroCounters();
  const conversionsBefore = sceneConversionCount();
  const restore = installSpies();
  const roots: Root[] = [];
  let painted = 0;
  let elapsed = 0;
  try {
    const started = performance.now();
    imageHosts.forEach((host, i) => {
      const root = createRoot(host);
      // Alternate the two sources so the run is not one URL twelve times — a
      // per-URL cache would otherwise hide eleven twelfths of the cost.
      root.render(
        createElement(PlotApp, {
          spec: imageSpec(
            i % 2 === 0 ? opts.gradient : opts.checker,
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
        createElement(PlotApp, { spec: compareSpec(opts.gradient, opts.checker, `diff-${i}`) }),
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
    // so an open panel binning nothing would mean the one `getImageData` below
    // was counted for a histogram that never got its data.
    await waitFor(() => histogramTotals().some((t) => t > 0), 8_000, 50);
  } finally {
    restore();
  }

  const c = counters;
  const conversions = sceneConversionCount() - conversionsBefore;
  const ok = painted === PANE_COUNT;
  report(
    ok,
    `${opts.name}: ${painted}/${PANE_COUNT} image panes painted within ${(PAINT_TIMEOUT_MS / 1000).toFixed(0)} s`,
  );
  // Reported, not gated: the wide card exists precisely so ONE pane has its
  // histogram open and pays for the readback that demands. If this ever reads 0
  // the harness has stopped measuring the case it was built for, and the
  // `getImageData` baseline below is quietly the wrong shape.
  const panels = stage().querySelectorAll("[data-cairn-info-panel]").length;
  // The shell spreads `surfaceAttrs` onto the ONE measured viewport element, so
  // this is exactly the `paneW` the auto-open rule would compare against —
  // printed to show how far short of 896 px it stays (see `WIDE_W`).
  const wideBox =
    wideHost
      .querySelector("[data-cpu-image-surface], [data-gpu-image-surface]")
      ?.getBoundingClientRect().width ?? 0;
  report(
    true,
    `BENCH: ${opts.name}: ${panels} histogram panel(s) open (the ${WIDE_W}x${WIDE_H} card, viewport ` +
      `${wideBox.toFixed(0)} px; the ${NARROW_W}x${NARROW_H} cards must not), ` +
      `binned samples ${histogramTotals().join("/") || "none"}`,
  );
  const gpuPart =
    opts.name === "gpu"
      ? `, writeTexture ${mib(c.writeTextureBytes)} MB in ${c.writeTextureCalls} call(s), ` +
        `copyExternalImageToTexture ${c.copyExternalImage}`
      : "";
  report(
    true,
    `BENCH: ${opts.name} ${PANE_COUNT} panes` +
      (opts.compareCards > 0 ? ` + ${opts.compareCards} compare` : "") +
      `: all painted in ${elapsed.toFixed(0)} ms; element decodes ${c.elementDecodes}, ` +
      `createImageBitmap ${c.bitmapTotal} (${bySource(c.bitmapBySource)}), ` +
      `getImageData ${c.getImageDataCalls} (${mpx(c.getImageDataPixels)} Mpx), ` +
      `scene conversions ${conversions}${gpuPart}`,
  );

  roots.forEach((r) => r.unmount());
  stage().replaceChildren();
  await sleep(60);
  return ok;
}

// ---------------------------------------------------------------------------
// Fixture readback baseline
// ---------------------------------------------------------------------------
/** FNV-1a over the decoded bytes — a stable, comparable stand-in for "these two
 *  paths produced the same pixels", printed so the byte-identity gate that
 *  lands with the decode rewrite has a baseline to be measured against. */
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

async function fixtureBaseline(name: string, url: string): Promise<void> {
  const img = new Image();
  img.src = url;
  await img.decode();
  const viaElement = readBack(img, img.naturalWidth, img.naturalHeight);
  const blob = await (await fetch(url)).blob();
  const bitmap = await createImageBitmap(blob);
  const viaBitmap = readBack(bitmap, bitmap.width, bitmap.height);
  bitmap.close();
  const same = digest(viaElement) === digest(viaBitmap);
  report(
    true,
    `BENCH: ${name} ${img.naturalWidth}x${img.naturalHeight} fixture: element path ${digest(viaElement)}, ` +
      `createImageBitmap(Blob) path ${digest(viaBitmap)}, identical ${same}`,
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

  let ok = await runPhase({
    name: "cpu",
    renderMode: "cpu",
    gradient: `${gradient}#cpu`,
    checker: `${checker}#cpu`,
    compareCards: 0,
  });

  if (navigator.gpu) {
    ok =
      (await runPhase({
        name: "gpu",
        renderMode: "gpu",
        gradient: `${gradient}#gpu`,
        checker: `${checker}#gpu`,
        compareCards: 2,
      })) && ok;
  } else {
    // Not a gate: the runner already reports a GPU-less environment loudly, and
    // a FAIL here would only make "no adapter" indistinguishable from "slow".
    report(true, "BENCH: gpu phase SKIPPED — navigator.gpu is absent");
  }

  // Unspied, after both phases: these two calls are a baseline for a LATER
  // gate, not part of the load cost being measured.
  await fixtureBaseline("gamma-tagged", TAGGED_PNG);
  await fixtureBaseline("translucent", TRANSLUCENT_PNG);
  return ok;
}

run()
  .then(setOverallStatus)
  .catch((e) => {
    report(false, `threw: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`);
    setOverallStatus(false);
  });
