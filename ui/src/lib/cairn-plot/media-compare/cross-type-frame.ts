import type { ComponentType } from "react";
import type { FrameSource } from "../host/types";

// ---------------------------------------------------------------------------
// WS-VC6 cross-type bridge — the pure (JSX-free) half of the "foreign 3D type"
// side of image<->3D compare. The React shell lives in `CrossTypeForeignFrame.tsx`.
//
// When an IMAGE card's resolved reference is a 3D type (mesh/pointcloud/
// boxes3d/volume), there is no existing machinery to turn that hash into a
// raster: unlike an image reference (trivially an artifact URL, no rendering
// needed), a 3D reference must be actually RENDERED by that type's own viewer
// to produce pixels. An image card has no idea how to construct a
// MeshViewer/PointCloudViewer/etc itself — that knowledge lives in each
// type's own card (the existing lazy-chunk boundary for `three`).
//
// cairn-plot owns the renderer-agnostic contract here (the `ForeignFrameProps`
// shape, the loader-registry types, and the `hasForeignFrameBridge` capability
// check); the concrete per-type loader registry (which lazy chunk to import
// for "mesh" vs "pointcloud" etc.) is INJECTED by the consumer — cairn-plot
// never hard-codes app chunk paths.
// ---------------------------------------------------------------------------

/** Props every type-specific foreign-frame component accepts: render the ONE
 *  resolved (hash, metadata) off-screen and report the captured raster once
 *  via `onFrame`. */
export interface ForeignFrameProps {
  hash: string;
  metadata: string | null | undefined;
  onFrame: (f: FrameSource) => void;
}

/** Lazily resolves a type-specific foreign-frame component (e.g. the app's
 *  `MeshForeignFrame`), co-located with that type's own blob-fetch/parse code
 *  so it shares the query cache rather than duplicating it. */
export type ForeignFrameLoader = () => Promise<ComponentType<ForeignFrameProps>>;

/** object_type → its lazy foreign-frame loader. Supplied by the consumer;
 *  cairn-plot itself never enumerates concrete types here. */
export type ForeignFrameLoaders = Record<string, ForeignFrameLoader>;

/** Whether `objectType` has a registered offscreen-render bridge in the given
 *  `loaders` registry. `false` for "image" (never needs this bridge) and any
 *  non-visual / unregistered type. */
export function hasForeignFrameBridge(objectType: string, loaders: ForeignFrameLoaders): boolean {
  return objectType in loaders;
}
