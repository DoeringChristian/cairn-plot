// ---------------------------------------------------------------------------
// RefBadge — the SINGLE "this pane is the reference/baseline" marker, shared by
// every compare pane: 2D image split/slide + side (media-compare) AND all four
// 3D compare types (mesh/pointcloud/boxes/volume). It owns ALL styling and
// positioning so the badge is pixel-identical (same element, same classes) and
// sits in the SAME corner in every mode.
//
// Position: TOP-LEFT, accent-tinted. This unifies three former divergent
// copies that caused the reported bug:
//   1. an accent top-left `<span>` (image split/slide) — duplicated verbatim in
//      compositor.tsx (CPU pane) AND GpuComparePane.tsx (GPU pane),
//   2. a GRAY, BOTTOM-LEFT `LabelChip label="REF"` (image `side` mode), and
//   3. a GRAY, BOTTOM-LEFT `LabelChip label="REF"` (every 3D compare viewport).
// (1) looked different from (2)/(3) AND sat in a different corner — the exact
// "inconsistent REF tag" complaint. Now every site renders THIS component.
//
// NOT shown in diff modes (a derived error map has no reference side) — that is
// a caller concern: every consumer gates the badge on being a genuine
// reference pane, so `RefBadge` itself is unconditional.
//
// `pointer-events-none`: the badge is a passive marker (never draggable, unlike
// `LabelChip`), so it must not intercept clicks/drags on the pane beneath it
// (image drag, 3D orbit). Mirrors the mesh-viewport metadata caption, the other
// top-left passive overlay.
// ---------------------------------------------------------------------------

/** The exact class contract for the reference badge — top-left, accent-tinted,
 *  pointer-transparent. Exported so the contract can be asserted without a DOM
 *  (see `ref-badge.test.ts`). */
export const REF_BADGE_CLASS =
  "absolute top-1 left-1 z-10 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent backdrop-blur-sm pointer-events-none select-none";

/** The badge label text. */
export const REF_BADGE_TEXT = "REF";

export default function RefBadge() {
  return <span className={REF_BADGE_CLASS}>{REF_BADGE_TEXT}</span>;
}
