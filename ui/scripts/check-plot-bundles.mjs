#!/usr/bin/env node
/**
 * Bundle-CONTENT + SIZE guard for the plot-inline IIFE split (addon-fold
 * ruling 2026-08-26: `gpu-image` lives in core; `three` and `figure` remain
 * addons because they are genuinely heavy).
 *
 * Before this script the split was enforced by comment discipline alone —
 * one stray static import could silently pull three/Plotly into every emitted
 * page with nothing failing. This asserts, on the BUILT artifacts:
 *   1. `core.iife.js` contains neither three.js nor Plotly markers.
 *   2. `three.iife.js` contains no Plotly markers.
 *   3. Each bundle stays under a size ceiling (generous headroom over the
 *      current build — the point is catching a whole-library leak, not
 *      normal growth; bump deliberately when a real feature lands).
 *
 * Run after `npm run build:plot-inline` (CI: `npm run check:plot-bundles`).
 */
import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dist = join(dirname(fileURLToPath(import.meta.url)), "..", "dist", "plot-inline");

// Marker strings that survive minification (library identifiers, not comments).
const THREE_MARKERS = ["THREE.WebGLRenderer", "OrbitControls", "isBufferGeometry"];
const PLOTLY_MARKERS = ["plotly.js", "Plotly.newPlot", "_fullLayout"];

const CEILINGS = {
  "core.iife.js": 2.6 * 1024 * 1024,
  "three.iife.js": 1.0 * 1024 * 1024,
  "figure.iife.js": 5.5 * 1024 * 1024,
};

let failed = false;
const fail = (msg) => {
  failed = true;
  console.error(`✗ ${msg}`);
};
const ok = (msg) => console.log(`✓ ${msg}`);

function assertAbsent(file, markers, label) {
  const text = readFileSync(join(dist, file), "utf8");
  const hit = markers.find((m) => text.includes(m));
  if (hit) fail(`${file} contains a ${label} marker ("${hit}") — the bundle split leaked`);
  else ok(`${file} carries no ${label}`);
}

for (const [file, ceiling] of Object.entries(CEILINGS)) {
  const size = statSync(join(dist, file)).size;
  if (size > ceiling) {
    fail(
      `${file} is ${(size / 1048576).toFixed(2)} MB > ceiling ${(ceiling / 1048576).toFixed(2)} MB ` +
        "— a library leaked in, or bump the ceiling deliberately",
    );
  } else {
    ok(`${file} ${(size / 1048576).toFixed(2)} MB ≤ ${(ceiling / 1048576).toFixed(2)} MB`);
  }
}

assertAbsent("core.iife.js", THREE_MARKERS, "three.js");
assertAbsent("core.iife.js", PLOTLY_MARKERS, "Plotly");
assertAbsent("three.iife.js", PLOTLY_MARKERS, "Plotly");

if (failed) process.exit(1);
console.log("bundle split guard: all checks passed");
