/** One flat, namespaced settings vocabulary shared by every plot cell. */
export interface PlotSettings {
  "image.encoding"?: string;
  "image.tonemapGamma"?: number;
  "image.peak"?: number;
  "image.exposureEV"?: number;
  "image.offset"?: number;
  "image.reduce"?: string;
  "image.colorRange"?: { min: number; max: number } | null;
  "image.view"?: { zoom: number; pan: { x: number; y: number } };
  "image.channelSelect"?: { part?: number | string; layer?: string | string[] } | null;
  "compare.operation"?: string;
  "compare.flipMode"?: "hdr" | "sdr";
  "compare.split"?: number;
  "panel.info"?: boolean | null;
  "chart.domainX"?: [number, number] | null;
  "chart.domainY"?: [number, number] | null;
  "scene3d.camera"?: {
    position: [number, number, number];
    target: [number, number, number];
    zoom: number;
  };
}

export type PlotSettingKey = keyof PlotSettings;
