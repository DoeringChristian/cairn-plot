/**
 * CPU COMPARE FALLBACK — when the WebGPU compare engine is unavailable (render
 * mode `cpu`), a compare must NOT show a bare "unavailable" placeholder with no
 * image. It falls back to a VALID view + a small notice:
 *
 *   1. FLOAT diff  → tone-map the float sides on the CPU, show a SLIDE + a
 *      "Diff needs WebGPU" notice (float diff is GPU-only pixel math).
 *   2. FLOAT split → the requested slide of the tone-mapped floats + a
 *      "Compare on CPU" notice.
 *   3. UINT8 diff with an ENGINE-only kernel (e.g. SSIM) → slide + a
 *      "This diff needs WebGPU" notice.
 *   4. UINT8 diff with a BASIC kernel (absolute) → the CPU pixel-diff pane
 *      (`computeDiff`), NO notice — the CPU can compute it.
 *
 * Mounts `CompositeMediaPane` directly (bypassing the descriptor pipeline) in
 * forced CPU mode. No WebGPU needed — that's the whole point.
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
function dataImgCount(hostId: string): number {
  return document.getElementById(hostId)!.querySelectorAll("img[src^='data:image']").length;
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

  // 1. FLOAT diff → slide + "Diff needs WebGPU"; no unavailable placeholder.
  mount("m1", { mode: "diff", imageFloat: floatSource("fg1"), baselineFloat: floatSource("ref1") });
  // 2. FLOAT split → slide + "Compare on CPU".
  mount("m2", { mode: "split", imageFloat: floatSource("fg2"), baselineFloat: floatSource("ref2") });
  // 3. UINT8 diff + ENGINE kernel (ssim) → slide + "This diff needs WebGPU".
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

  // --- 1. FLOAT diff ---------------------------------------------------------
  const n1 = await waitFor(() => !!notice("m1") && dataImgCount("m1") >= 1, 4000, 20);
  const n1txt = notice("m1")?.textContent ?? "";
  report(n1 && /diff needs webgpu/i.test(n1txt), `FLOAT diff → slide + notice "${n1txt}"`);
  report(!hasUnavailablePlaceholder("m1"), "FLOAT diff → NO full 'GPU compare unavailable' placeholder");
  report(dataImgCount("m1") >= 1, `FLOAT diff → tone-mapped image(s) shown (${dataImgCount("m1")})`);
  ok = ok && n1 && /diff needs webgpu/i.test(n1txt) && !hasUnavailablePlaceholder("m1") && dataImgCount("m1") >= 1;

  // --- 2. FLOAT split --------------------------------------------------------
  const n2 = await waitFor(() => !!notice("m2") && dataImgCount("m2") >= 1, 4000, 20);
  const n2txt = notice("m2")?.textContent ?? "";
  report(n2 && /compare on cpu/i.test(n2txt), `FLOAT split → slide + notice "${n2txt}"`);
  report(!hasUnavailablePlaceholder("m2"), "FLOAT split → NO full placeholder");
  ok = ok && n2 && /compare on cpu/i.test(n2txt) && !hasUnavailablePlaceholder("m2");

  // --- 3. UINT8 engine-kernel diff ------------------------------------------
  const n3 = await waitFor(() => !!notice("m3") && dataImgCount("m3") >= 1, 4000, 20);
  const n3txt = notice("m3")?.textContent ?? "";
  report(n3 && /diff needs webgpu/i.test(n3txt), `UINT8 SSIM diff → slide + notice "${n3txt}"`);
  ok = ok && n3 && /diff needs webgpu/i.test(n3txt);

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

  // View-only changes must remain compositor-only. A fresh diff-source shape on
  // every render used to invalidate the HDR wrapper and tone-map the complete
  // native-resolution error field once per wheel/pointer event.
  let diffRepaints = 0;
  const diffContext = diffCanvas?.getContext("2d");
  const originalPutImageData = diffContext?.putImageData.bind(diffContext);
  if (diffCanvas && diffContext && originalPutImageData) {
    diffContext.putImageData = ((...args: Parameters<CanvasRenderingContext2D["putImageData"]>) => {
      diffRepaints++;
      return originalPutImageData(...args);
    }) as CanvasRenderingContext2D["putImageData"];
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
    diffContext.putImageData = originalPutImageData;
  }
  report(diffRepaints === 0, `CPU diff pan/zoom does not rerun native-resolution tone mapping (${diffRepaints} repaint(s))`);
  ok = ok && diffRepaints === 0;

  roots.forEach((r) => r.unmount());
  return ok;
}

run()
  .then((ok) => setOverallStatus(ok))
  .catch((err) => {
    report(false, `threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    setOverallStatus(false);
  });
