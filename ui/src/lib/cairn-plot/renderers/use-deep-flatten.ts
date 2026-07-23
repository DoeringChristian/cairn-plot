/**
 * `useDeepFlatten` — the DEEP EXR depth-WINDOW controller shared by both image
 * backends (CPU + GPU HDR paths).
 *
 * A deep source arrives as an `HdrData` whose `data` is the FULL composite plus
 * a `deep` {@link DeepFlattenController} (retained wasm-side samples). This hook
 * exposes a depth WINDOW `[zNear, zFar]` (default `[zMin, zMax]` = full
 * composite) and:
 *   - two `ToolbarSliderSpec`s (Z-NEAR + Z-FAR) seeded via `useResettableState`
 *     so HOME/double-click reset both through the shell's reset/extraModified
 *     contract. The sliders clamp against each other (`zNear ≤ zFar`); manual
 *     out-of-range entry is allowed per the slider-entry convention. LINEAR in Z
 *     unless the volume spans > 1e3× (`zMax/zMin`), where each maps LOG10;
 *   - real-time re-composite as either edge moves — NO debounce. On GPU
 *     (`onWindow` supplied) every change is a uniform write + pass + blit
 *     (sub-frame); on CPU it's a coalesced (latest-wins, one-in-flight) wasm
 *     re-flatten with an rAF-aligned upload;
 *   - `selectRegion(x0,y0,x1,y1)` — the region-select action: query the samples'
 *     Z range inside an image-pixel rect and set the window to it (padded by a
 *     tiny epsilon so boundary samples survive the float compare). An empty
 *     region is a no-op (returns `{ ok:false }` with a message);
 *   - `dispose()`s the retained handle on unmount / source change.
 *
 * Non-deep sources (no `hdr.deep`) return the `hdr` untouched, `sliders:
 * undefined`, `hasDeep:false`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HdrData } from "./image-backend";
import type { ToolbarSliderSpec } from "../controls/ToolbarConfig";
import { useResettableState } from "../hooks/use-resettable-state";
import { IDLE_COALESCE, requestCoalesce, resolveCoalesce, type CoalesceState } from "./coalesce";
import type { TexelRect } from "./region-select";

/** Dynamic-range threshold above which the sliders map Z on a log10 scale. */
const LOG_SCALE_RATIO = 1e3;

/** rAF shim so the upload aligns to a frame (fallback for non-DOM envs). */
const raf: (cb: () => void) => number =
  typeof requestAnimationFrame === "function"
    ? (cb) => requestAnimationFrame(() => cb())
    : (cb) => setTimeout(cb, 0) as unknown as number;
const cancelRaf: (h: number) => void =
  typeof cancelAnimationFrame === "function" ? cancelAnimationFrame : (h) => clearTimeout(h);

/** Result of a region-select query. */
export interface RegionSelectResult {
  ok: boolean;
  message?: string;
}

export interface DeepFlattenState {
  /** The effective `HdrData` — the prop `hdr`, or a windowed re-flatten of it. */
  hdr: HdrData;
  /** The Z-NEAR + Z-FAR sliders for the toolbar (absent for non-deep sources). */
  sliders?: ToolbarSliderSpec[];
  /** True when the source is deep (the region-select button shows). */
  hasDeep: boolean;
  /** The persisted region rectangle (image texels), or `null`. View-local,
   *  per-pane; kept visible after selection so it can be moved/resized. Note the
   *  rect and the sliders may DIVERGE after a manual slider edit — the rect marks
   *  the last queried region, the sliders the live window. */
  region: TexelRect | null;
  /** Query the Z range of samples inside an image-pixel rect and set BOTH the
   *  window (epsilon-padded) AND the persisted rect to it. Empty region ⇒ no-op:
   *  the previous window + rect are kept (`{ ok:false, message }`). Used by the
   *  fresh marquee and by an edit release. */
  commitRegion(x0: number, y0: number, x1: number, y1: number): Promise<RegionSelectResult>;
  /** Remove the rect and reset ONLY the Z window to `[zMin, zMax]` (the × chip). */
  removeRegion(): void;
  /** Restore the window to `[zMin, zMax]` AND clear the rect — wired to shell HOME. */
  reset(): void;
  /** True while the window is narrower than `[zMin, zMax]` (enables shell HOME). */
  isModified: boolean;
}

export function useDeepFlatten(
  hdr: HdrData,
  onWindow?: (zNear: number, zFar: number) => void,
): DeepFlattenState {
  const deep = hdr.deep;
  const zMin = deep?.zMin ?? 0;
  const zMax = deep?.zMax ?? 0;
  const gpuMode = onWindow != null;

  // Window edges, seeded at the full range. Reset/isModified drive the shell.
  const [zNear, setZNear, nearMeta] = useResettableState<number>(zMin);
  const [zFar, setZFar, farMeta] = useResettableState<number>(zMax);
  // Windowed buffer for the current cutoff (null ⇒ show the full composite).
  const [flatData, setFlatData] = useState<HdrData["data"] | null>(null);
  // The persisted region rectangle (image texels) — view-local, per-pane.
  const [region, setRegion] = useState<TexelRect | null>(null);

  // Live refs so the (stable) launcher / clamps never read stale values.
  const deepRef = useRef(deep);
  deepRef.current = deep;
  const zMinRef = useRef(zMin);
  zMinRef.current = zMin;
  const zMaxRef = useRef(zMax);
  zMaxRef.current = zMax;
  const zNearRef = useRef(zNear);
  zNearRef.current = zNear;
  const zFarRef = useRef(zFar);
  zFarRef.current = zFar;

  // Latest wanted window + a version stamp; a resolved flatten for a superseded
  // version is dropped (latest-wins).
  const wantRef = useRef<{ near: number; far: number; ver: number }>({ near: zNear, far: zFar, ver: 0 });
  const verRef = useRef(0);
  const isFullRef = useRef(true);
  const coalesceRef = useRef<CoalesceState>(IDLE_COALESCE);
  const rafRef = useRef<number | null>(null);

  // Cross-clamped setters: enforce zNear ≤ zFar (manual out-of-[zMin,zMax] entry
  // is otherwise allowed, per the slider-entry convention).
  const setNear = useCallback((v: number) => setZNear(Math.min(v, zFarRef.current)), [setZNear]);
  const setFar = useCallback((v: number) => setZFar(Math.max(v, zNearRef.current)), [setZFar]);

  // Launch one CPU re-flatten of the LATEST window; apply (rAF-aligned) only if
  // still the wanted version, then chain if a newer request landed.
  const launch = useCallback(() => {
    const d = deepRef.current;
    if (!d) return;
    const { near, far, ver } = wantRef.current;
    const done = () => {
      const step = resolveCoalesce(coalesceRef.current);
      coalesceRef.current = step.state;
      if (step.launch != null) launch();
    };
    d.flatten(near, far)
      .then((buf) => {
        if (wantRef.current.ver === ver && !isFullRef.current) {
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

  const request = useCallback(() => {
    // The window itself rides `wantRef`; the coalescer just gates one-in-flight.
    const step = requestCoalesce(coalesceRef.current, 1);
    coalesceRef.current = step.state;
    if (step.launch != null) launch();
  }, [launch]);

  // Dispose the retained handle + cancel any pending upload on unmount / source change.
  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelRaf(rafRef.current);
      deep?.dispose();
    };
  }, [deep]);

  // Re-composite as the window changes.
  //  - GPU mode: hand the window straight to `onWindow` (uniform + pass + blit).
  //  - CPU mode: full window ⇒ show the prop composite; else coalesced re-flatten.
  useEffect(() => {
    if (!deep) return;
    const full = zNear <= zMin && zFar >= zMax;
    isFullRef.current = full;
    verRef.current += 1;
    wantRef.current = { near: zNear, far: zFar, ver: verRef.current };
    if (gpuMode) {
      onWindow(zNear, zFar);
      return;
    }
    if (full) {
      setFlatData(null);
      return;
    }
    request();
  }, [deep, zNear, zFar, zMin, zMax, request, gpuMode, onWindow]);

  const effectiveHdr = useMemo<HdrData>(
    () => (deep && !gpuMode && flatData != null ? { ...hdr, data: flatData } : hdr),
    [hdr, deep, gpuMode, flatData],
  );

  const useLog = deep != null && zMin > 0 && zMax / zMin > LOG_SCALE_RATIO;

  const sliders = useMemo<ToolbarSliderSpec[] | undefined>(() => {
    if (!deep || !(zMax > zMin)) return undefined;
    const fmtZ = (z: number) =>
      Math.abs(z) >= 1000 || (Math.abs(z) < 0.01 && z !== 0) ? z.toExponential(2) : z.toFixed(3);
    const mk = (
      id: string,
      label: string,
      title: string,
      value: number,
      onChange: (v: number) => void,
    ): ToolbarSliderSpec => {
      if (useLog) {
        const lo = Math.log10(zMin);
        const hi = Math.log10(zMax);
        return {
          id,
          icon: "layers",
          label,
          title: `${title} (log scale). Double-click to type a Z.`,
          min: lo,
          max: hi,
          step: (hi - lo) / 200,
          value: Math.log10(Math.max(zMin, Math.min(value, zMax))),
          onChange: (v: number) => onChange(10 ** v),
          format: (v: number) => fmtZ(10 ** v),
        };
      }
      return {
        id,
        icon: "layers",
        label,
        title: `${title}. Double-click to type a Z.`,
        min: zMin,
        max: zMax,
        step: (zMax - zMin) / 200,
        value,
        onChange,
        format: fmtZ,
      };
    };
    return [
      mk("depth-near", "ZN", "Depth window NEAR — composite only samples with Z ≥ this", zNear, setNear),
      mk("depth-far", "ZF", "Depth window FAR — composite only samples with Z ≤ this", zFar, setFar),
    ];
  }, [deep, zMin, zMax, zNear, zFar, useLog, setNear, setFar]);

  const commitRegion = useCallback(
    async (x0: number, y0: number, x1: number, y1: number): Promise<RegionSelectResult> => {
      const d = deepRef.current;
      if (!d) return { ok: false, message: "no deep source" };
      let zr;
      try {
        zr = await d.zRangeInRect(x0, y0, x1, y1);
      } catch {
        return { ok: false, message: "region query failed" };
      }
      // Empty region ⇒ keep the previous window AND rect (no-op).
      if (zr.count === 0) return { ok: false, message: "no samples in region" };
      // Pad by a tiny epsilon so boundary samples aren't lost to float compare.
      const span = zMaxRef.current - zMinRef.current;
      const eps = Math.max(Math.abs(span) * 1e-4, 1e-4);
      setZNear(zr.zMin - eps);
      setZFar(zr.zMax + eps);
      setRegion({ x0, y0, x1, y1 }); // persist the rect (visible + editable)
      return { ok: true };
    },
    [setZNear, setZFar],
  );

  // × chip: drop the rect and reset ONLY the Z window to the full range.
  const removeRegion = useCallback(() => {
    setRegion(null);
    nearMeta.reset();
    farMeta.reset();
    setFlatData(null);
  }, [nearMeta, farMeta]);

  // HOME: full deep reset — window back to [zMin,zMax] AND the rect cleared.
  const reset = useCallback(() => {
    nearMeta.reset();
    farMeta.reset();
    setRegion(null);
    setFlatData(null);
  }, [nearMeta, farMeta]);

  return {
    hdr: effectiveHdr,
    sliders,
    hasDeep: deep != null,
    region,
    commitRegion,
    removeRegion,
    reset,
    isModified: nearMeta.isModified || farMeta.isModified,
  };
}
