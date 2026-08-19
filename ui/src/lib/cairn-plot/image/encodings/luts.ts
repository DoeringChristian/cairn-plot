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
 * `displayRange` + diverging fold), not on these float-image entries. Phase 4
 * added the DATA norms + bounds: an entry now declares `exposure`/`offset`
 * (sensitivity) + `min`/`max` (the bounds skin) + `norm` (linear/log/power), and
 * the `cpu` twin threads the scalar through `computeDataIndex` before the LUT.
 */
import {
  registerEncoding,
  clamp01,
  computeDataIndex,
  reduceToScalar,
  defaultReduceMode,
  signedAnalyticColor,
  turboDataIndex,
  DEFAULT_ENCODE_PARAMS,
  type DisplayEncoding,
} from "./registry.ts";
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

/** The analytic entry computes its color directly — the WGSL twin is the shared
 *  family call (`LUT_FAMILY_WGSL`'s `cairnSignedAnalyticColor`), whose result the
 *  isScalar path runs through output-encode (NOT written unchanged). Held as the
 *  entry's `wgsl` so the registry's "non-empty wgsl" invariant holds. */
const ANALYTIC_WGSL_REF = "cairnSignedAnalyticColor(scalar)";

/** The TURBO entry binds its table like an ordinary LUT — the WGSL twin is the
 *  shared family call, but the isScalar path indexes it at `cairnTurboDataIndex`
 *  (scalar-mode 3) instead of `cairnDataIndex`. Held as the entry's `wgsl` for the
 *  registry's "non-empty wgsl" invariant + to document the family. */
const TURBO_WGSL_REF = "cairnLutColor(lut, cairnTurboDataIndex(scalar), /*cmapMode*/ 0, filterLinear)";

/** CPU twin of the LUT family: the (reduced) scalar → the DISPLAY (sRGB) colormap
 *  color in `[0,1]`. The k>1 sample is first collapsed to a scalar by
 *  {@link reduceToScalar} (the multi-channel follow-up: luminance / mean over the
 *  color channels), then the LUT INDEX runs through {@link computeDataIndex} (the
 *  norm reshape + optional min/max bounds affine — the shared CPU source of truth
 *  the WGSL `cairnDataIndex` mirrors). At k=1 `reduceToScalar` returns `v[0]`
 *  unchanged, so with DEFAULT params (norm `linear`, no bounds) the scalar passes
 *  straight through — byte-identical to the pre-follow-up behavior. `reduce`
 *  defaults to the k-based mode ({@link defaultReduceMode}) when unset. */
function lutCpu(name: string): DisplayEncoding["cpu"] {
  return (v, k, p = DEFAULT_ENCODE_PARAMS) => {
    const scalar = reduceToScalar(v, k, p.reduce ?? defaultReduceMode(k));
    const idx = computeDataIndex(scalar, p);
    const [r, g, b] = sampleLutByte(getColormapLUT(name as never), clamp01(idx));
    return [r / 255, g / 255, b / 255];
  };
}

/** The ANALYTIC colormaps (tev-style signed error) — computed per value, NO LUT
 *  bind. `red-green` ports tev's POS_NEG (negative → red, positive → green,
 *  amplitude `2*|v|`, UNCLAMPED linear). Same `id` as the retired LUT entry so
 *  descriptors / back-compat aliases / sync keys keep working; `analytic:true`
 *  (not `needsLut`) routes the GPU to `cairnSignedAnalyticColor` + the shared
 *  output-encode (surviving >1 on the HDR surface) instead of a texture sample —
 *  see {@link DisplayEncoding.analytic}. Declares exposure/offset (sensitivity =
 *  amplitude scaling) + reduce (k>1 collapse), NOT norm/min/max (an unbounded
 *  signed map has no log/power or normalize-to-[0,1] skin). */
const ANALYTIC_LUT_IDS = new Set<string>(["red-green"]);

/** The TURBO false-color colormap (the tev-exact follow-up) — a table-backed LUT
 *  whose INDEX is tev's FIXED log2 mapping ({@link turboDataIndex}) BAKED into the
 *  encoding (not the user-facing norm path). `turbo:true` routes the GPU to
 *  scalar-mode 3 (`cairnTurboDataIndex` before the LUT sample); it declares NO
 *  norm/min/max (the log2 is intrinsic) and defaults `reduce` to `mean` (tev
 *  averages RGB). Exposure/offset apply BEFORE the log2 (sliding along the ramp). */
const TURBO_LUT_IDS = new Set<string>(["turbo"]);

/** CPU twin of the TURBO entry: the (reduced, exposure/offset-adjusted) scalar →
 *  tev's FIXED log2 index → the DISPLAY (sRGB) turbo color in `[0,1]`. The k>1
 *  sample is collapsed to a scalar first; the turbo entry defaults `reduce` to
 *  `mean` (tev's RGB average), NOT the k-based {@link defaultReduceMode}. */
function turboCpu(): DisplayEncoding["cpu"] {
  return (v, k, p = DEFAULT_ENCODE_PARAMS) => {
    const scalar = reduceToScalar(v, k, p.reduce ?? "mean");
    const idx = turboDataIndex(scalar);
    const [r, g, b] = sampleLutByte(getColormapLUT("turbo" as never), clamp01(idx));
    return [r / 255, g / 255, b / 255];
  };
}

/** CPU twin of an analytic entry: the (reduced, exposure/offset-adjusted) signed
 *  scalar → the SCENE-LINEAR analytic color (UNCLAMPED, pre-output-encode — the
 *  caller runs it through outputEncode/extendedOutputEncode, exactly like a
 *  curve). At k=1 `reduceToScalar` returns `v[0]`; k>1 collapses per `reduce`. */
function analyticCpu(): DisplayEncoding["cpu"] {
  return (v, k, p = DEFAULT_ENCODE_PARAMS) => {
    const scalar = reduceToScalar(v, k, p.reduce ?? defaultReduceMode(k));
    return signedAnalyticColor(scalar);
  };
}

/** The colormaps as registry encodings, in `COLORMAP_NAMES` (canonical) order so
 *  `listEncodingsByKind("lut")` matches the colormap menu order. `red-green` is
 *  the ANALYTIC entry (computed, no LUT bind); the rest are table-backed LUTs. */
export const LUT_ENCODINGS: DisplayEncoding[] = COLORMAP_NAMES.map((name, i) =>
  TURBO_LUT_IDS.has(name)
    ? {
        id: name,
        label: COLORMAP_LABELS[name],
        kind: "lut", // COLORMAPS menu section; gates as a DATA encoding.
        arities: [1, 2, 3, 4],
        needsLut: true,
        turbo: true,
        // Sensitivity (exposure slides along the ramp BEFORE the log2) + offset +
        // the k>1 reduce (default `mean`, tev's RGB average). NO norm/min/max — the
        // log2 index is BAKED into the encoding (see TURBO_LUT_IDS / turboDataIndex).
        params: ["exposure", "offset", "reduce"],
        operatorId: LUT_OPERATOR_ID_BASE + i,
        lutName: name,
        wgsl: TURBO_WGSL_REF,
        cpu: turboCpu(),
      }
    : ANALYTIC_LUT_IDS.has(name)
    ? {
        id: name,
        label: COLORMAP_LABELS[name],
        kind: "lut", // COLORMAPS menu section; gates as a DATA encoding.
        arities: [1, 2, 3, 4],
        // NO needsLut / lutName — the color is COMPUTED, not sampled.
        analytic: true,
        // Sensitivity (exposure scales the error amplitude) + offset + the k>1
        // reduce. NO norm/min/max (see ANALYTIC_LUT_IDS doc).
        params: ["exposure", "offset", "reduce"],
        operatorId: LUT_OPERATOR_ID_BASE + i,
        wgsl: ANALYTIC_WGSL_REF,
        cpu: analyticCpu(),
      }
    : {
        id: name,
        label: COLORMAP_LABELS[name],
        kind: "lut",
        // Colormaps map the selected channels → RGB. The follow-up makes them legal
        // at EVERY k∈[1,4]: a k>1 sample is REDUCED to a scalar (luminance/mean)
        // before the LUT (see `reduce` below + `reduceToScalar`), so a colormap is
        // offered on RGB / RGBA sources too, not only isolated scalars.
        // usePaneEncoding gates the menu by this arity set.
        arities: [1, 2, 3, 4],
        needsLut: true,
        // The DATA encoding declares the sensitivity skin (exposure/offset), the
        // bounds skin (min/max — the ALTERNATIVE affine, shown only when the
        // descriptor seeds a colorRange), and the multi-channel `reduce`
        // (luminance/mean — shown only at k>1). All are UI-gating metadata; the
        // pipeline reads uniforms directly. (The `norm` picker was removed — the
        // engine `cairnDataIndex`/`u_bind9` norm machinery stays but is unused
        // UI-side; the manifest no longer declares it — norm-UI-removal follow-up.)
        params: ["exposure", "offset", "min", "max", "reduce"],
        operatorId: LUT_OPERATOR_ID_BASE + i,
        lutName: name,
        wgsl: LUT_FAMILY_WGSL_REF,
        cpu: lutCpu(name),
      },
);

let registered = false;
export function registerLutEncodings(): void {
  if (registered) return;
  registered = true;
  for (const e of LUT_ENCODINGS) registerEncoding(e);
}
