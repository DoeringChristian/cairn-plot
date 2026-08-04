/**
 * Public entry for the JS/HTML builder surface (`window.cairnPlot`).
 *
 * Two ways in:
 *  - the CORE inline bundle installs `window.cairnPlot` (see
 *    `plot-bootstrap.tsx` → `installCairnPlotApi`), the primary HTML path;
 *  - ESM consumers `import { cairnPlot } from "…/builder"` — the default
 *    namespace here, bound to the CORE-installed mount runtime at call time.
 *
 * `createCairnPlot(mounter)` builds a namespace bound to a specific mounter
 * (what the CORE install uses). The default `cairnPlot` export leaves the
 * mounter unbound, so `.mount()`/`.toElement()` resolve
 * `window.__cairnPlotMountObject` on demand — throwing a clear error if the
 * core bundle isn't loaded.
 */
export { createCairnPlot, BUILDER_NAMES, type CairnPlot } from "./builders.ts";
export type { PlotHandle, MountedPlot, Mounter } from "./handle.ts";
export type { ShapedImage, ImageDataOpts } from "./data.ts";

import { createCairnPlot } from "./builders.ts";

/** The default builder namespace — bound to the CORE-installed mount runtime
 *  (`window.__cairnPlotMountObject`) at call time. */
export const cairnPlot = createCairnPlot();

export default cairnPlot;
