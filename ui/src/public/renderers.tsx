import { createElement, lazy, type ComponentType } from "react";

import { registerCoreRenderers } from "../plot-renderers.tsx";
import type { ReactBackendProps, ReactPlotBackend } from "../host/react-backend.ts";
import type { SettingsRecord } from "../plots/contracts.ts";
import { eraseReactPlotBackend, registerReactPlotBackends } from "../plots/react-registry.ts";
import type { ThreePlotKind, ThreePresentation } from "../plots/three/register.ts";
import { figureBackend } from "../plots/figure/backend.ts";
import type { FigurePresentation } from "../plots/figure/view.tsx";
import type { ReactPlotViewProps } from "../plots/react-view.ts";

let registered = false;

/** Register the complete browser renderer set without exposing the registry. */
export function ensurePublicRenderers(): void {
  if (registered) return;
  registered = true;
  registerCoreRenderers();
  const FigureView = lazy(() =>
    import("../plots/figure/view.tsx").then((module) => ({ default: module.FigurePlotView }))
  ) as ComponentType<ReactPlotViewProps<FigurePresentation, SettingsRecord>>;
  registerReactPlotBackends("figure", [eraseReactPlotBackend(figureBackend(FigureView))]);
  const views = {
    pointcloud: lazy(() => import("../plots/three/views.tsx").then((module) => ({ default: module.PointCloudPlotView }))),
    mesh: lazy(() => import("../plots/three/views.tsx").then((module) => ({ default: module.MeshPlotView }))),
    volume: lazy(() => import("../plots/three/views.tsx").then((module) => ({ default: module.VolumePlotView }))),
    boxes3d: lazy(() => import("../plots/three/views.tsx").then((module) => ({ default: module.BoxesPlotView }))),
  };
  for (const kind of Object.keys(views) as ThreePlotKind[]) {
    registerReactPlotBackends(kind, [
      eraseReactPlotBackend(lazyThreeBackend(
        kind,
        views[kind] as unknown as ComponentType<ReactPlotViewProps<ThreePresentation, SettingsRecord>>,
      )),
    ]);
  }
}

function lazyThreeBackend(
  kind: ThreePlotKind,
  View: ComponentType<ReactPlotViewProps<ThreePresentation, SettingsRecord>>,
): ReactPlotBackend<ThreePresentation, SettingsRecord> {
  return {
    id: `${kind}-three-lazy`,
    family: kind,
    technology: "three",
    supports: () => ({ supported: true, priority: 1 }),
    canReuse: () => true,
    component({ input }: ReactBackendProps<ThreePresentation, SettingsRecord>) {
      return createElement(View, {
        presentation: input.presentation,
        settings: input.settings,
        commands: input.commands,
      });
    },
  };
}
