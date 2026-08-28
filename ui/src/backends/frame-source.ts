/** Rasterizable output accepted by image-space comparison backends. */
export type FrameSource =
  | { kind: "url"; url: string }
  | { kind: "canvas"; canvas: HTMLCanvasElement }
  | { kind: "dataUrl"; dataUrl: string };
