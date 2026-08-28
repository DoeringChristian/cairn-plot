import { lazy } from "react";

import { registerRenderer } from "../plot-registry.tsx";
import { registerCoreRenderers } from "../plot-renderers.tsx";

let registered = false;

/** Register the complete browser renderer set without exposing the registry. */
export function ensurePublicRenderers(): void {
  if (registered) return;
  registered = true;
  registerCoreRenderers();
  registerRenderer(
    "figure",
    lazy(() => import("../plot-figure-renderer.tsx").then((module) => ({ default: module.FigureStandalone }))),
  );
  registerRenderer(
    "pointcloud",
    lazy(() => import("../plot-three-renderers.tsx").then((module) => ({ default: module.PointCloudStandalone }))),
  );
  registerRenderer(
    "mesh",
    lazy(() => import("../plot-three-renderers.tsx").then((module) => ({ default: module.MeshStandalone }))),
  );
  registerRenderer(
    "volume",
    lazy(() => import("../plot-three-renderers.tsx").then((module) => ({ default: module.VolumeStandalone }))),
  );
  registerRenderer(
    "boxes3d",
    lazy(() => import("../plot-three-renderers.tsx").then((module) => ({ default: module.BoxesStandalone }))),
  );
}
