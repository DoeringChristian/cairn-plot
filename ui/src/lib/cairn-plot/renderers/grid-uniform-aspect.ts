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
import { createContext, useCallback, useMemo, useState } from "react";
import { representativeAspect } from "../selection/pack-grid";

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
