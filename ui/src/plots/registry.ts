import type { CompareNode } from "../../../packages/spec/src/spec.ts";
import type {
  ComparisonCapability,
  ComparisonPlan,
  ComparisonRequest,
  RegisteredPlotDefinition,
  ResolveContext,
} from "./contracts.ts";

const definitions = new Map<string, RegisteredPlotDefinition>();
const listeners = new Set<() => void>();
let comparisonPlans = new WeakMap<CompareNode, PlannedComparison>();

export function registerPlotType(definition: RegisteredPlotDefinition): void {
  if (definitions.has(definition.kind)) {
    throw new Error(`cairn-plot: duplicate plot type ${JSON.stringify(definition.kind)}`);
  }
  definitions.set(definition.kind, definition);
  for (const listener of listeners) listener();
}

export function getPlotType(kind: string): RegisteredPlotDefinition | undefined {
  return definitions.get(kind);
}

export function requirePlotType(kind: string): RegisteredPlotDefinition {
  const definition = getPlotType(kind);
  if (!definition) throw new Error(`cairn-plot: unknown plot type ${JSON.stringify(kind)}`);
  return definition;
}

/** The plot kind that owns a comparison. Old descriptors are image comparisons. */
export function comparisonRenderer(node: CompareNode): string {
  return node.renderer ?? "image";
}

export interface PlannedComparison {
  readonly renderer: string;
  readonly definition: RegisteredPlotDefinition;
  readonly capability: ComparisonCapability<unknown, unknown>;
  readonly request: ComparisonRequest;
  readonly plan: ComparisonPlan<unknown>;
}

function normalizeComparison(
  node: CompareNode,
  renderer: string,
  capability: ComparisonCapability<unknown, unknown>,
): ComparisonRequest {
  const operands = node.operands?.length
    ? node.operands
    : node.a && node.b
      ? [node.a, node.b]
      : [];
  if (operands.length < 2) {
    throw new Error("cairn-plot: comparison requires at least two operands");
  }
  const strategy = node.strategy ?? capability.defaultStrategy;
  const referenceIndex = node.referenceIndex ?? node.baselineIndex ??
    (strategy === "reference" ? 0 : undefined);
  if (referenceIndex !== undefined &&
      (!Number.isInteger(referenceIndex) || referenceIndex < 0 || referenceIndex >= operands.length)) {
    throw new Error(`cairn-plot: comparison reference index ${referenceIndex} is out of range`);
  }
  const presentation = node.presentation ??
    (node.mode === "diff" ? "difference" : node.mode === "split" ? "split" : undefined);
  const props = { ...(node.props ?? {}) };
  if (node.diffSubmode !== undefined) props.diffSubmode = node.diffSubmode;
  if (node.align !== undefined) props.align = node.align;
  if (node.fit !== undefined) props.fit = node.fit;
  return { renderer, operands, strategy, referenceIndex, presentation, props };
}

/**
 * Select and validate comparison behavior through the same registry as ordinary
 * plots. Layout code must not infer comparison semantics from the operands.
 */
export function planComparison(node: CompareNode): PlannedComparison {
  const cached = comparisonPlans.get(node);
  if (cached) return cached;
  const renderer = comparisonRenderer(node);
  const definition = requirePlotType(renderer);
  const capability = definition.comparison;
  if (!capability) {
    throw new Error(
      `cairn-plot: plot type ${JSON.stringify(renderer)} does not support comparison`,
    );
  }
  const request = normalizeComparison(node, renderer, capability);
  const acceptance = capability.accepts(request);
  if (!acceptance.accepted) {
    const suffix = acceptance.reason ? `: ${acceptance.reason}` : "";
    throw new Error(
      `cairn-plot: plot type ${JSON.stringify(renderer)} rejected comparison${suffix}`,
    );
  }
  const planned = {
    renderer,
    definition,
    capability,
    request,
    plan: capability.plan(request),
  };
  comparisonPlans.set(node, planned);
  return planned;
}

/** Resolve the semantic presentation selected by a comparison capability. */
export function resolveComparison(
  node: CompareNode,
  context: ResolveContext,
): Promise<unknown> {
  const planned = planComparison(node);
  if (planned.plan.outputs.length !== 1) {
    throw new Error(
      `cairn-plot: comparison planned ${planned.plan.outputs.length} outputs; select an output explicitly`,
    );
  }
  return planned.capability.resolve(planned.plan.outputs[0]!.plan, context);
}

/** Subscribe to registrations so lazy addon hosts can retry resolution. */
export function onPlotTypeRegister(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Test seam; production registration is process-wide and internal. */
export function clearPlotTypesForTest(): void {
  definitions.clear();
  comparisonPlans = new WeakMap();
}
