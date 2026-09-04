/**
 * CPU COMPARE — with `CpuImagePane` and `GpuImagePane` implementing the SAME
 * `ImageBackendInput`/`ImageComparisonInput` contract, a compare in render mode
 * `cpu` is not a "fallback" at all: the CPU backend renders every mode the GPU
 * one does. This harness pins that there is no degraded path left:
 *
 *   1. FLOAT diff  → the real CPU error field (`[data-cpu-comparison-result]`),
 *      NOT a slide, and no "needs WebGPU" notice.
 *   2. FLOAT split → the CPU split composite (divider + two per-side TEV
 *      overlays) in ONE pane, no notice.
 *   3. UINT8 diff with an engine-era kernel (SSIM) → a real CPU comparison
 *      (metrics chip), no notice.
 *   4. UINT8 diff with a pointwise kernel (absolute) → the CPU pixel-diff pane.
 *   5/6. The public descriptor path lowers straight to `CpuImagePane` with a
 *      `compareSource`; exact metrics and the pointwise diff pixels must work
 *      without WebGPU, and pan/zoom must not rerun a content pass.
 *
 * Cases 1-4 mount `CompositeMediaPane` directly (bypassing the descriptor
 * pipeline) in forced CPU mode. No WebGPU needed — that's the whole point.
 */
import { floatValues } from "../../runtime/pixel-buffer.ts";
import { createRoot, type Root } from "react-dom/client";
import { createElement } from "react";
import { CompositeMediaPane } from "../../runtime/compare-compositor";
import CpuImagePane from "../../cpu/view.tsx";
import type { ResolvedFloatImage } from "../../definition/content.ts";
import type { DiffMode } from "../../../types";
import { createHarness, waitFor } from "../../../../testing/harness";

const { report, setOverallStatus } = createHarness({ title: "CPU-COMPARE-FALLBACK" });

/** A tiny wide float source (2:1), a diagonal gradient so the tone-map isn't flat. */
function floatSource(key: string): ResolvedFloatImage {
  const w = 8;
  const h = 4;
  const data = new Float32Array(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = (x + y) / (w + h);
      const b = (y * w + x) * 3;
      data[b] = v;
      data[b + 1] = v * 0.5;
      data[b + 2] = 1 - v;
    }
  }
  return { pixels: floatValues(data), width: w, height: h, channels: 3, contentKey: key };
}
/** A uint8 data-URL side (a solid color PNG). */
function urlSide(color: string): string {
  const c = document.createElement("canvas");
  c.width = 8;
  c.height = 4;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 8, 4);
  return c.toDataURL("image/png");
}

function host(id: string): HTMLElement {
  const el = document.getElementById(id)!;
  el.style.cssText = "width:360px;height:200px;position:relative;background:#222";
  return el;
}
function notice(hostId: string): HTMLElement | null {
  return document.getElementById(hostId)!.querySelector<HTMLElement>("[data-cairn-compare-cpu-notice]");
}
function hasUnavailablePlaceholder(hostId: string): boolean {
  return (document.getElementById(hostId)!.textContent ?? "").includes("GPU compare unavailable");
}
/** The ONE presentation canvas of a mounted CPU pane (there is no `<img>` any more). */
function paneCanvasCount(hostId: string): number {
  return document
    .getElementById(hostId)!
    .querySelectorAll("[data-cpu-image-pane] canvas[data-cpu-image-canvas]").length;
}
function splitChrome(hostId: string): { divider: boolean; overlays: number } {
  const el = document.getElementById(hostId)!;
  return {
    divider: !!el.querySelector(".cairn-plot-split-divider"),
    overlays: el.querySelectorAll("[data-pixel-value-overlay]").length,
  };
}

async function run(): Promise<boolean> {
  let ok = true;
  (window as unknown as { __cairnPlotRenderMode?: string }).__cairnPlotRenderMode = "cpu";
  const roots: Root[] = [];

  const baseProps = {
    imageUrl: null as string | null,
    baselineUrl: null as string | null,
    operation: "absolute" as DiffMode,
    interpolation: "auto" as const,
    zoom: 1,
    pan: { x: 0, y: 0 },
    label: "",
  };
  const mount = (id: string, props: Record<string, unknown>) => {
    const root = createRoot(host(id));
    root.render(createElement(CompositeMediaPane, { ...baseProps, ...props } as never));
    roots.push(root);
  };

  // 1. FLOAT diff → the real CPU error field; no notice, no placeholder.
  mount("m1", { mode: "diff", imageFloat: floatSource("fg1"), baselineFloat: floatSource("ref1") });
  // 2. FLOAT split → the CPU split composite in ONE pane.
  mount("m2", { mode: "split", imageFloat: floatSource("fg2"), baselineFloat: floatSource("ref2") });
  // 3. UINT8 diff + the engine-era SSIM kernel → a real CPU comparison.
  mount("m3", {
    mode: "diff",
    operation: "ssim" as DiffMode,
    imageUrl: urlSide("#c0392b"),
    baselineUrl: urlSide("#2980b9"),
  });
  // 4. UINT8 diff + BASIC kernel (absolute) → CPU pixel-diff pane, NO notice.
  mount("m4", { mode: "diff", imageUrl: urlSide("#27ae60"), baselineUrl: urlSide("#8e44ad") });
  // 5. The public descriptor path lowers directly to CpuImagePane with a
  // compareSource. Its exact source metrics must work without WebGPU too.
  const directSource = floatSource("direct");
  const directRoot = createRoot(host("m5"));
  directRoot.render(createElement(CpuImagePane, {
    source: {
      dtype: "float",
      pixels: directSource.pixels,
      shape: [directSource.height, directSource.width, directSource.channels],
      contentKey: directSource.contentKey,
    },
    compareSource: {
      b: {
        dtype: "float",
        pixels: directSource.pixels,
        shape: [directSource.height, directSource.width, directSource.channels],
        contentKey: directSource.contentKey,
      },
      operationId: "ssim",
      mode: "diff",
      referenceLabel: "reference",
      foregroundLabel: "foreground",
    },
    label: "",
  }));
  roots.push(directRoot);

  // 6. Cairn's public compare descriptor uses this same direct CpuImagePane
  // shape. A pointwise operation must enter the real CPU diff pipeline rather
  // than leaving the reference rendered as an ordinary image.
  const pointwiseRoot = createRoot(host("m6"));
  pointwiseRoot.render(createElement(CpuImagePane, {
    source: { dtype: "uint8", url: urlSide("#0000ff"), contentKey: "blue-reference" },
    compareSource: {
      b: { dtype: "uint8", url: urlSide("#ff0000"), contentKey: "red-foreground" },
      operationId: "absolute",
      mode: "diff",
      referenceLabel: "reference",
      foregroundLabel: "foreground",
    },
    label: "",
  }));
  roots.push(pointwiseRoot);

  // --- 1. FLOAT diff → the real CPU error field ------------------------------
  const d1 = await waitFor(
    () => !!document.getElementById("m1")!.querySelector("[data-cpu-comparison-result]"),
    4000,
    20,
  );
  report(d1, "FLOAT diff → the CPU comparison result renders (no slide degradation)");
  report(!notice("m1"), "FLOAT diff → NO 'needs WebGPU' notice (the CPU computes it)");
  report(!hasUnavailablePlaceholder("m1"), "FLOAT diff → NO full 'GPU compare unavailable' placeholder");
  report(paneCanvasCount("m1") >= 1, `FLOAT diff → the viewport canvas is painted (${paneCanvasCount("m1")})`);
  ok = ok && d1 && !notice("m1") && !hasUnavailablePlaceholder("m1") && paneCanvasCount("m1") >= 1;

  // --- 2. FLOAT split → ONE pane compositing both operands -------------------
  const s2 = await waitFor(() => {
    const c = splitChrome("m2");
    return paneCanvasCount("m2") === 1 && c.divider && c.overlays >= 2;
  }, 4000, 20);
  const c2 = splitChrome("m2");
  report(
    s2,
    `FLOAT split → one pane, divider ${c2.divider}, ${c2.overlays} per-side TEV overlay(s), ${paneCanvasCount("m2")} canvas`,
  );
  report(!notice("m2"), "FLOAT split → NO 'compare on CPU' notice");
  report(!hasUnavailablePlaceholder("m2"), "FLOAT split → NO full placeholder");
  ok = ok && s2 && !notice("m2") && !hasUnavailablePlaceholder("m2");

  // --- 3. UINT8 SSIM diff → a real CPU comparison ---------------------------
  const m3metrics = await waitFor(
    () => !!document.getElementById("m3")!.querySelector("[data-cpu-compare-metrics]"),
    4000,
    20,
  );
  report(m3metrics, "UINT8 SSIM diff → the CPU comparison runs (metrics chip present)");
  report(!notice("m3"), "UINT8 SSIM diff → NO 'this diff needs WebGPU' notice");
  ok = ok && m3metrics && !notice("m3");

  // --- 4. UINT8 basic diff → CPU pixel diff, NO notice -----------------------
  const cpuPane = await waitFor(() => !!document.getElementById("m4")!.querySelector("[data-cpu-image-pane]"), 4000, 20);
  report(cpuPane, "UINT8 absolute diff → CPU pixel-diff pane renders");
  report(!notice("m4"), "UINT8 absolute diff → NO fallback notice (the CPU computes it)");
  ok = ok && cpuPane && !notice("m4");

  // --- 5. Unified CpuImagePane source metrics -------------------------------
  const cpuMetrics = await waitFor(
    () => !!document.getElementById("m5")!.querySelector("[data-cpu-compare-metrics]"),
    4000,
    20,
  );
  const cpuMetricsText = document.getElementById("m5")!
    .querySelector("[data-cpu-compare-metrics]")?.textContent ?? "";
  report(
    cpuMetrics && /MSE 0\.00e\+0 · PSNR ∞ dB · SSIM 1\.0000/.test(cpuMetricsText),
    `unified CPU compare exposes exact metrics "${cpuMetricsText}"`,
  );
  ok = ok && cpuMetrics && /MSE 0\.00e\+0 · PSNR ∞ dB · SSIM 1\.0000/.test(cpuMetricsText);

  // --- 6. Unified CpuImagePane enters pointwise diff mode -------------------
  // The pane paints into ONE VIEWPORT-sized presentation canvas (spec §3), so
  // the diff pixels sit at the image QUAD inside it — sample the centre, not
  // canvas (0,0), which is letterbox/checkerboard at this aspect.
  const centrePixel = (canvas: HTMLCanvasElement | null | undefined) =>
    canvas && canvas.width > 0 && canvas.height > 0
      ? canvas.getContext("2d")?.getImageData(canvas.width >> 1, canvas.height >> 1, 1, 1).data
      : undefined;
  const pointwiseDiff = await waitFor(() => {
    const result = document.getElementById("m6")!.querySelector('[data-cpu-comparison-result="absolute"]');
    const canvas = result?.querySelector<HTMLCanvasElement>("canvas[data-cpu-image-canvas]");
    const px = centrePixel(canvas);
    return !!px && px[3]! > 0;
  }, 4000, 20);
  const diffCanvas = document.getElementById("m6")!.querySelector<HTMLCanvasElement>("canvas[data-cpu-image-canvas]");
  const diffPixel = centrePixel(diffCanvas);
  const isMagentaDifference = !!diffPixel && diffPixel[0] === 255 && diffPixel[1] === 0 && diffPixel[2] === 255;
  report(pointwiseDiff && isMagentaDifference, `unified CPU compare renders the actual pointwise diff (${diffPixel ? [...diffPixel] : "no pixel"})`);
  ok = ok && pointwiseDiff && isMagentaDifference;

  // View-only changes must remain presentation-only. A fresh diff-source shape
  // on every render used to invalidate the HDR wrapper and tone-map the complete
  // native-resolution error field once per wheel/pointer event.
  //
  // The pane paints its presentation canvas with `drawImage` now, so watching
  // THAT canvas's `putImageData` would be vacuous. Watch the two calls the
  // CONTENT stage cannot avoid instead, GLOBALLY (they also fire on the
  // offscreen canvases the pipelines use): every native `ImageData` write goes
  // through `CanvasRenderingContext2D.prototype.putImageData`, and every new
  // paint source goes through `createImageBitmap`. Zero of each across the
  // gesture means no pixel pass re-ran.
  let contentWrites = 0;
  const proto = CanvasRenderingContext2D.prototype;
  const originalPutImageData = proto.putImageData;
  const originalCreateImageBitmap = window.createImageBitmap;
  if (diffCanvas) {
    proto.putImageData = function patched(
      this: CanvasRenderingContext2D,
      ...args: Parameters<CanvasRenderingContext2D["putImageData"]>
    ) {
      contentWrites++;
      return originalPutImageData.apply(this, args);
    } as CanvasRenderingContext2D["putImageData"];
    window.createImageBitmap = function patched(
      ...args: Parameters<typeof createImageBitmap>
    ) {
      contentWrites++;
      return originalCreateImageBitmap.apply(window, args);
    } as typeof createImageBitmap;
    const rect = diffCanvas.getBoundingClientRect();
    for (let i = 0; i < 8; i++) {
      diffCanvas.dispatchEvent(new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        ctrlKey: true,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        deltaY: -24,
      }));
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
    proto.putImageData = originalPutImageData;
    window.createImageBitmap = originalCreateImageBitmap;
  }
  // Guard against the assertion going vacuous: BOTH spies must actually observe
  // the calls a content pass would make (an offscreen `putImageData`, a
  // `createImageBitmap`). Without this a broken patch would read as "0 passes".
  let probePuts = 0;
  let probeBitmaps = 0;
  {
    const put = proto.putImageData;
    const make = window.createImageBitmap;
    proto.putImageData = function patched(
      this: CanvasRenderingContext2D,
      ...args: Parameters<CanvasRenderingContext2D["putImageData"]>
    ) {
      probePuts++;
      return put.apply(this, args);
    } as CanvasRenderingContext2D["putImageData"];
    window.createImageBitmap = function patched(...args: Parameters<typeof createImageBitmap>) {
      probeBitmaps++;
      return make.apply(window, args);
    } as typeof createImageBitmap;
    try {
      const probeCanvas = document.createElement("canvas");
      probeCanvas.width = 1;
      probeCanvas.height = 1;
      probeCanvas.getContext("2d")!.putImageData(new ImageData(1, 1), 0, 0);
      await window.createImageBitmap(new ImageData(1, 1));
    } finally {
      proto.putImageData = put;
      window.createImageBitmap = make;
    }
  }
  const spiesWork = probePuts === 1 && probeBitmaps === 1;
  report(spiesWork, `content-pass spies observe both calls (${probePuts} putImageData, ${probeBitmaps} createImageBitmap)`);
  report(
    contentWrites === 0,
    `CPU diff pan/zoom does not rerun native-resolution tone mapping (${contentWrites} content pass(es))`,
  );
  ok = ok && spiesWork && contentWrites === 0;

  roots.forEach((r) => r.unmount());
  return ok;
}

run()
  .then((ok) => setOverallStatus(ok))
  .catch((err) => {
    report(false, `threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    setOverallStatus(false);
  });
