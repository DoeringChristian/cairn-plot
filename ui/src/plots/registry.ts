import type { RegisteredPlotDefinition } from "./contracts.ts";

const definitions = new Map<string, RegisteredPlotDefinition>();

export function registerPlotType(definition: RegisteredPlotDefinition): void {
  if (definitions.has(definition.kind)) {
    throw new Error(`cairn-plot: duplicate plot type ${JSON.stringify(definition.kind)}`);
  }
  definitions.set(definition.kind, definition);
}

export function getPlotType(kind: string): RegisteredPlotDefinition | undefined {
  return definitions.get(kind);
}

export function requirePlotType(kind: string): RegisteredPlotDefinition {
  const definition = getPlotType(kind);
  if (!definition) throw new Error(`cairn-plot: unknown plot type ${JSON.stringify(kind)}`);
  return definition;
}

/** Test seam; production registration is process-wide and internal. */
export function clearPlotTypesForTest(): void {
  definitions.clear();
}

