import React from "react";
import { createRoot } from "react-dom/client";
import { halfBits } from "../../../plots/image/runtime/pixel-buffer.ts";
import { hdrSource, type FloatImageData } from "../../../plots/image/runtime/contracts.ts";
import GpuImagePane from "../../../plots/image/webgpu/view.tsx";
import { getLiveSwapchainCount } from "../../../plots/image/webgpu/pool.ts";
import {
  getLiveGpuPaneLimit,
  setLiveGpuPaneLimit,
  setOffscreenCpuReleaseMs,
} from "../../../resources/runtime-config.ts";
import { getWebGpuComparisonStats, resetWebGpuComparisonStats } from "../../../plots/image/webgpu/perf-stats.ts";
import { getMemoryDiagnosticSnapshot } from "../../../public/memory-diagnostics.ts";
import { createHarness, sleep, waitFor } from "../../harness.ts";

const { report, setOverallStatus } = createHarness({
  title: "GPU LARGE IMAGE STRESS",
  resultFlag: "__gpuLargeImageStressResult",
});
const h = React.createElement;

function mib(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

function heapBytes(): number | undefined {
  return (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize;
}

async function main(): Promise<void> {
  const body = document.body;
  const width = Number(body.dataset.width ?? "3840");
  const height = Number(body.dataset.height ?? "2160");
  const count = Number(body.dataset.count ?? "12");
  if (body.dataset.liveLimit) setLiveGpuPaneLimit(Number(body.dataset.liveLimit));
  const releaseMs = body.dataset.offscreenReleaseMs
    ? Number(body.dataset.offscreenReleaseMs)
    : null;
  if (releaseMs !== null) setOffscreenCpuReleaseMs(releaseMs);
  const liveLimit = getLiveGpuPaneLimit();
  const pixels = width * height;
  const sourceBytes = pixels * 2;
  const expandedBytesPerPane = pixels * 4 * 2;
  const predictedResidentBytes = expandedBytesPerPane; // one immutable shared texture

  const bits = new Uint16Array(pixels);
  bits.fill(0x3800); // 0.5 in IEEE binary16
  const image: FloatImageData = {
    pixels: halfBits(bits),
    shape: [height, width],
    dtype: "<f2",
  };
  const source = hdrSource(image, `stress:half:${width}x${height}`);
  const container = document.createElement("div");
  container.style.cssText =
    "display:grid;grid-template-columns:repeat(4,240px);grid-auto-rows:110px;gap:4px;width:980px";
  body.appendChild(container);

  resetWebGpuComparisonStats();
  const longTasks: number[] = [];
  const longTaskObserver = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) longTasks.push(entry.duration);
  });
  try {
    longTaskObserver.observe({ type: "longtask", buffered: true });
  } catch {
    // Older browsers may not expose Long Tasks; the memory/upload results remain useful.
  }
  const heapBefore = heapBytes();
  const started = performance.now();
  const root = createRoot(container);
  root.render(
    h(
      React.Fragment,
      null,
      ...Array.from({ length: count }, (_, index) =>
        h(
          "div",
          { key: index, style: { minWidth: 0, minHeight: 0, overflow: "hidden" } },
          h(GpuImagePane, {
            source,
            tonemap: "linear",
            exposure: 0,
            zoom: 1,
            pan: { x: 0, y: 0 },
            onViewChange: () => {},
            resetSettings: () => {},
            label: `large-${width}x${height}-${index}`,
          }),
        ),
      ),
    ),
  );

  const ready = await waitFor(
    () =>
      container.querySelectorAll('[data-gpu-backend-ready="true"]').length === count &&
      getLiveSwapchainCount() === Math.min(count, liveLimit),
    180_000,
    100,
  );
  const elapsed = performance.now() - started;
  const statsAtReady = getWebGpuComparisonStats();
  await sleep(3_000);
  const live = getLiveSwapchainCount();
  const heapAfter = heapBytes();
  const stats = getWebGpuComparisonStats();
  const memory = getMemoryDiagnosticSnapshot();
  const stableUploads = stats.sourceUploads === statsAtReady.sourceUploads;
  const sharedOnce = count <= 1 || stats.sourceUploads === 1;
  const stableAdmission =
    live <= liveLimit &&
    memory.panes.offscreen === 0 &&
    memory.panes.waiting === Math.max(0, count - live);

  report(ready, `BENCH: ${count} panes became GPU-ready at ${width}x${height}`);
  report(
    stableAdmission,
    `BENCH: visible=${count - memory.panes.offscreen}; live=${live}; waiting=${memory.panes.waiting}; ` +
      `cap=${liveLimit}; mount=${elapsed.toFixed(0)} ms`,
  );
  report(
    stableUploads,
    `BENCH: uploads at ready=${statsAtReady.sourceUploads}; after 3s=${stats.sourceUploads}; ` +
      `post-ready delta=${stats.sourceUploads - statsAtReady.sourceUploads} (must be zero)`,
  );
  report(
    sharedOnce,
    `BENCH: repeated immutable content uploads=${stats.sourceUploads}; shared entries=${memory.gpuSources.sharedEntries}; ` +
      `expanded refs=${memory.expandedCpuUploads.refs}`,
  );
  report(
    true,
    `BENCH: long tasks=${longTasks.length}; total=${longTasks.reduce((a, b) => a + b, 0).toFixed(0)} ms; ` +
      `max=${Math.max(0, ...longTasks).toFixed(0)} ms`,
  );
  report(
    true,
    `BENCH: source=${mib(sourceBytes)} MiB; expanded texture/pane=${mib(expandedBytesPerPane)} MiB; ` +
      `predicted live source textures=${mib(predictedResidentBytes)} MiB`,
  );
  if (heapBefore !== undefined && heapAfter !== undefined) {
    report(
      true,
      `BENCH: JS heap before=${mib(heapBefore)} MiB; after=${mib(heapAfter)} MiB; delta=${mib(heapAfter - heapBefore)} MiB`,
    );
  }

  // Admission stability: taking one admitted pane offscreen must free its slot
  // for exactly one waiter; returning it becomes a waiter and must not displace
  // another visible pane or trigger another source upload.
  let waiterPromotion = true;
  if (count > liveLimit) {
    const firstCell = container.firstElementChild as HTMLElement | null;
    if (firstCell) {
      const refsBefore = getMemoryDiagnosticSnapshot().expandedCpuUploads.refs;
      firstCell.style.display = "none";
      const promoted = await waitFor(() => {
        const now = getMemoryDiagnosticSnapshot();
        return now.panes.offscreen === 1 && now.panes.live === liveLimit &&
          now.panes.waiting === count - liveLimit - 1;
      }, 5_000, 25);
      firstCell.style.display = "";
      const returnedWaiting = await waitFor(() => {
        const now = getMemoryDiagnosticSnapshot();
        return now.panes.offscreen === 0 && now.panes.live === liveLimit &&
          now.panes.waiting === count - liveLimit;
      }, 5_000, 25);
      if (releaseMs !== null) await sleep(releaseMs + 50);
      const afterCycle = getMemoryDiagnosticSnapshot();
      const quickReturnCancelled = afterCycle.expandedCpuUploads.refs === refsBefore;

      let delayedRelease = true;
      if (releaseMs !== null) {
        firstCell.style.display = "none";
        await waitFor(() => getMemoryDiagnosticSnapshot().panes.offscreen === 1, 5_000, 25);
        await sleep(releaseMs + 50);
        delayedRelease = getMemoryDiagnosticSnapshot().expandedCpuUploads.refs === refsBefore - 1;
        firstCell.style.display = "";
        await waitFor(() => {
          const now = getMemoryDiagnosticSnapshot();
          return now.panes.offscreen === 0 && now.expandedCpuUploads.refs === refsBefore;
        }, 5_000, 25);
      }
      const finalCycle = getMemoryDiagnosticSnapshot();
      waiterPromotion = promoted && returnedWaiting && quickReturnCancelled && delayedRelease &&
        finalCycle.uploads.count === stats.sourceUploads;
      report(
        waiterPromotion,
        `BENCH: offscreen frees one slot; return waits stably; quick return cancels CPU release; ` +
          `delayed release=${delayedRelease}; uploads remain ${finalCycle.uploads.count}`,
      );
    }
  }

  longTaskObserver.disconnect();
  const teardownStarted = performance.now();
  root.unmount();
  container.remove();
  const released = await waitFor(() => getLiveSwapchainCount() === 0, 30_000, 50);
  report(released, `BENCH: teardown released all live surfaces in ${(performance.now() - teardownStarted).toFixed(0)} ms`);
  setOverallStatus(ready && stableAdmission && stableUploads && sharedOnce && waiterPromotion && released);
}

void main().catch((error) => {
  report(false, error instanceof Error ? `${error.name}: ${error.message}` : String(error));
  setOverallStatus(false);
});
