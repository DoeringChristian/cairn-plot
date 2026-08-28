import type { DataSpec } from "../../../../packages/spec/src/spec.ts";
import type { ComparisonPlan, ComparisonRequest } from "../contracts.ts";

export type ScalarSpec = Extract<DataSpec, { kind: "inline" }>;
export type ScalarPresentation = Record<string, unknown>;

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

function prefixedSeries(value: ScalarPresentation, prefix: string, side: string): unknown[] {
  const series = Array.isArray(value.series) ? value.series : [];
  return series.map((entry, index) => {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) return entry;
    const record = entry as Record<string, unknown>;
    const key = typeof record.key === "string" ? record.key : String(index);
    const label = typeof record.label === "string" ? record.label : key;
    return { ...record, key: `${side}:${key}`, label: `${prefix} · ${label}` };
  });
}

/** Overlay both operands as uniquely keyed series in one scalar presentation. */
export function overlayScalarPresentations(
  plan: ScalarComparisonPlan,
  presentations: readonly ScalarPresentation[],
): ScalarPresentation {
  const first = presentations[0] ?? {};
  return {
    ...first,
    series: presentations.flatMap((presentation, index) =>
      prefixedSeries(presentation, plan.labels[index] ?? String(index + 1), String(index))
    ),
  };
}
