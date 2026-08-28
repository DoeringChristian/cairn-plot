import type { PlotSettings } from "../../../settings/schema.ts";

export type ImageSettingKey = keyof PlotSettings;

/** A semantic setting exposed by the image plot. Backends consume the resolved
 * value but never define whether the setting exists or how it is presented. */
export interface ImageSettingDefinition {
  readonly key: ImageSettingKey;
  readonly label: string;
  readonly control: "slider" | "choice" | "toggle" | "view";
}

export const IMAGE_SETTINGS: readonly ImageSettingDefinition[] = [
  { key: "image.view", label: "View", control: "view" },
  { key: "image.encoding", label: "Display", control: "choice" },
  { key: "image.exposureEV", label: "Exposure", control: "slider" },
  { key: "image.offset", label: "Offset", control: "slider" },
  { key: "image.tonemapGamma", label: "Gamma", control: "slider" },
  { key: "image.colorRange", label: "Range", control: "slider" },
  { key: "compare.operation", label: "Comparison", control: "choice" },
  { key: "compare.split", label: "Split", control: "slider" },
];
