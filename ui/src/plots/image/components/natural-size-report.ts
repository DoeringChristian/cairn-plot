/**
 * A tiny React context that lets an image pane REPORT its source (natural) pixel
 * dimensions UP to whatever framing wrapper encloses it — without threading an
 * `onNaturalSize` prop through the descriptor/renderer registry.
 *
 * `ImagePaneShell` is the ONE frame every image/compare pane renders inside, and
 * it already receives `naturalDims`; it publishes them here whenever they change.
 * Two consumers subscribe:
 *   - `ContentAspectFrame` (the default standalone/grid framing) sizes the pane's
 *     box to the content aspect (Part 1).
 *   - the page-level selection STAGE collects each cell's aspect to pack the grid
 *     densely to the content aspect (Part 2).
 *
 * The default is `null` (no listener) so a pane rendered without a framing
 * wrapper simply never reports — behaviour-identical to before.
 */
import { createContext, useContext, useEffect } from "react";

export type ReportNaturalSize = (width: number, height: number) => void;

export const ReportNaturalSizeContext = createContext<ReportNaturalSize | null>(null);

/**
 * Publish a pane's natural content size on {@link ReportNaturalSizeContext} to
 * whatever framing wrapper encloses it, re-firing whenever the dims change. The
 * ONE place every image/compare pane (`ImagePaneShell`, `GpuComparePane`, the CPU
 * `MediaComparePane`) reports up from — so the publish protocol lives in a single
 * spot. `null` dims (not yet decoded) simply don't publish.
 */
export function usePublishNaturalSize(dims: { w: number; h: number } | null): void {
  const report = useContext(ReportNaturalSizeContext);
  useEffect(() => {
    if (report && dims) report(dims.w, dims.h);
  }, [report, dims?.w, dims?.h]);
}
