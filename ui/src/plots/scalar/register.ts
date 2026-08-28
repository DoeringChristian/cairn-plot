import { createElement, type ComponentType } from "react";

import type { DataSource } from "../../lib/cairn-plot/store/data-sources.ts";
import type { ReactBackendProps, ReactPlotBackend } from "../../host/react-backend.ts";
import { definePlot, type SettingsRecord } from "../contracts.ts";
import { getPlotType } from "../registry.ts";
import { registerReactPlotType } from "../react-registry.ts";
import {
  overlayScalarPresentations,
  planScalarComparison,
  validateScalarData,
  type ScalarComparisonPlan,
  type ScalarPresentation,
  type ScalarSpec,
} from "./comparison.ts";

/** Register scalar resolution, overlay comparison, and its current React backend. */
export function ensureScalarPlotType(
  View: ComponentType<Record<string, unknown>>,
  resolve: (spec: ScalarSpec, source: DataSource) => Promise<ScalarPresentation>,
): void {
  if (getPlotType("scalar")) return;
  const backend: ReactPlotBackend<ScalarPresentation, SettingsRecord> = {
    id: "scalar-react",
    family: "scalar",
    technology: "dom",
    supports: () => ({ supported: true, priority: 1 }),
    canReuse: () => true,
    component({ input }: ReactBackendProps<ScalarPresentation, SettingsRecord>) {
      return createElement(View, {
        ...input.presentation,
        syncedSettings: input.settings,
        setSyncedSettings: input.commands.patch,
        resetViewportSettings: input.commands.reset,
      });
    },
  };
  const definition = definePlot<
    ScalarSpec,
    ScalarPresentation,
    SettingsRecord,
    ScalarPresentation,
    ScalarComparisonPlan
  >({
    kind: "scalar",
    data: { validate: validateScalarData },
    settings: {
      defaults: () => ({}),
      project: (settings) => ({ ...settings }),
    },
    resolve: (spec, context) => resolve(spec, context.source),
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
          plan.operands.map((operand) => resolve(operand, context.source)),
        );
        return overlayScalarPresentations(plan, presentations);
      },
    },
    backends: [],
  });
  registerReactPlotType({ definition, backends: [backend] });
}
