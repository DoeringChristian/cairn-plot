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
  { key: "compare.split", label: "Split", control: "slider" },
  { key: "panel.info", label: "Information", control: "toggle" },
];

/**
 * Read-side migration of the removed `compare.flipMode` setting.
 *
 * HDR FLIP used to be `compare.operation: "flip"` plus a separate range switch;
 * it is now the public operation `flip-hdr` in its own right. Sessions, saved
 * cell settings and descriptor props authored before the split still carry the
 * old pair, so every read path (the plot definition's `project`, the image
 * adapter's view, the descriptor settings seed) runs them through here. The
 * object is returned unchanged — same identity — when there is nothing to do,
 * so memoized settings stay stable across renders.
 */
export function migrateCompareSettings<T extends Record<string, unknown>>(settings: T): T {
  if (!("compare.flipMode" in settings)) return settings;
  const { "compare.flipMode": flipMode, ...rest } = settings as Record<string, unknown>;
  if (rest["compare.operation"] === "flip" && flipMode === "hdr") rest["compare.operation"] = "flip-hdr";
  return rest as T;
}
