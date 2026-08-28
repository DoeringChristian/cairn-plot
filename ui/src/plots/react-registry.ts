import type { RegisteredPlotDefinition, SettingsRecord } from "./contracts.ts";
import { registerPlotType } from "./registry.ts";
import type { ReactPlotBackend } from "../host/react-backend.ts";

export interface RegisteredReactPlotType {
  readonly definition: RegisteredPlotDefinition;
  readonly backends: readonly ReactPlotBackend<Record<string, unknown>, SettingsRecord>[];
}

const registrations = new Map<string, RegisteredReactPlotType>();

/** Register semantic definition and same-root host backends as one ownership act. */
export function registerReactPlotType<
  TPresentation,
  TSettings extends SettingsRecord,
>(registration: {
  readonly definition: RegisteredPlotDefinition;
  readonly backends: readonly ReactPlotBackend<TPresentation, TSettings>[];
}): void {
  if (registrations.has(registration.definition.kind)) {
    throw new Error(`cairn-plot: duplicate React plot type ${JSON.stringify(registration.definition.kind)}`);
  }
  registerPlotType(registration.definition);
  registrations.set(
    registration.definition.kind,
    registration as unknown as RegisteredReactPlotType,
  );
}

export function getReactPlotType(kind: string): RegisteredReactPlotType | undefined {
  return registrations.get(kind);
}

export function clearReactPlotTypesForTest(): void {
  registrations.clear();
}
