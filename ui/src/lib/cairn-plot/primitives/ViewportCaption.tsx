// ---------------------------------------------------------------------------
// ViewportCaption — the SINGLE per-pane metadata caption chip shared by every
// 3D viewport (mesh/pointcloud/boxes/volume). It owns ALL styling and
// positioning so the caption is pixel-identical (same element, same classes)
// and sits in the SAME corner in every type.
//
// This unifies four former byte-identical copies of the same chip that had
// drifted (mesh's/volume's captions were dropped during the WS-VC5 migration
// and later restored inline; boxes kept its own copy; pointcloud never had
// one at all — a user-visible feature gap). Now every type renders THIS
// component and the pointcloud gap is closed.
//
// Position: TOP-LEFT, gray, pointer-transparent. Pinned top-left (NOT
// bottom-left) so it never collides with the bottom-left draggable `LabelChip`
// — both used to want that same corner. `pointer-events-none`: the caption is
// a passive marker (never draggable), so it must not intercept orbit/drag on
// the live viewer beneath it. Mirrors `RefBadge`, the other top-left passive
// overlay.
// ---------------------------------------------------------------------------

/** The exact class contract for the metadata caption — top-left, gray,
 *  monospace, pointer-transparent. Exported so the contract can be asserted
 *  without a DOM (see `viewport-dedup.test.ts`) and so it is the ONE source of
 *  truth for styling+position. */
export const VIEWPORT_CAPTION_CLASS =
  "pointer-events-none absolute left-1 top-1 z-10 mono rounded bg-bg/80 px-1 py-0.5 text-[10px] text-fg-subtle backdrop-blur-sm";

export default function ViewportCaption({ text }: { text: string }) {
  return <div className={VIEWPORT_CAPTION_CLASS}>{text}</div>;
}
