import type { SettingsCommandPort } from "../backends/contracts.ts";

/** Typed React adapter input; mirrors BackendInput without invalidation metadata. */
export interface ReactPlotViewProps<TPresentation, TSettings> {
  readonly presentation: TPresentation;
  readonly settings: Readonly<TSettings>;
  readonly commands: SettingsCommandPort<TSettings>;
}
