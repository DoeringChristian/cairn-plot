import type { Device, Surface, Texture, TextureFormat } from "../../../plots/image/webgpu/device/device-contract.ts";
import { imageWebGpuRuntime, type ImageWebGpuRuntime } from "../../../plots/image/webgpu/device/runtime.ts";
import {
  acquirePane,
  applyGpuResourcePolicy,
  getGpuPoolMemorySnapshot,
  getRegisteredGpuDeviceCountForTest,
  isCanvasLive,
  releasePane,
  setDocumentHiddenForTest,
  type PaneHandle,
  type SourceUpload,
} from "../../../plots/image/webgpu/pool.ts";
import { expandedUploadCache } from "../../../plots/image/webgpu/expanded-upload-cache.ts";
import {
  setGpuSourceTextureLimits,
  setGpuSourceTextureRetentionLimit,
  setLiveGpuPaneLimit,
  setOffscreenCpuReleaseMs,
} from "../../../resources/runtime-config.ts";
import { createHarness } from "../../harness.ts";

const { report, setOverallStatus } = createHarness({
  title: "GPU RESOURCE POOL LIFECYCLE",
  resultFlag: "__gpuResourcePoolLifecycleResult",
});

let writes = 0;
let destroys = 0;
let failSurface = false;
const lostListeners = new Set<(reason: unknown) => void>();

function bytesPerPixel(format: TextureFormat): number {
  return format === "rgba8unorm" || format === "r32float" ? 4 : format === "rgba16float" ? 8 : 16;
}

function texture(width: number, height: number, format: TextureFormat): Texture {
  let destroyed = false;
  return {
    width,
    height,
    format,
    write() { writes++; },
    destroy() {
      if (!destroyed) {
        destroyed = true;
        destroys++;
      }
    },
  };
}

const device = {
  backend: "webgpu",
  capabilities: { hdr: true, compute: true, float16: true },
  createTexture: texture,
  createSurface(canvas: HTMLCanvasElement, opts: { hdr: boolean }): Surface {
    if (failSurface) {
      failSurface = false;
      throw new Error("synthetic activation failure");
    }
    return {
      canvas,
      hdr: opts.hdr,
      configure() {},
      getCurrentTextureView() { return {}; },
    };
  },
  destroy() {},
  onLost(listener: (reason: unknown) => void) {
    lostListeners.add(listener);
    return () => lostListeners.delete(listener);
  },
  isContextLost() { return false; },
} as unknown as Device;

const runtime: ImageWebGpuRuntime = {
  device,
  createSurface: (canvas, options = {}) => device.createSurface(canvas, { hdr: options.hdr ?? false }),
  readSurface: (surface) => device.readback(surface),
};
(imageWebGpuRuntime as { acquire: () => Promise<ImageWebGpuRuntime> }).acquire = async () => runtime;

function upload(byteLength: number): SourceUpload {
  const width = byteLength / bytesPerPixel("rgba8unorm");
  return { width, height: 1, format: "rgba8unorm", data: new Uint8Array(byteLength) };
}

function leased(key: string, byteLength: number) {
  const reacquire = () => expandedUploadCache.acquire(key, () => upload(byteLength));
  return { lease: reacquire(), reacquire };
}

async function pane(
  name: string,
  admitted: string[],
  failed: string[],
): Promise<{ handle: PaneHandle; canvas: HTMLCanvasElement }> {
  const canvas = document.createElement("canvas");
  canvas.dataset.name = name;
  const handle = await acquirePane(canvas, {
    onAdmitted: () => admitted.push(name),
    onActivationFailure: () => failed.push(name),
  });
  handle.resize(8, 8);
  return { handle, canvas };
}

async function tick(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

async function main(): Promise<void> {
  let ok = true;
  const admitted: string[] = [];
  const failed: string[] = [];
  expandedUploadCache.setBudgetBytes(16);
  setGpuSourceTextureRetentionLimit(3);
  setGpuSourceTextureLimits({ activeBytes: 48, sharedBytes: 1024, zeroRefBytes: 1024 });
  setLiveGpuPaneLimit(2);
  setOffscreenCpuReleaseMs(0);

  // Live replacement: admission is evaluated before upload. A larger distinct
  // source cannot displace another visible pane and leaves the old canvas paint.
  const p1 = await pane("replace", admitted, failed);
  const p2 = await pane("blocker", admitted, failed);
  const a1 = leased("lease:replace:old", 16);
  p1.handle.setSourceLease(a1.lease, "replace:old", a1.reacquire);
  p1.handle.restore();
  const a2 = leased("lease:blocker", 16);
  p2.handle.setSourceLease(a2.lease, "blocker", a2.reacquire);
  p2.handle.restore();
  const writesBeforeRejectedReplacement = writes;
  const canvasWidthBefore = p1.canvas.width;
  const large = leased("lease:replace:large", 64);
  p1.handle.setSourceLease(large.lease, "replace:large", large.reacquire);
  const replacementSnapshot = getGpuPoolMemorySnapshot();
  const replacementSafe = p1.handle.isParked && p1.handle.isWaiting &&
    writes === writesBeforeRejectedReplacement && p1.canvas.width === canvasWidthBefore &&
    replacementSnapshot.sourceTextures.activeBytes <= 48;
  report(replacementSafe,
    `live replacement waits without upload: live=${replacementSnapshot.panes.live}, ` +
    `waiting=${replacementSnapshot.panes.waiting}, active=${replacementSnapshot.sourceTextures.activeBytes}, writes=${writes}`);
  ok &&= replacementSafe;

  // Both successful uploads and capacity waiters release reconstructible leases.
  const leaseSnapshot = expandedUploadCache.snapshot();
  const leasesReleased = leaseSnapshot.refs === 0 && leaseSnapshot.bytes <= 16 && !leaseSnapshot.overBudget;
  report(leasesReleased,
    `distinct-content pressure leaves no pane pins: refs=${leaseSnapshot.refs}, bytes=${leaseSnapshot.bytes}, entries=${leaseSnapshot.entries}`);
  ok &&= leasesReleased;
  releasePane(p1.handle);
  releasePane(p2.handle);

  // FIFO survives hide/show: the pre-existing waiter is restored before the
  // pane that was live when the document became hidden.
  setLiveGpuPaneLimit(1);
  setGpuSourceTextureLimits({ activeBytes: 1024, sharedBytes: 1024, zeroRefBytes: 1024 });
  const f1 = await pane("was-live", admitted, failed);
  const f2 = await pane("old-waiter", admitted, failed);
  f1.handle.setSource(upload(16), "fifo:a");
  f1.handle.restore();
  f2.handle.setSource(upload(16), "fifo:b");
  f2.handle.restore();
  await tick();
  admitted.length = 0;
  setDocumentHiddenForTest(true);
  const hiddenSnapshot = getGpuPoolMemorySnapshot();
  setDocumentHiddenForTest(false);
  await tick();
  const fifoSnapshot = getGpuPoolMemorySnapshot();
  const fifoSafe = hiddenSnapshot.panes.documentHidden === 2 && hiddenSnapshot.panes.offscreen === 0 &&
    isCanvasLive(f2.canvas) && !isCanvasLive(f1.canvas) && admitted[0] === "old-waiter" &&
    fifoSnapshot.panes.waiting === 1;
  report(fifoSafe,
    `hide/show FIFO + separate hidden state: admitted=${admitted.join(",")}, hidden=${hiddenSnapshot.panes.documentHidden}, offscreen=${hiddenSnapshot.panes.offscreen}`);
  ok &&= fifoSafe;
  releasePane(f1.handle);
  releasePane(f2.handle);

  // Visibility restoration uses the exception-safe activation authority and
  // reports failure only after complete teardown.
  const broken = await pane("broken", admitted, failed);
  broken.handle.setSource(upload(16), "broken");
  broken.handle.restore();
  setDocumentHiddenForTest(true);
  failSurface = true;
  setDocumentHiddenForTest(false);
  await tick();
  const failedSnapshot = getGpuPoolMemorySnapshot();
  const failureSafe = failed.includes("broken") && broken.handle.isParked && !broken.handle.isWaiting &&
    failedSnapshot.panes.live === 0;
  report(failureSafe,
    `visibility activation failure tears down + notifies: failed=${failed.join(",")}, live=${failedSnapshot.panes.live}, waiting=${failedSnapshot.panes.waiting}`);
  ok &&= failureSafe;
  releasePane(broken.handle);

  // Runtime retention changes trim existing zero-ref shared entries now, not on
  // a future upload/release, while the device remains registered for diagnostics.
  const trim = await pane("trim", admitted, failed);
  trim.handle.setSource(upload(16), "trim:a");
  trim.handle.restore();
  trim.handle.setSourceB(upload(16), "trim:b");
  trim.handle.setSource(upload(16), "trim:c");
  trim.handle.setSourceB(upload(16), "trim:d");
  const beforeTrim = getGpuPoolMemorySnapshot().sourceTextures.zeroRefEntries;
  setGpuSourceTextureRetentionLimit(2);
  setGpuSourceTextureLimits({ activeBytes: 1024, sharedBytes: 1024, zeroRefBytes: 0 });
  applyGpuResourcePolicy();
  const afterTrim = getGpuPoolMemorySnapshot().sourceTextures.zeroRefEntries;
  const immediateTrim = beforeTrim > 0 && afterTrim === 0;
  report(immediateTrim, `runtime policy immediately trims shared zero-ref cache: before=${beforeTrim}, after=${afterTrim}`);
  ok &&= immediateTrim;

  releasePane(trim.handle);
  const cleanupSnapshot = getGpuPoolMemorySnapshot();
  const explicitCleanup = getRegisteredGpuDeviceCountForTest() === 0 &&
    cleanupSnapshot.sourceTextures.sharedEntries === 0 && lostListeners.size === 0;
  report(explicitCleanup,
    `last-pane cleanup unregisters device/caches: devices=${getRegisteredGpuDeviceCountForTest()}, shared=${cleanupSnapshot.sourceTextures.sharedEntries}, listeners=${lostListeners.size}`);
  ok &&= explicitCleanup;

  const lost = await pane("device-lost", admitted, failed);
  lost.handle.setSource(upload(16), "lost");
  lost.handle.restore();
  const notifyLost = [...lostListeners][0];
  notifyLost?.({ reason: "synthetic-loss" });
  await tick();
  const lossSnapshot = getGpuPoolMemorySnapshot();
  const lossCleanup = failed.includes("device-lost") && getRegisteredGpuDeviceCountForTest() === 0 &&
    lossSnapshot.sourceTextures.sharedEntries === 0 && lostListeners.size === 0;
  report(lossCleanup,
    `device loss tears down panes and diagnostic registry: devices=${getRegisteredGpuDeviceCountForTest()}, shared=${lossSnapshot.sourceTextures.sharedEntries}, destroys=${destroys}`);
  ok &&= lossCleanup;
  releasePane(lost.handle);

  setDocumentHiddenForTest(false);
  setOverallStatus(ok);
}

void main().catch((error) => {
  report(false, error instanceof Error ? `${error.name}: ${error.message}` : String(error));
  setOverallStatus(false);
});
