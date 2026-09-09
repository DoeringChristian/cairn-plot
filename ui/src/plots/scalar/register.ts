import { createElement, type ComponentType } from "react";

import type { JsonValue } from "../../../../packages/spec/src/json.ts";
import type { DataSpec } from "../../../../packages/spec/src/spec.ts";
import type { ReactBackendProps, ReactPlotBackend } from "../../backends/react.ts";
import { canonicalJson } from "../../resources/resolution-cache.ts";
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

function coordinate(point: JsonValue | undefined, axis: "x" | "y"): string {
  if (point === null || typeof point !== "object" || Array.isArray(point)) return "";
  return String((point as Record<string, JsonValue>)[axis] ?? "");
}

/**
 * Content identity for inline scalar data that never serialises the samples.
 * Each series contributes `key|n|x0|xn|yn` — enough to separate the histories a
 * host actually hands us (appended points, a re-run, a different metric) — and
 * the remaining props are canonicalised as usual, so `smoothing` and friends
 * still change the id. Per-point metadata (`wallTime`, `context`) is ignored by
 * construction, which is what lets a recreated descriptor hit the resolution
 * cache. Cost is O(series), not O(points): stringifying a ten-metric run of
 * 100k points each used to dominate every re-render.
 */
function scalarContentId(data: DataSpec): string | null {
  if (data.kind !== "inline") return null;
  const { series, ...rest } = data.props;
  if (!Array.isArray(series)) return null;
  const summary = series.map((entry) => {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) return canonicalJson(entry);
    const record = entry as Record<string, JsonValue>;
    const points = Array.isArray(record.points) ? record.points : [];
    const last = points[points.length - 1];
    return `${String(record.key ?? "")}|${points.length}|${coordinate(points[0], "x")}` +
      `|${coordinate(last, "x")}|${coordinate(last, "y")}`;
  }).join(";");
  return `scalar:${summary}|${canonicalJson(rest)}`;
}

/** Register scalar resolution, overlay comparison, and its current React backend. */
export function ensureScalarPlotType(
  View: ComponentType<ReactPlotViewProps<ScalarPresentation, ScalarSettings>>,
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
    resolve: async (spec) => scalarPresentation({ ...spec.props }),
    present: (content) => content,
    contentId: scalarContentId,
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
      async resolve(plan) {
        const presentations = await Promise.all(
          plan.operands.map(async (operand) => scalarPresentation({ ...operand.props })),
        );
        return overlayScalarPresentations(plan, presentations);
      },
    },
  });
  registerReactPlotType({ definition, backends: [backend] });
}
