/**
 * The DATA-LUT display encodings (Phase 2) — the colormaps (viridis / plasma /
 * magma / red-green / red-blue) as `kind:"lut"` registry entries. A LUT encoding
 * is the DATA-side rival to a light-curve tone-map: it answers "how does ONE
 * scalar channel become RGB" by indexing a 256-entry colormap table.
 *
 * ## One family, tables not code
 * Unlike curves (each an inlined WGSL expression in the shared `applyOperator`
 * dispatch), colormaps are ONE shader family (`LUT_FAMILY_WGSL`'s `cairnLutColor`)
 * parameterized by the bound 256×1 texture. So an entry carries only a `lutName`
 * REFERENCE to its table (`colormaps/lut.ts`'s `COLORMAP_STOPS`), never texel
 * data or its own pipeline — adding a colormap is one `COLORMAP_STOPS` entry, and
 * these registry entries + the menus regenerate from it.
 *
 * ## Parity twin
 * `cpu` mirrors the GPU family for the FLOAT-image path (cmap-mode `linear`, the
 * sequential full ramp): clamp the (exposure/offset-adjusted) scalar to `[0,1]`,
 * round to a LUT row, read the DISPLAY (sRGB) color — the exact bytes the GPU
 * family samples and writes to the surface unchanged. The `encoding-registry`
 * parity harness renders a scalar float image through the image pass with each
 * colormap's table bound and compares to this twin.
 *
 * The diff-display blit reuses the SAME family for its `signed`/`positive` index
 * modes (see `engine/diff-engine.ts`); those live on the diff path (a kernel
 * `displayRange` + diverging fold), not on these float-image entries, whose
 * params are `exposure`/`offset` only until Phase 4 adds min/max + norms.
 */
import { registerEncoding, clamp01, type DisplayEncoding } from "./registry.ts";
import { COLORMAP_NAMES, COLORMAP_LABELS, getColormapLUT } from "../../colormaps/lut.ts";
import { sampleLutByte } from "../../colormaps/lut-sample.ts";

/** operatorId space: curves own 0–9 (see `curves.ts`); LUT entries take 10+.
 *  The id is never dispatched through `applyOperator` (the `isScalar` path
 *  short-circuits to the LUT family before it), but the registry requires every
 *  entry's operatorId to be a UNIQUE integer, so LUT ids stay disjoint. */
const LUT_OPERATOR_ID_BASE = 10;

/** The float-image LUT reads the DISPLAY color directly — the WGSL twin is the
 *  shared family call (`LUT_FAMILY_WGSL`), not a per-entry dispatch branch. Held
 *  as the entry's `wgsl` so the registry's "non-empty wgsl" invariant holds and
 *  the string documents which family the entry belongs to. */
const LUT_FAMILY_WGSL_REF = "cairnLutColor(lut, scalar, /*cmapMode*/ 0, filterLinear)";

/** CPU twin of the LUT family (cmap-mode `linear`): the (already exposure/offset-
 *  adjusted) scalar → the DISPLAY (sRGB) colormap color in `[0,1]`. */
function lutCpu(name: string): DisplayEncoding["cpu"] {
  return (v) => {
    const [r, g, b] = sampleLutByte(getColormapLUT(name as never), clamp01(v[0] ?? 0));
    return [r / 255, g / 255, b / 255];
  };
}

/** The colormaps as LUT encodings, in `COLORMAP_NAMES` (canonical) order so
 *  `listEncodingsByKind("lut")` matches the colormap menu order. */
export const LUT_ENCODINGS: DisplayEncoding[] = COLORMAP_NAMES.map((name, i) => ({
  id: name,
  label: COLORMAP_LABELS[name],
  kind: "lut",
  // Colormaps map ONE scalar channel → RGB; arity 1 only (Phase 3 gates this).
  arities: [1],
  needsLut: true,
  // Sensitivity params for now; min/max + norms are Phase 4.
  params: ["exposure", "offset"],
  operatorId: LUT_OPERATOR_ID_BASE + i,
  lutName: name,
  wgsl: LUT_FAMILY_WGSL_REF,
  cpu: lutCpu(name),
}));

let registered = false;
export function registerLutEncodings(): void {
  if (registered) return;
  registered = true;
  for (const e of LUT_ENCODINGS) registerEncoding(e);
}
