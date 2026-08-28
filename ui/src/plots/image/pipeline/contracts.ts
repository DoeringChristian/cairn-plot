/** Values produced before display mapping. Neither texture ownership nor a
 * concrete GPU API crosses this semantic boundary. */
export interface ImageFieldDescriptor {
  readonly width: number;
  readonly height: number;
  readonly channels: number;
  readonly format: "u8" | "f16" | "f32";
}

export type FieldCachePolicy = "never" | "global-lru";
