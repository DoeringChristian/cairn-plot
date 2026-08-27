import type { ComponentType } from "react";

import { createReactRendererPlugin } from "../../../packages/react/src/react-renderer-plugin.tsx";
import type { SettingsPatch, SourceSpec } from "../../../packages/spec/src/spec.ts";
import type { DataSpec } from "../../../ui/src/plot-descriptor.ts";
import { resolveDataProps } from "../../../ui/src/plot-descriptor.ts";
import { getRenderer } from "../../../ui/src/plot-registry.tsx";
import type { DataSource } from "../../../ui/src/lib/cairn-plot/store/data-sources.ts";

function legacyProps(settings: SettingsPatch): Record<string, unknown> {
  return {
    encoding: settings["image.encoding"],
    exposureEV: settings["image.exposureEV"],
    offset: settings["image.offset"],
    colorRange: settings["image.colorRange"],
    view: settings["image.view"],
    channelSelect: settings["image.channelSelect"],
    infoPanel: settings["panel.info"],
  };
}

/**
 * First migration adapter: the existing image React renderer participates in
 * the plugin runtime without moving or rewriting its rendering internals.
 * Delete after the image implementation moves to render-core/render-gpu.
 */
export function createLegacyImagePlugin(source: DataSource) {
  return createReactRendererPlugin<Record<string, unknown>>({
    kind: "image",
    component: () => getRenderer("image") as ComponentType<Record<string, unknown>> | undefined,
    async resolve(sources: SourceSpec[]) {
      const data = sources[0] as unknown as DataSpec;
      return resolveDataProps(data, source);
    },
    props(pane, resolved, settings) {
      return { ...pane.props, ...resolved, ...legacyProps(settings) };
    },
  });
}
