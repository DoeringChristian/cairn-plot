import { resolveEffectiveTonemap, TONEMAP_GAMMA_DEFAULT } from "../../plots/image/model/tonemap.ts";
import type { ViewportSettings } from "./viewport-settings.ts";

interface InitialSettingsNode {
  kind: string;
  mode?: string;
  diffSubmode?: string;
  props?: Record<string, unknown>;
}

interface InitialSettingsShared {
  colormap?: string;
  colorRange?: [number, number];
}

/** Materialize authored values exactly once when a render surface forms. */
export function initialViewportSettings(
  node: InitialSettingsNode,
  shared: InitialSettingsShared | undefined,
): ViewportSettings {
  const props = node.props ?? {};
  const authored = props.settings as ViewportSettings | undefined;
  const settings: ViewportSettings = {
    "image.view": {
      zoom: typeof props.zoom === "number" ? props.zoom : 1,
      pan:
        props.pan && typeof props.pan === "object"
          ? (props.pan as { x: number; y: number })
          : { x: 0, y: 0 },
    },
    "image.encoding": resolveEffectiveTonemap(props.tonemap as string | undefined, false),
    "image.tonemapGamma":
      typeof props.gamma === "number" && props.gamma > 0
        ? props.gamma
        : TONEMAP_GAMMA_DEFAULT,
    "image.exposureEV": 0,
    "image.offset": 0,
    "image.colorRange": null,
    "panel.info": null,
  };
  const authoredColormap = props.colormap ?? shared?.colormap;

  if (typeof authoredColormap === "string" && authoredColormap !== "none") {
    settings["image.encoding"] = authoredColormap === "viridis" ? "turbo" : authoredColormap;
  }
  if (shared?.colorRange) {
    settings["image.colorRange"] = { min: shared.colorRange[0], max: shared.colorRange[1] };
  }
  if (node.kind === "compare") {
    const mode = node.mode === "diff" ? "diff" : "split";
    const difference = (props.diffSubmode as string | undefined) ?? node.diffSubmode ?? "absolute";
    settings["compare.operation"] = mode === "split" ? "split" : difference;
    settings["compare.split"] = typeof props.splitPosition === "number" ? props.splitPosition : 0.5;
  }

  // The explicit settings object is the canonical authored form. Legacy
  // descriptor props above are compatibility inputs only.
  Object.assign(settings, authored ?? {});
  return settings;
}
