import { createElement, type ComponentType } from "react";

import type { CompareNode, DataSpec, PlotLeafNode } from "../../../../../packages/spec/src/spec.ts";
import type { DataSource } from "../../../resources/data/data-source.ts";
import type { ImagePresentation } from "../runtime/presentation.ts";
import type { PlotSettings } from "../../../settings/schema.ts";
import type { ReactBackendProps, ReactPlotBackend } from "../../../backends/react.ts";
import { definePlot, type SettingsRecord } from "../../contracts.ts";
import { getPlotType } from "../../registry.ts";
import { registerReactPlotType } from "../../react-registry.ts";
import type { ReactPlotViewProps } from "../../react-view.ts";
import {
  planImageComparison,
  type ImageComparisonPlan,
} from "./comparison-plan.ts";
import { resolveDisplayOperator, TONEMAP_GAMMA_DEFAULT } from "../runtime/tonemap.ts";

type ImageSpec = Extract<DataSpec, { kind: "inline" | "image" | "imghdr" | "url" }>;
export type { ImagePresentation } from "../runtime/presentation.ts";
export type ImageSettings = PlotSettings & SettingsRecord;

/** Image-owned HOME state. Authored node settings are merged by the host. */
export function defaultImageSettings(node: PlotLeafNode | CompareNode): ImageSettings {
  return {
    "image.view": { zoom: 1, pan: { x: 0, y: 0 } },
    "image.encoding": resolveDisplayOperator(undefined),
    "image.tonemapGamma": TONEMAP_GAMMA_DEFAULT,
    "image.exposureEV": 0,
    "image.offset": 0,
    "image.colorRange": null,
    "panel.info": null,
    ...(node.kind === "compare"
      ? {
          "compare.operation": node.presentation === "difference" ? "absolute" : "split",
          "compare.split": 0.5,
        }
      : {}),
  };
}

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
      defaults: defaultImageSettings,
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
          if (request.presentation !== "split" && request.presentation !== "difference") {
            throw new Error(`unsupported image comparison presentation ${JSON.stringify(request.presentation)}`);
          }
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
