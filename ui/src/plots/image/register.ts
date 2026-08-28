import { createElement, type ComponentType } from "react";

import type { DataSpec } from "../../../../packages/spec/src/spec.ts";
import type { DataSource } from "../../lib/cairn-plot/store/data-sources.ts";
import type { ReactBackendProps, ReactPlotBackend } from "../../host/react-backend.ts";
import { definePlot, type SettingsRecord } from "../contracts.ts";
import { getPlotType } from "../registry.ts";
import { registerReactPlotType } from "../react-registry.ts";
import {
  planImageComparison,
  type ImageComparisonPlan,
} from "./comparison-plan.ts";

type ImageSpec = Extract<DataSpec, { kind: "inline" | "image" | "imghdr" | "url" }>;
type ImagePresentation = Record<string, unknown>;

function validateImageData(value: DataSpec): ImageSpec {
  if (value.kind === "inline" || value.kind === "image" || value.kind === "imghdr" || value.kind === "url") {
    return value;
  }
  throw new Error(`cairn-plot: image plot does not accept data kind ${JSON.stringify(value.kind)}`);
}

/** Register the existing proven ImageView as the first typed production kind. */
export function ensureImagePlotType(
  View: ComponentType<Record<string, unknown>>,
  resolve: (spec: ImageSpec, source: DataSource) => Promise<ImagePresentation>,
): void {
  if (getPlotType("image")) return;
  const backend: ReactPlotBackend<ImagePresentation, SettingsRecord> = {
    id: "image-react",
    family: "image",
    technology: "canvas2d",
    supports: () => ({ supported: true, priority: 1 }),
    canReuse: () => true,
    component({ input }: ReactBackendProps<ImagePresentation, SettingsRecord>) {
      return createElement(View, input.presentation);
    },
  };
  const definition = definePlot<
    ImageSpec,
    ImagePresentation,
    SettingsRecord,
    ImagePresentation,
    ImageComparisonPlan
  >({
    kind: "image",
    data: { validate: validateImageData },
    settings: {
      defaults: () => ({}),
      project: (settings) => ({ ...settings }),
    },
    resolve: (spec, context) => resolve(spec, context.source),
    present: (content) => content,
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
        return resolveImageComparisonPair(plan.reference, plan.foreground, context.source);
      },
    },
    // The current adapter is same-root React. Imperative image backends can be
    // added after renderer internals no longer depend on React lifecycle.
    backends: [],
  });
  registerReactPlotType({ definition, backends: [backend] });
}
