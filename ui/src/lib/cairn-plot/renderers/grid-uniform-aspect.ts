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
import { createContext } from "react";

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
