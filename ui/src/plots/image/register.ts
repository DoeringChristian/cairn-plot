import { createElement, type ComponentType } from "react";

import type { DataSpec } from "../../../../packages/spec/src/spec.ts";
import type { DataSource } from "../../lib/cairn-plot/store/data-sources.ts";
import type { DeepFlattenController } from "../../lib/cairn-plot/image/decoders.ts";
import type {
  DecodedSource,
  ImageBackendProps,
  RenderMode,
} from "../../plots/image/backend/contracts.ts";
import type { ViewportSettings } from "../../state/settings/viewport-settings.ts";
import type { ReactBackendProps, ReactPlotBackend } from "../../host/react-backend.ts";
import { definePlot, type SettingsRecord } from "../contracts.ts";
import { getPlotType } from "../registry.ts";
import { registerReactPlotType } from "../react-registry.ts";
import type { ReactPlotViewProps } from "../react-view.ts";
import {
  planImageComparison,
  type ImageComparisonPlan,
} from "./comparison-plan.ts";

type ImageSpec = Extract<DataSpec, { kind: "inline" | "image" | "imghdr" | "url" }>;
type ImageRuntimePlumbing =
  | "source"
  | "syncedSettings"
  | "setSyncedSettings"
  | "resetViewportSettings"
  | "onViewportChange";

/** Semantic image input. Cell-owned settings and commands are deliberately absent. */
export type ImagePresentation = Omit<ImageBackendProps, ImageRuntimePlumbing> & {
  readonly source?: DecodedSource;
  readonly imageUrl?: string | null;
  readonly hdr?: {
    readonly data: Float32Array | Float64Array | Uint16Array;
    readonly precision?: "f32" | "f16-bits";
    readonly shape: number[];
    readonly dtype: string;
    readonly deep?: DeepFlattenController;
  };
  readonly renderMode?: RenderMode;
  readonly height?: number;
};
export type ImageSettings = ViewportSettings & SettingsRecord;

/** Checked erasure boundary for resolved and legacy-inline image payloads. */
export function imagePresentation(value: Record<string, unknown>): ImagePresentation {
  const source = value.source;
  const hasSource = source !== null && typeof source === "object" &&
    ((source as { dtype?: unknown }).dtype === "float" || (source as { dtype?: unknown }).dtype === "uint8");
  if (!hasSource && value.hdr == null && value.imageUrl == null) {
    throw new Error("cairn-plot: image presentation requires a decoded source");
  }
  return value as unknown as ImagePresentation;
}

function validateImageData(value: DataSpec): ImageSpec {
  if (value.kind === "inline" || value.kind === "image" || value.kind === "imghdr" || value.kind === "url") {
    return value;
  }
  throw new Error(`cairn-plot: image plot does not accept data kind ${JSON.stringify(value.kind)}`);
}

/** Register the existing proven ImageView as the first typed production kind. */
export function ensureImagePlotType(
  View: ComponentType<ReactPlotViewProps<ImagePresentation, ImageSettings>>,
  resolve: (spec: ImageSpec, source: DataSource) => Promise<Record<string, unknown>>,
): void {
  if (getPlotType("image")) return;
  const backend: ReactPlotBackend<ImagePresentation, ImageSettings> = {
    id: "image-react",
    family: "image",
    technology: "canvas2d",
    supports: () => ({ supported: true, priority: 1 }),
    canReuse: () => true,
    component({ input }: ReactBackendProps<ImagePresentation, ImageSettings>) {
      return createElement(View, {
        presentation: input.presentation,
        settings: input.settings,
        commands: input.commands,
      });
    },
  };
  const definition = definePlot<
    ImageSpec,
    ImagePresentation,
    ImageSettings,
    ImagePresentation,
    ImageComparisonPlan
  >({
    kind: "image",
    data: { validate: validateImageData },
    settings: {
      defaults: () => ({}),
      project: (settings) => ({ ...settings }) as ImageSettings,
    },
    resolve: (spec, context) => resolve(spec, context.source),
    present: imagePresentation,
    comparison: {
      presentations: [
        { id: "split", label: "Split", minOperands: 2 },
        { id: "difference", label: "Difference", minOperands: 2 },
      ],
      strategies: [{ id: "reference", minOperands: 2, requiresReference: true }],
      defaultStrategy: "reference",
      accepts(request) {
        try {
          if (request.strategy !== "reference") throw new Error("image comparison requires a reference");
          for (const operand of request.operands) validateImageData(operand);
          return { accepted: true };
        } catch (error) {
          return {
            accepted: false,
            reason: error instanceof Error ? error.message : String(error),
          };
        }
      },
      plan: planImageComparison,
      async resolve(plan, context) {
        const { resolveImageComparisonPair } = await import("./comparison-resolve.ts");
        return imagePresentation(await resolveImageComparisonPair(plan.reference, plan.foreground, context.source));
      },
    },
    // The current adapter is same-root React. Imperative image backends can be
    // added after renderer internals no longer depend on React lifecycle.
    backends: [],
  });
  registerReactPlotType({ definition, backends: [backend] });
}
