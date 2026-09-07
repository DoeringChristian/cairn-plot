/**
 * The ONE pane DISPLAY-encoding resolution: raw store id + authored seed +
 * active-backend capabilities → what renders, what to report, whether the cell
 * is off HOME.
 *
 * Kept OUT of `display-operation.ts`'s hook so the rule is reachable without a
 * React tree (`pane-encoding.test.ts` exercises the identical function
 * `usePaneEncoding` calls). Two invariants live here:
 *
 *   - The capability projection is READ-TIME ONLY. `effective` may differ from
 *     the raw id, but the raw id is what the settings store holds and what every
 *     write callback reasons about; nothing here writes it back.
 *   - `modified` compares the RAW id to the seed, NEVER the projected one. A
 *     user selection that happens to fall back onto the seed (`aces` → `srgb` on
 *     a backend without ACES) is still a user selection.
 *
 * Pure and backend-agnostic: it takes the capability probe, never a backend
 * object.
 */
import { projectDisplayOperation, type CapabilityFallback, type DisplayOperationSupport } from "../definition/core.ts";

export interface PaneEncodingInput {
  /** The RAW store id (`settings["image.encoding"]`), or the bootstrap seed. */
  readonly rawId: string;
  /** The authored HOME encoding at this arity, resolved catalogue-level. */
  readonly seedId: string;
  /** The ACTIVE backend's display-capability probe. */
  readonly capabilities: DisplayOperationSupport;
}

export interface PaneEncodingResolution {
  /** What actually renders: `rawId`, or the core fallback when unsupported. */
  readonly effective: string;
  /** The substitution to report as a chip, when one happened. */
  readonly fallback: CapabilityFallback | null;
  /** True when the RAW id differs from the authored seed. */
  readonly modified: boolean;
}

export function resolvePaneEncoding(input: PaneEncodingInput): PaneEncodingResolution {
  const { rawId, seedId, capabilities } = input;
  const { effective, fallback } = projectDisplayOperation(rawId, capabilities);
  return { effective, fallback, modified: rawId !== seedId };
}
