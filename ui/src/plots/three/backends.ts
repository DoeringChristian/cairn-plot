import { createElement, type ComponentType } from "react";

import type { ReactBackendProps, ReactPlotBackend } from "../../host/react-backend.ts";
import type { SettingsRecord } from "../contracts.ts";
import type { ThreePlotKind, ThreePresentation } from "./register.ts";
import type { ReactPlotViewProps } from "../react-view.ts";
import {
  BoxesPlotView,
  MeshPlotView,
  PointCloudPlotView,
  VolumePlotView,
} from "./views.tsx";

function backend(
  kind: ThreePlotKind,
  View: ComponentType<ReactPlotViewProps<ThreePresentation, SettingsRecord>>,
): ReactPlotBackend<ThreePresentation, SettingsRecord> {
  return {
    id: `${kind}-three`,
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

export function threePlotBackends(): Readonly<Record<ThreePlotKind, ReactPlotBackend<ThreePresentation, SettingsRecord>>> {
  return {
    pointcloud: backend("pointcloud", PointCloudPlotView as unknown as ComponentType<ReactPlotViewProps<ThreePresentation, SettingsRecord>>),
    mesh: backend("mesh", MeshPlotView as unknown as ComponentType<ReactPlotViewProps<ThreePresentation, SettingsRecord>>),
    volume: backend("volume", VolumePlotView as unknown as ComponentType<ReactPlotViewProps<ThreePresentation, SettingsRecord>>),
    boxes3d: backend("boxes3d", BoxesPlotView as unknown as ComponentType<ReactPlotViewProps<ThreePresentation, SettingsRecord>>),
  };
}
