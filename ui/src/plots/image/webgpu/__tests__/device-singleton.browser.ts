/**
 * Shared-device singleton harness (Task 4 of the WebGPU engine,
 * Sub-project 1) — `engine/device.ts`'s `getSharedWebGpuDevice()`/
 * `resetSharedWebGpuDevice()`.
 *
 * jsdom has no WebGPU, so — like `backend-readback.browser.ts` — this is NOT
 * a unit test, it's a browser page driven via claude-in-chrome.
 *
 * The engine is WebGPU-ONLY (the WebGL2 backend was removed — see
 * shared WebGPU device lifecycle); there is no
 * `?forceWebGL2` mode to exercise anymore. Assertions run on a plain page
 * load:
 *   1. `getSharedWebGpuDevice()` called twice (back to back, before either
 *      resolves) returns the SAME `Device` instance (`===`).
 *   2. On a WebGPU-capable browser (`navigator.gpu` present), the resolved
 *      device's `.backend === "webgpu"`.
 *   3. `resetSharedWebGpuDevice()` then `getSharedWebGpuDevice()` again yields a FRESH
 *      instance (`!==` the first one).
 *   4. On a browser WITHOUT `navigator.gpu`, `getSharedWebGpuDevice()` REJECTS
 *      (no in-engine fallback — see `engine/device.ts`'s module doc; the
 *      caller is responsible for falling back to the legacy CPU pane).
 *
 * RUNNING:
 *   1. Bundle this file to plain JS:
 *        cd cairn/ui && npx esbuild \
 *          src/plots/image/webgpu/__tests__/device-singleton.browser.ts \
 *          --bundle --format=esm \
 *          --outfile=src/plots/image/webgpu/__tests__/device-singleton.browser.bundle.js
 *   2. Serve over http (file:// is blocked for module scripts):
 *        cd cairn/ui/src/plots/image/webgpu/__tests__ && python3 -m http.server 8935
 *   3. Open in Chrome (claude-in-chrome) and read the PASS/FAIL lines from
 *      the DOM/console:
 *        http://localhost:8935/device-singleton.browser.html
 *
 * The generated `.bundle.js` is NOT committed (gitignored) — regenerate with
 * the command above whenever this harness or its imports change.
 */
import { getSharedWebGpuDevice, resetSharedWebGpuDevice } from "../device/device-provider.ts";
import { createHarness } from "../../../../testing/harness";

const { report, setOverallStatus } = createHarness({ title: "DEVICE SINGLETON", resultFlag: "__deviceSingletonTestResult" });

async function runNoWebGPUCheck(): Promise<boolean> {
  resetSharedWebGpuDevice();
  try {
    const device = await getSharedWebGpuDevice();
    report(false, `navigator.gpu is NOT available, but getSharedWebGpuDevice() resolved anyway (backend=${device.backend}) — expected a rejection (no in-engine fallback)`);
    return false;
  } catch (err) {
    report(true, `navigator.gpu is NOT available -> getSharedWebGpuDevice() REJECTED as expected (${err instanceof Error ? err.message : String(err)})`);
    return true;
  }
}

async function runDefaultModeChecks(): Promise<boolean> {
  let allOk = true;

  // 1. Two concurrent calls (before either resolves) return the same instance.
  const p1 = getSharedWebGpuDevice();
  const p2 = getSharedWebGpuDevice();
  const [d1, d2] = await Promise.all([p1, p2]);
  const sameInstance = d1 === d2;
  allOk = allOk && sameInstance;
  report(sameInstance, `getSharedWebGpuDevice() called twice concurrently returns the SAME instance (backend=${d1.backend})`);

  // A third, later call (after the first has resolved) must also return the
  // same memoized instance.
  const d3 = await getSharedWebGpuDevice();
  const stillSame = d3 === d1;
  allOk = allOk && stillSame;
  report(stillSame, `getSharedWebGpuDevice() called again after resolution still returns the SAME instance`);

  // 2. The shared device is always WebGPU (the engine's only backend).
  const isWebGPU = d1.backend === "webgpu";
  allOk = allOk && isWebGPU;
  report(isWebGPU, `shared device backend === "webgpu" (actual: ${d1.backend})`);

  // 3. resetSharedWebGpuDevice() + a fresh getSharedWebGpuDevice() call yields a new instance.
  resetSharedWebGpuDevice();
  const d4 = await getSharedWebGpuDevice();
  const isFresh = d4 !== d1;
  allOk = allOk && isFresh;
  report(isFresh, `resetSharedWebGpuDevice() then getSharedWebGpuDevice() yields a FRESH instance (backend=${d4.backend})`);

  return allOk;
}

async function main(): Promise<void> {
  try {
    const hasWebGPU = "gpu" in navigator && !!navigator.gpu;
    report(true, `navigator.gpu present: ${hasWebGPU}`);
    const ok = hasWebGPU ? await runDefaultModeChecks() : await runNoWebGPUCheck();
    setOverallStatus(ok);
  } catch (err) {
    report(false, `threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    setOverallStatus(false);
  }
}

void main();
