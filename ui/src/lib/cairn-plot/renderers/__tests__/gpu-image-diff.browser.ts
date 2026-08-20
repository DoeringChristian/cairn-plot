/**
 * `GpuImagePane` DIFF capability (content-op unification, Phase 2c) — the LIVE
 * browser harness for the unified diff pane. jsdom has no WebGPU, so — like every
 * `*.browser.ts` harness under `renderers/__tests__/` — this mounts live React
 * panes; it self-drives its own gestures (no external pointer/keyboard) and
 * finalizes `#status`, so it opts into the DEFAULT `test:harness` set via
 * `data-cairn-harness="self-driving"`.
 *
 * WHAT IT PROVES (the Landing-1 asserts of the content-op unification):
 *   1. signed → RED-GREEN: `GpuImagePane` driven with `compareSource` (source=REF,
 *      b=FG, opId "signed") renders a diverging diff — the composited canvas
 *      carries BOTH red-dominant (negative error) AND green-dominant (positive
 *      error) pixels, the analytic red-green map. The EXACT per-byte equivalence to
 *      the diff engine (and thus to GpuComparePane's diff blit for signed→red-green)
 *      is pinned separately by `engine/__tests__/content-ops.browser.ts` (unified
 *      GPU path === the composed cpu twin === `ensureDiff`+`renderImage`); this
 *      proves the PANE wires that engine through `compareSource`.
 *   2. FLIP → magma: a cached FLIP diff renders a non-degenerate magma map.
 *   3. MODE menu switches kernels (via the probe seam), changing the surface with
 *      no re-decode; the metrics chip (`data-gpu-compare-metrics`) is present.
 *   4. HOME resets the kernel/colormap override back to the descriptor default.
 *
 * READBACK NOTE. The pane canvases are in the DOM (composited), so their WebGPU
 * swapchain texture rotates to a fresh back-buffer once a frame composites — a
 * direct `device.readback(surface)` then reads a BLANK texture. This harness reads
 * the COMPOSITED content via `createImageBitmap(canvas)` instead (the same reason
 * `gpu-image-pane.browser.ts` uses it), which is stable across the rotation.
 */
import React from "react";
import { createRoot } from "react-dom/client";
import GpuImagePane from "../GpuImagePane";
import { urlSource } from "../image-backend";
import { getSharedDevice } from "../../engine/device";

const h = React.createElement;

interface DiffProbe {
  canvas: HTMLCanvasElement | null;
  requestRender: () => void;
  readonly diffKernel: string;
  readonly resolvedKernelId: string;
  readonly colormap: string;
  readonly metrics: { mse: number; psnr: number; mae: number } | null;
  readonly ssimText: string;
  changeDiffKernel: (id: string) => void;
  changeDiffColormap: (id: string) => void;
  home: () => void;
}

function report(pass: boolean, message: string): void {
  const line = `${pass ? "PASS" : "FAIL"}: ${message}`;
  // eslint-disable-next-line no-console
  console[pass ? "log" : "error"](line);
  const el = document.getElementById("result");
  if (el) {
    const p = document.createElement("div");
    p.textContent = line;
    p.style.color = pass ? "green" : "red";
    el.appendChild(p);
  }
}

function setOverallStatus(pass: boolean): void {
  const el = document.getElementById("status");
  if (el) {
    el.textContent = pass ? "PASS" : "FAIL";
    el.style.color = pass ? "green" : "red";
  }
  document.title = pass ? "GPU IMAGE DIFF PASS" : "GPU IMAGE DIFF FAIL";
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
async function waitFor(
  pred: () => boolean | Promise<boolean>,
  timeoutMs = 8000,
  stepMs = 40,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await pred()) return true;
    await sleep(stepMs);
  }
  return await pred();
}

/** A 64×64 uint8 PNG data URL from a per-pixel fill. */
function makeImageUrl(fill: (x: number, y: number) => [number, number, number]): string {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(64, 64);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const i = (y * 64 + x) * 4;
      const [r, g, b] = fill(x, y);
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL("image/png");
}

// FG = x-gradient, REF = y-gradient → REF−FG crosses zero (both red AND green).
const FG_URL = makeImageUrl((x) => [Math.round((x / 63) * 255), 128, 64]);
const REF_URL = makeImageUrl((_x, y) => [Math.round((y / 63) * 255), 128, 64]);

/** Read the COMPOSITED canvas content (stable across swapchain rotation for an
 *  in-DOM canvas) as RGBA bytes. */
async function readCanvasBytes(canvas: HTMLCanvasElement | null): Promise<Uint8Array | null> {
  if (!canvas) return null;
  const bmp = await createImageBitmap(canvas);
  const tmp = document.createElement("canvas");
  tmp.width = bmp.width;
  tmp.height = bmp.height;
  const ctx = tmp.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0);
  return new Uint8Array(ctx.getImageData(0, 0, tmp.width, tmp.height).data.buffer);
}

function nonZero(bytes: Uint8Array): boolean {
  for (let i = 0; i < bytes.length; i += 4) {
    if (bytes[i] !== 0 || bytes[i + 1] !== 0 || bytes[i + 2] !== 0) return true;
  }
  return false;
}

/** Fraction of bytes equal (identity) between two equal-length buffers. */
function sameFrac(a: Uint8Array, b: Uint8Array): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 1;
  let same = 0;
  for (let i = 0; i < n; i++) if ((a[i] ?? 0) === (b[i] ?? 0)) same++;
  return same / n;
}

/** Count strongly red-dominant and green-dominant pixels (the red-green diverging
 *  map: negative error → red, positive → green). */
function redGreenPresence(bytes: Uint8Array): { red: number; green: number } {
  let red = 0;
  let green = 0;
  for (let i = 0; i + 3 < bytes.length; i += 4) {
    const r = bytes[i]!;
    const g = bytes[i + 1]!;
    const b = bytes[i + 2]!;
    if (r > g + 30 && r > b + 30) red++;
    if (g > r + 30 && g > b + 30) green++;
  }
  return { red, green };
}

/** A LIVE probe accessor — re-reads `__cairnImageDiffProbe` each call, since the
 *  probe object (with fresh state getters) is re-set on every render. */
type ProbeRef = () => DiffProbe;

function mountUnifiedDiff(container: HTMLElement, opId: string): Promise<ProbeRef> {
  const root = createRoot(container);
  root.render(
    h(
      "div",
      { style: { width: "128px", height: "128px" } },
      h(GpuImagePane, {
        // source = REFERENCE (slot a), compareSource.b = FOREGROUND (slot b) →
        // diff = a−b = REF−FG, matching GpuComparePane's texA(ref)−texB(fg).
        source: urlSource(REF_URL),
        compareSource: { b: urlSource(FG_URL), opId, referenceLabel: "ref", foregroundLabel: "fg" },
        zoom: 1,
        pan: { x: 0, y: 0 },
        label: "",
      }),
    ),
  );
  // The probe rides `paneRef.current` = the VIEWPORT box (`data-gpu-image-viewport`).
  const paneEl = () =>
    container.querySelector("[data-gpu-image-viewport]") as (HTMLElement & { __cairnImageDiffProbe?: DiffProbe }) | null;
  return waitFor(() => !!paneEl()?.__cairnImageDiffProbe?.canvas).then(() => {
    if (!paneEl()?.__cairnImageDiffProbe) {
      const cpu = !!container.querySelector("[data-cpu-image-pane]");
      throw new Error(`unified diff pane never exposed its probe (cpu-fallback=${cpu})`);
    }
    return () => {
      const live = paneEl()?.__cairnImageDiffProbe;
      if (!live) throw new Error("diff probe disappeared");
      return live;
    };
  });
}

/** Force a render and read the composited pane bytes once they are non-degenerate. */
async function paintedBytes(probe: ProbeRef): Promise<Uint8Array | null> {
  await waitFor(async () => {
    probe().requestRender();
    const bytes = await readCanvasBytes(probe().canvas);
    return !!bytes && nonZero(bytes);
  }, 8000, 120);
  return readCanvasBytes(probe().canvas);
}

async function main(): Promise<void> {
  try {
    await getSharedDevice();
    let allOk = true;

    // ---- Case 1: signed → red-green diverging diff -----------------------
    const cUnified = document.createElement("div");
    cUnified.style.cssText = "width:128px;height:128px;position:absolute;left:0;top:0";
    document.body.appendChild(cUnified);

    const probe = await mountUnifiedDiff(cUnified, "signed");
    const signedBytes = await paintedBytes(probe);
    if (!signedBytes) {
      report(false, `[case1] could not read back the unified diff surface`);
      allOk = false;
    } else {
      const { red, green } = redGreenPresence(signedBytes);
      const ok = red > 20 && green > 20 && probe().colormap === "red-green";
      if (!ok) allOk = false;
      report(ok, `[case1] signed diff renders red-green diverging map (colormap="${probe().colormap}", red px=${red}, green px=${green})`);
    }

    // ---- Case 3a: metrics chip present -----------------------------------
    const chipPresent = await waitFor(() => !!cUnified.querySelector("[data-gpu-compare-metrics]"), 4000);
    if (!chipPresent) allOk = false;
    report(chipPresent, `[case3a] metrics chip (data-gpu-compare-metrics) present + SSIM=${probe().ssimText}`);

    // ---- Case 3b: MODE menu switches kernels (no re-decode) --------------
    const before = await readCanvasBytes(probe().canvas);
    probe().changeDiffKernel("absolute");
    await waitFor(() => probe().resolvedKernelId === "absolute", 3000);
    await sleep(300);
    probe().requestRender();
    await sleep(120);
    const after = await readCanvasBytes(probe().canvas);
    const switched =
      probe().resolvedKernelId === "absolute" && !!before && !!after && sameFrac(before, after) < 0.98;
    if (!switched) allOk = false;
    report(switched, `[case3b] MODE menu switch signed→absolute changed the surface (kernel now "${probe().resolvedKernelId}")`);

    // ---- Case 4: HOME resets the kernel back to the default --------------
    probe().home();
    const homeOk = await waitFor(() => probe().diffKernel === "signed", 3000);
    if (!homeOk) allOk = false;
    report(homeOk, `[case4] HOME reset kernel back to "${probe().diffKernel}"`);

    // ---- Case 2: FLIP → magma non-degenerate -----------------------------
    const cFlip = document.createElement("div");
    cFlip.style.cssText = "width:128px;height:128px;position:absolute;left:320px;top:0";
    document.body.appendChild(cFlip);
    const flipProbe = await mountUnifiedDiff(cFlip, "flip");
    const flipBytes = await paintedBytes(flipProbe);
    const flipOk = flipProbe().colormap === "magma" && !!flipBytes && nonZero(flipBytes);
    if (!flipOk) allOk = false;
    report(flipOk, `[case2] FLIP diff renders non-degenerate (colormap="${flipProbe().colormap}")`);

    report(allOk, `all GpuImagePane diff-capability cases`);
    setOverallStatus(allOk);
  } catch (err) {
    report(false, `threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    setOverallStatus(false);
  }
}

void main();
