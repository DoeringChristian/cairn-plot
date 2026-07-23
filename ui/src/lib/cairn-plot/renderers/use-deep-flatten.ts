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
  /** Live (coalesced) window update while a rect is being drawn/moved/resized:
   *  query the samples' Z range in the rect and set the window (real range, or
   *  the EMPTY sentinel `zNear > zFar` when the region holds no samples — a valid
   *  selection that composites nothing). Does NOT persist the rect. */
  queryRegionWindow(x0: number, y0: number, x1: number, y1: number): void;
  /** Finalize a rect (drag release): PERSIST it and set the window from it. An
   *  empty region is valid — the rect is placed and the window goes empty. */
  commitRegion(x0: number, y0: number, x1: number, y1: number): void;
  /** Remove the rect and reset ONLY the Z window to `[zMin, zMax]` (the × chip). */
  removeRegion(): void;
  /** Restore the window to `[zMin, zMax]` AND clear the rect — wired to shell HOME. */
  reset(): void;
  /** True while the window differs from `[zMin, zMax]` (enables shell HOME). */
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

  // Sliders set the edges DIRECTLY — no cross-clamp. A crossed window
  // (zNear > zFar) is a VALID empty selection (composites nothing), matching an
  // empty region; manual out-of-[zMin,zMax] entry is allowed per the convention.
  const setNear = setZNear;
  const setFar = setZFar;

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

  // Set the Z window from a region's sample range. A NON-EMPTY region → the
  // ε-padded [zMin, zMax] (padded so boundary samples survive the float compare).
  // An EMPTY region (count 0) is a VALID selection → the empty sentinel
  // zNear > zFar (STRICTLY crossed even for a single-Z image where zMin==zMax),
  // which composites nothing (transparent) on both the GPU and wasm paths — no
  // extra flag/uniform needed, the existing window path already renders it. The
  // rect is placeable anywhere.
  const applyWindowFromZRange = useCallback(
    (zr: { zMin: number; zMax: number; count: number }) => {
      if (zr.count === 0) {
        const lo = zMinRef.current;
        const hi = zMaxRef.current;
        const pad = hi > lo ? 0 : 1; // ensure a strict cross even when hi==lo
        setZNear(hi + pad);
        setZFar(lo - pad);
        return;
      }
      const span = zMaxRef.current - zMinRef.current;
      const eps = Math.max(Math.abs(span) * 1e-4, 1e-4);
      setZNear(zr.zMin - eps);
      setZFar(zr.zMax + eps);
    },
    [setZNear, setZFar],
  );

  // A SEPARATE latest-wins / one-in-flight coalescer for the region Z-range query
  // (independent of the flatten coalescer) so a live drag can re-query every move
  // without piling up worker round-trips. `queryRectRef` holds the latest rect.
  const queryRectRef = useRef<TexelRect | null>(null);
  const queryCoalesceRef = useRef<CoalesceState>(IDLE_COALESCE);
  const queryLaunch = useCallback(() => {
    const d = deepRef.current;
    const rect = queryRectRef.current;
    const done = () => {
      const step = resolveCoalesce(queryCoalesceRef.current);
      queryCoalesceRef.current = step.state;
      if (step.launch != null) queryLaunch();
    };
    if (!d || !rect) {
      done();
      return;
    }
    d.zRangeInRect(rect.x0, rect.y0, rect.x1, rect.y1)
      .then((zr) => {
        applyWindowFromZRange(zr);
        done();
      })
      .catch(done);
  }, [applyWindowFromZRange]);

  // Live, coalesced window update (drawing / moving / resizing) — does NOT persist.
  const queryRegionWindow = useCallback(
    (x0: number, y0: number, x1: number, y1: number) => {
      queryRectRef.current = { x0, y0, x1, y1 };
      const step = requestCoalesce(queryCoalesceRef.current, 1);
      queryCoalesceRef.current = step.state;
      if (step.launch != null) queryLaunch();
    },
    [queryLaunch],
  );

  // Finalize (drag release): PERSIST the rect + set its window (empty is valid).
  const commitRegion = useCallback(
    (x0: number, y0: number, x1: number, y1: number) => {
      setRegion({ x0, y0, x1, y1 });
      queryRegionWindow(x0, y0, x1, y1);
    },
    [queryRegionWindow],
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
    queryRegionWindow,
    commitRegion,
    removeRegion,
    reset,
    isModified: nearMeta.isModified || farMeta.isModified,
  };
}
