// ---------------------------------------------------------------------------
// The catalogue's REQUIRED CORE and the read-time fallback projection.
//
// `definition/` states what is generally supported (the hull the authoring
// side validates against). A backend advertises a subset of it by id. The
// authored settings are the default state; when the ACTIVE backend cannot
// render one of them, the view projects it — at read time, never into the
// settings store — onto a fallback that every backend must declare:
//   colormap  → turbo        curve / remap → srgb
//   comparison operation → split
// `defineImageBackendCapabilities` refuses a declaration missing the core, so
// the projection always lands on something the backend renders.
// ---------------------------------------------------------------------------

import { getDisplayOperation } from "./display-operations.ts";

/**
 * The slices of a backend capability object the projection reads. Declared
 * here rather than imported from `backend.ts` because definitions must not
 * depend on backends (plot-boundary rule); `ImageBackendCapabilities`
 * satisfies both structurally.
 */
export interface DisplayOperationSupport {
  supportsDisplayOperation(id: string): boolean;
}
export interface ImageOperationSupport {
  supportsImageOperation(id: string): boolean;
}

export const CORE_IMAGE_OPERATION_IDS = ["identity", "split"] as const;
export const CORE_DISPLAY_OPERATION_IDS = ["srgb", "turbo"] as const;

export const FALLBACK_COMPARISON_OPERATION = "split";

/** Colormaps fall back to turbo; curves, the normal remap and unknown ids to srgb. */
export function fallbackDisplayOperation(requestedId: string): "turbo" | "srgb" {
  return getDisplayOperation(requestedId)?.category === "colormap" ? "turbo" : "srgb";
}

/** One substitution the view made because the active backend lacks `requested`. */
export interface CapabilityFallback {
  readonly kind: "display" | "comparison";
  readonly requested: string;
  readonly effective: string;
}

export interface Projection {
  readonly effective: string;
  readonly fallback: CapabilityFallback | null;
}

export function projectDisplayOperation(
  requestedId: string,
  capabilities: DisplayOperationSupport,
): Projection {
  if (capabilities.supportsDisplayOperation(requestedId)) return { effective: requestedId, fallback: null };
  const effective = fallbackDisplayOperation(requestedId);
  return { effective, fallback: { kind: "display", requested: requestedId, effective } };
}

export function projectComparisonOperation(
  requestedId: string,
  capabilities: ImageOperationSupport,
): Projection {
  if (capabilities.supportsImageOperation(requestedId)) return { effective: requestedId, fallback: null };
  const effective = FALLBACK_COMPARISON_OPERATION;
  return { effective, fallback: { kind: "comparison", requested: requestedId, effective } };
}
