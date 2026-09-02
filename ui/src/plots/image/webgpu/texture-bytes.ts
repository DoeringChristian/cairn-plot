import type { Texture, TextureFormat } from "./device/device-contract.ts";

const BYTES_PER_TEXEL: Readonly<Record<TextureFormat, number>> = {
  rgba8unorm: 4,
  rgba16float: 8,
  rgba32float: 16,
  r32float: 4,
};

/** Exact logical texel storage for an uncompressed source/result texture. */
export function textureByteLength(width: number, height: number, format: TextureFormat): number {
  if (!Number.isInteger(width) || width < 0 || !Number.isInteger(height) || height < 0) {
    throw new Error("cairn-plot: texture dimensions must be non-negative integers");
  }
  return width * height * BYTES_PER_TEXEL[format];
}

export function textureBytes(texture: Pick<Texture, "width" | "height" | "format">): number {
  return textureByteLength(texture.width, texture.height, texture.format);
}
