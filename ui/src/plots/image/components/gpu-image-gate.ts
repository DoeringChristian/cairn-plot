/**
 * The in-core WebGPU IMAGE-ENGINE gate — the replacement for the deleted
 * `gpu-image` addon protocol (fold ruling 2026-08-26: `GpuImagePane` ships in
 * `core.iife.js`; only `three` and `figure` remain addons).
 *
 * What stays from the addon era is the genuinely irreducible part: device
 * acquisition (`getSharedWebGpuDevice()`) is ASYNC and can fail, so image surfaces
 * must render the CPU backend first and flip to the engine pane when the
 * probe settles. What is DELETED: the window component seam
 * (`__cairnPlotGpuImagePane`), the ready `CustomEvent` whose name three files
 * kept in sync by comment, the include-once flag, and the second copy of this
 * gate the compositor carried — everything is a static import plus this one
 * module-local store.
 *
 * The probe is LAZY: nothing runs until the first image/compare surface calls
 * `ensureGpuImageProbe()` (from an effect), so a chart-only page never
 * touches WebGPU — strictly better than the old emit-time addon heuristic.
 *
 * `window.__cairnPlotUseGpuImage === false` remains the HOST-facing opt-out
 * (harnesses and embedding pages set it before mount); it short-circuits the
 * probe entirely. The failure path carries the addon's capability triage
 * (secure-context vs genuinely unsupported) unchanged.
 */
import { getSharedWebGpuDevice } from "../engine/webgpu/device-provider.ts";
import {
  noWebgpuKind,
  reportCapabilityLimit,
  warnGpuUnavailable,
} from "../../../primitives/components/capability-notice";

declare global {
  interface Window {
    /** Host-facing opt-out: `false` forces the CPU backends even when WebGPU
     *  is available. Set before mount. */
    __cairnPlotUseGpuImage?: boolean;
  }
}

export type GpuImageGateState = "unknown" | "ready" | "unavailable";

let state: GpuImageGateState = "unknown";
let probing = false;
const listeners = new Set<() => void>();

function setState(next: GpuImageGateState): void {
  if (state === next) return;
  state = next;
  for (const cb of [...listeners]) cb();
}

/** Snapshot read for `useSyncExternalStore`. */
export function gpuImageGateState(): GpuImageGateState {
  return state;
}

/** Subscribe to gate flips. Returns unsubscribe. */
export function subscribeGpuImageGate(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/**
 * Kick the device probe (idempotent; called from image-surface mount
 * effects). Respects the host opt-out. Safe to call any number of times.
 */
export function ensureGpuImageProbe(): void {
  if (state !== "unknown" || probing) return;
  if (typeof window === "undefined") return;
  if (window.__cairnPlotUseGpuImage === false) {
    setState("unavailable");
    return;
  }
  probing = true;
  getSharedWebGpuDevice().then(
    () => {
      probing = false;
      setState("ready");
    },
    (err) => {
      probing = false;
      // WebGPU not available (or failed to initialize) — the CPU backends
      // stay in place. Expected, non-fatal; surface the right remedy
      // (secure-context misconfiguration vs a genuinely unsupported browser).
      // eslint-disable-next-line no-console
      console.warn("cairn-plot: WebGPU image engine unavailable, staying on CPU backends", err);
      const gpuEnv = {
        hasGpu: "gpu" in navigator,
        isSecureContext: window.isSecureContext !== false,
      };
      reportCapabilityLimit(noWebgpuKind(gpuEnv));
      warnGpuUnavailable(gpuEnv);
      setState("unavailable");
    },
  );
}

/** TESTS ONLY: reset the gate to a fresh-page state. */
export function __resetGpuImageGateForTest(): void {
  state = "unknown";
  probing = false;
  listeners.clear();
}
