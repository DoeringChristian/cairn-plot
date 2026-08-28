/**
 * GRID UNIFORM-ASPECT coordination.
 *
 * In a `cp.Grid` every image viewport in a row must be the SAME size — a grid is
 * a uniform layout, not N independently-shrink-wrapped panes. (A standalone image
 * still tracks its own content aspect; the selection stage packs its own uniform
 * cells. This context governs only the regular grid.)
 *
 * The grid can't know its children's aspects from the descriptor alone (a URL/EXR
 * image's dims are known only after fetch+decode), so it COLLECTS them at runtime:
 * each image cell reports its content aspect via {@link GridUniformAspectApi.report},
 * the grid takes the REPRESENTATIVE (median) aspect, and publishes it back as
 * {@link GridUniformAspectApi.uniformAspect}. Every image cell then sizes to that
 * ONE aspect (so all cells in a row are identical) and the pane fills the cell —
 * a differently-shaped image object-contain letterboxes WITHIN its uniform cell,
 * rather than getting a differently-sized viewport. Because the pane fills the
 * cell, the selectable grid item IS the viewport, so the selection ring matches it
 * exactly (no "ring larger than the viewport").
 *
 * Absent context (a standalone mount) ⇒ `null`; the pane keeps its per-content
 * {@link ContentAspectFrame} framing.
 */
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { representativeAspect } from "./pack-grid";
import { ReportNaturalSizeContext } from "./natural-size";

/** A finite, strictly-positive aspect (w / h), or `null` for any other input
 *  (missing / NaN / ≤ 0) — the ONE validity guard aspects flow through. */
export function finitePositive(x: number | null | undefined): number | null {
  return x != null && Number.isFinite(x) && x > 0 ? x : null;
}

export interface GridUniformAspectApi {
  /** Report (or, with `null`, withdraw) THIS cell's content aspect (w / h). The
   *  `key` is any stable per-cell id; the grid keys the aspect set on it. */
  report: (key: string, aspect: number | null) => void;
  /** The representative (median) content aspect across the grid's image cells, or
   *  `null` until at least one cell has reported. Every image cell sizes to this. */
  uniformAspect: number | null;
}

export const GridUniformAspectContext = createContext<GridUniformAspectApi | null>(null);

/** Fallback cell aspect (w / h) used before any image cell has reported, so a
 *  cell has a definite box to mount/measure into (avoids a 0-height flash). */
export const DEFAULT_GRID_CELL_ASPECT = 4 / 3;

/** Breathing room (px) left below a page-height-capped image, so a tall pane
 *  (standalone or a grid cell) never exceeds the window and stays viewable in
 *  one screenful. Shared by `ContentAspectFrame` (JS measure) and the grid-cell
 *  CSS cap in `PaneSelectionFrame`. */
export const VIEWPORT_HEIGHT_MARGIN = 24;

/**
 * The ONE size-computation primitive shared by every grid layout (the regular
 * `cp.Grid` AND the compare/enlarge stage): it collects each cell's content
 * aspect (reported at runtime — a URL/EXR image's dims are known only after
 * decode) and derives the REPRESENTATIVE (median) aspect every cell is sized to.
 * The consumer provides {@link GridUniformAspectApi.report} to its cells (via
 * `GridUniformAspectContext`, which `GridCellReporter` calls) and lays out with
 * {@link GridUniformAspectApi.uniformAspect} — as a CSS `aspect-ratio` (width-
 * driven `cp.Grid`) or as the `packContentGrid` aspect (bounded stage). Type-
 * agnostic: cells with no intrinsic aspect simply never report and fall back to
 * {@link DEFAULT_GRID_CELL_ASPECT}. */
export function useUniformGridAspect(): GridUniformAspectApi {
  const [cellAspects, setCellAspects] = useState<ReadonlyMap<string, number>>(() => new Map());
  const report = useCallback((key: string, aspect: number | null) => {
    setCellAspects((prev) => {
      const cur = prev.get(key);
      if (aspect == null) {
        if (!prev.has(key)) return prev;
        const next = new Map(prev);
        next.delete(key);
        return next;
      }
      if (cur === aspect) return prev;
      const next = new Map(prev);
      next.set(key, aspect);
      return next;
    });
  }, []);
  const uniformAspect = useMemo<number | null>(() => {
    const xs = [...cellAspects.values()];
    return xs.length ? representativeAspect(xs) : null;
  }, [cellAspects]);
  return useMemo(() => ({ report, uniformAspect }), [report, uniformAspect]);
}

/**
 * The per-cell side of {@link useUniformGridAspect}: returns a setter that
 * reports THIS cell's content aspect (or `null` to withdraw) into the enclosing
 * grid, keyed by a stable {@link useId}, and auto-withdraws on unmount. Keyed on
 * the STABLE `report` fn (not the api object, whose identity churns every repack)
 * so a re-pack never re-fires the cleanup and transiently drops the aspect.
 */
export function useReportCellAspect(): (aspect: number | null) => void {
  const gridReport = useContext(GridUniformAspectContext)?.report;
  const key = useId();
  const set = useCallback((aspect: number | null) => gridReport?.(key, aspect), [gridReport, key]);
  useEffect(() => () => gridReport?.(key, null), [gridReport, key]);
  return set;
}

/**
 * The grid-cell body used INSTEAD of `ContentAspectFrame` when an image pane sits
 * in a grid layout (a `GridUniformAspectContext` is present). It does NOT shrink-
 * wrap the pane — the pane FILLS the cell (the grid item is already sized to the
 * grid's ONE uniform aspect, so every cell in a row is identical and the selection
 * ring matches the viewport). Its only job is to REPORT this cell's content aspect
 * up so the grid can pick the representative: from `seedAspect` (a float/EXR
 * source's known shape) or, for a uint8/URL pane, the pane's own `<img>`-onload
 * natural-size report.
 */
export function GridCellReporter({
  seedAspect,
  children,
}: {
  seedAspect?: number | null;
  children: ReactNode;
}) {
  const setCellAspect = useReportCellAspect();
  const [reported, setReported] = useState<number | null>(null);
  const report = useCallback((w: number, h: number) => {
    if (w > 0 && h > 0) setReported((prev) => (prev === w / h ? prev : w / h));
  }, []);
  const aspect = finitePositive(seedAspect) ?? reported;
  useEffect(() => {
    setCellAspect(aspect);
  }, [setCellAspect, aspect]);
  return (
    <div
      data-cairn-grid-cell=""
      style={{ width: "100%", height: "100%", minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}
    >
      <ReportNaturalSizeContext.Provider value={report}>{children}</ReportNaturalSizeContext.Provider>
    </div>
  );
}
