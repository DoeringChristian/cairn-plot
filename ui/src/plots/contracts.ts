import type { JsonValue } from "../../../packages/spec/src/json.ts";
import type { DataSpec, PlotLeafNode } from "../../../packages/spec/src/spec.ts";
import type { PlotBackend } from "../backends/contracts.ts";
import type { DataSource } from "../resources/data/data-sources.ts";

export type SettingsRecord = Record<string, JsonValue>;

export interface ResolveContext {
  readonly source: DataSource;
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
  readonly maxOperands?: number;
}

export interface ComparisonStrategyDefinition {
  readonly id: "reference" | "all";
  readonly minOperands: number;
  readonly maxOperands?: number;
  readonly requiresReference: boolean;
}

/** Normalized comparison intent. Plot definitions never inspect legacy a/b. */
export interface ComparisonRequest {
  readonly renderer: string;
  readonly operands: readonly DataSpec[];
  readonly strategy: "reference" | "all";
  readonly referenceIndex?: number;
  readonly presentation?: string;
  readonly props: Readonly<Record<string, JsonValue>>;
}

export interface ComparisonPlan<TOutputPlan> {
  readonly outputs: readonly ComparisonOutputPlan<TOutputPlan>[];
  readonly layout: "single" | "grid";
}

export interface ComparisonOutputPlan<TPlan> {
  readonly plan: TPlan;
  /** Source operand indexes represented by this visible output. */
  readonly operandIndices: readonly number[];
}

export interface ComparisonAcceptance {
  readonly accepted: boolean;
  readonly reason?: string;
}

export interface ComparisonCapability<
  TPlan,
  TPresentation,
> {
  readonly presentations: readonly ComparisonPresentationDefinition[];
  readonly strategies: readonly ComparisonStrategyDefinition[];
  readonly defaultStrategy: "reference" | "all";
  accepts(request: ComparisonRequest): ComparisonAcceptance;
  plan(request: ComparisonRequest): ComparisonPlan<TPlan>;
  resolve(plan: TPlan, context: ResolveContext): Promise<TPresentation>;
}

/** Strongly typed authoring unit for one internally maintained plot kind. */
export interface PlotDefinition<
  TSpec extends DataSpec,
  TContent,
  TSettings extends SettingsRecord,
  TPresentation,
  TComparisonPlan = never,
> {
  readonly kind: string;
  readonly data: DataSchema<TSpec>;
  readonly settings: SettingsSchema<TSettings>;
  readonly backends: readonly PlotBackend<TPresentation, TSettings>[];

  resolve(spec: TSpec, context: ResolveContext): Promise<TContent>;
  present(content: TContent): TPresentation;

  readonly comparison?: ComparisonCapability<TComparisonPlan, TPresentation>;
}

/** The sole type-erased boundary used by the heterogeneous host registry. */
export interface RegisteredPlotDefinition {
  readonly kind: string;
  validateData(value: DataSpec): DataSpec;
  defaults(): SettingsRecord;
  projectSettings(settings: Readonly<SettingsRecord>): SettingsRecord;
  resolve(node: PlotLeafNode, context: ResolveContext): Promise<unknown>;
  present(content: unknown): unknown;
  readonly backends: readonly PlotBackend<unknown, SettingsRecord>[];
  readonly comparison?: ComparisonCapability<unknown, unknown>;
}

/** Erase a checked definition once; concrete plot and backend code stays typed. */
export function definePlot<
  TSpec extends DataSpec,
  TContent,
  TSettings extends SettingsRecord,
  TPresentation,
  TComparisonPlan = never,
>(
  definition: PlotDefinition<TSpec, TContent, TSettings, TPresentation, TComparisonPlan>,
): RegisteredPlotDefinition {
  return {
    kind: definition.kind,
    validateData: (value) => definition.data.validate(value),
    defaults: () => definition.settings.defaults(),
    projectSettings: (settings) => definition.settings.project(settings),
    resolve: (node, context) => definition.resolve(definition.data.validate(node.data), context),
    present: (content) => definition.present(content as TContent),
    // Type erasure is deliberately contained here. Runtime values have already
    // crossed the definition's schema and are paired by this same adapter.
    backends: definition.backends as unknown as readonly PlotBackend<unknown, SettingsRecord>[],
    comparison: definition.comparison as unknown as
      | ComparisonCapability<unknown, unknown>
      | undefined,
  };
}
