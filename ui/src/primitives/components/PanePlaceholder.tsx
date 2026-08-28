// ---------------------------------------------------------------------------
// PanePlaceholder — the SINGLE non-content state chip shared by every 3D
// viewport (mesh/pointcloud/boxes/volume). It owns ALL styling/layout for the
// three placeholder states so they are pixel-identical everywhere:
//
//   - "empty"   — nothing logged yet ("no mesh logged yet", etc.).
//   - "loading" — waiting on a compare pair (animated pulse).
//   - "error"   — a hard mismatch that blocks rendering (topology/shape, or
//                 "no property values to diff") — boxed, padded, centered text.
//
// This unifies ~20 copy-pasted sites across the four viewport files. It also
// FIXES a real inconsistency: the reference-side "empty" state used to drop
// `w-full`, so it centered differently from the primary-side "empty". Here
// `w-full` is ALWAYS present — every state centers identically.
// ---------------------------------------------------------------------------

export type ViewportPlaceholderVariant = "empty" | "loading" | "error";

const BASE = "flex h-full w-full items-center justify-center";

/** The exact class contract per variant. Exported so the contract can be
 *  asserted without a DOM (see `viewport-dedup.test.ts`) and so it is the ONE
 *  source of truth for the placeholder styling. */
export const VIEWPORT_PLACEHOLDER_CLASS: Record<ViewportPlaceholderVariant, string> = {
  empty: `${BASE} text-sm text-fg-muted`,
  loading: `${BASE} text-sm text-fg-muted motion-safe:animate-pulse`,
  error: `${BASE} rounded bg-bg p-4 text-center text-sm text-fg-muted`,
};

export default function PanePlaceholder({
  variant,
  children,
}: {
  variant: ViewportPlaceholderVariant;
  children: React.ReactNode;
}) {
  return <div className={VIEWPORT_PLACEHOLDER_CLASS[variant]}>{children}</div>;
}
