/**
 * `useDeepFlatten` — the DEEP EXR depth-slider controller shared by both image
 * backends (CPU + GPU HDR paths).
 *
 * A deep source arrives as an `HdrData` whose `data` is the FULL composite plus
 * a `deep` {@link DeepFlattenController} (retained wasm-side samples). This hook:
 *   - seeds the Z cutoff at `zMax` (full composite) via `useResettableState`, so
 *     HOME/double-click reset it through the shell's existing reset/extraModified
 *     contract;
 *   - on a cutoff change, DEBOUNCES (~100ms) a `deep.flatten(zClip)` re-composite
 *     and swaps the resulting buffer into the returned `hdr` (same dims/precision)
 *     — the pane's existing "hdr changed → re-render/re-upload" effect does the
 *     rest;
 *   - exposes a `ToolbarSliderSpec` for the shell's slider row (double-click
 *     manual entry + out-of-range typing come free). The slider is LINEAR in Z
 *     unless the volume spans > 1e3× (`zMax/zMin`), where it maps LOG10 so the
 *     near field isn't crushed — the read-out shows the true Z either way;
 *   - `dispose()`s the retained handle on unmount / source change.
 *
 * Non-deep sources (no `hdr.deep`) return the `hdr` untouched and `slider:
 * undefined`, so the pane shows no depth row.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HdrData } from "./image-backend";
import type { ToolbarSliderSpec } from "../controls/ToolbarConfig";
import { useResettableState } from "../hooks/use-resettable-state";

/** Debounce before firing a re-flatten (coalesces slider drags). */
const DEEP_FLATTEN_DEBOUNCE_MS = 100;
/** Dynamic-range threshold above which the slider maps Z on a log10 scale. */
const LOG_SCALE_RATIO = 1e3;

export interface DeepFlattenState {
  /** The effective `HdrData` — the prop `hdr`, or a Z-clipped re-flatten of it. */
  hdr: HdrData;
  /** The depth slider for the toolbar (absent for non-deep sources). */
  slider?: ToolbarSliderSpec;
  /** Restore the cutoff to `zMax` (full composite) — wired to the shell HOME. */
  reset(): void;
  /** True while the cutoff is below `zMax` (enables the shell HOME button). */
  isModified: boolean;
}

export function useDeepFlatten(hdr: HdrData): DeepFlattenState {
  const deep = hdr.deep;
  const zMin = deep?.zMin ?? 0;
  const zMax = deep?.zMax ?? 0;

  // Z cutoff, seeded at zMax (full composite). Reset/isModified drive the shell.
  const [zClip, setZClip, zMeta] = useResettableState<number>(zMax);
  // Re-flattened buffer for the current cutoff (null ⇒ show the full composite).
  const [flatData, setFlatData] = useState<HdrData["data"] | null>(null);
  const reqRef = useRef(0);

  // Dispose the retained handle when the source changes or the pane unmounts.
  useEffect(() => {
    return () => deep?.dispose();
  }, [deep]);

  // Debounced re-flatten on cutoff change. At (or above) zMax the full composite
  // already IS `hdr.data`, so we just clear the override — no worker round-trip.
  useEffect(() => {
    if (!deep) return;
    if (zClip >= zMax) {
      setFlatData(null);
      return;
    }
    const myReq = ++reqRef.current;
    const timer = setTimeout(() => {
      deep
        .flatten(zClip)
        .then((buf) => {
          if (reqRef.current === myReq) setFlatData(buf);
        })
        .catch(() => {
          /* a stale/failed re-flatten leaves the previous frame shown */
        });
    }, DEEP_FLATTEN_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [deep, zClip, zMax]);

  const effectiveHdr = useMemo<HdrData>(
    () => (deep && flatData != null ? { ...hdr, data: flatData } : hdr),
    [hdr, deep, flatData],
  );

  // Log mapping only when the volume spans a large dynamic range AND zMin is
  // positive (log needs a positive floor).
  const useLog = deep != null && zMin > 0 && zMax / zMin > LOG_SCALE_RATIO;

  const slider = useMemo<ToolbarSliderSpec | undefined>(() => {
    if (!deep || !(zMax > zMin)) return undefined;
    const fmtZ = (z: number) => (Math.abs(z) >= 1000 || Math.abs(z) < 0.01 ? z.toExponential(2) : z.toFixed(3));
    if (useLog) {
      // Slider operates in log10(Z) space; value/onChange/format convert to true Z.
      const lo = Math.log10(zMin);
      const hi = Math.log10(zMax);
      return {
        id: "depth",
        icon: "layers",
        label: "Z",
        title:
          "Depth cutoff — composite only samples with Z ≤ this (log scale). Double-click to type a Z.",
        min: lo,
        max: hi,
        step: (hi - lo) / 200,
        value: Math.log10(Math.max(zMin, Math.min(zClip, zMax))),
        onChange: (v: number) => setZClip(10 ** v),
        format: (v: number) => fmtZ(10 ** v),
      };
    }
    return {
      id: "depth",
      icon: "layers",
      label: "Z",
      title: "Depth cutoff — composite only samples with Z ≤ this. Double-click to type a Z.",
      min: zMin,
      max: zMax,
      step: (zMax - zMin) / 200,
      value: zClip,
      onChange: (v: number) => setZClip(v),
      format: (v: number) => fmtZ(v),
    };
  }, [deep, zMin, zMax, zClip, useLog, setZClip]);

  const reset = useCallback(() => {
    zMeta.reset();
    setFlatData(null);
  }, [zMeta]);

  return { hdr: effectiveHdr, slider, reset, isModified: zMeta.isModified };
}
