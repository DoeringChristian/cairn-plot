import type { DataSpec } from "../../../packages/spec/src/spec.ts";
import type { RegisteredPlotDefinition, SettingsRecord } from "./contracts.ts";
import { registerPlotType } from "./registry.ts";
import { setContentIdResolver } from "../resources/resolution-cache.ts";
import type { ReactPlotBackend } from "../backends/react.ts";

export interface RegisteredReactPlotType {
  readonly definition: RegisteredPlotDefinition;
  readonly backends: readonly ReactPlotBackend<Record<string, unknown>, SettingsRecord>[];
}

const registrations = new Map<string, RegisteredReactPlotType>();
const listeners = new Set<() => void>();

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
  for (const listener of listeners) listener();
}

/** Install optional same-root backends after their addon bundle becomes available. */
export function registerReactPlotBackends(
  kind: string,
  backends: readonly ReactPlotBackend<Record<string, unknown>, SettingsRecord>[],
): void {
  const current = registrations.get(kind);
  if (!current) throw new Error(`cairn-plot: cannot install backends for unknown plot type ${JSON.stringify(kind)}`);
  registrations.set(kind, { ...current, backends: [...current.backends, ...backends] });
  for (const listener of listeners) listener();
}

/** Contain heterogeneous backend erasure at the registry boundary. */
export function eraseReactPlotBackend<TPresentation, TSettings extends SettingsRecord>(
  backend: ReactPlotBackend<TPresentation, TSettings>,
): ReactPlotBackend<Record<string, unknown>, SettingsRecord> {
  return backend as unknown as ReactPlotBackend<Record<string, unknown>, SettingsRecord>;
}

export function onRegisterReactPlotType(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getReactPlotType(kind: string): RegisteredReactPlotType | undefined {
  return registrations.get(kind);
}

export function clearReactPlotTypesForTest(): void {
  registrations.clear();
  listeners.clear();
}

// The resolution cache keys authored content by a plot definition's own content
// id when it has one. It cannot import this module (shared resources must not
// reach up into the plot layer — `check:plot-boundary`), so the registry hands
// the lookup down instead. `undefined` means "not registered yet": the cache
// then keys by canonical JSON without memoising, and adopts the definition's id
// on the registration re-render.
setContentIdResolver((type, data) => {
  const registered = registrations.get(type);
  if (!registered) return undefined;
  return { contentId: registered.definition.contentId?.(data as DataSpec) ?? null };
});
