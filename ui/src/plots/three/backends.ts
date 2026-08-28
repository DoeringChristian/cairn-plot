import { createElement, type ComponentType } from "react";

import type { ReactBackendProps, ReactPlotBackend } from "../../host/react-backend.ts";
import type { SettingsRecord } from "../contracts.ts";
import type { ThreePlotKind, ThreePresentation } from "./register.ts";
import {
  BoxesStandalone,
  MeshStandalone,
  PointCloudStandalone,
  VolumeStandalone,
} from "./views.tsx";

function backend(
  kind: ThreePlotKind,
  View: ComponentType<ThreePresentation>,
): ReactPlotBackend<ThreePresentation, SettingsRecord> {
  return {
    id: `${kind}-three`,
    family: kind,
    technology: "three",
    supports: () => ({ supported: true, priority: 1 }),
    canReuse: () => true,
    component({ input }: ReactBackendProps<ThreePresentation, SettingsRecord>) {
      return createElement(View, input.presentation);
    },
  };
}

export function threePlotBackends(): Readonly<Record<ThreePlotKind, ReactPlotBackend<ThreePresentation, SettingsRecord>>> {
  return {
    pointcloud: backend("pointcloud", PointCloudStandalone as unknown as ComponentType<ThreePresentation>),
    mesh: backend("mesh", MeshStandalone as unknown as ComponentType<ThreePresentation>),
    volume: backend("volume", VolumeStandalone as unknown as ComponentType<ThreePresentation>),
    boxes3d: backend("boxes3d", BoxesStandalone as unknown as ComponentType<ThreePresentation>),
  };
}
