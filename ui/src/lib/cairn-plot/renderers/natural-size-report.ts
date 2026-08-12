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
import { createContext } from "react";

export type ReportNaturalSize = (width: number, height: number) => void;

export const ReportNaturalSizeContext = createContext<ReportNaturalSize | null>(null);
