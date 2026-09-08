/**
 * Supported Plotly/figure integration surface. Kept in a separate entry so
 * hosts can lazy-load Plotly without pulling it into the core browser bundle.
 */
export { default as Figure } from "../plots/figure/backends/plotly/Figure.tsx";
export type {
  FigureInteractionSettings,
  SharedView,
} from "../plots/figure/backends/plotly/Figure.tsx";
// Pure view-state helper (no Plotly import): hosts accumulating relayout
// events across panes must merge them with this, not `{...prev, ...next}` —
// see mergeRelayout's doc comment.
export { mergeRelayout } from "../plots/figure/backends/plotly/view-overrides.ts";
export {
  checkFigureMergeable,
  mergeFigures,
} from "../plots/transforms/figure-merge.ts";
export type {
  FigureMergeEntry,
} from "../plots/transforms/figure-merge.ts";
export type { PlotlyFigureLike } from "../plots/types.ts";
export { useContainerSize } from "../host/hooks/use-container-size.ts";
