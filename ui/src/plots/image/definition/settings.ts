export type ImageSettingKey =
  | "image.view"
  | "image.encoding"
  | "image.tonemapGamma"
  | "image.peak"
  | "image.exposureEV"
  | "image.offset"
  | "image.reduce"
  | "image.colorRange"
  | "image.channelSelect"
  | "compare.operation"
  | "compare.flipMode"
  | "compare.split"
  | "panel.info";

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
  { key: "image.peak", label: "Peak", control: "slider" },
  { key: "image.reduce", label: "Channel reduction", control: "choice" },
  { key: "image.colorRange", label: "Range", control: "slider" },
  { key: "image.channelSelect", label: "Channels", control: "choice" },
  { key: "compare.operation", label: "Comparison", control: "choice" },
  { key: "compare.flipMode", label: "FLIP range", control: "choice" },
  { key: "compare.split", label: "Split", control: "slider" },
  { key: "panel.info", label: "Information", control: "toggle" },
];
