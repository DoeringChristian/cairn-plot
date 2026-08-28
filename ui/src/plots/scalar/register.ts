import { createElement, type ComponentType } from "react";

import type { DataSource } from "../../resources/data/data-source.ts";
import type { ReactBackendProps, ReactPlotBackend } from "../../backends/react.ts";
import { definePlot } from "../contracts.ts";
import { getPlotType } from "../registry.ts";
import { registerReactPlotType } from "../react-registry.ts";
import type { ReactPlotViewProps } from "../react-view.ts";
import {
  overlayScalarPresentations,
  planScalarComparison,
  validateScalarData,
  type ScalarComparisonPlan,
  type ScalarPresentation,
  type ScalarSpec,
} from "./comparison.ts";
import {
  projectScalarSettings,
  scalarPresentation,
  type ScalarSettings,
} from "./types.ts";

/** Register scalar resolution, overlay comparison, and its current React backend. */
export function ensureScalarPlotType(
  View: ComponentType<ReactPlotViewProps<ScalarPresentation, ScalarSettings>>,
  resolve: (spec: ScalarSpec, source: DataSource) => Promise<Record<string, unknown>>,
): void {
  if (getPlotType("scalar")) return;
  const backend: ReactPlotBackend<ScalarPresentation, ScalarSettings> = {
    id: "scalar-react",
    family: "scalar",
    technology: "dom",
    supports: () => ({ supported: true, priority: 1 }),
    canReuse: () => true,
    component({ input }: ReactBackendProps<ScalarPresentation, ScalarSettings>) {
      return createElement(View, {
        presentation: input.presentation,
        settings: input.settings,
        commands: input.commands,
      });
    },
  };
  const definition = definePlot<
    ScalarSpec,
    ScalarPresentation,
    ScalarSettings,
    ScalarPresentation,
    ScalarComparisonPlan
  >({
    kind: "scalar",
    data: { validate: validateScalarData },
    settings: {
      defaults: () => ({}),
      project: projectScalarSettings,
    },
    resolve: async (spec, context) => scalarPresentation(await resolve(spec, context.source)),
    present: (content) => content,
    comparison: {
      presentations: [{ id: "overlay", label: "Overlay", minOperands: 2 }],
      strategies: [{ id: "all", minOperands: 2, requiresReference: false }],
      defaultStrategy: "all",
      accepts(request) {
        try {
          planScalarComparison(request);
          return { accepted: true };
        } catch (error) {
          return { accepted: false, reason: error instanceof Error ? error.message : String(error) };
        }
      },
      plan: planScalarComparison,
      async resolve(plan, context) {
        const presentations = await Promise.all(
          plan.operands.map(async (operand) => scalarPresentation(await resolve(operand, context.source))),
        );
        return overlayScalarPresentations(plan, presentations);
      },
    },
    backends: [],
  });
  registerReactPlotType({ definition, backends: [backend] });
}
