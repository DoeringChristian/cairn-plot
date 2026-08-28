import type { DataSpec } from "../../../../packages/spec/src/spec.ts";
import type { ComparisonPlan, ComparisonRequest } from "../contracts.ts";
import type { Series } from "../../lib/cairn-plot/types.ts";
import type { ScalarPresentation } from "./types.ts";

export type ScalarSpec = Extract<DataSpec, { kind: "inline" }>;
export type { ScalarPresentation } from "./types.ts";

export interface ScalarComparisonPlan {
  readonly operands: readonly ScalarSpec[];
  readonly labels: readonly string[];
}

export function validateScalarData(value: DataSpec): ScalarSpec {
  if (value.kind !== "inline") {
    throw new Error(`cairn-plot: scalar plot requires inline data, got ${JSON.stringify(value.kind)}`);
  }
  return value;
}

export function planScalarComparison(
  request: ComparisonRequest,
): ComparisonPlan<ScalarComparisonPlan> {
  const presentation = request.presentation ?? "overlay";
  if (presentation !== "overlay") {
    throw new Error(`cairn-plot: scalar comparison does not support ${JSON.stringify(presentation)}`);
  }
  if (request.strategy !== "all") {
    throw new Error("cairn-plot: scalar overlay comparison requires the all strategy");
  }
  const authoredLabels = Array.isArray(request.props.labels) ? request.props.labels : [];
  const labels = request.operands.map((_, index) => {
    const authored = authoredLabels[index];
    if (typeof authored === "string") return authored;
    if (request.operands.length === 2) {
      const legacy = index === 0 ? request.props.labelA : request.props.labelB;
      if (typeof legacy === "string") return legacy;
    }
    return String.fromCharCode(65 + index);
  });
  return {
    outputs: [{
      operandIndices: request.operands.map((_, index) => index),
      plan: { operands: request.operands.map(validateScalarData), labels },
    }],
    layout: "single",
  };
}

function prefixedSeries(value: ScalarPresentation, prefix: string, side: string): Series[] {
  return value.series.map((series) => ({
    ...series,
    key: `${side}:${series.key}`,
    label: `${prefix} · ${series.label}`,
  }));
}

/** Overlay both operands as uniquely keyed series in one scalar presentation. */
export function overlayScalarPresentations(
  plan: ScalarComparisonPlan,
  presentations: readonly ScalarPresentation[],
): ScalarPresentation {
  const first = presentations[0];
  if (!first) throw new Error("cairn-plot: scalar comparison resolved no operands");
  return {
    ...first,
    series: presentations.flatMap((presentation, index) =>
      prefixedSeries(presentation, plan.labels[index] ?? String(index + 1), String(index))
    ),
  };
}
