import { createElement, type ComponentType } from "react";

import type { CompareNode, DataSpec, PlotLeafNode } from "../../../../../packages/spec/src/spec.ts";
import type { ImagePresentation } from "../runtime/presentation.ts";
import type { PlotSettings } from "../../../settings/schema.ts";
import type { ReactBackendProps, ReactPlotBackend } from "../../../backends/react.ts";
import { definePlot, type SettingsRecord } from "../../contracts.ts";
import { getPlotType } from "../../registry.ts";
import { registerReactPlotType } from "../../react-registry.ts";
import {
  planImageComparison,
  type ImageComparisonPlan,
} from "./comparison-plan.ts";
import {
  EXTENDED_TONEMAP_PEAK_DEFAULT,
  resolveDisplayOperator,
  TONEMAP_GAMMA_DEFAULT,
} from "../runtime/tonemap.ts";
import { resolveImageData } from "../resources/resolve-data.ts";
import { recommendedImageEncoding } from "./operation-display-defaults.ts";
import { migrateCompareSettings } from "../definition/settings.ts";
import type { ImageBackend } from "../backend.ts";
import type { ImageBackendView } from "./contracts.ts";
import type { ImagePlotViewProps } from "./view.tsx";

type ImageSpec = Extract<DataSpec, { kind: "image" | "imghdr" | "url" }>;
export type { ImagePresentation } from "../runtime/presentation.ts";
export type ImageSettings = PlotSettings & SettingsRecord;

/** Image-owned HOME state. Authored node settings are merged by the host. */
export function defaultImageSettings(node: PlotLeafNode | CompareNode): ImageSettings {
  // A descriptor authored before the `flip`/`flip-hdr` split can seed
  // `compare.flipMode: "hdr"`; the same read-side migration resolves it here so
  // the seeded operation (and the display default derived from it) is public.
  const authored = migrateCompareSettings({ ...(node.settings ?? {}) });
  const authoredOperation = typeof authored["compare.operation"] === "string"
    ? authored["compare.operation"]
    : node.kind === "compare"
      ? node.presentation === "difference" ? "absolute" : "split"
      : undefined;
  const authoredSourceEncoding = typeof authored["image.encoding"] === "string"
    ? authored["image.encoding"]
    : resolveDisplayOperator(undefined);
  return {
    "image.view": { zoom: 1, pan: { x: 0, y: 0 } },
    "image.encoding": recommendedImageEncoding({
      operation: authoredOperation,
      authoredSourceEncoding,
    }),
    "image.tonemapGamma": TONEMAP_GAMMA_DEFAULT,
    "image.peak": EXTENDED_TONEMAP_PEAK_DEFAULT,
    "image.exposureEV": 0,
    "image.offset": 0,
    "image.colorRange": null,
    "image.channelSelect": null,
    "panel.info": null,
    ...(node.kind === "compare"
      ? {
          "compare.operation": authoredOperation!,
          "compare.split": 0.5,
        }
      : {}),
  };
}

/** Checked erasure boundary for resolved image content. */
export function imagePresentation(value: Record<string, unknown>): ImagePresentation {
  const source = value.source;
  const hasSource = source !== null && typeof source === "object" &&
    ((source as { dtype?: unknown }).dtype === "float" || (source as { dtype?: unknown }).dtype === "uint8");
  if (!hasSource) {
    throw new Error("cairn-plot: image presentation requires a decoded source");
  }
  return value as unknown as ImagePresentation;
}

function validateImageData(value: DataSpec): ImageSpec {
  if (value.kind === "image" || value.kind === "imghdr" || value.kind === "url") {
    return value;
  }
  throw new Error(`cairn-plot: image plot does not accept data kind ${JSON.stringify(value.kind)}`);
}

/** Register the existing proven ImageView as the first typed production kind. */
export function ensureImagePlotType(
  View: ComponentType<ImagePlotViewProps>,
  imageBackends: readonly ImageBackend<ImageBackendView>[],
): void {
  if (getPlotType("image")) return;
  const cpu = imageBackends.find(({ id }) => id === "cpu");
  const backends: ReactPlotBackend<ImagePresentation, ImageSettings>[] = imageBackends.map(
    (imageBackend) => ({
      id: `image-${imageBackend.id}`,
      family: "image",
      technology: imageBackend.technology,
      prepare: imageBackend.prepare,
      subscribeSupport: imageBackend.subscribeSupport,
      supportSnapshot: imageBackend.supportSnapshot,
      supports(_presentation, environment) {
        return imageBackend.supports(environment);
      },
      canReuse: () => true,
      component({ input }: ReactBackendProps<ImagePresentation, ImageSettings>) {
        return createElement(View, {
          presentation: input.presentation,
          settings: input.settings,
          commands: input.commands,
          backend: imageBackend,
          failureFallback: imageBackend.id === "webgpu" ? cpu : undefined,
        });
      },
    }),
  );
  const definition = definePlot<
    ImageSpec,
    Record<string, unknown>,
    ImageSettings,
    ImagePresentation,
    ImageComparisonPlan
  >({
    kind: "image",
    data: { validate: validateImageData },
    settings: {
      defaults: defaultImageSettings,
      // The host adapter's read of cell settings: the one place a saved session
      // from before the `flip`/`flip-hdr` split is rewritten (`compare.flipMode`).
      project: (settings) => migrateCompareSettings({ ...settings }) as ImageSettings,
    },
    resolve: (spec, context) => resolveImageData(spec, context.source),
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
      const { resolveImageComparisonPair } = await import("../resources/comparison-resolve.ts");
        return imagePresentation(await resolveImageComparisonPair(plan.reference, plan.foreground, context.source));
      },
    },
  });
  registerReactPlotType({ definition, backends });
}
