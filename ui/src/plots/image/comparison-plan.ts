import type {
  CompareNode,
  DataSpec,
  PlotLeafNode,
} from "../../../../packages/spec/src/spec.ts";
import type {
  CompareAlign,
  CompareFit,
} from "../../lib/cairn-plot/renderers/image-backend.ts";
import type { DataSource } from "../../lib/cairn-plot/store/data-sources.ts";
import { planComparison } from "../registry.ts";

export type ImageComparisonPresentation = "split" | "difference";

let warnedBlendRemoved = false;

/** Normalize durable/legacy spelling into semantic image presentations. */
export function normalizeImageComparisonPresentation(
  mode: string | undefined | null,
): ImageComparisonPresentation {
  if (mode === "blend") {
    if (!warnedBlendRemoved) {
      warnedBlendRemoved = true;
      console.warn("cairn-plot: the 'blend' compare mode was removed; rendering as 'split'.");
    }
    return "split";
  }
  return mode === "diff" ? "difference" : "split";
}

export interface ImageComparisonPlan {
  readonly presentation: ImageComparisonPresentation;
  readonly reference: DataSpec;
  readonly foreground: DataSpec;
  /** Transitional spelling consumed by the existing image leaf adapter. */
  readonly fgData: DataSpec;
  readonly leaf: PlotLeafNode;
  readonly align?: CompareAlign;
  readonly fit?: CompareFit;
  readonly referenceLabel?: string;
  readonly foregroundLabel?: string;
}

const plans = new WeakMap<CompareNode, ImageComparisonPlan>();

/**
 * Interpret an authored comparison into image semantics. Layout receives one
 * ordinary image leaf plus ordered operands; it does not choose baselines,
 * labels, or presentation meaning itself.
 */
export function planImageComparison(node: CompareNode): ImageComparisonPlan {
  let plan = plans.get(node);
  if (plan) return plan;

  const baselineIndex = node.baselineIndex ?? 0;
  const reference = baselineIndex === 0 ? node.a : node.b;
  const foreground = baselineIndex === 0 ? node.b : node.a;
  const props = node.props ?? {};
  const labelA = typeof props.labelA === "string" ? props.labelA : undefined;
  const labelB = typeof props.labelB === "string" ? props.labelB : undefined;
  const legacyLabel = typeof props.label === "string" ? props.label : undefined;
  const leafProps: NonNullable<PlotLeafNode["props"]> = {
    interpolation: (props.interpolation as string | undefined) ?? "auto",
    showAxes: (props.showAxes as boolean | undefined) ?? false,
  };
  if (props.toolbar !== undefined) leafProps.toolbar = props.toolbar;
  if (props.pixelValueNotation !== undefined) leafProps.pixelValueNotation = props.pixelValueNotation;
  if (props.processing !== undefined) leafProps.processing = props.processing;
  if (typeof props.height === "number") leafProps.height = props.height;

  plan = {
    presentation: normalizeImageComparisonPresentation(node.mode),
    reference,
    foreground,
    fgData: foreground,
    leaf: { kind: "plot", renderer: "image", data: reference, props: leafProps },
    align: node.align,
    fit: node.fit,
    referenceLabel: baselineIndex === 0 ? labelA : labelB,
    foregroundLabel: (baselineIndex === 0 ? labelB : labelA) ?? legacyLabel,
  };
  plans.set(node, plan);
  return plan;
}

/** Checked adapter while the production host has only an image comparison UI. */
export function planRegisteredImageComparison(node: CompareNode): ImageComparisonPlan {
  const planned = planComparison(node);
  if (planned.renderer !== "image") {
    throw new Error(
      `cairn-plot: comparison host for ${JSON.stringify(planned.renderer)} is not installed`,
    );
  }
  return planned.plan as ImageComparisonPlan;
}

/** Resolve through the registered capability; the host never calls image decode directly. */
export async function resolveRegisteredImageComparison(
  node: CompareNode,
  source: DataSource,
  signal: AbortSignal = new AbortController().signal,
): Promise<Record<string, unknown>> {
  const planned = planComparison(node);
  if (planned.renderer !== "image") {
    throw new Error(
      `cairn-plot: comparison host for ${JSON.stringify(planned.renderer)} is not installed`,
    );
  }
  return planned.capability.resolve(planned.plan, { source, signal }) as Promise<Record<string, unknown>>;
}
