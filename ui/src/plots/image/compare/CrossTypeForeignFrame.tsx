import { lazy, Suspense, useMemo } from "react";
import type { FrameSource } from "../../../backends/frame-source";
import type { ForeignFrameLoaders } from "./cross-type-frame";

/**
 * Renders a foreign 3D type's ONE resolved (hash, metadata) hidden, off
 * -screen, purely to capture a single offscreen snapshot via `onFrame` — the
 * bridge an IMAGE card's cross-type compare uses to get a comparable raster
 * out of a mesh/pointcloud/boxes3d/volume reference. Renders nothing visible
 * (the caller positions this off-screen, matching `OffscreenComparePanes`'
 * own hidden-viewer convention) and nothing at all while the chunk is still
 * loading (no flash of placeholder content — the parent card already shows
 * "normal" mode gracefully until `onFrame` first fires, exactly like any
 * other not-yet-resolved reference).
 *
 * The `loaders` registry is injected so this shell stays renderer-agnostic:
 * it knows how to lazy-mount + suspense-wrap a foreign-frame component, not
 * which concrete component any given `objectType` maps to (see
 * `cross-type-frame.ts` for the pure contract).
 */
export function CrossTypeForeignFrame({
  objectType,
  hash,
  metadata,
  onFrame,
  loaders,
}: {
  objectType: string;
  hash: string;
  metadata: string | null | undefined;
  onFrame: (f: FrameSource) => void;
  loaders: ForeignFrameLoaders;
}) {
  const Foreign = useMemo(() => {
    const loader = loaders[objectType];
    return loader ? lazy(() => loader().then((C) => ({ default: C }))) : null;
    // `loaders` is a stable module-level registry in practice; keying only on
    // `objectType` avoids re-minting the lazy component every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objectType]);

  if (!Foreign) return null;
  return (
    <Suspense fallback={null}>
      <Foreign hash={hash} metadata={metadata} onFrame={onFrame} />
    </Suspense>
  );
}

export default CrossTypeForeignFrame;
