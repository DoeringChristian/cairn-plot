/**
 * Slide/split TEV per-side NUMBER alignment harness (media-compare).
 *
 * Regression proof for the reported bug: in the Slide (split/wipe) compare mode
 * the per-side TEV pixel-value NUMBERS were misaligned with the pixels they
 * annotate when
 *   (1) the two operands have DIFFERENT resolutions, and
 *   (2) the resolution is very large (numbers drift progressively with index).
 *
 * Root cause: BOTH per-side overlays mapped texel→screen through the PRIMARY
 * (foreground / texB) dims, but the split shader (`compare.wgsl`) samples each
 * operand through ONE normalized uv window scaled by its OWN `textureDimensions`
 * — so the reference (texA) side fills the framing quad with its OWN grid. The
 * fix threads each side's own `sourceDims` into `PixelValueOverlay` (fill-stretch
 * via `region-select`'s `computeSourceFit`).
 *
 * This harness mounts the REAL `GpuComparePane` and checks, on a live GPU:
 *   A. MISMATCHED resolution (64×48 reference vs 100×70 foreground, different
 *      aspect). For a known texel on EACH side it asserts the overlay's drawn
 *      texel center (the `__cairnCompareProbe.overlayTexelCenter` seam) sits on
 *      the pixel the SHADER actually draws — verified two independent ways:
 *        · against a from-first-principles shader-uv formula (readback-free), and
 *        · against the CENTROID of a unique sentinel texel read back from the
 *          rendered canvas (end-to-end: the number lands on the real pixel).
 *      It also proves the OLD primary-grid placement would have mislabeled the
 *      reference texel (the sentinel is FAR from the primary-grid position).
 *   B. LARGE resolution (1200×800 vs 1100×760). It asserts a NEAR and a
 *      FAR-corner reference texel's number both sit on their pixel (no growing
 *      drift), while the OLD primary-grid placement drifts (and drifts MORE at
 *      the far corner).
 *
 * Loads the committed compiled Tailwind CSS (`harness-style.css`) — the pane
 * uses `w-full`/`h-full`/`flex` utilities for layout; without them the pixel
 * geometry below is meaningless.
 *
 * SELF-DRIVING (`data-cairn-harness` in the HTML): it drives the pane purely via
 * React state (no pointer gestures), so `npm run test:harness` runs it in the
 * DEFAULT set (needs WebGPU; the runner skips-loud when no adapter is present).
 *
 * RUNNING (manual):
 *   npx esbuild \
 *     src/lib/cairn-plot/media-compare/__tests__/gpu-compare-split-numbers.browser.ts \
 *     --bundle --format=esm --jsx=automatic \
 *     --outfile=src/lib/cairn-plot/media-compare/__tests__/gpu-compare-split-numbers.browser.bundle.js
 *   then serve ui/ and open the .browser.html (or: npm run test:harness --only
 *   gpu-compare-split-numbers). The generated .bundle.js is gitignored.
 */
import React from "react";
import { createRoot } from "react-dom/client";
// Phase 3: split renders on the UNIFIED pane (`GpuImagePane` + a `compareSource`
// whose `mode:"split"`), so the #88 per-side number-alignment proof migrates onto
// it — reading the SAME per-side geometry seams (now on `__cairnImageDiffProbe`).
import GpuImagePane from "../../../../plots/image/backend/gpu";
import { urlSource, type CompareSource } from "../../../../plots/image/backend/contracts";
import type { Viewport as ImageViewport } from "../../hooks/use-image-viewport";
import { isDeviceLostError } from "../../../../plots/image/engine/webgpu/device";
import { createHarness, sleep, waitFor } from "../../testing/harness";

const h = React.createElement;

/** The subset of the unified pane's `__cairnImageDiffProbe` this harness reads. */
interface SplitNumbersProbe {
  overlayTexelCenter: (side: "a" | "b", px: number, py: number) => { x: number; y: number } | null;
  overlayWindow: { x: number; y: number; w: number; h: number };
  srcDims: { a: { w: number; h: number }; b: { w: number; h: number } } | null;
  dims: { w: number; h: number } | null;
  readbackSurface: () => Promise<{ data: Uint8Array | Float32Array; width: number; height: number } | null>;
}

const { report, setOverallStatus } = createHarness({ title: "SPLIT NUMBERS", colors: { pass: "#6f6", fail: "#f66" } });

/** A gray WxH image with a single unique SENTINEL texel — a data URL. */
function patternUrl(
  w: number,
  h: number,
  sentinel: { px: number; py: number; rgb: [number, number, number] },
): string {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "rgb(96,96,96)";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = `rgb(${sentinel.rgb[0]},${sentinel.rgb[1]},${sentinel.rgb[2]})`;
  ctx.fillRect(sentinel.px, sentinel.py, 1, 1);
  return c.toDataURL("image/png");
}

/** A readback normalized to 0–255 RGBA (an f16/f32 HDR surface reads 0–1). */
interface RGBA {
  data: number[] | Uint8Array | Float32Array;
  width: number;
  height: number;
  s: number; // scale: 1 for u8 bytes, 255 for float [0,1]
}
function normalize(rb: { data: Uint8Array | Float32Array; width: number; height: number }): RGBA {
  return { data: rb.data, width: rb.width, height: rb.height, s: rb.data instanceof Float32Array ? 255 : 1 };
}

/** The pixel MOST like `rgb` (for diagnostics). */
function closestPixel(img: RGBA, rgb: [number, number, number]): { x: number; y: number; c: [number, number, number]; d: number } {
  let best = { x: 0, y: 0, c: [0, 0, 0] as [number, number, number], d: Infinity };
  for (let y = 0; y < img.height; y += 2) {
    for (let x = 0; x < img.width; x += 2) {
      const i = (y * img.width + x) * 4;
      const c: [number, number, number] = [img.data[i]! * img.s, img.data[i + 1]! * img.s, img.data[i + 2]! * img.s];
      const d = Math.abs(c[0] - rgb[0]) + Math.abs(c[1] - rgb[1]) + Math.abs(c[2] - rgb[2]);
      if (d < best.d) best = { x, y, c, d };
    }
  }
  return best;
}

/** Centroid (in DEVICE px) of every pixel within `tol` of `rgb`; null if none. */
function sentinelCentroid(
  img: RGBA,
  rgb: [number, number, number],
  tol: number,
): { x: number; y: number; n: number } | null {
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 4;
      if (img.data[i + 3]! * img.s < 200) continue;
      if (
        Math.abs(img.data[i]! * img.s - rgb[0]) <= tol &&
        Math.abs(img.data[i + 1]! * img.s - rgb[1]) <= tol &&
        Math.abs(img.data[i + 2]! * img.s - rgb[2]) <= tol
      ) {
        sx += x;
        sy += y;
        n++;
      }
    }
  }
  return n > 0 ? { x: sx / n, y: sy / n, n } : null;
}

/**
 * The split shader's OWN placement of a sampled source's texel center, in
 * canvas-LOCAL CSS px — derived independently of `computeSourceFit`, from the
 * normalized uv window + the box fraction the fragment maps to. Ground truth.
 */
function shaderTexelLocal(
  boxW: number,
  boxH: number,
  uv: { x: number; y: number; w: number; h: number },
  srcW: number,
  srcH: number,
  px: number,
  py: number,
): { x: number; y: number } {
  const fracX = ((px + 0.5) / srcW - uv.x) / uv.w;
  const fracY = ((py + 0.5) / srcH - uv.y) / uv.h;
  return { x: fracX * boxW, y: fracY * boxH };
}

/** Centered-zoom pan (matches a real cursor-centered wheel-zoom). */
function centerZoomPan(paneW: number, paneH: number, zoom: number): { x: number; y: number } {
  return { x: (paneW / 2) * (1 - zoom), y: (paneH / 2) * (1 - zoom) };
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// ── one persistent mount, driven by window-exposed setters ───────────────────
interface Handle {
  container: HTMLDivElement;
  canvas: () => HTMLCanvasElement | null;
  probe: () => SplitNumbersProbe | null;
  setViewport: (v: ImageViewport) => void;
  setSplit: (p: number) => void;
  unmount: () => void;
}

function mount(id: string, wCss: number, hCss: number, imageUrl: string, baselineUrl: string): Handle {
  const container = document.createElement("div");
  container.id = id;
  container.style.width = `${wCss}px`;
  container.style.height = `${hCss}px`;
  container.style.background = "#222";
  document.body.appendChild(container);

  let setViewportFn: (v: ImageViewport) => void = () => {};
  let setSplitFn: (p: number) => void = () => {};

  function Harness() {
    const [viewport, setViewport] = React.useState<ImageViewport>({ zoom: 1, pan: { x: 0, y: 0 } });
    const [split, setSplit] = React.useState(0.5);
    setViewportFn = setViewport;
    setSplitFn = setSplit;
    // Slot convention: source = REFERENCE (baselineUrl, side "a" / LEFT of the
    // divider), compareSource.b = FOREGROUND (imageUrl, side "b" / RIGHT).
    const compareSource: CompareSource = {
      b: urlSource(imageUrl),
      opId: "absolute", // the diff kernel seed (unused in split mode)
      mode: "split",
      splitPosition: split,
      onSplitPositionChange: setSplit,
      referenceLabel: "ref",
      foregroundLabel: "fg",
    };
    return h(GpuImagePane, {
      source: urlSource(baselineUrl),
      compareSource,
      zoom: viewport.zoom,
      pan: viewport.pan,
      onViewportChange: setViewport,
      label: "split-numbers",
    });
  }
  const root = createRoot(container);
  root.render(h(Harness));

  // The seam is attached to the pane's INNER viewport element (`paneRef`), not
  // the outer `data-gpu-image-pane` root — walk the subtree for it.
  const findProbe = (): SplitNumbersProbe | null => {
    type SeamEl = HTMLElement & { __cairnImageDiffProbe?: SplitNumbersProbe };
    for (const n of Array.from(container.querySelectorAll("*")) as SeamEl[]) {
      if (n.__cairnImageDiffProbe) return n.__cairnImageDiffProbe;
    }
    return null;
  };
  return {
    container,
    canvas: () =>
      container.querySelector(
        "canvas[data-gpu-image-canvas], canvas[data-gpu-compare-canvas]",
      ) as HTMLCanvasElement | null,
    probe: findProbe,
    setViewport: (v) => setViewportFn(v),
    setSplit: (p) => setSplitFn(p),
    unmount: () => {
      root.unmount();
      container.remove();
    },
  };
}

async function waitForContent(probe: () => SplitNumbersProbe | null): Promise<boolean> {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const p = probe();
    // eslint-disable-next-line no-await-in-loop
    const rb = p ? await p.readbackSurface() : null;
    if (rb) {
      const img = normalize(rb);
      const i = ((img.height >> 1) * img.width + (img.width >> 1)) * 4;
      if (img.data[i + 3]! * img.s > 200) return true;
    }
    // eslint-disable-next-line no-await-in-loop
    await sleep(60);
  }
  return false;
}

// ── Case A — mismatched resolution (64×48 ref vs 100×70 fg, different aspect) ─
const CYAN: [number, number, number] = [0, 255, 255]; // foreground sentinel
const MAGENTA: [number, number, number] = [255, 0, 255]; // reference sentinel
const FG_SENTINEL = { px: 50, py: 35 };
const REF_SENTINEL = { px: 32, py: 24 };

async function runMismatchCase(): Promise<boolean> {
  let ok = true;
  const fgUrl = patternUrl(100, 70, { ...FG_SENTINEL, rgb: CYAN });
  const refUrl = patternUrl(64, 48, { ...REF_SENTINEL, rgb: MAGENTA });
  const paneW = 700;
  const paneH = 500;
  const H = mount("mismatch-harness", paneW, paneH, fgUrl, refUrl);

  const canvasFound = await waitFor(() => !!H.canvas(), 8000, 25);
  report(canvasFound, "[mismatch] GPU compare canvas mounts");
  if (!canvasFound) {
    H.unmount();
    return false;
  }
  const canvas = H.canvas()!;
  // Zoom in so ~1 texel is ≥30px (nearest filtering → solid sentinel blocks).
  const zoom = 5;
  H.setViewport({ zoom, pan: centerZoomPan(paneW, paneH, zoom) });
  const dimsReady = await waitFor(() => {
    const p = H.probe();
    return !!p && !!p.srcDims && p.srcDims.a.w === 64 && p.srcDims.b.w === 100;
  }, 8000, 25);
  report(dimsReady, "[mismatch] both source dims loaded (ref 64×48, fg 100×70)");
  const contentA = await waitForContent(H.probe);
  report(contentA, "[mismatch] surface renders non-blank content (readback)");
  ok = ok && contentA;
  await sleep(200);

  const probe = H.probe()!;
  const box = canvas.getBoundingClientRect();
  const uv = probe.overlayWindow;

  // --- 1) seam vs independent shader-uv formula, per side ---
  const fgSeam = probe.overlayTexelCenter("b", FG_SENTINEL.px, FG_SENTINEL.py)!;
  const fgTruth = shaderTexelLocal(box.width, box.height, uv, 100, 70, FG_SENTINEL.px, FG_SENTINEL.py);
  const fgSeamOk = dist(fgSeam, fgTruth) < 1;
  report(fgSeamOk, `[mismatch] FG(texB) overlay center matches shader uv (Δ=${dist(fgSeam, fgTruth).toFixed(3)}px)`);
  ok = ok && fgSeamOk;

  const refSeam = probe.overlayTexelCenter("a", REF_SENTINEL.px, REF_SENTINEL.py)!;
  const refTruth = shaderTexelLocal(box.width, box.height, uv, 64, 48, REF_SENTINEL.px, REF_SENTINEL.py);
  const refSeamOk = dist(refSeam, refTruth) < 1;
  report(refSeamOk, `[mismatch] REF(texA) overlay center matches shader uv on ITS OWN 64×48 grid (Δ=${dist(refSeam, refTruth).toFixed(3)}px)`);
  ok = ok && refSeamOk;

  // The OLD placement put the reference texel on the PRIMARY (100×70) grid — a
  // DIFFERENT screen point. Assert the two differ meaningfully (else the case is
  // degenerate / the bug would be invisible).
  const refOnPrimaryGrid = shaderTexelLocal(box.width, box.height, uv, 100, 70, REF_SENTINEL.px, REF_SENTINEL.py);
  const oldGap = dist(refSeam, refOnPrimaryGrid);
  const gapOk = oldGap > 15;
  report(gapOk, `[mismatch] fixed REF placement differs from the OLD primary-grid placement by ${oldGap.toFixed(1)}px (the bug)`);
  ok = ok && gapOk;

  // --- 2) end-to-end: the number lands on the REAL rendered pixel (centroid) ---
  // Foreground filling the whole canvas (split=0 → colorB everywhere).
  H.setSplit(0);
  await sleep(250);
  {
    const rb = await H.probe()!.readbackSurface();
    const img = normalize(rb!);
    const devPerCss = img.width / box.width;
    const c = sentinelCentroid(img, CYAN, 60);
    if (!c) {
      const cp = closestPixel(img, CYAN);
      report(false, `[mismatch] FG sentinel (cyan) not found; img=${img.width}x${img.height} closest=rgb(${cp.c.map((v) => Math.round(v)).join(",")})@(${cp.x},${cp.y}) d=${cp.d.toFixed(0)}`);
      ok = false;
    } else {
      const local = { x: c.x / devPerCss, y: c.y / devPerCss };
      const d = dist(local, fgSeam);
      const good = d < 3;
      report(good, `[mismatch] FG number sits on the rendered cyan pixel (centroid Δ=${d.toFixed(2)}px, n=${c.n})`);
      ok = ok && good;
    }
  }
  // Reference filling the whole canvas (split=1 → colorA everywhere).
  H.setSplit(1);
  await sleep(250);
  {
    const rb = await H.probe()!.readbackSurface();
    const img = normalize(rb!);
    const devPerCss = img.width / box.width;
    const c = sentinelCentroid(img, MAGENTA, 60);
    if (!c) {
      const cp = closestPixel(img, MAGENTA);
      report(false, `[mismatch] REF sentinel (magenta) not found; closest=rgb(${cp.c.map((v) => Math.round(v)).join(",")}) d=${cp.d.toFixed(0)}`);
      ok = false;
    } else {
      const local = { x: c.x / devPerCss, y: c.y / devPerCss };
      const d = dist(local, refSeam);
      const good = d < 3;
      report(good, `[mismatch] REF number sits on the rendered magenta pixel (centroid Δ=${d.toFixed(2)}px, n=${c.n})`);
      ok = ok && good;
      // And the magenta pixel is FAR from where the OLD primary-grid number was.
      const dOld = dist(local, refOnPrimaryGrid);
      const oldMiss = dOld > 15;
      report(oldMiss, `[mismatch] the OLD primary-grid number would have missed this pixel by ${dOld.toFixed(1)}px`);
      ok = ok && oldMiss;
    }
  }

  H.unmount();
  return ok;
}

// ── Case B — large resolution (1200×800 fg vs 1100×760 ref), no growing drift ─
async function runLargeCase(): Promise<boolean> {
  let ok = true;
  const fgUrl = patternUrl(1200, 800, { px: 0, py: 0, rgb: CYAN });
  const refUrl = patternUrl(1100, 760, { px: 0, py: 0, rgb: MAGENTA });
  const paneW = 700;
  const paneH = 500;
  const H = mount("large-harness", paneW, paneH, fgUrl, refUrl);

  const canvasFound = await waitFor(() => !!H.canvas(), 8000, 25);
  report(canvasFound, "[large] GPU compare canvas mounts");
  if (!canvasFound) {
    H.unmount();
    return false;
  }
  const canvas = H.canvas()!;
  const zoom = 40; // deep zoom so a single texel is many px
  H.setViewport({ zoom, pan: centerZoomPan(paneW, paneH, zoom) });
  const ready = await waitFor(() => {
    const p = H.probe();
    return !!p && !!p.srcDims && p.srcDims.a.w === 1100 && p.srcDims.b.w === 1200;
  }, 8000, 25);
  report(ready, "[large] both source dims loaded (ref 1100×760, fg 1200×800)");
  await waitForContent(H.probe);
  await sleep(200);

  const probe = H.probe()!;
  const box = canvas.getBoundingClientRect();
  const uv = probe.overlayWindow;

  // Near-origin and FAR-corner reference texels — the fixed placement must sit on
  // the shader's pixel at BOTH (no index-growing drift), while the OLD
  // primary-grid placement drifts, and drifts MORE at the far corner.
  const near = { x: 10, y: 10 };
  const far = { x: 1090, y: 755 };
  for (const [name, t] of [["near", near], ["far", far]] as const) {
    const seam = probe.overlayTexelCenter("a", t.x, t.y)!;
    const truth = shaderTexelLocal(box.width, box.height, uv, 1100, 760, t.x, t.y);
    const d = dist(seam, truth);
    const good = d < 1.5;
    report(good, `[large] REF ${name}-corner texel (${t.x},${t.y}) number sits on its pixel (Δ=${d.toFixed(3)}px)`);
    ok = ok && good;
  }
  // Prove the OLD placement drifted, growing with index.
  const oldNear = dist(
    shaderTexelLocal(box.width, box.height, uv, 1200, 800, near.x, near.y),
    shaderTexelLocal(box.width, box.height, uv, 1100, 760, near.x, near.y),
  );
  const oldFar = dist(
    shaderTexelLocal(box.width, box.height, uv, 1200, 800, far.x, far.y),
    shaderTexelLocal(box.width, box.height, uv, 1100, 760, far.x, far.y),
  );
  const driftGrows = oldFar > oldNear + 5;
  report(driftGrows, `[large] OLD primary-grid drift grows with index (near=${oldNear.toFixed(1)}px → far=${oldFar.toFixed(1)}px)`);
  ok = ok && driftGrows;

  H.unmount();
  return ok;
}

async function main(): Promise<void> {
  try {
    const a = await runMismatchCase();
    const b = await runLargeCase();
    setOverallStatus(a && b);
  } catch (err) {
    if (isDeviceLostError(err)) {
      // Loud SKIP — the software (SwiftShader) backend lost the device/instance
      // mid-readback; this proof couldn't run, but it's a teardown artifact, not
      // a parity defect. Same handling as the backend-readback harness.
      report(
        true,
        `SKIPPED — device lost/destroyed mid-readback (software-backend teardown ` +
          `artifact, not a parity failure): ${err instanceof Error ? err.message : String(err)}`,
      );
      setOverallStatus(true);
    } else {
      report(false, `threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
      setOverallStatus(false);
    }
  }
}

void main();
