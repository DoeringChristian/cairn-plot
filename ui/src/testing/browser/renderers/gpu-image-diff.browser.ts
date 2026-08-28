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
 *      is pinned separately by `engine/__tests__/image-operations.browser.ts` (unified
 *      GPU path === the composed cpu twin === `ensureDiff`+`renderImage`); this
 *      proves the PANE wires that engine through `compareSource`.
 *   2. FLIP → magma: a cached FLIP diff renders a non-degenerate magma map.
 *   3. MODE menu switches kernels (via the probe seam), changing the surface with
 *      no re-decode; the metrics chip (`data-gpu-compare-metrics`) is present.
 *   4. HOME resets the kernel/colormap override back to the descriptor default.
 *
 * READBACK NOTE. Content assertions read the ENGINE-LEVEL surface via the probe's
 * `readbackSurface()` seam — a fresh synchronous `renderPass()` then
 * `device.readback()` of the POOL-OWNED surface (the same deterministic path
 * `engine/__tests__/image-operations.browser.ts` and `GpuComparePane.readbackSurface`
 * use). We do NOT sample the composited canvas via `createImageBitmap(canvas)`:
 * an in-DOM WebGPU swapchain rotates to a fresh back-buffer once a frame
 * composites, so `createImageBitmap` reads a BLANK texture on some builds (CI's
 * Chromium hits this deterministically where local SwiftShader does not — the
 * gotcha the 8104cbd deep-sampler design already routed around). A canvas-bitmap
 * read is kept ONLY as an advisory NOTE (never a FAIL) so local eyes still get
 * the composited view.
 */
import React from "react";
import { isDeviceLostError } from "../../../plots/image/webgpu/device/device";
import { createRoot } from "react-dom/client";
import GpuImagePane from "../../../plots/image/webgpu/view";
import { urlSource } from "../../../plots/image/runtime/contracts";
import { getSharedWebGpuDevice } from "../../../plots/image/webgpu/device/device-provider.ts";
import { createHarness, waitFor } from "../../harness";
import type { PlotSettings } from "../../../settings/schema.ts";
import type { Colormap } from "../../../plots/types.ts";

const h = React.createElement;

interface DiffProbe {
  canvas: HTMLCanvasElement | null;
  requestRender: () => void;
  readonly comparisonOperationId: string;
  readonly resolvedOperationId: string;
  readonly colormap: string;
  readonly metrics: { mse: number; psnr: number; mae: number } | null;
  readonly ssimText: string;
  changeComparisonOperation: (id: string) => void;
  changeDiffColormap: (id: string) => void;
  home: () => void;
  // Engine-level readback of the pool-owned surface (fresh renderPass + device
  // .readback) — deterministic across swapchain rotation, unlike the composited
  // canvas. This is the seam the content assertions read.
  readbackSurface: () => Promise<{ data: Uint8Array; width: number; height: number } | null>;
}

const { report, setOverallStatus } = createHarness({ title: "GPU IMAGE DIFF" });

function note(message: string): void {
  // eslint-disable-next-line no-console
  console.log("NOTE:", message);
  const el = document.getElementById("result");
  if (el) {
    const p = document.createElement("div");
    p.textContent = "NOTE: " + message;
    p.style.color = "#88f";
    el.appendChild(p);
  }
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

/** Engine-level readback of the pool-owned surface (the ASSERTED content) — a
 *  fresh `renderPass()` then `device.readback()`, deterministic across swapchain
 *  rotation where a composited-canvas read is not. */
async function readSurfaceBytes(probe: ProbeRef): Promise<Uint8Array | null> {
  const r = await probe().readbackSurface();
  return r ? r.data : null;
}

/** Read the COMPOSITED canvas content via `createImageBitmap`. ADVISORY ONLY —
 *  used to emit a local-eyes NOTE; on some builds (CI Chromium) an in-DOM
 *  swapchain reads BLANK here, so this is never allowed to drive a FAIL. */
async function readCanvasBytes(canvas: HTMLCanvasElement | null): Promise<Uint8Array | null> {
  if (!canvas) return null;
  try {
    const bmp = await createImageBitmap(canvas);
    const tmp = document.createElement("canvas");
    tmp.width = bmp.width;
    tmp.height = bmp.height;
    const ctx = tmp.getContext("2d")!;
    ctx.drawImage(bmp, 0, 0);
    return new Uint8Array(ctx.getImageData(0, 0, tmp.width, tmp.height).data.buffer);
  } catch {
    return null;
  }
}

/** Advisory NOTE (never a FAIL): report what the COMPOSITED canvas shows, so
 *  local eyes still get the pixel view even though the assertion reads the
 *  engine surface. */
async function noteCanvas(label: string, probe: ProbeRef): Promise<void> {
  const bytes = await readCanvasBytes(probe().canvas);
  if (!bytes) {
    note(`${label}: composited-canvas readback BLANK/unavailable (expected on CI Chromium; assertion uses the engine surface)`);
    return;
  }
  const { red, green } = redGreenPresence(bytes);
  note(`${label}: composited canvas nonZero=${nonZero(bytes)}, red px=${red}, green px=${green}`);
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

function mountUnifiedDiff(container: HTMLElement, opId: string, encoding: Colormap): Promise<ProbeRef> {
  const OwnedDiff = () => {
    const defaults = React.useMemo(() => ({
      "compare.operation": opId,
      "image.encoding": encoding,
      "image.view": { zoom: 1, pan: { x: 0, y: 0 } },
    }), []);
    const [settings, setSettings] = React.useState<PlotSettings>(defaults);
    const patchSettings = React.useCallback((patch: PlotSettings) => {
      setSettings((current) => ({ ...current, ...patch }));
    }, []);
    return h(GpuImagePane, {
      source: urlSource(REF_URL),
      compareSource: {
        b: urlSource(FG_URL),
        opId: settings["compare.operation"] as string,
        colormap: encoding,
        referenceLabel: "ref",
        foregroundLabel: "fg",
      },
      zoom: 1,
      pan: { x: 0, y: 0 },
      label: "",
      syncedSettings: settings,
      setSyncedSettings: patchSettings,
      resetSettings: () => setSettings({ ...defaults }),
    });
  };
  const root = createRoot(container);
  root.render(
    h(
      "div",
      { style: { width: "128px", height: "128px" } },
      h(OwnedDiff),
    ),
  );
  // The probe rides `paneRef.current` = the VIEWPORT box (`data-gpu-image-surface`).
  const paneEl = () =>
    container.querySelector("[data-gpu-image-surface]") as (HTMLElement & { __cairnImageDiffProbe?: DiffProbe }) | null;
  return waitFor(() => !!paneEl()?.__cairnImageDiffProbe?.canvas, 8000, 40).then(() => {
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

/**
 * Force renders until the composited pane bytes satisfy `want` (default: any
 * non-zero pixel), then return the freshest read. ROBUST TO SLOW SOFTWARE
 * ADAPTERS: it polls the ACTUAL content condition rather than waiting a fixed
 * delay, so a late first diff-paint on SwiftShader (where the pane may briefly
 * composite the raw source gradient — non-zero, but PRE-diff — before the
 * red-green/magma diff frame lands) cannot be sampled as a degenerate frame. If
 * the condition never holds within the budget, the last painted frame is
 * returned so the caller's assertion fails LOUDLY with the real pixel counts.
 */
async function paintedBytes(
  probe: ProbeRef,
  want: (bytes: Uint8Array) => boolean = nonZero,
  timeoutMs = 8000,
): Promise<Uint8Array | null> {
  let last: Uint8Array | null = null;
  await waitFor(async () => {
    const bytes = await readSurfaceBytes(probe);
    if (bytes) last = bytes;
    return !!bytes && want(bytes);
  }, timeoutMs, 120);
  const fresh = await readSurfaceBytes(probe);
  return fresh ?? last;
}

/**
 * Poll renders until the composited surface DIFFERS from `baseline` (a kernel
 * switch has visibly composited), robust to slow software adapters — replaces a
 * fixed post-switch delay. Returns the last read (changed if it diverged, else
 * the final frame so the caller's `sameFrac` assertion reports the real value).
 */
async function paintedUntilChanged(
  probe: ProbeRef,
  baseline: Uint8Array,
  timeoutMs = 8000,
): Promise<Uint8Array | null> {
  let last: Uint8Array | null = null;
  await waitFor(async () => {
    const bytes = await readSurfaceBytes(probe);
    if (bytes) last = bytes;
    return !!bytes && sameFrac(baseline, bytes) < 0.98;
  }, timeoutMs, 120);
  return last;
}

async function main(): Promise<void> {
  try {
    await getSharedWebGpuDevice();
    let allOk = true;

    // ---- Case 1: signed → red-green diverging diff -----------------------
    const cUnified = document.createElement("div");
    cUnified.style.cssText = "width:128px;height:128px;position:absolute;left:0;top:0";
    document.body.appendChild(cUnified);

    const probe = await mountUnifiedDiff(cUnified, "signed", "red-green");
    // Wait for the red-green diff frame ITSELF (both polarities present), not a
    // generic non-zero paint — otherwise a slow adapter's pre-diff source frame
    // is sampled and red/green come back 0.
    const signedBytes = await paintedBytes(probe, (b) => {
      const { red, green } = redGreenPresence(b);
      return red > 20 && green > 20;
    });
    if (!signedBytes) {
      report(false, `[case1] could not read back the unified diff surface`);
      allOk = false;
    } else {
      const { red, green } = redGreenPresence(signedBytes);
      const ok = red > 20 && green > 20 && probe().colormap === "red-green";
      if (!ok) allOk = false;
      report(ok, `[case1] signed diff renders red-green diverging map (colormap="${probe().colormap}", red px=${red}, green px=${green})`);
      await noteCanvas("[case1]", probe);
    }

    // ---- Case 3a: metrics chip present -----------------------------------
    const chipPresent = await waitFor(() => !!cUnified.querySelector("[data-gpu-compare-metrics]"), 4000, 40);
    if (!chipPresent) allOk = false;
    report(chipPresent, `[case3a] metrics chip (data-gpu-compare-metrics) present + SSIM=${probe().ssimText}`);

    // ---- Case 3b: MODE menu switches kernels (no re-decode) --------------
    const before = await readSurfaceBytes(probe);
    probe().changeComparisonOperation("absolute");
    await waitFor(() => probe().resolvedOperationId === "absolute", 3000, 40);
    // Poll for the switched frame to render rather than sleeping a fixed
    // amount — the absolute-kernel frame lands later on slow software adapters.
    const after = before ? await paintedUntilChanged(probe, before) : await readSurfaceBytes(probe);
    const switched =
      probe().resolvedOperationId === "absolute" && !!before && !!after && sameFrac(before, after) < 0.98;
    if (!switched) allOk = false;
    report(switched, `[case3b] MODE menu switch signed→absolute changed the surface (kernel now "${probe().resolvedOperationId}")`);

    // ---- Case 4: HOME resets the kernel back to the default --------------
    probe().home();
    const homeOk = await waitFor(() => probe().comparisonOperationId === "signed", 3000, 40);
    if (!homeOk) allOk = false;
    report(homeOk, `[case4] HOME reset kernel back to "${probe().comparisonOperationId}"`);

    // ---- Case 2: FLIP → magma non-degenerate -----------------------------
    const cFlip = document.createElement("div");
    cFlip.style.cssText = "width:128px;height:128px;position:absolute;left:320px;top:0";
    document.body.appendChild(cFlip);
    const flipProbe = await mountUnifiedDiff(cFlip, "flip", "magma");
    // FLIP is a cached multi-pass kernel displayed through magma — wait for the
    // colormap to resolve, THEN poll for a non-degenerate composited frame. On
    // slow software adapters the cached compute + blit lands well after mount, so
    // a single early read would sample a degenerate (all-zero) frame.
    await waitFor(() => flipProbe().colormap === "magma", 4000, 40);
    const flipBytes = await paintedBytes(flipProbe);
    const flipOk = flipProbe().colormap === "magma" && !!flipBytes && nonZero(flipBytes);
    if (!flipOk) allOk = false;
    report(flipOk, `[case2] FLIP diff renders non-degenerate (colormap="${flipProbe().colormap}")`);
    await noteCanvas("[case2]", flipProbe);

    report(allOk, `all GpuImagePane diff-capability cases`);
    setOverallStatus(allOk);
  } catch (err) {
    if (isDeviceLostError(err)) {
      // Loud SKIP — the software (SwiftShader) backend lost the device/instance
      // mid-readback (Dawn teardown artifact on direct-mounted panes; the diff
      // CONTENT proofs still run on CI via the realstack-gpu fingerprints and on
      // capable adapters here). Same handling as operations/backend-readback.
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
