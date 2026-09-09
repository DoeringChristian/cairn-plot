import type {
  CompareNode,
  DataSpec,
  GridNode,
  PlotLeafNode,
} from "../../../../../packages/spec/src/spec.ts";
import type {
  ImageCompareAlign,
  ImageCompareFit,
} from "../definition/content.ts";
import type { DataSource } from "../../../resources/data/data-source.ts";
import type { ComparisonPlan, ComparisonRequest } from "../../contracts.ts";
import { planComparison } from "../../registry.ts";

export type ImageComparisonPresentation = "split" | "difference";

export interface ImageComparisonPlan {
  readonly presentation: ImageComparisonPresentation;
  readonly reference: DataSpec;
  readonly foreground: DataSpec;
  readonly leaf: PlotLeafNode;
  readonly align?: ImageCompareAlign;
  readonly fit?: ImageCompareFit;
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
    };
    if (props.toolbar !== undefined) leafProps.toolbar = props.toolbar;
    if (props.pixelValueNotation !== undefined) leafProps.pixelValueNotation = props.pixelValueNotation;
    if (props.processing !== undefined) leafProps.processing = props.processing;
    if (typeof props.height === "number") leafProps.height = props.height;
    // H3': the synthesised leaf IS the pane, so the authored hold-previous
    // request has to survive the lowering. Dropping it here (the allowlist was
    // written for view controls only) is why every compare pane blinked to
    // "Loading…" between iteration steps even though the author asked for the
    // previous frame to be held.
    if (props.holdPreviousWhileLoading !== undefined) {
      leafProps.holdPreviousWhileLoading = props.holdPreviousWhileLoading;
    }
    return [{
      operandIndices: [referenceIndex, index],
      plan: {
        presentation: request.presentation as ImageComparisonPresentation,
        reference,
        foreground,
        leaf: { kind: "plot" as const, type: "image", data: reference, props: leafProps },
        align: props.align as ImageCompareAlign | undefined,
        fit: props.fit as ImageCompareFit | undefined,
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

/**
 * Stable identity for one pair child of an expanded multi-operand comparison.
 *
 * The synthesised children carried NO `id`, which cost them twice: the grid
 * keyed them by position (CP2/H6), and the pane's hold-previous gate refuses to
 * hold a frame for a node it cannot identify (a stacked flip between two
 * identity-less panes would otherwise show the wrong slot's picture).
 *
 * The identity is the parent's own identity plus the FOREGROUND's role: always
 * the operand INDEX, with the authored label appended when there is one. The
 * index is what makes it unique — two operands may legitimately carry the same
 * label, and a duplicate id is worse than a positional one (the grid drops it
 * back to the positional key and warns). Deliberately NOT the operand hashes: a
 * content-derived id changes on every iteration step, which is exactly when the
 * pane needs its slot to look unchanged, so hashing would disable the very hold
 * this id exists to enable. These ids survive a step, a reorder and a
 * re-authored spec.
 */
function pairChildId(parent: CompareNode, foregroundLabel: string | undefined, index: number): string {
  return `${parent.id ?? "compare"}|${index}${foregroundLabel ? `:${foregroundLabel}` : ""}`;
}

/** Lower a multi-output image plan into layout-only pair nodes for the host. */
export function expandImageComparison(node: CompareNode): GridNode | null {
  const cached = expandedNodes.get(node);
  if (cached !== undefined) return cached;
  const planned = planComparison(node);
  if (planned.type !== "image" || planned.plan.outputs.length <= 1) {
    expandedNodes.set(node, null);
    return null;
  }
  const children = planned.plan.outputs.map((output, index) => {
    const plan = output.plan as ImageComparisonPlan;
    return {
      kind: "compare" as const,
      id: pairChildId(node, plan.foregroundLabel, index),
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
