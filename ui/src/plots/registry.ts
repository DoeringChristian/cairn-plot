import type { RegisteredPlotDefinition } from "./contracts.ts";
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
