import { createElement, type ComponentType } from "react";

import type { ReactBackendProps, ReactPlotBackend } from "../../host/react-backend.ts";
import type { SettingsRecord } from "../contracts.ts";
import type { FigurePresentation } from "./view.tsx";

export function figureBackend(
  View: ComponentType<FigurePresentation>,
): ReactPlotBackend<FigurePresentation, SettingsRecord> {
  return {
    id: "figure-plotly",
    family: "figure",
    technology: "dom",
    supports: () => ({ supported: true, priority: 1 }),
    canReuse: () => true,
    component({ input }: ReactBackendProps<FigurePresentation, SettingsRecord>) {
      return createElement(View, input.presentation);
    },
  };
}
