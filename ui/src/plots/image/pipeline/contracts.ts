/** Values produced before display mapping. Neither texture ownership nor a
 * concrete GPU API crosses this semantic boundary. */
export interface ImageFieldDescriptor {
  readonly width: number;
  readonly height: number;
  readonly channels: number;
  readonly format: "u8" | "f16" | "f32";
}

export type FieldCachePolicy = "never" | "global-lru";

/** Sources -> image field. Cache policy is execution metadata on the operation,
 * not a different operation interface and never a display concern. */
export interface ImageFieldOperationDeclaration {
  readonly id: string;
  readonly inputCount: number;
  readonly cachePolicy: FieldCachePolicy;
}

/** Image field -> three display channels. Linear, ACES, Turbo and LUT-backed
 * mappings all implement this same contract; auxiliary resources are private to
 * their backend implementation. */
export interface ImageDisplayOperationDeclaration {
  readonly id: string;
  readonly supportedChannels: readonly number[];
}

/** Backend-private compiled work. A display operation may produce any number of
 * passes and leases without exposing whether it uses a LUT or analytic code. */
export interface PreparedKernelSequence<TPass = unknown, TLease = unknown> {
  readonly passes: readonly TPass[];
  readonly leases: readonly TLease[];
}
