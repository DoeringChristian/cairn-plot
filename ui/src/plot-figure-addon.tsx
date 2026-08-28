/**
 * The OFFLINE **figure addon** inline-bundle entry (O2 bundle-split) — compiled
 * by `vite.plot-figure.config.ts` into the self-contained `dist/plot-inline/
 * figure.iife.js`. Python emits it (include-once, guarded by
 * `window.__cairnPlotFigureLoaded`) ONLY for a `figure` element, so a
 * scalar/table/image plot never carries Plotly.
 *
 * It bundles Plotly (`plotly.js-dist-min`, ~4.8M) + the `FigureStandalone`
 * adapter, then installs its backend into the core-owned figure definition via
 * `window.__cairnPlotRegisterBackends("figure", …)`. `react` +
 * `react/jsx-runtime` are marked EXTERNAL in this build and mapped to core's
 * `window.__cairnPlotReact` / `__cairnPlotJsxRuntime`, so the addon reuses
 * core's single React copy (required for hooks to work when core's React
 * renders this component — see `plot-core-main.tsx`). Net: the addon carries
 * Plotly + Figure + prop-types, but NOT React and NOT the bootstrap/2D
 * renderers.
 *
 * GENERIC PATTERN (Phase D 3D addon follows it verbatim): a self-contained
 * IIFE that (1) guards on its own `__cairnPlot<Name>Loaded` flag and (2) calls
 * the core-exposed typed backend hook once. Nothing here is
 * figure-specific beyond the name and the imported component.
 */
import { figureBackend } from "./plots/figure/backend.ts";
import { FigurePlotView } from "./plots/figure/view.tsx";

if (!window.__cairnPlotFigureLoaded) {
  if (typeof window.__cairnPlotRegisterBackends === "function") {
    window.__cairnPlotRegisterBackends("figure", [figureBackend(FigurePlotView)]);
    window.__cairnPlotFigureLoaded = true;
  } else {
    // Core must run first (Python emits it before this addon). If it somehow
    // hasn't, fail loud in the console rather than silently no-op.
    console.error(
      "cairn-plot figure addon: core bundle not installed " +
        "(window.__cairnPlotRegisterBackends missing) — figure will not render.",
    );
  }
}
