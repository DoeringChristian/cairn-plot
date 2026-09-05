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
 * WHAT THIS DOES *NOT* PROVE (documented limitation). The harness cannot OCR the
 * overlay, so it proves SUB-TEXEL PLACEMENT (each label's ink is centred on a
 * painted texel centre, and the label lattice has the painted pitch) and PAINT
 * IDENTITY (the texel the pane painted at a given screen position is the texel
 * the shared geometry says belongs there — the B-channel check below). It does
 * NOT prove LABEL TEXT identity: a hypothetical overlay that placed every number
 * perfectly but printed its NEIGHBOUR's value would pass here. That mapping —
 * `computeFit` / `computeSourceFit` screen<->texel and the per-cell sample the
 * overlay prints — is covered by the unit tests of `region-select.ts` and the
 * `PixelValueOverlay` sampling, which run without a rasteriser.
 *
 * HOME VIEW. At zoom 1 a texel is well under a pixel, so no numbers are drawn and
 * there is nothing to align. The home case instead pins the OTHER half of the
 * geometry: the outer painted image rect (found at the 50%-alpha boundary) must
 * equal the object-contain `viewToQuad` home rect, so a letterbox offset on a
 * fractional box cannot drift.
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
import { PIXEL_VALUE_LINE_H_FRAC, pixelValueFontHeight } from "../../../../primitives/components/pixel-value-size.ts";

const { report, setOverallStatus } = createHarness({
  title: "CPU-LABEL-ALIGNMENT",
  colors: { pass: "#6f6", fail: "#f66" },
});

const N = 512;
/** Channel jump that counts as a texel boundary (the source alternates 0/255). */
const EDGE_DELTA = 64;
/** Glyph-fill brightness floor; the drop shadow is black and never reaches it. */
const INK_BRIGHTNESS = 120;
/** A painted pixel is INSIDE the image at >= 50% coverage (the home-rect probe). */
const ALPHA_HALF = 128;
/** The two levels of the B identity checker, and the classifier between them. */
const B_HIGH = 200;
const B_LOW = 60;
const B_MID = (B_HIGH + B_LOW) / 2;

/** The B checker of texel `(x,y)`: period 4 on each axis (see `parityImageUrl`). */
function expectedBlueHigh(x: number, y: number): boolean {
  return ((((x >> 1) & 1) ^ ((y >> 1) & 1)) & 1) === 1;
}

/** RGBA pixels read back from a presentation surface (2D canvas or GPU surface). */
interface Pixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/**
 * A `n`x`n` PNG carrying two independent signals.
 *
 * EDGES: R = 255 on odd columns, G = 255 on odd rows. Adjacent columns differ by
 * a full 255 in R and adjacent rows by 255 in G, so every texel boundary is a
 * detectable edge on both axes NO MATTER what display transfer a backend applies
 * (an index ramp could quantise two neighbours together).
 *
 * IDENTITY: B is a 2-texel checker, `((x>>1) ^ (y>>1)) & 1`. The parity signal
 * alone repeats every texel, so a WHOLE-TEXEL paint offset would be invisible to
 * a nearest-match comparison; B has period 4 on each axis, so the texel index the
 * geometry names can be checked against the colour actually painted there
 * ({@link paintIdentityErrors}). Read as a two-level classification, never an
 * exact value, so any monotonic display transfer is irrelevant.
 *
 * A same-origin `data:` URL keeps the readback canvas untainted — harness code,
 * not the paint path.
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
      img.data[i + 2] = expectedBlueHigh(x, y) ? B_HIGH : B_LOW;
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
function calibrateInkBias(fontH: number): { x: number; y: number; note: string } {
  const F = fontH;
  const size = 400;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.clearRect(0, 0, size, size);
  ctx.font = `${F}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // These four must track `PixelValueOverlay.tsx`'s LABEL_SHADOW_COLOR /
  // LABEL_SHADOW_BLUR_FRAC / LABEL_SHADOW_OFFSET_FRAC and the `draw()` that
  // applies them. They are MODULE-PRIVATE there (not exported), so they are
  // duplicated here rather than imported; if they change, this calibration must
  // change with them (the reported bias number is the tell).
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

/** Ink bias calibrated AT THE CASE'S OWN FONT SIZE (memoised per quarter px).
 *  The bias is not scale-free: the shadow's `max(2, …)`/`max(1, …)` floors and
 *  glyph hinting make it non-proportional below ~20 px, which is where every
 *  zoomed case lands (fonts are capped at 24 px), so a 40 px calibration
 *  applied proportionally misses by up to ~1 px on some platforms' fonts. */
const inkBiasMemo = new Map<number, ReturnType<typeof calibrateInkBias>>();
function inkBiasFor(fontH: number): ReturnType<typeof calibrateInkBias> {
  const k = Math.round(fontH * 4) / 4;
  let v = inkBiasMemo.get(k);
  if (!v) {
    v = calibrateInkBias(k);
    inkBiasMemo.set(k, v);
  }
  return v;
}

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
 * A cluster is USABLE when it is a COMPLETE label stack, decided exactly rather
 * than by a margin: it must not touch the canvas border (`clipped`), and its ink
 * extent must be at least 80% of the median extent — every cell on an axis prints
 * the same widest line and the same 4-line stack, so a short extent means the
 * draw was cut off (by the viewport, or by the overlay's own clip rect) and its
 * midpoint is not a position. A painted centre is then compared only if it falls
 * within half a texel of the span the usable labels cover, i.e. only where a label
 * survives to compare against. `bias` is the calibrated font-metric offset per
 * unit of ink extent.
 */
function compareAxis(
  edg: number[],
  clusters: Cluster[],
  dpr: number,
  pitch: number,
  bias: number,
): AxisResult {
  const whole = clusters.filter((c) => !c.clipped);
  const extents = whole.map((c) => c.extent).sort((a, b) => a - b);
  const median = extents.length ? extents[extents.length >> 1]! : 0;
  const usable = whole
    .filter((c) => c.extent >= 0.8 * median)
    .map((c) => c.mid - bias * c.extent);
  const lo = usable.length ? Math.min(...usable) - 0.5 * pitch : 0;
  const hi = usable.length ? Math.max(...usable) + 0.5 * pitch : 0;
  const inside = (v: number) => v >= lo && v <= hi;
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
  xCells: number;
  yCells: number;
  maxErr: number;
  pitchErr: number;
  spacingErr: number;
  pitchCss: number;
  dpr: number;
  /** The view the pane actually rendered (its own last emission). */
  rendered: ImageViewState;
  /** `rendered` equals the requested view (nothing reframed it under us). */
  viewHeld: boolean;
  /** Texel centres whose PAINTED colour disagrees with the texel index the
   *  shared geometry names for that position (a whole-texel paint offset). */
  identityErrors: number;
  identityChecked: number;
  detail: string;
}

/**
 * PAINT IDENTITY. For each painted texel centre on one scan line, derive the
 * texel index the SHARED geometry assigns to that screen position and compare the
 * colour it implies with the colour actually painted there — the check that makes
 * a WHOLE-TEXEL paint offset visible, which locating edges alone cannot do.
 *
 * TWO signals are compared, because each alone has a blind spot: the along-axis
 * PARITY channel (R for a column scan, G for a row scan) catches any ODD texel
 * offset but is blind to even ones, and the B checker (period 2 texels) catches
 * any offset of 2 mod 4 but is blind to odd-vs-odd. Together every offset except
 * a multiple of FOUR texels is caught at EVERY checked position. Both are read as
 * two-level classifications, never exact values, so a display transfer is
 * irrelevant.
 *
 * `along` is the axis being scanned; `fixed` is the (device px) coordinate of the
 * scan line on the other axis.
 */
function paintIdentityErrors(
  img: Pixels,
  edg: number[],
  along: "x" | "y",
  crossEdges: number[],
  quad: { left: number; top: number; width: number; height: number },
  dpr: number,
): { errors: number; checked: number } {
  const pitch = (quad.width / N) * dpr;
  const originAlong = (along === "x" ? quad.left : quad.top) * dpr;
  const originFixed = (along === "x" ? quad.top : quad.left) * dpr;
  // Sample along the CENTRE of the cross-axis cell that straddles the image
  // middle — never along the raw middle line, which can coincide with a painted
  // texel boundary (a sub-pixel coin toss that inverts every check on this row).
  const mid = (along === "x" ? img.height : img.width) / 2;
  let fixed = mid;
  if (crossEdges.length > 0) {
    // The painted edge nearest the middle, then half a pitch into the cell the
    // middle lies in (this also covers a single cell whose only interior edge
    // does not bracket the middle).
    let nearest = crossEdges[0]!;
    for (const e of crossEdges) if (Math.abs(e - mid) < Math.abs(nearest - mid)) nearest = e;
    fixed = Math.floor(nearest + (mid >= nearest ? 0.5 : -0.5) * pitch);
  }
  const fixedExtent = along === "x" ? img.height : img.width;
  if (fixed < 0 || fixed >= fixedExtent) return { errors: 0, checked: 0 };
  const fixedIndex = Math.floor((fixed - originFixed) / pitch);
  let errors = 0;
  let checked = 0;
  for (let i = 0; i + 1 < edg.length; i++) {
    const center = (edg[i]! + edg[i + 1]!) / 2;
    const index = Math.floor((center - originAlong) / pitch);
    if (index < 0 || index >= N || fixedIndex < 0 || fixedIndex >= N) continue;
    const px = along === "x" ? Math.floor(center) : fixed;
    const py = along === "x" ? fixed : Math.floor(center);
    if (px < 0 || py < 0 || px >= img.width || py >= img.height) continue;
    const base = (py * img.width + px) * 4;
    const blue = img.data[base + 2]!;
    const parity = img.data[base + (along === "x" ? 0 : 1)]!;
    const wantBlue =
      along === "x" ? expectedBlueHigh(index, fixedIndex) : expectedBlueHigh(fixedIndex, index);
    const wantParity = (index & 1) === 1;
    checked++;
    if (blue > B_MID !== wantBlue || parity > 128 !== wantParity) errors++;
  }
  return { errors, checked };
}

/** The outer extent of the PAINTED image along one 1-px strip, at the 50%-alpha
 *  boundary, in continuous device-px coordinates. Null when nothing is opaque. */
function opaqueSpan(strip: Uint8ClampedArray, length: number): { lo: number; hi: number } | null {
  let lo = -1;
  let hi = -1;
  for (let i = 0; i < length; i++) {
    if (strip[i * 4 + 3]! >= ALPHA_HALF) {
      if (lo < 0) lo = i;
      hi = i;
    }
  }
  return lo < 0 ? null : { lo, hi: hi + 1 };
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

interface Mounted {
  host: HTMLElement;
  root: Root;
  surface: HTMLElement;
  labels: HTMLCanvasElement;
  /** The view the pane last RENDERED (its own emissions included). */
  rendered: () => ImageViewState;
  set: (v: ImageViewState) => void;
}

/** Mount `pane` at `hostW`x`hostH` and wait until it has painted a real frame. */
async function mountPane(pane: PaneSpec, hostW: number, hostH: number): Promise<Mounted> {
  const host = document.getElementById("host")!;
  host.style.cssText = `width:${hostW}px;height:${hostH}px;position:relative;background:#222`;
  const control: { set: (v: ImageViewState) => void } = { set: () => {} };
  // `latest` follows the pane's OWN emissions too: the shell reframes the view on
  // its first layout, and the geometry compared against must be the one the pane
  // last rendered, not the one this harness asked for. Every case asserts the two
  // agree (`viewHeld`), so a silent reframe can never be mistaken for alignment.
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
  const root = createRoot(host);
  root.render(h(Harness));
  const mounted = await waitFor(
    () =>
      !!host.querySelector(pane.canvasSelector) && !!host.querySelector("[data-pixel-value-overlay]"),
    8000,
    20,
  );
  if (!mounted) {
    root.unmount();
    throw new Error("pane did not mount");
  }
  // Let the first content pass land before driving the view, so the zoom does not
  // race the decode (the canvas only paints once a bitmap exists).
  const painted = await waitFor(async () => isPainted(await readPaint(pane, host)), 15000, 60);
  if (!painted) {
    root.unmount();
    throw new Error("pane never painted a non-empty frame");
  }
  return {
    host,
    root,
    surface: host.querySelector<HTMLElement>(pane.surfaceSelector)!,
    labels: host.querySelector<HTMLCanvasElement>("canvas[data-pixel-value-overlay]")!,
    rendered: () => latest,
    set: (v) => control.set(v),
  };
}

/** Extract the mid-row / mid-column 1-px strips of a painted surface. */
function midStrips(img: Pixels): {
  row: Uint8ClampedArray;
  col: Uint8ClampedArray;
  midRow: number;
  midCol: number;
} {
  const midRow = Math.floor(img.height / 2);
  const midCol = Math.floor(img.width / 2);
  const row = img.data.subarray(midRow * img.width * 4, (midRow + 1) * img.width * 4);
  const col = new Uint8ClampedArray(img.height * 4);
  for (let y = 0; y < img.height; y++) {
    const sIdx = (y * img.width + midCol) * 4;
    for (let k = 0; k < 4; k++) col[y * 4 + k] = img.data[sIdx + k]!;
  }
  return { row, col, midRow, midCol };
}

/** True when `rendered` is the view that was asked for (relative 1e-6 on zoom,
 *  absolute 1e-3 px on pan) — nothing reframed the pane under the measurement. */
function viewHeld(rendered: ImageViewState, want: ImageViewState): boolean {
  return (
    Math.abs(rendered.zoom / want.zoom - 1) <= 1e-6 &&
    Math.abs(rendered.pan.x - want.pan.x) <= 1e-3 &&
    Math.abs(rendered.pan.y - want.pan.y) <= 1e-3
  );
}

interface HomeMeasurement {
  dpr: number;
  /** Worst |painted image edge - `viewToQuad` home edge|, CSS px, over all four. */
  maxEdgeErr: number;
  rendered: ImageViewState;
  viewHeld: boolean;
  detail: string;
}

/**
 * HOME VIEW (zoom 1, pan 0) on a FRACTIONAL box, where the object-contain
 * letterbox offset is non-zero. No numbers are drawn at ~0.5 px per texel, so
 * instead of label placement this pins the painted image RECT: the 50%-alpha
 * boundary of the paint must equal the `viewToQuad` home rect on all four sides.
 */
async function measureHome(pane: PaneSpec, hostW: number, hostH: number): Promise<HomeMeasurement> {
  const home: ImageViewState = { zoom: 1, pan: { x: 0, y: 0 } };
  const m = await mountPane(pane, hostW, hostH);
  try {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await sleep(50);
    const box = m.surface.getBoundingClientRect();
    const img = await readPaint(pane, m.host);
    if (!img) throw new Error("surface readback failed");
    const dpr = img.width / box.width;
    const { row, col } = midStrips(img);
    const xSpan = opaqueSpan(row, img.width);
    const ySpan = opaqueSpan(col, img.height);
    if (!xSpan || !ySpan) throw new Error("the home view painted nothing opaque");
    const quad = viewToQuad(home, { width: box.width, height: box.height }, N, N);
    if (!quad) throw new Error("viewToQuad returned null");
    const want = {
      left: quad.left * dpr,
      right: (quad.left + quad.width) * dpr,
      top: quad.top * dpr,
      bottom: (quad.top + quad.height) * dpr,
    };
    const err = (a: number, b: number) => Math.abs(a - b) / dpr;
    const errs = [
      err(xSpan.lo, want.left),
      err(xSpan.hi, want.right),
      err(ySpan.lo, want.top),
      err(ySpan.hi, want.bottom),
    ];
    return {
      dpr,
      maxEdgeErr: Math.max(...errs),
      rendered: m.rendered(),
      viewHeld: viewHeld(m.rendered(), home),
      detail:
        `painted L/R ${(xSpan.lo / dpr).toFixed(2)}/${(xSpan.hi / dpr).toFixed(2)} ` +
        `vs quad ${quad.left.toFixed(2)}/${(quad.left + quad.width).toFixed(2)}; ` +
        `T/B ${(ySpan.lo / dpr).toFixed(2)}/${(ySpan.hi / dpr).toFixed(2)} ` +
        `vs ${quad.top.toFixed(2)}/${(quad.top + quad.height).toFixed(2)}`,
    };
  } finally {
    m.root.unmount();
    m.host.replaceChildren();
  }
}

/** Mount `pane` at `hostW`x`hostH`, drive it to `view`, and measure. */
async function measure(
  pane: PaneSpec,
  hostW: number,
  hostH: number,
  view: ImageViewState,
): Promise<Measurement> {
  const m = await mountPane(pane, hostW, hostH);
  try {
    m.set(view);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const inked = await waitFor(
      async () => {
        const img = await readCanvas(m.labels);
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

    const rendered = m.rendered();
    const box = m.surface.getBoundingClientRect();
    const paintImg = await readPaint(pane, m.host);
    const labelImg = await readCanvas(m.labels);
    if (!paintImg || !labelImg) throw new Error("surface readback failed");
    const dpr = paintImg.width / box.width;

    // Painted texel boundaries: R alternates per column, G alternates per row.
    const { row, col } = midStrips(paintImg);
    const xEdges = edges(row, paintImg.width, 0);
    const yEdges = edges(col, paintImg.height, 1);

    const quad = viewToQuad(rendered, { width: box.width, height: box.height }, N, N);
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

    // The overlay sizes its font from the cell pitch, the line count (4: RGBA
    // uint8) and the widest printed line ("0.502": 5 chars); calibrate there.
    const fontH = pixelValueFontHeight(pitch / dpr, 4, 5);
    const bias = inkBiasFor(fontH);
    const xr = compareAxis(xEdges, xClusters, dpr, pitch, bias.x);
    const yr = compareAxis(yEdges, yClusters, dpr, pitch, bias.y);

    let pitchErr = 0;
    for (let i = 0; i + 1 < xEdges.length; i++) {
      pitchErr = Math.max(pitchErr, Math.abs(xEdges[i + 1]! - xEdges[i]! - pitch) / dpr);
    }
    for (let i = 0; i + 1 < yEdges.length; i++) {
      pitchErr = Math.max(pitchErr, Math.abs(yEdges[i + 1]! - yEdges[i]! - pitch) / dpr);
    }

    const idX = paintIdentityErrors(paintImg, xEdges, "x", yEdges, quad, dpr);
    const idY = paintIdentityErrors(paintImg, yEdges, "y", xEdges, quad, dpr);

    return {
      xCells: xr.cells,
      yCells: yr.cells,
      maxErr: Math.max(xr.maxErr, yr.maxErr),
      pitchErr,
      spacingErr: Math.max(xr.spacingErr, yr.spacingErr) / dpr,
      pitchCss: pitch / dpr,
      dpr,
      rendered,
      viewHeld: viewHeld(rendered, view),
      identityErrors: idX.errors + idY.errors,
      identityChecked: idX.checked + idY.checked,
      detail:
        `x ${xr.cells} cells/${xr.usable} labels err ${xr.maxErr.toFixed(2)}px, ` +
        `y ${yr.cells} cells/${yr.usable} labels err ${yr.maxErr.toFixed(2)}px`,
    };
  } finally {
    m.root.unmount();
    m.host.replaceChildren();
  }
}

/** (host width, host height, view) — deliberately fractional boxes and long, ugly
 *  pans: the reported misalignment only showed up off the integer grid. The first
 *  entry is the geometry from the report itself and its numbers are not to be
 *  tuned; the rest widen the coverage (different aspect, different pitch). */
const CASES: [number, number, ImageViewState][] = [
  [642, 277.5, { zoom: 242.257, pan: { x: -44091.4, y: -40039.9 } }],
  [355, 402.5, { zoom: 183.934, pan: { x: 78.5184, y: -42274.7 } }],
  [500, 333.3, { zoom: 120, pan: { x: -20000, y: -15000.25 } }],
  [800, 601.5, { zoom: 64, pan: { x: -9000.5, y: -12000 } }],
];

/** The HOME case's box: fractional on BOTH axes, and wider than 1:1, so the
 *  object-contain fit letterboxes horizontally by a non-integer offset. */
const HOME_CASE: [number, number] = [642, 277.5];

/**
 * What this PAGE actually got, MEASURED rather than assumed. A headless Chromium
 * does not apply the runner's CDP `deviceScaleFactor` to its device-pixel content
 * box, so the `data-cairn-harness-dpr="2"` page can legitimately end up running
 * against a 1x backing store. `effective` is the pane's own
 * `canvas.width / box.width`, so the log always names the case that actually ran
 * instead of the one the attribute asked for.
 */
function dprSituation(effective: number): string {
  const ratio = window.devicePixelRatio;
  if (Math.abs(effective - ratio) < 1e-3) {
    return `effective ratio ${effective} — true ${effective}x backing store (devicePixelRatio ${ratio})`;
  }
  return (
    `effective ratio ${effective} vs devicePixelRatio ${ratio} — ratio/box MISMATCH case ` +
    `(headless Chromium does not apply the CDP deviceScaleFactor to the device-pixel ` +
    `content box, so the pane must believe the MEASURED box, not the ratio)`
  );
}

async function runPane(pane: PaneSpec): Promise<boolean> {
  let ok = true;

  // --- HOME: painted image rect == the object-contain home quad -------------
  try {
    const hm = await measureHome(pane, HOME_CASE[0], HOME_CASE[1]);
    report(true, `BENCH: ${pane.name}: ${dprSituation(hm.dpr)}`);
    const pass = hm.viewHeld && hm.maxEdgeErr <= 1;
    report(
      pass,
      `BENCH: ${pane.name} ${HOME_CASE[0]}x${HOME_CASE[1]} HOME zoom ${hm.rendered.zoom} ` +
        `pan (${hm.rendered.pan.x}, ${hm.rendered.pan.y}) @dpr ${hm.dpr}: ` +
        `painted image rect vs viewToQuad max edge err ${hm.maxEdgeErr.toFixed(2)} px` +
        `${hm.viewHeld ? "" : " — VIEW NOT HELD (the pane reframed the home view)"} (${hm.detail})`,
    );
    ok = ok && pass;
  } catch (err) {
    report(false, `${pane.name} ${HOME_CASE[0]}x${HOME_CASE[1]} HOME: ${String(err)}`);
    ok = false;
  }

  // --- ZOOMED: label placement, pitch, and paint identity -------------------
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
    // everything else guards the pane. BOTH axes must contribute at least one
    // compared cell — a case that measured only one axis proves only one axis.
    const pass =
      r.viewHeld &&
      r.xCells >= 1 &&
      r.yCells >= 1 &&
      r.identityChecked >= 2 &&
      r.identityErrors === 0 &&
      r.spacingErr <= 1 &&
      r.maxErr <= 1 &&
      r.pitchErr <= 1;
    // `BENCH:` prefix: the runner echoes matching lines even on a PASS, so the
    // measured alignment numbers are visible in CI output, not only on failure.
    // The zoom/pan printed are the RENDERED ones, never the requested ones.
    report(
      pass,
      `BENCH: ${pane.name} ${w}x${hgt} zoom ${r.rendered.zoom} ` +
        `pan (${r.rendered.pan.x}, ${r.rendered.pan.y}) @dpr ${r.dpr}: ` +
        `${r.xCells}+${r.yCells} cells, label-vs-texel max ${r.maxErr.toFixed(2)} px, ` +
        `pitch err ${r.pitchErr.toFixed(2)} px, label-spacing err ${r.spacingErr.toFixed(2)} px, ` +
        `paint identity ${r.identityErrors}/${r.identityChecked} wrong` +
        `${r.viewHeld ? "" : " — VIEW NOT HELD (the pane reframed the requested view)"} ` +
        `(pitch ${r.pitchCss.toFixed(2)} css px; ${r.detail})`,
    );
    ok = ok && pass;
  }
  return ok;
}

async function run(): Promise<boolean> {

  (window as unknown as { __cairnPlotRenderMode?: string }).__cairnPlotRenderMode = "cpu";
  const cpuOk = await runPane(CPU_PANE);
  // The calibrations the CPU cases used, one per distinct font size, so the
  // bias numbers stay visible in the log (they are the tell when the overlay's
  // halo or font constants change).
  for (const c of inkBiasMemo.values()) report(true, `BENCH: ${c.note}`);

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
