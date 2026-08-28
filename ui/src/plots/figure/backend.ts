import { createElement, type ComponentType } from "react";

import type { ReactBackendProps, ReactPlotBackend } from "../react-backend.ts";
import type { SettingsRecord } from "../contracts.ts";
import type { FigurePresentation } from "./view.tsx";
import type { ReactPlotViewProps } from "../react-view.ts";

export function figureBackend(
  View: ComponentType<ReactPlotViewProps<FigurePresentation, SettingsRecord>>,
): ReactPlotBackend<FigurePresentation, SettingsRecord> {
  return {
    id: "figure-plotly",
    family: "figure",
    technology: "dom",
    supports: () => ({ supported: true, priority: 1 }),
    canReuse: () => true,
    component({ input }: ReactBackendProps<FigurePresentation, SettingsRecord>) {
      return createElement(View, {
        presentation: input.presentation,
        settings: input.settings,
        commands: input.commands,
      });
    },
  };
}
