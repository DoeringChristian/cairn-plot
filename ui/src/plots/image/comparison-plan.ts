import type {
  CompareNode,
  DataSpec,
  GridNode,
  PlotLeafNode,
} from "../../../../packages/spec/src/spec.ts";
import type {
  CompareAlign,
  CompareFit,
} from "./backend/contracts.ts";
import type { DataSource } from "../../resources/data/data-source.ts";
import type { ComparisonPlan, ComparisonRequest } from "../contracts.ts";
import { planComparison } from "../registry.ts";

export type ImageComparisonPresentation = "split" | "difference";

export interface ImageComparisonPlan {
  readonly presentation: ImageComparisonPresentation;
  readonly reference: DataSpec;
  readonly foreground: DataSpec;
  readonly leaf: PlotLeafNode;
  readonly align?: CompareAlign;
  readonly fit?: CompareFit;
  readonly referenceLabel?: string;
  readonly foregroundLabel?: string;
}

/**
 * Interpret an authored comparison into image semantics. Layout receives one
 * ordinary image leaf plus ordered operands; it does not choose baselines,
 * labels, or presentation meaning itself.
 */
export function planImageComparison(
  request: ComparisonRequest,
): ComparisonPlan<ImageComparisonPlan> {
  if (request.strategy !== "reference" || request.referenceIndex === undefined) {
    throw new Error("cairn-plot: image comparison requires a reference strategy");
  }
  const referenceIndex = request.referenceIndex;
  const props = request.props;
  const labelA = typeof props.labelA === "string" ? props.labelA : undefined;
  const labelB = typeof props.labelB === "string" ? props.labelB : undefined;
  const labels = Array.isArray(props.labels) ? props.labels : [];
  const legacyLabel = typeof props.label === "string" ? props.label : undefined;
  const labelAt = (index: number): string | undefined => {
    const label = labels[index];
    if (typeof label === "string") return label;
    if (request.operands.length === 2) return index === 0 ? labelA : labelB;
    return undefined;
  };
  const reference = request.operands[referenceIndex]!;
  const outputs = request.operands.flatMap((foreground, index) => {
    if (index === referenceIndex) return [];
    const leafProps: NonNullable<PlotLeafNode["props"]> = {
      interpolation: (props.interpolation as string | undefined) ?? "auto",
      showAxes: (props.showAxes as boolean | undefined) ?? false,
    };
    if (props.toolbar !== undefined) leafProps.toolbar = props.toolbar;
    if (props.pixelValueNotation !== undefined) leafProps.pixelValueNotation = props.pixelValueNotation;
    if (props.processing !== undefined) leafProps.processing = props.processing;
    if (typeof props.height === "number") leafProps.height = props.height;
    return [{
      operandIndices: [referenceIndex, index],
      plan: {
        presentation: request.presentation as ImageComparisonPresentation,
        reference,
        foreground,
        leaf: { kind: "plot" as const, type: "image", data: reference, props: leafProps },
        align: props.align as CompareAlign | undefined,
        fit: props.fit as CompareFit | undefined,
        referenceLabel: labelAt(referenceIndex),
        foregroundLabel: labelAt(index) ?? legacyLabel,
      },
    }];
  });
  return { outputs, layout: outputs.length === 1 ? "single" : "grid" };
}

/** Checked adapter while the production host has only an image comparison UI. */
export function planRegisteredImageComparison(node: CompareNode): ImageComparisonPlan {
  const planned = planComparison(node);
  if (planned.type !== "image") {
    throw new Error(
      `cairn-plot: comparison host for ${JSON.stringify(planned.type)} is not installed`,
    );
  }
  if (planned.plan.outputs.length !== 1) {
    throw new Error(`cairn-plot: image comparison host expected one output, got ${planned.plan.outputs.length}`);
  }
  return planned.plan.outputs[0]!.plan as ImageComparisonPlan;
}

/** Resolve through the registered capability; the host never calls image decode directly. */
export async function resolveRegisteredImageComparison(
  node: CompareNode,
  source: DataSource,
  signal: AbortSignal = new AbortController().signal,
): Promise<Record<string, unknown>> {
  const planned = planComparison(node);
  if (planned.type !== "image") {
    throw new Error(
      `cairn-plot: comparison host for ${JSON.stringify(planned.type)} is not installed`,
    );
  }
  if (planned.plan.outputs.length !== 1) {
    throw new Error(`cairn-plot: image comparison host expected one output, got ${planned.plan.outputs.length}`);
  }
  return planned.capability.resolve(planned.plan.outputs[0]!.plan, { source, signal }) as Promise<Record<string, unknown>>;
}

const expandedNodes = new WeakMap<CompareNode, GridNode | null>();

/** Lower a multi-output image plan into layout-only pair nodes for the host. */
export function expandImageComparison(node: CompareNode): GridNode | null {
  const cached = expandedNodes.get(node);
  if (cached !== undefined) return cached;
  const planned = planComparison(node);
  if (planned.type !== "image" || planned.plan.outputs.length <= 1) {
    expandedNodes.set(node, null);
    return null;
  }
  const children = planned.plan.outputs.map((output) => {
    const plan = output.plan as ImageComparisonPlan;
    return {
      kind: "compare" as const,
      type: "image",
      operands: [plan.reference, plan.foreground],
      strategy: "reference" as const,
      referenceIndex: 0,
      presentation: plan.presentation,
      props: {
        ...planned.request.props,
        ...(plan.referenceLabel ? { labelA: plan.referenceLabel } : {}),
        ...(plan.foregroundLabel ? { labelB: plan.foregroundLabel } : {}),
      },
    };
  });
  const grid: GridNode = { kind: "grid", children, switchable: false };
  expandedNodes.set(node, grid);
  return grid;
}
