import type { JsonValue } from "../../../packages/spec/src/json.ts";
import type { DataSpec, PlotLeafNode, PlotNode } from "../../../packages/spec/src/spec.ts";
import type { PlotBackend } from "../backends/contracts.ts";

export type SettingsRecord = Record<string, JsonValue>;

export interface ResolveContext {
  readonly source: object;
  readonly signal: AbortSignal;
}

export interface DataSchema<TSpec extends DataSpec> {
  validate(value: DataSpec): TSpec;
}

export interface SettingsSchema<TSettings extends SettingsRecord> {
  defaults(): TSettings;
  project(settings: Readonly<SettingsRecord>): TSettings;
}

export interface ComparisonPresentationDefinition {
  readonly id: string;
  readonly label: string;
  readonly minOperands: number;
  readonly maxOperands: number;
}

export interface ComparisonAcceptance {
  readonly accepted: boolean;
  readonly reason?: string;
}

export interface ComparisonRequest {
  readonly presentation: string;
  readonly settings: Readonly<SettingsRecord>;
}

export interface ComparisonCapability<
  TSpec extends DataSpec,
  TContent,
  TPresentation,
> {
  readonly presentations: readonly ComparisonPresentationDefinition[];
  accepts(operands: readonly PlotNode[]): ComparisonAcceptance;
  resolve(
    operands: readonly TSpec[],
    context: ResolveContext,
  ): Promise<readonly TContent[]>;
  compose(
    contents: readonly TContent[],
    request: ComparisonRequest,
  ): TPresentation;
}

/** Strongly typed authoring unit for one internally maintained plot kind. */
export interface PlotDefinition<
  TSpec extends DataSpec,
  TContent,
  TSettings extends SettingsRecord,
  TPresentation,
> {
  readonly kind: string;
  readonly data: DataSchema<TSpec>;
  readonly settings: SettingsSchema<TSettings>;
  readonly backends: readonly PlotBackend<TPresentation, TSettings>[];

  resolve(spec: TSpec, context: ResolveContext): Promise<TContent>;
  present(content: TContent): TPresentation;

  readonly comparison?: ComparisonCapability<TSpec, TContent, TPresentation>;
}

/** The sole type-erased boundary used by the heterogeneous host registry. */
export interface RegisteredPlotDefinition {
  readonly kind: string;
  validateData(value: DataSpec): DataSpec;
  defaults(): SettingsRecord;
  resolve(node: PlotLeafNode, context: ResolveContext): Promise<unknown>;
  present(content: unknown): unknown;
  readonly backends: readonly PlotBackend<unknown, SettingsRecord>[];
  readonly comparison?: ComparisonCapability<DataSpec, unknown, unknown>;
}

/** Erase a checked definition once; concrete plot and backend code stays typed. */
export function definePlot<
  TSpec extends DataSpec,
  TContent,
  TSettings extends SettingsRecord,
  TPresentation,
>(
  definition: PlotDefinition<TSpec, TContent, TSettings, TPresentation>,
): RegisteredPlotDefinition {
  return {
    kind: definition.kind,
    validateData: (value) => definition.data.validate(value),
    defaults: () => definition.settings.defaults(),
    resolve: (node, context) => definition.resolve(definition.data.validate(node.data), context),
    present: (content) => definition.present(content as TContent),
    // Type erasure is deliberately contained here. Runtime values have already
    // crossed the definition's schema and are paired by this same adapter.
    backends: definition.backends as unknown as readonly PlotBackend<unknown, SettingsRecord>[],
    comparison: definition.comparison as unknown as
      | ComparisonCapability<DataSpec, unknown, unknown>
      | undefined,
  };
}

