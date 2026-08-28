import type { CompareNode } from "../../../packages/spec/src/spec.ts";
import type {
  ComparisonCapability,
  RegisteredPlotDefinition,
} from "./contracts.ts";
import { claimPlotKind, releasePlotKinds } from "./kind-ownership.ts";

const definitions = new Map<string, RegisteredPlotDefinition>();
const listeners = new Set<() => void>();

export function registerPlotType(definition: RegisteredPlotDefinition): void {
  if (definitions.has(definition.kind)) {
    throw new Error(`cairn-plot: duplicate plot type ${JSON.stringify(definition.kind)}`);
  }
  claimPlotKind(definition.kind, "definition");
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
  readonly plan: unknown;
}

/**
 * Select and validate comparison behavior through the same registry as ordinary
 * plots. Layout code must not infer comparison semantics from the operands.
 */
export function planComparison(node: CompareNode): PlannedComparison {
  const renderer = comparisonRenderer(node);
  const definition = requirePlotType(renderer);
  const capability = definition.comparison;
  if (!capability) {
    throw new Error(
      `cairn-plot: plot type ${JSON.stringify(renderer)} does not support comparison`,
    );
  }
  const acceptance = capability.accepts(node);
  if (!acceptance.accepted) {
    const suffix = acceptance.reason ? `: ${acceptance.reason}` : "";
    throw new Error(
      `cairn-plot: plot type ${JSON.stringify(renderer)} rejected comparison${suffix}`,
    );
  }
  return {
    renderer,
    definition,
    capability,
    plan: capability.plan(node),
  };
}

/** Subscribe to registrations so lazy addon hosts can retry resolution. */
export function onPlotTypeRegister(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Test seam; production registration is process-wide and internal. */
export function clearPlotTypesForTest(): void {
  definitions.clear();
  releasePlotKinds("definition");
}
