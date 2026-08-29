import { createElement, type ComponentType } from "react";

import type { DataSpec } from "../../../packages/spec/src/spec.ts";
import type { ReactBackendProps, ReactPlotBackend } from "../backends/react.ts";
import { definePlot, type SettingsRecord, type SettingsSchema } from "./contracts.ts";
import { getPlotType } from "./registry.ts";
import { registerReactPlotType } from "./react-registry.ts";
import type { ReactPlotViewProps } from "./react-view.ts";

export type InlineSpec = Extract<DataSpec, { kind: "inline" }>;

export interface InlinePlotRegistration<TPresentation, TSettings extends SettingsRecord> {
  readonly kind: string;
  readonly View: ComponentType<ReactPlotViewProps<TPresentation, TSettings>>;
  readonly settings: SettingsSchema<TSettings>;
  readonly parse: (value: Record<string, unknown>) => TPresentation;
}

/** Shared adapter for typed native plots whose durable source is inline JSON. */
export function ensureInlinePlotType<TPresentation, TSettings extends SettingsRecord>(
  registration: InlinePlotRegistration<TPresentation, TSettings>,
): void {
  if (getPlotType(registration.kind)) return;
  const backend: ReactPlotBackend<TPresentation, TSettings> = {
    id: `${registration.kind}-react`,
    family: registration.kind,
    technology: "dom",
    supports: () => ({ supported: true, priority: 1 }),
    canReuse: () => true,
    component({ input }: ReactBackendProps<TPresentation, TSettings>) {
      return createElement(registration.View, {
        presentation: input.presentation,
        settings: input.settings,
        commands: input.commands,
      });
    },
  };
  const definition = definePlot<InlineSpec, TPresentation, TSettings, TPresentation>({
    kind: registration.kind,
    data: {
      validate(value) {
        if (value.kind !== "inline") {
          throw new Error(
            `cairn-plot: ${registration.kind} plot requires inline data, got ${JSON.stringify(value.kind)}`,
          );
        }
        return value;
      },
    },
    settings: registration.settings,
    resolve: async (spec) => registration.parse({ ...spec.props }),
    present: (content) => content,
    backends: [],
  });
  registerReactPlotType({ definition, backends: [backend] });
}
