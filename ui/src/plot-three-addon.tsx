/**
 * The OFFLINE **three.js 3D addon** inline-bundle entry (O2 bundle-split, G3) —
 * compiled by `vite.plot-three.config.ts` into the self-contained
 * `dist/plot-inline/three.iife.js`. Python emits it (include-once, guarded by
 * `window.__cairnPlotThreeLoaded`) ONLY for a 3D element (pointcloud/mesh/
 * volume/boxes3d), so a 2D/table/image plot never carries three.js.
 *
 * It bundles `three` (~600K) + the 3D standalone adapters, then registers them
 * into the already-installed core bootstrap via
 * `window.__cairnPlotRegisterRenderer(name, …)`. `react` + `react/jsx-runtime`
 * are EXTERNAL and mapped to core's `window.__cairnPlotReact` /
 * `__cairnPlotJsxRuntime`, so the addon reuses core's single React copy
 * (required for hooks — see `plot-core-main.tsx` / the figure addon). This is
 * the SAME generic addon shape as `plot-figure-addon.tsx`.
 *
 * It wires ALL FOUR 3D renderers: `pointcloud` (G3a) + `mesh` / `volume` /
 * `boxes3d` (G3b). They share the one bundled `three` copy, so a 3D element of
 * any type triggers this single addon include-once.
 */
import { threePlotBackends } from "./plots/three/backends.ts";

if (!window.__cairnPlotThreeLoaded) {
  if (typeof window.__cairnPlotRegisterBackends === "function") {
    const backends = threePlotBackends();
    window.__cairnPlotRegisterBackends("pointcloud", [backends.pointcloud]);
    window.__cairnPlotRegisterBackends("mesh", [backends.mesh]);
    window.__cairnPlotRegisterBackends("volume", [backends.volume]);
    window.__cairnPlotRegisterBackends("boxes3d", [backends.boxes3d]);
    window.__cairnPlotThreeLoaded = true;
  } else {
    // Core must run first (Python emits it before this addon). If it somehow
    // hasn't, fail loud in the console rather than silently no-op.
    console.error(
      "cairn-plot three addon: core bundle not installed " +
        "(window.__cairnPlotRegisterBackends missing) — 3D plots will not render.",
    );
  }
}
