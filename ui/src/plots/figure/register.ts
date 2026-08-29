import type { DataSpec } from "../../../../packages/spec/src/spec.ts";
import { definePlot, type SettingsRecord } from "../contracts.ts";
import { getPlotType } from "../registry.ts";
import { registerReactPlotType } from "../react-registry.ts";
import type { FigurePresentation } from "./view.tsx";

type InlineSpec = Extract<DataSpec, { kind: "inline" }>;

function validateFigureData(value: DataSpec): InlineSpec {
  if (value.kind !== "inline") throw new Error("cairn-plot: figure requires inline data");
  return value;
}

/** Core-owned Plotly semantics; the optional figure bundle installs the backend. */
export function ensureFigurePlotType(): void {
  if (getPlotType("figure")) return;
  registerReactPlotType({
    definition: definePlot<InlineSpec, Record<string, unknown>, SettingsRecord, FigurePresentation>({
      kind: "figure",
      data: { validate: validateFigureData },
      settings: { defaults: () => ({}), project: () => ({}) },
      resolve: async (spec) => ({ ...spec.props }),
      present: (content) => content,
      backends: [],
    }),
    backends: [],
  });
}
