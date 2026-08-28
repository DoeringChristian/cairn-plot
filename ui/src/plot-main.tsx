/**
 * The standalone `cairn-plot` entry — the code-split `plot.html` build served
 * at the server `/plot` route (the ENDPOINT / `link` companion to the offline
 * inline bundles).
 *
 * All mount logic lives in the shared `./plot-bootstrap` module: install
 * `window.__cairnPlotBootstrap` for per-div notebook mounts, drain the mount
 * queue, and auto-mount the page-level `#cairn-plot-root` when present (the
 * `/plot` route).
 *
 * Renderer registration (O2): this build seeds the runtime registry with the
 * core renderers AND a `React.lazy` `figure` — so, unlike the split OFFLINE
 * bundles, this single code-split build keeps Plotly in its OWN async
 * `/assets` chunk (loaded from the server only when a `figure` renders), while
 * still serving every renderer from one page.
 */
import React from "react";
import { installCairnPlotBootstrap } from "./plot-bootstrap";
import { registerCoreRenderers } from "./plot-renderers";
import { figureBackend } from "./plots/figure/backend.ts";
import type { FigurePresentation } from "./plots/figure/view.tsx";
import type { SettingsRecord } from "./plots/contracts.ts";
import type { ReactPlotViewProps } from "./plots/react-view.ts";
import { eraseReactPlotBackend, registerReactPlotBackends } from "./plots/react-registry.ts";
import "./public/theme/plot.css";

installCairnPlotBootstrap();
registerCoreRenderers();

// Plotly `figure` stays in a lazy chunk for the server build (code-split).
const LazyFigure = React.lazy(() =>
  import("./plots/figure/view").then((m) => ({ default: m.FigurePlotView })),
) as React.ComponentType<ReactPlotViewProps<FigurePresentation, SettingsRecord>>;
registerReactPlotBackends("figure", [eraseReactPlotBackend(figureBackend(LazyFigure))]);
