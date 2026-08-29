/**
 * `gpu-image-gate.ts`'s capability contract — Case 6 of the `GpuImagePane`
 * harness, the successor of the old ADDON-protocol check (the gpu-image addon
 * was folded into core, ruling 2026-08-26: no window component seam, no ready
 * event, no include-once flag — one static import plus the lazy device gate).
 *
 * `gpu-image-pane.browser.html` loads, in document order:
 *   1. `gpu-image-pane.browser.bundle.js` (cases 1-5, `type="module"`,
 *      deferred);
 *   2. THIS file's bundle (`type="module"`, deferred — it still waits for (1)
 *      to actually FINISH before writing the page's final #status).
 *
 * Asserts the gate: (a) `ensureGpuImageProbe()` settles to `"ready"` on a
 * WebGPU-capable page and notifies subscribers, (b) the HOST opt-out
 * (`window.__cairnPlotUseGpuImage = false`) short-circuits a fresh gate to
 * `"unavailable"` without probing, (c) the reset seam restores `"unknown"`.
 */
import {
  ensureGpuImageProbe,
  gpuImageGateState,
  subscribeGpuImageGate,
  __resetGpuImageGateForTest,
} from "../../../plots/image/runtime/gpu-image-gate";
import { createHarness, waitFor } from "../../harness";

declare global {
  interface Window {
    __gpuImagePaneTestResult?: "pass" | "fail";
    __gpuImagePaneMainDone?: boolean;
  }
}

const { report, setOverallStatus } = createHarness({ title: "GPU IMAGE PANE", resultFlag: "__gpuImagePaneTestResult" });

async function main(): Promise<void> {
  try {
    // (a) probe on a WebGPU-capable page → "ready", with a subscriber tick.
    let ticks = 0;
    const unsub = subscribeGpuImageGate(() => {
      ticks += 1;
    });
    ensureGpuImageProbe();
    const becameReady = await waitFor(() => gpuImageGateState() === "ready");
    report(becameReady, "gate settles to 'ready' once getSharedWebGpuDevice() resolves");
    report(ticks >= 1, "gate notifies subscribers on the flip");
    unsub();

    // (c) reset restores a fresh page.
    __resetGpuImageGateForTest();
    const resetOk = gpuImageGateState() === "unknown";
    report(resetOk, "test reset restores 'unknown'");

    // (b) HOST opt-out short-circuits a fresh gate without probing.
    window.__cairnPlotUseGpuImage = false;
    ensureGpuImageProbe();
    const optedOut = gpuImageGateState() === "unavailable";
    report(optedOut, "host opt-out (__cairnPlotUseGpuImage=false) short-circuits to 'unavailable'");
    delete window.__cairnPlotUseGpuImage;

    // Restore "ready" for any later reader on this page (idempotent probe).
    __resetGpuImageGateForTest();
    ensureGpuImageProbe();
    await waitFor(() => gpuImageGateState() === "ready");

    const gateOk = becameReady && ticks >= 1 && resetOk && optedOut;

    // Wait for the sibling bundle (cases 1-5) to finish, then combine into
    // the page's FINAL authoritative status (this script runs last).
    const mainDone = await waitFor(() => window.__gpuImagePaneMainDone === true, 20000);
    report(mainDone, "sibling gpu-image-pane.browser.bundle.js (cases 1-5) completed");
    const mainOk = window.__gpuImagePaneTestResult === "pass";
    report(mainOk, "sibling gpu-image-pane.browser.bundle.js (cases 1-5) result was PASS");

    setOverallStatus(gateOk && mainDone && mainOk);
  } catch (err) {
    report(false, `threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    setOverallStatus(false);
  }
}

void main();
