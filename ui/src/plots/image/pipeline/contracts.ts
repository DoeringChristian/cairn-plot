/** Values produced before display mapping. Neither texture ownership nor a
 * concrete GPU API crosses this semantic boundary. */
export interface ImageFieldDescriptor {
  readonly width: number;
  readonly height: number;
  readonly channels: number;
  readonly format: "u8" | "f16" | "f32";
}

export type FieldCachePolicy = "never" | "global-lru";

/** Backend-private compiled work. A display operation may produce any number of
 * passes and leases without exposing whether it uses a LUT or analytic code. */
export interface PreparedKernelSequence<TPass = unknown, TLease = unknown> {
  readonly passes: readonly TPass[];
  readonly leases: readonly TLease[];
}
