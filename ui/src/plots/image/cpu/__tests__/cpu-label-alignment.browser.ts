/**
 * TEV LABEL ↔ PAINT ALIGNMENT — the end-to-end proof that the per-pixel numbers
 * land on the texels the pane actually painted.
 *
 * Both halves of an image pane derive their geometry from ONE `ImageViewport`
 * (`components/image-viewport.ts`): `cpu/paint.ts` blits the bitmap into the
 * presentation canvas at `viewport.quad` scaled to DEVICE px, while
 * `PixelValueOverlay` centres each number at `quad.left + (px+0.5)*pitch` in CSS
 * px on a canvas carrying the CSS→device transform. A dropped or doubled `dpr`
 * factor, a half-texel origin slip, or a paint that letterboxes differently than
 * the overlay does are all invisible to a unit test (jsdom has neither layout nor
 * a rasteriser). So this harness measures the RENDERED PIXELS:
 *
 *   1. Paint a 512x512 source whose texel colour ALTERNATES per texel
 *      (R = 0/255 by column parity, G = 0/255 by row parity), so every texel
 *      boundary is a full-contrast colour edge on both axes — robust to any
 *      display transfer either backend applies.
 *   2. Read the presentation surface back and locate those edges, in device px,
 *      along the middle scanline (columns) and the middle column (rows). The
 *      midpoints between consecutive edges are the texel centres the pane
 *      PAINTED — measured, not derived.
 *   3. Read the label canvas back and locate the ink clusters — the numbers the
 *      overlay DREW — independently, on the same axes.
 *   4. Assert every painted texel centre carries a label centred on it (<= 1 px),
 *      and that the painted texel pitch matches `viewToQuad`'s (<= 1 px), which
 *      pins the measured paint to the SHARED geometry, not merely to itself.
 *
 * TOLERANCE: 1 px, not the ~0.05 px the pure geometry would give. The paint's
 * destination rect is float32 inside Skia and magnified sampling is nearest, so a
 * detected edge is quantised to the device pixel it falls in, and a cluster
 * midpoint to a half pixel. 1 px is the measurement floor; the failures this
 * guards (a dpr factor, a half-texel origin) are tens of px at these zooms.
 *
 * TWO MEASUREMENT CORRECTIONS, both about turning ink into a position:
 *   - Ink runs are in pixel INDICES; a run [start,last] covers the continuous
 *     span [start, last+1), so its centre is (start+last+1)/2. Painted edges are
 *     already continuous boundary coordinates. Mixing the two conventions is a
 *     flat 0.5 px error — measured, and removed.
 *   - A line of text drawn with `textBaseline:"middle"` is NOT vertically centred
 *     on its ink: digits sit asymmetrically in the em box, so the ink extent's
 *     midpoint lands ~3% of the stack height above where the overlay drew. That
 *     is a FONT METRIC, not a misalignment — so it is CALIBRATED
 *     (`calibrateInkBias` re-draws the overlay's own 4-line stack, with its font,
 *     baseline and drop shadow, at a KNOWN centre and measures the offset as a
 *     fraction of the stack's ink extent) and subtracted. Nothing else about the
 *     comparison is tuned, and the calibration numbers are reported.
 *   Ink is keyed on BRIGHTNESS (the fixed-intensity glyph fills), never on alpha:
 *   every glyph sits on a black drop shadow offset downward, which would bias an
 *   alpha-keyed midpoint on the very axis being measured.
 *
 * DPR. The page runs under the runner's `data-cairn-harness-dpr="2"` override;
 * `cpu-label-alignment-dpr1.browser.html` loads this same bundle without it. The
 * EFFECTIVE ratio is MEASURED (`paint.width / box.width`) and printed on every
 * line rather than assumed — headless Chromium's `device-pixel-content-box` does
 * not follow a CDP `deviceScaleFactor` override, so on a headless runner the
 * DPR-2 page exercises `devicePixelRatio = 2` against a 1x device-pixel content
 * box (the pane must believe the MEASURED box, not the ratio); on a real 2x
 * display, or a Chromium launched with `--force-device-scale-factor=2`, the same
 * page is a genuine 2x backing store.
 *
 * The GPU section repeats the whole measurement on `GpuImagePane` (whose live
 * in-DOM swapchain reads blank through `createImageBitmap`, so it goes through
 * the pane's test-only `__cairnImagePaneProbe.readbackSurface()` seam) and SKIPS
 * LOUDLY, without failing, when the runner has no WebGPU adapter.
 */
import { createRoot, type Root } from "react-dom/client";
import { createElement as h, useState, type ComponentType } from "react";
import CpuImagePane from "../view.tsx";
import GpuImagePane from "../../webgpu/view.tsx";
import type { ImageViewState } from "../../../../host/hooks/use-image-gestures";
import { createHarness, sleep, waitFor } from "../../../../testing/harness";
import { viewToQuad } from "../../components/region-select.ts";
import { PIXEL_VALUE_LINE_H_FRAC } from "../../../../primitives/components/pixel-value-size.ts";

const { report, setOverallStatus } = createHarness({
  title: "CPU-LABEL-ALIGNMENT",
  colors: { pass: "#6f6", fail: "#f66" },
});

const N = 512;
/** Channel jump that counts as a texel boundary (the source alternates 0/255). */
const EDGE_DELTA = 64;
/** Glyph-fill brightness floor; the drop shadow is black and never reaches it. */
const INK_BRIGHTNESS = 120;

/** RGBA pixels read back from a presentation surface (2D canvas or GPU surface). */
interface Pixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/**
 * A `n`x`n` PNG whose texel colour ALTERNATES with texel parity: R = 255 on odd
 * columns, G = 255 on odd rows, B constant. Adjacent columns therefore differ by
 * a full 255 in R and adjacent rows by 255 in G, so every texel boundary is a
 * detectable edge on both axes NO MATTER what display transfer a backend applies
 * (an index ramp could quantise two neighbours together). A same-origin `data:`
 * URL keeps the readback canvas untainted — harness code, not the paint path.
 */
function parityImageUrl(n: number): string {
  const c = document.createElement("canvas");
  c.width = n;
  c.height = n;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(n, n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = (y * n + x) * 4;
      img.data[i] = x & 1 ? 255 : 0;
      img.data[i + 1] = y & 1 ? 255 : 0;
      img.data[i + 2] = 128;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL("image/png");
}

// Built ONCE: a fresh data URL per render would be a fresh content key, so the
// pane would re-decode (and briefly blank) on every commit.
const SOURCE_URL = parityImageUrl(N);

/** A 2D canvas's current bitmap as RGBA pixels. */
async function readCanvas(canvas: HTMLCanvasElement): Promise<Pixels | null> {
  if (canvas.width === 0 || canvas.height === 0) return null;
  const bitmap = await createImageBitmap(canvas);
  const tmp = document.createElement("canvas");
  tmp.width = bitmap.width;
  tmp.height = bitmap.height;
  const ctx = tmp.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const img = ctx.getImageData(0, 0, tmp.width, tmp.height);
  return { data: img.data, width: img.width, height: img.height };
}

/** Device-px boundary coordinates where a channel jumps along one 1-px strip. */
function edges(strip: Uint8ClampedArray, length: number, channel: number): number[] {
  const out: number[] = [];
  for (let i = 1; i < length; i++) {
    if (strip[i * 4 + 3]! < 128 || strip[(i - 1) * 4 + 3]! < 128) continue;
    if (Math.abs(strip[i * 4 + channel]! - strip[(i - 1) * 4 + channel]!) > EDGE_DELTA) out.push(i);
  }
  return out;
}

/** One run of label ink along an axis, in continuous coordinates. */
interface Cluster {
  /** Midpoint of the ink extent. */
  mid: number;
  /** Length of the ink extent. */
  extent: number;
  /** Touches the canvas border, so extent (and midpoint) is truncated. */
  clipped: boolean;
}

/** Runs of ink separated by at least `gap` empty samples. */
function inkClusters(profile: Float64Array, gap: number): Cluster[] {
  const out: Cluster[] = [];
  let start = -1;
  let last = -1;
  const push = () => {
    if (start < 0) return;
    // The index run [start,last] covers the continuous span [start, last+1).
    out.push({
      mid: (start + last + 1) / 2,
      extent: last + 1 - start,
      clipped: start === 0 || last === profile.length - 1,
    });
    start = -1;
  };
  for (let i = 0; i < profile.length; i++) {
    if (profile[i]! > 0) {
      if (start < 0) start = i;
      last = i;
    } else if (start >= 0 && i - last > gap) {
      push();
    }
  }
  push();
  return out;
}

/** Per-axis BRIGHT-ink profiles of a label canvas (see the header on ink vs alpha). */
function inkProfiles(img: Pixels): { cols: Float64Array; rows: Float64Array } {
  const cols = new Float64Array(img.width);
  const rows = new Float64Array(img.height);
  const d = img.data;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 4;
      if (d[i + 3]! < 128) continue;
      if (Math.max(d[i]!, d[i + 1]!, d[i + 2]!) < INK_BRIGHTNESS) continue;
      cols[x]! += 1;
      rows[y]! += 1;
    }
  }
  return { cols, rows };
}

/**
 * The offset between where the overlay DRAWS a cell's stack of numbers and where
 * that stack's ink extent is centred, per axis, as a fraction of the extent — a
 * pure font metric (`textBaseline:"middle"` centres the em box, not the digits).
 * Measured by re-drawing the overlay's own stack (its font stack, its
 * `PIXEL_VALUE_LINE_H_FRAC` pitch, its constant dark drop shadow) at a KNOWN
 * centre and reading the ink back through the same brightness rule, so the
 * correction is scale-free and threshold-consistent with the real measurement.
 */
function calibrateInkBias(): { x: number; y: number; note: string } {
  const F = 40;
  const size = 400;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.clearRect(0, 0, size, size);
  ctx.font = `${F}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0,0,0,0.9)";
  ctx.shadowBlur = Math.max(2, F * 0.15);
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = Math.max(1, F * 0.06);
  ctx.fillStyle = "#ffffff";
  // One line per channel of a uint8 RGBA cell, the shapes the overlay prints.
  const lines = ["0", "1", "0.502", "1"];
  const lineH = F * PIXEL_VALUE_LINE_H_FRAC;
  const cx = size / 2;
  const cy = size / 2;
  let ly = cy - (lines.length * lineH) / 2 + lineH / 2;
  for (const line of lines) {
    ctx.fillText(line, cx, ly);
    ly += lineH;
  }
  const img = ctx.getImageData(0, 0, size, size);
  const { cols, rows } = inkProfiles({ data: img.data, width: size, height: size });
  const xs = inkClusters(cols, size)[0]!;
  const ys = inkClusters(rows, size)[0]!;
  return {
    x: (xs.mid - cx) / xs.extent,
    y: (ys.mid - cy) / ys.extent,
    note:
      `ink-bias calibration @${F}px: x ${(xs.mid - cx).toFixed(2)}px over ${xs.extent}px extent, ` +
      `y ${(ys.mid - cy).toFixed(2)}px over ${ys.extent}px extent`,
  };
}

const INK_BIAS = calibrateInkBias();

interface AxisResult {
  /** Painted texel centres that were compared against a label. */
  cells: number;
  /** Worst |label centre - painted texel centre|, CSS px. */
  maxErr: number;
  /** Worst |label-to-label spacing - painted pitch|, device px (clustering sanity). */
  spacingErr: number;
  usable: number;
}

/**
 * Compare one axis's label clusters with its painted texel centres.
 *
 * Only positions at least 0.6 of a texel inside the canvas are used: a cell whose
 * label runs off the viewport has a truncated (meaningless) ink extent, and
 * clipped clusters are never matched against. `bias` is the calibrated
 * font-metric offset per unit of ink extent.
 */
function compareAxis(
  edg: number[],
  clusters: Cluster[],
  dpr: number,
  extent: number,
  pitch: number,
  bias: number,
): AxisResult {
  const inside = (v: number) => v >= 0.6 * pitch && v <= extent - 0.6 * pitch;
  const usable = clusters
    .filter((c) => !c.clipped && inside(c.mid))
    .map((c) => c.mid - bias * c.extent);
  let cells = 0;
  let maxErr = 0;
  for (let i = 0; i + 1 < edg.length; i++) {
    const center = (edg[i]! + edg[i + 1]!) / 2;
    if (!inside(center) || usable.length === 0) continue;
    const m = usable.reduce(
      (best, v) => (Math.abs(v - center) < Math.abs(best - center) ? v : best),
      usable[0]!,
    );
    maxErr = Math.max(maxErr, Math.abs(m - center) / dpr);
    cells++;
  }
  // Consecutive label positions must be exactly one painted texel apart. This is
  // the clustering's own sanity check: a merged pair reads ~2*pitch and a split
  // cell ~0, either of which would make the positions above meaningless.
  let spacingErr = 0;
  for (let i = 0; i + 1 < usable.length; i++) {
    spacingErr = Math.max(spacingErr, Math.abs(usable[i + 1]! - usable[i]! - pitch));
  }
  return { cells, maxErr, spacingErr, usable: usable.length };
}

interface Measurement {
  cells: number;
  maxErr: number;
  pitchErr: number;
  spacingErr: number;
  pitchCss: number;
  dpr: number;
  detail: string;
}

interface PaneSpec {
  name: string;
  component: ComponentType<never>;
  canvasSelector: string;
  surfaceSelector: string;
  /** A WebGPU pane cannot be read through `createImageBitmap` (blank swapchain). */
  readViaProbe: boolean;
}

const CPU_PANE: PaneSpec = {
  name: "cpu",
  component: CpuImagePane as unknown as ComponentType<never>,
  canvasSelector: "canvas[data-cpu-image-canvas]",
  surfaceSelector: "[data-cpu-image-surface]",
  readViaProbe: false,
};
const GPU_PANE: PaneSpec = {
  name: "gpu",
  component: GpuImagePane as unknown as ComponentType<never>,
  canvasSelector: "canvas[data-gpu-image-canvas]",
  surfaceSelector: "[data-gpu-image-surface]",
  readViaProbe: true,
};

interface SurfaceProbe {
  readbackSurface: () => Promise<{
    data: Uint8Array | Float32Array;
    width: number;
    height: number;
  } | null>;
}

/** The painted surface as RGBA bytes, whichever backend produced it. */
async function readPaint(pane: PaneSpec, host: HTMLElement): Promise<Pixels | null> {
  const canvas = host.querySelector<HTMLCanvasElement>(pane.canvasSelector);
  if (!canvas) return null;
  if (!pane.readViaProbe) return readCanvas(canvas);
  const surface = host.querySelector<HTMLElement & { __cairnImagePaneProbe?: SurfaceProbe }>(
    pane.surfaceSelector,
  );
  const probe = surface?.__cairnImagePaneProbe;
  if (!probe) return null;
  const rb = await probe.readbackSurface();
  if (!rb) return null;
  const scale = rb.data instanceof Float32Array ? 255 : 1;
  const out = new Uint8ClampedArray(rb.width * rb.height * 4);
  for (let i = 0; i < out.length; i++) out[i] = rb.data[i]! * scale;
  return { data: out, width: rb.width, height: rb.height };
}

/** True once the surface carries any opaque pixel (the first content pass landed). */
function isPainted(img: Pixels | null): boolean {
  if (!img) return false;
  for (let i = 3; i < img.data.length; i += 4 * 97) if (img.data[i]! > 0) return true;
  return false;
}

/** Mount `pane` at `hostW`x`hostH`, drive it to `view`, and measure. */
async function measure(
  pane: PaneSpec,
  hostW: number,
  hostH: number,
  view: ImageViewState,
): Promise<Measurement> {
  const host = document.getElementById("host")!;
  host.style.cssText = `width:${hostW}px;height:${hostH}px;position:relative;background:#222`;
  const control: { set: (v: ImageViewState) => void } = { set: () => {} };
  // `latest` follows the pane's OWN emissions too: the shell reframes the view on
  // its first layout, and the geometry compared against must be the one the pane
  // last rendered, not the one this harness asked for.
  let latest: ImageViewState = { zoom: 1, pan: { x: 0, y: 0 } };
  function Harness() {
    const [v, setV] = useState<ImageViewState>(latest);
    control.set = (next: ImageViewState) => {
      latest = next;
      setV(next);
    };
    return h(pane.component, {
      source: { dtype: "uint8", url: SOURCE_URL, contentKey: "texel-parity-512" },
      zoom: v.zoom,
      pan: v.pan,
      onViewChange: (next: ImageViewState) => {
        latest = next;
        setV(next);
      },
      label: "",
      toolbar: false,
    } as never);
  }
  let root: Root | null = null;
  try {
    root = createRoot(host);
    root.render(h(Harness));
    const mounted = await waitFor(
      () =>
        !!host.querySelector(pane.canvasSelector) &&
        !!host.querySelector("[data-pixel-value-overlay]"),
      8000,
      20,
    );
    if (!mounted) throw new Error("pane did not mount");
    // Let the first content pass land before driving the view, so the zoom does
    // not race the decode (the canvas only paints once a bitmap exists).
    const painted = await waitFor(async () => isPainted(await readPaint(pane, host)), 15000, 60);
    if (!painted) throw new Error("pane never painted a non-empty frame");

    control.set(view);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const labels = host.querySelector<HTMLCanvasElement>("canvas[data-pixel-value-overlay]")!;
    const surface = host.querySelector<HTMLElement>(pane.surfaceSelector)!;
    const inked = await waitFor(
      async () => {
        const img = await readCanvas(labels);
        if (!img) return false;
        const { cols } = inkProfiles(img);
        for (let i = 0; i < cols.length; i++) if (cols[i]! > 0) return true;
        return false;
      },
      8000,
      50,
    );
    if (!inked) throw new Error(`the TEV overlay drew no numbers at zoom ${view.zoom}`);
    await sleep(50);

    const box = surface.getBoundingClientRect();
    const paintImg = await readPaint(pane, host);
    const labelImg = await readCanvas(labels);
    if (!paintImg || !labelImg) throw new Error("surface readback failed");
    const dpr = paintImg.width / box.width;

    // Painted texel boundaries: R alternates per column, G alternates per row.
    const midRow = Math.floor(paintImg.height / 2);
    const midCol = Math.floor(paintImg.width / 2);
    const rowStrip = paintImg.data.subarray(
      midRow * paintImg.width * 4,
      (midRow + 1) * paintImg.width * 4,
    );
    const colStrip = new Uint8ClampedArray(paintImg.height * 4);
    for (let y = 0; y < paintImg.height; y++) {
      const s = (y * paintImg.width + midCol) * 4;
      for (let k = 0; k < 4; k++) colStrip[y * 4 + k] = paintImg.data[s + k]!;
    }
    const xEdges = edges(rowStrip, paintImg.width, 0);
    const yEdges = edges(colStrip, paintImg.height, 1);

    const quad = viewToQuad(latest, { width: box.width, height: box.height }, N, N);
    if (!quad) throw new Error("viewToQuad returned null");
    const pitch = (quad.width / N) * dpr;

    // Cluster gaps as fractions of the texel pitch. The overlay's layout is
    // scale-free (`pixel-value-size.ts`): a 4-line stack's ink spans ~0.65 of the
    // cell HEIGHT with ~0.07*pitch between lines, and one line spans under ~0.7
    // of the cell WIDTH with ~0.02*pitch between glyphs. 0.18*pitch (rows) /
    // 0.10*pitch (columns) therefore merges exactly one cell's ink and never two
    // cells' — which `spacingErr` below then VERIFIES rather than assumes.
    const { cols, rows } = inkProfiles(labelImg);
    const xClusters = inkClusters(cols, 0.1 * pitch);
    const yClusters = inkClusters(rows, 0.18 * pitch);

    const xr = compareAxis(xEdges, xClusters, dpr, paintImg.width, pitch, INK_BIAS.x);
    const yr = compareAxis(yEdges, yClusters, dpr, paintImg.height, pitch, INK_BIAS.y);

    let pitchErr = 0;
    for (let i = 0; i + 1 < xEdges.length; i++) {
      pitchErr = Math.max(pitchErr, Math.abs(xEdges[i + 1]! - xEdges[i]! - pitch) / dpr);
    }
    for (let i = 0; i + 1 < yEdges.length; i++) {
      pitchErr = Math.max(pitchErr, Math.abs(yEdges[i + 1]! - yEdges[i]! - pitch) / dpr);
    }

    return {
      cells: xr.cells + yr.cells,
      maxErr: Math.max(xr.maxErr, yr.maxErr),
      pitchErr,
      spacingErr: Math.max(xr.spacingErr, yr.spacingErr) / dpr,
      pitchCss: pitch / dpr,
      dpr,
      detail:
        `x ${xr.cells} cells/${xr.usable} labels err ${xr.maxErr.toFixed(2)}px, ` +
        `y ${yr.cells} cells/${yr.usable} labels err ${yr.maxErr.toFixed(2)}px`,
    };
  } finally {
    root?.unmount();
    host.replaceChildren();
  }
}

/** (host width, host height, view) — deliberately fractional boxes and long, ugly
 *  pans: the reported misalignment only showed up off the integer grid. */
const CASES: [number, number, ImageViewState][] = [
  [642, 277.5, { zoom: 242.257, pan: { x: -44091.4, y: -40039.9 } }],
  [355, 402.5, { zoom: 183.934, pan: { x: 78.5184, y: -42274.7 } }],
  [500, 333.3, { zoom: 120, pan: { x: -20000, y: -15000.25 } }],
  [800, 601.5, { zoom: 64, pan: { x: -9000.5, y: -12000 } }],
];

async function runPane(pane: PaneSpec): Promise<boolean> {
  let ok = true;
  for (const [w, hgt, view] of CASES) {
    let r: Measurement;
    try {
      r = await measure(pane, w, hgt, view);
    } catch (err) {
      report(false, `${pane.name} ${w}x${hgt} zoom ${view.zoom}: ${String(err)}`);
      ok = false;
      continue;
    }
    // `spacingErr` guards the MEASUREMENT (one ink cluster per painted cell);
    // `maxErr` / `pitchErr` guard the pane.
    const pass = r.cells >= 2 && r.spacingErr <= 1 && r.maxErr <= 1 && r.pitchErr <= 1;
    // `BENCH:` prefix: the runner echoes matching lines even on a PASS, so the
    // measured alignment numbers are visible in CI output, not only on failure.
    report(
      pass,
      `BENCH: ${pane.name} ${w}x${hgt} zoom ${view.zoom} @dpr ${r.dpr}: ${r.cells} cells, ` +
        `label-vs-texel max ${r.maxErr.toFixed(2)} px, pitch err ${r.pitchErr.toFixed(2)} px, ` +
        `label-spacing err ${r.spacingErr.toFixed(2)} px ` +
        `(pitch ${r.pitchCss.toFixed(2)} css px; ${r.detail})`,
    );
    ok = ok && pass;
  }
  return ok;
}

async function run(): Promise<boolean> {
  report(true, `BENCH: devicePixelRatio ${window.devicePixelRatio}; ${INK_BIAS.note}`);

  (window as unknown as { __cairnPlotRenderMode?: string }).__cairnPlotRenderMode = "cpu";
  const cpuOk = await runPane(CPU_PANE);

  // GPU section — the same measurement against the WebGPU backend. Without an
  // adapter it SKIPS LOUDLY (the runner surfaces any "SKIPPED" line even on a
  // PASS) rather than failing: the CPU proof above stands on its own.
  if (!navigator.gpu) {
    report(true, "SKIPPED: GpuImagePane label alignment — no navigator.gpu on this runner");
    return cpuOk;
  }
  (window as unknown as { __cairnPlotRenderMode?: string }).__cairnPlotRenderMode = "gpu";
  const gpuOk = await runPane(GPU_PANE);
  return cpuOk && gpuOk;
}

run()
  .then(setOverallStatus)
  .catch((e) => {
    report(false, String(e));
    setOverallStatus(false);
  });
