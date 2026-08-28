// ---------------------------------------------------------------------------
// compareCaptions — the ONE place that turns a compare pane's per-side image
// labels (captions) into the two chips it shows, by mode. Shared by the CPU
// `MediaComparePane` and the GPU `GpuComparePane` so both label identically:
//   - split: the REFERENCE caption bottom-LEFT, the FOREGROUND caption
//     bottom-RIGHT (the full-height divider passes over them as it slides);
//   - diff:          ONE bottom-LEFT caption "<metric> · <fg> compared to <ref>"
//     naming the error map, where <metric> is the active diff kernel's display
//     name. Missing side captions fall back to "image"/"reference".
// ---------------------------------------------------------------------------
import { listDiffMenuModes } from "../../../plots/image/engine/kernels";

export interface CompareCaptions {
  /** Bottom-LEFT chip: the reference caption (slide) OR the whole diff
   *  caption (diff). Undefined ⇒ render nothing. */
  left?: string;
  /** Bottom-RIGHT chip: the foreground caption (slide only). */
  right?: string;
}

/** The active diff kernel's human display name (the metric named in the diff
 *  caption), falling back to the raw id. */
export function diffMetricName(diffKernel: string | undefined): string {
  if (!diffKernel) return "";
  return listDiffMenuModes().find((k) => k.id === diffKernel)?.label ?? diffKernel;
}

export function compareCaptions(opts: {
  mode: string;
  diffKernel?: string;
  referenceLabel?: string;
  foregroundLabel?: string;
}): CompareCaptions {
  const { mode, diffKernel, referenceLabel, foregroundLabel } = opts;
  if (mode === "diff") {
    const metric = diffMetricName(diffKernel);
    const fg = foregroundLabel || "image";
    const ref = referenceLabel || "reference";
    const prefix = metric ? `${metric} · ` : "";
    return { left: `${prefix}${fg} compared to ${ref}` };
  }
  // split (and any non-diff composited mode): reference left, fg right.
  return { left: referenceLabel || undefined, right: foregroundLabel || undefined };
}
