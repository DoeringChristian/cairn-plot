/**
 * ONE source for the content-kind DISPLAY-ENCODING sync rule shared by all three
 * image panes — `GpuImagePane`, and `CpuImagePane`'s SDR + HDR faces (M4). The
 * "don't adopt a diff peer's scalar-error colormap onto a light pane" rule (the
 * orange-frame fix) previously existed as THREE hand-copies whose predicate diverged
 * AND gated on three different notions of "diff":
 *   - GpuImagePane: a boolean `diffMode` (the Phase-2c concept).
 *   - CpuImagePane SDR: a legacy `DiffMode` string enum (`diffMode !== "none"`).
 *   - CpuImagePane HDR: unconditional (`patch.compareMode !== "diff"`), correct only
 *     by accident because that pane can never be a diff face.
 * A sync fix added to one silently missed the other two. This module collapses them
 * onto ONE boolean capability parameter — `isDiffFace` — so the rule, the scoped
 * encoding adoption, and the publisher FACE tag each exist exactly once.
 */
import type { ImageSyncSettings } from "../viewport/image-settings-sync";

/** The content-kind scoping predicate. A DIFF peer's SCALAR-ERROR display encoding is
 *  tagged `compareMode:"diff"`; adopting it onto a pane rendering LIGHT content
 *  false-colors the light image through the diff's colormap (the reported orange
 *  frame). So a pane that is NOT itself a diff face ignores a diff-tagged encoding.
 *  `isDiffFace` is the ONE capability that used to be spelled three ways. */
export function shouldAdoptDisplayEncoding(
  patch: ImageSyncSettings,
  isDiffFace: boolean,
): boolean {
  return !(patch.compareMode === "diff" && !isDiffFace);
}

/** Applies a peer's SCOPED display-encoding keys (`encoding` | `colormap` | `tonemap`)
 *  to the pane's ONE encoding store, honoring {@link shouldAdoptDisplayEncoding}. The
 *  unified `encoding` id is primary; `colormap`/`tonemap` are back-compat (a
 *  pre-registry compare peer publishes those, not `encoding`). Single source for all
 *  three panes' `applyRemoteSettings` — the unconditional display keys
 *  (exposure/offset/peak/gamma/reduce/bounds) and the diff kernel stay pane-local
 *  because they are genuine per-capability differences, not copies. */
export function adoptRemoteDisplayEncoding(
  setEncoding: (id: string) => void,
  patch: ImageSyncSettings,
  isDiffFace: boolean,
): void {
  if (!shouldAdoptDisplayEncoding(patch, isDiffFace)) return;
  if (patch.encoding !== undefined) setEncoding(patch.encoding);
  else if (patch.colormap !== undefined && patch.colormap !== "none") setEncoding(patch.colormap);
  else if (patch.tonemap !== undefined) setEncoding(patch.tonemap);
}

/** The FACE tag a pane stamps on its SCOPED display publishes (M3): a diff face tags
 *  `compareMode:"diff"` (a light peer scopes it out; the bus's mode-aware merge keeps
 *  the snapshot coherent under a later image write), an image/light face carries no
 *  tag (every peer adopts it). ONE source so the three panes' publishers can't drift. */
export function diffFaceTag(isDiffFace: boolean): { compareMode?: "diff" } {
  return isDiffFace ? { compareMode: "diff" } : {};
}
