import type { CompareNode, DataSpec } from "../../../../packages/spec/src/spec.ts";

export type ScalarSpec = Extract<DataSpec, { kind: "inline" }>;
export type ScalarPresentation = Record<string, unknown>;

export interface ScalarComparisonPlan {
  readonly a: ScalarSpec;
  readonly b: ScalarSpec;
  readonly labelA: string;
  readonly labelB: string;
}

export function validateScalarData(value: DataSpec): ScalarSpec {
  if (value.kind !== "inline") {
    throw new Error(`cairn-plot: scalar plot requires inline data, got ${JSON.stringify(value.kind)}`);
  }
  return value;
}

export function planScalarComparison(node: CompareNode): ScalarComparisonPlan {
  const presentation = node.presentation ?? "overlay";
  if (presentation !== "overlay") {
    throw new Error(`cairn-plot: scalar comparison does not support ${JSON.stringify(presentation)}`);
  }
  return {
    a: validateScalarData(node.a),
    b: validateScalarData(node.b),
    labelA: typeof node.props?.labelA === "string" ? node.props.labelA : "A",
    labelB: typeof node.props?.labelB === "string" ? node.props.labelB : "B",
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
  a: ScalarPresentation,
  b: ScalarPresentation,
): ScalarPresentation {
  return {
    ...a,
    series: [
      ...prefixedSeries(a, plan.labelA, "a"),
      ...prefixedSeries(b, plan.labelB, "b"),
    ],
  };
}
