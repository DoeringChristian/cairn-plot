/**
 * `useDeepFlatten` — the DEEP EXR depth-slider controller shared by both image
 * backends (CPU + GPU HDR paths).
 *
 * A deep source arrives as an `HdrData` whose `data` is the FULL composite plus
 * a `deep` {@link DeepFlattenController} (retained wasm-side samples). This hook:
 *   - seeds the Z cutoff at `zMax` (full composite) via `useResettableState`, so
 *     HOME/double-click reset it through the shell's existing reset/extraModified
 *     contract;
 *   - re-flattens in REAL TIME as the cutoff moves — NO debounce. A pure
 *     latest-wins / one-in-flight coalescer (`./coalesce.ts`) keeps at most one
 *     `deep.flatten(zClip)` running; while it runs only the LATEST cutoff is
 *     remembered, and the newest buffer is uploaded rAF-aligned. The slider
 *     thumb + Z read-out track the pointer instantly (they read `zClip` state
 *     directly, decoupled from the async flatten);
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
import { IDLE_COALESCE, requestCoalesce, resolveCoalesce, type CoalesceState } from "./coalesce";

/** Dynamic-range threshold above which the slider maps Z on a log10 scale. */
const LOG_SCALE_RATIO = 1e3;

/** rAF shim so the upload aligns to a frame (fallback for non-DOM envs). */
const raf: (cb: () => void) => number =
  typeof requestAnimationFrame === "function"
    ? (cb) => requestAnimationFrame(() => cb())
    : (cb) => setTimeout(cb, 0) as unknown as number;
const cancelRaf: (h: number) => void =
  typeof cancelAnimationFrame === "function" ? cancelAnimationFrame : (h) => clearTimeout(h);

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

  // Live refs so the (stable) launcher never closes over stale values.
  const deepRef = useRef(deep);
  deepRef.current = deep;
  const zMaxRef = useRef(zMax);
  zMaxRef.current = zMax;
  // The most-recent cutoff the user WANTS shown — an in-flight flatten for any
  // other value is stale and its result is dropped (latest-wins).
  const wantRef = useRef(zClip);
  const coalesceRef = useRef<CoalesceState>(IDLE_COALESCE);
  const rafRef = useRef<number | null>(null);

  // Launch one flatten; on resolve upload (rAF-aligned) only if still wanted,
  // then chain the latest pending cutoff (if any) — the coalescer's one-in-flight
  // guarantee. Stable across renders (reads everything through refs).
  const launch = useCallback((value: number) => {
    const d = deepRef.current;
    if (!d) return;
    const done = () => {
      const step = resolveCoalesce(coalesceRef.current);
      coalesceRef.current = step.state;
      if (step.launch != null) launch(step.launch);
    };
    d.flatten(value)
      .then((buf) => {
        // Apply only if this is still the wanted cutoff AND it's a real clip
        // (returning to zMax shows the prop's full composite, not this buffer).
        if (wantRef.current === value && value < zMaxRef.current) {
          if (rafRef.current != null) cancelRaf(rafRef.current);
          rafRef.current = raf(() => {
            rafRef.current = null;
            setFlatData(buf);
          });
        }
        done();
      })
      .catch(done);
  }, []);

  const request = useCallback(
    (value: number) => {
      const step = requestCoalesce(coalesceRef.current, value);
      coalesceRef.current = step.state;
      if (step.launch != null) launch(step.launch);
    },
    [launch],
  );

  // Dispose the retained handle + cancel any pending upload on unmount / source change.
  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelRaf(rafRef.current);
      deep?.dispose();
    };
  }, [deep]);

  // Drive the re-flatten as the cutoff changes — no debounce, coalesced. At (or
  // above) zMax the full composite already IS `hdr.data`, so drop the override
  // (and stop wanting any in-flight clipped result).
  useEffect(() => {
    if (!deep) return;
    wantRef.current = zClip;
    if (zClip >= zMax) {
      setFlatData(null);
      return;
    }
    request(zClip);
  }, [deep, zClip, zMax, request]);

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
