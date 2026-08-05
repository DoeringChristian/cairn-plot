/**
 * HDR tone-mapping operators for the float-image path (cairn-plot HDR-A).
 *
 * PIPELINE (the HDR image renderer runs these in order, per pixel):
 *
 *   1. EXPOSURE   — `applyExposure(v, ev) = v * 2**ev`, in scene-linear space,
 *                   where `ev` is a stop count (EV). Applied to each channel
 *                   BEFORE tone-mapping.
 *   2. TONE-MAP   — one `TonemapOperator` (`TONEMAP_OPERATORS[name]`): maps the
 *                   exposure-applied scene-linear RGB in [0, ∞) down to
 *                   DISPLAY-LINEAR RGB in [0, 1]. Still LINEAR light — NOT yet
 *                   gamma/sRGB encoded.
 *   3. OUTPUT-ENCODE — `outputEncode(x, tonemap, gamma)`: the last step maps the
 *                   display-linear [0,1] value to a display-referred code value.
 *                   For `tonemap === "srgb"` this is the sRGB OETF; otherwise a
 *                   plain `pow(x, 1/gamma)` power curve (gamma defaults to 1 =
 *                   identity). This is deliberately SPLIT from the tone-map: the
 *                   operator only compresses HDR→[0,1]; the encode is a separate,
 *                   swappable stage.
 *
 * WHY THE SPLIT: "sRGB" and "gamma" are output *transfer functions*, not
 * tone-maps. Keeping them out of `TONEMAP_OPERATORS` means every operator
 * (linear/reinhard/aces/…) can be paired with any output encode, and adding a
 * new HDR operator is a ONE-LINE addition to `TONEMAP_OPERATORS` — it never has
 * to re-implement gamma/sRGB.
 *
 * ADDING AN OPERATOR: add a single entry to `TONEMAP_OPERATORS` below, e.g.
 *   uncharted2: (rgb) => rgb.map(uncharted2Curve) as RgbTriple,
 * and (optionally) widen the `TonemapOperator` union / Python `Literal`. No
 * other renderer/registry change is needed — `HdrImagePane` looks the operator
 * up by name at render time and falls back to `srgb` for an unknown key.
 *
 * PERF: these are plain scalar functions used in the CPU decode loop (v1).
 * The WebGPU engine (`engine/shaders/image.wgsl.ts`) ports the same operators
 * to a GPU fragment shader (see `HdrImagePane`'s module doc).
 */

import { clamp01 } from "../util/clamp.ts";

export type RgbTriple = [number, number, number];

/**
 * The extensible tone-map operator set. Each operator takes exposure-applied
 * scene-linear RGB in [0, ∞) and returns DISPLAY-LINEAR RGB in [0, 1]
 * (pre-gamma / pre-sRGB). Keep it a plain object so adding an operator is a
 * one-line addition (see module doc).
 */
export type TonemapOperator =
  | "linear"
  | "srgb"
  | "gamma" //             Gamma(γ) display transfer — pow(clamp01(x), 1/γ), tev-style
  | "reinhard"
  | "aces"
  // HDR-OUT family (selectable only when the extended surface engaged):
  | "extended" //          Extended · Linear           — unclamped pass-through
  | "extended-clamp" //    Extended · Linear (managed) — identity below P, hard ceiling at P
  | "extended-reinhard" // Extended · Reinhard         — peak/white-point roll-off
  | "extended-aces"; //    Extended · ACES             — ACES fit rescaled to the peak

/** Per-channel Reinhard tone curve: x / (1 + x). Maps [0,∞) → [0,1), 1 → 0.5. */
const reinhardCurve = (x: number): number => {
  const v = x < 0 ? 0 : x;
  return v / (1 + v);
};

/**
 * Narkowicz 2015 ACES filmic approximation, per channel, clamped to [0,1].
 * `(x*(2.51*x+0.03)) / (x*(2.43*x+0.59)+0.14)`. Monotonic on [0,∞); aces(0)=0.
 */
const acesCurve = (x: number): number => {
  const v = x < 0 ? 0 : x;
  const num = v * (2.51 * v + 0.03);
  const den = v * (2.43 * v + 0.59) + 0.14;
  return clamp01(num / den);
};

// ---------------------------------------------------------------------------
// HDR-OUT roll-off operators (the "extended" family). HDR-out-only: they emit
// DISPLAY-LINEAR light in [0, peak] (NOT [0,1]) so a real HDR surface
// (`rgba16float` + extended canvas tone-mapping) preserves values above SDR
// white while rolling the very brightest ones off toward the panel's headroom.
// `peak` is the white point in multiples of SDR white (the PEAK slider; default
// EXTENDED_TONEMAP_PEAK_DEFAULT). Ported verbatim into `engine/shaders/
// image.wgsl.ts`'s `applyOperator`; the GPU-vs-TS parity harness checks them.
// ---------------------------------------------------------------------------

/** Peak-white slider bounds (×SDR white). Default 4, range 1..16, step 0.5.
 *  FOLLOW-UP: a browser-exposed display headroom (once standardized) would seed
 *  the default; until then it is a fixed 4. */
export const EXTENDED_TONEMAP_PEAK_DEFAULT = 4;
export const EXTENDED_TONEMAP_PEAK_MIN = 1;
export const EXTENDED_TONEMAP_PEAK_MAX = 16;
export const EXTENDED_TONEMAP_PEAK_STEP = 0.5;

/**
 * Extended · Linear (MANAGED) with a display peak P: `y = min(max(x, 0), P)` —
 * a pure identity below `P` (slope exactly 1, values pass through unchanged) and
 * a HARD CEILING at `P`. Per channel, `x` pre-clamped to `[0,∞)`. Invariants
 * (tested): `y = x` exactly for `0 ≤ x ≤ P`; `y = P` exactly for `x ≥ P`;
 * monotone non-decreasing.
 *
 * This is the CROSS-BROWSER-DETERMINISTIC counterpart to `extended` (Extended ·
 * Linear): `extended` hands raw unclamped values to the browser/OS compositor,
 * which clips each unclamped value at ITS OWN estimate of display headroom — so
 * Chrome and Safari render the same HDR image differently. `extended-clamp`
 * instead does the clip in OUR shader at a shared `P` (the PEAK slider), so
 * every browser that honors extended tone mapping converges below `P`. It is
 * HDR-out like the other extended operators (emits display-linear light in
 * `[0, P]`); mirrored verbatim in `engine/shaders/image.wgsl.ts`'s
 * `extendedClampCurve` and checked by the GPU↔TS parity harness.
 */
export function extendedClampCurve(x: number, peak: number): number {
  const v = x < 0 ? 0 : x;
  return v > peak ? peak : v;
}

/**
 * Extended Reinhard with a display peak P: `y = x/(1 + x/P)` — the plain
 * Reinhard curve `x/(1+x)` rescaled so the ASYMPTOTE is `P` while the low-`x`
 * slope stays exactly 1. Per channel, `x` pre-clamped to `[0,∞)`. Invariants
 * (tested): monotonic increasing; `y ≈ x` for `x ≪ 1`; `y → P` as `x → ∞`.
 *
 * NOT the SDR white-point form `x·(1+x/P²)/(1+x)` (Reinhard et al. 2002,
 * eq. 4): that curve targets `x = P → 1` — an SDR-OUTPUT mapping — and dips
 * well below identity in the midrange (at P=4, `x=1 → 0.53`), visibly
 * darkening SDR-range content on an HDR display. For extended output the
 * ceiling must be `P`, not 1.
 */
export function extendedReinhardCurve(x: number, peak: number): number {
  const v = x < 0 ? 0 : x;
  return v / (1 + v / peak);
}

/**
 * ACES fit peak-parameterized as the CANONICAL curve scaled to a peak P:
 * `y = P · acesCurve(x / P)`, where `acesCurve` is the Narkowicz 2015 fit
 * (clamped to `[0,1]`). Per channel, `x` pre-clamped to `[0,∞)`.
 *
 * INVARIANT (the operator-family consistency rule): at `P = 1` this is
 * `1 · acesCurve(x/1) = acesCurve(x)` — the SDR ACES operator EXACTLY, so the
 * ONLY difference between the SDR and extended ACES is the peak `P` (the clip
 * point), tested by `tonemap.test.ts`'s P=1-equivalence goldens. It also
 * satisfies `y → P` as `x → ∞` (acesCurve saturates at 1, so `y → P·1 = P`)
 * and is monotone increasing.
 *
 * NOTE: this REPLACES the earlier `P · acesCurve(x · S / P)` form (with
 * `S = 0.14/0.03`), which normalized the low-`x` slope to exactly 1 but BROKE
 * the P=1 equivalence (`acesCurve(x·S) ≠ acesCurve(x)`). The `x/P` form keeps
 * the invariant exact at ALL `x` (SDR = extended at P=1 identically), sharing
 * the Narkowicz low-`x` slope (`acesCurve'(0) = 0.03/0.14`) between the SDR and
 * extended curves rather than a separate slope-1 normalization — which is what
 * "the only difference is the clip point P" means.
 */
export function extendedAcesCurve(x: number, peak: number): number {
  const v = x < 0 ? 0 : x;
  const p = peak > 0 ? peak : 1;
  return p * acesCurve(v / p);
}

export const TONEMAP_OPERATORS: Record<string, (rgb: RgbTriple) => RgbTriple> = {
  // Straight clamp — no tone compression, just clip to displayable range.
  linear: ([r, g, b]) => [clamp01(r), clamp01(g), clamp01(b)],
  // Identity tone-map: the HDR→[0,1] step is a clamp; the sRGB OETF is applied
  // by the OUTPUT-ENCODE stage (`outputEncode` with tonemap==="srgb").
  srgb: ([r, g, b]) => [clamp01(r), clamp01(g), clamp01(b)],
  // Gamma(γ) DISPLAY TRANSFER (tev "Gamma" mode): the RANGE-MAP step is the
  // SAME clamp to [0,1] (= extended-clamp / linear at P=1); the γ power curve
  // `pow(clamp01(x), 1/γ)` is applied by the OUTPUT-ENCODE stage instead of the
  // sRGB OETF. The renderer drives that by passing the `gamma` output-encode
  // parameter = γ ONLY when this operator is in effect (see
  // `resolveEncodeGamma`); for every other operator the encode is the sRGB OETF
  // (or identity for `linear`). So the operator function itself is the clamp,
  // exactly like `linear`/`srgb` — the γ lives in the encode stage, matching the
  // existing split (operator compresses, output-encode is the transfer).
  gamma: ([r, g, b]) => [clamp01(r), clamp01(g), clamp01(b)],
  // Reinhard, per-channel (v1 choice; luminance-based Reinhard is a possible
  // future operator). Naturally lands in [0,1) so the clamp is a no-op safety.
  reinhard: ([r, g, b]) => [reinhardCurve(r), reinhardCurve(g), reinhardCurve(b)],
  // ACES filmic (Narkowicz), per channel.
  aces: ([r, g, b]) => [acesCurve(r), acesCurve(g), acesCurve(b)],
  // Extended · Linear (HDR-out only): pure identity — no compression, no clamp.
  // Values stay in scene-linear [0, ∞) so a real HDR surface (`rgba16float`
  // + `toneMapping:{mode:'extended'}`, see `engine/webgpu/surface.ts`'s
  // `configureHDRSurface`) can preserve them past 1.0 — Chrome's `'extended'`
  // canvas tone-mapping mode expects EXACTLY this: the shader hands over raw
  // scene-referred values and the OS/display compositor (not this pipeline)
  // maps them to the panel's actual peak brightness. It is the DEFAULT effective
  // operator whenever a pane's true-HDR surface engages (`GpuImagePane`'s
  // `useHdr`), and heads the HDR menu group ("Extended · Linear/Reinhard/ACES")
  // offered ONLY on such a pane. The two ROLL-OFF siblings (extended-reinhard /
  // extended-aces) are NOT in this object — they take a `peak` parameter, so
  // they live as the standalone `extendedReinhardCurve`/`extendedAcesCurve`
  // functions above (and `applyTonemapOperatorTriple` dispatches all three).
  // Picking an SDR operator on an engaged pane instead tone-maps INTO SDR range
  // (previewing the SDR rendition on the HDR display) — the render path then
  // sets `hdrOut:false` so the output-encode stage runs. SDR panes never see any
  // extended operator (their pixels are already encoded 8-bit).
  extended: ([r, g, b]) => [r, g, b],
};

/** The default operator when none / an unknown key is supplied. */
export const DEFAULT_TONEMAP: TonemapOperator = "srgb";

/**
 * The user-selectable SDR tone-map operators — the TONEMAP toolbar menu's base
 * option group (always shown). The `extended*` operators are HDR-out-only and
 * excluded here; they form the separate {@link HDR_TONEMAP_OPERATORS} group,
 * appended to the menu only on a pane whose real HDR surface engaged.
 */
export const SDR_TONEMAP_OPERATORS: readonly TonemapOperator[] = [
  "linear",
  "srgb",
  "gamma",
  "reinhard",
  "aces",
];

/**
 * The DISPLAY-TRANSFER operators offered on an SDR / 8-bit image pane (menu
 * order: sRGB · Gamma · Linear). These are the pure encodes — each is a
 * RANGE-MAP clamp to `[0,1]` (`P=1`) paired with a transfer at the output-encode
 * stage: `srgb` → sRGB OETF (the DEFAULT, an identity round-trip for an
 * already-sRGB 8-bit source); `gamma` → `pow(x, 1/γ)`; `linear` → identity (raw
 * linear to the display). tev applies the same transfer selector to LDR images.
 * The compression operators (`reinhard`/`aces`) are NOT offered on an 8-bit pane
 * (its pixels are already in `[0,1]`), so this is a subset of
 * {@link SDR_TONEMAP_OPERATORS}. See `renderers/GpuImagePane`/`CpuImagePane` for
 * the sRGB-DECODE-first pipeline the 8-bit source runs through first.
 */
export const SDR_DISPLAY_TRANSFER_OPERATORS: readonly TonemapOperator[] = [
  "srgb",
  "gamma",
  "linear",
];

/**
 * The HDR-out tone-map operators (the "extended" family) — the menu's second
 * group, offered ONLY when the pane's real HDR surface engaged. Order is the
 * menu order: Linear · Linear (managed) · Reinhard · ACES — `extended-clamp`
 * (managed linear) sits next to `extended` because it is its cross-browser-
 * deterministic sibling (identity below P, hard ceiling at P in OUR shader).
 */
export const HDR_TONEMAP_OPERATORS: readonly TonemapOperator[] = [
  "extended",
  "extended-clamp",
  "extended-reinhard",
  "extended-aces",
];

/** The extended operators whose curve ROLLS OFF toward the peak (a soft
 *  shoulder): Reinhard/ACES. `extended-clamp` is peak-parameterized too but is a
 *  HARD clip, not a roll-off, so it is NOT here — see {@link EXTENDED_PEAK_OPERATORS}. */
export const EXTENDED_ROLLOFF_OPERATORS: readonly TonemapOperator[] = [
  "extended-reinhard",
  "extended-aces",
];

/** Every extended operator that READS the PEAK parameter — the roll-off pair
 *  PLUS `extended-clamp` (managed linear, whose ceiling IS the peak). Selecting
 *  any of these reveals the PEAK slider. `extended` (raw Linear) has no peak. */
export const EXTENDED_PEAK_OPERATORS: readonly TonemapOperator[] = [
  "extended-clamp",
  "extended-reinhard",
  "extended-aces",
];

/** True when `op` is an HDR-out operator (drives `hdrOut` + the menu group). */
export function isHdrTonemap(name: string | undefined | null): name is TonemapOperator {
  return !!name && (HDR_TONEMAP_OPERATORS as readonly string[]).includes(name);
}

/** True when the operator reads the PEAK parameter (extended-clamp/-reinhard/
 *  -aces), i.e. the PEAK slider should be visible. */
export function tonemapHasPeak(name: string | undefined | null): boolean {
  return !!name && (EXTENDED_PEAK_OPERATORS as readonly string[]).includes(name);
}

/** Each extended operator's SDR counterpart — the fallback used when a pane
 *  requests an HDR operator but the HDR surface does NOT engage. */
const EXTENDED_TO_SDR: Record<string, TonemapOperator> = {
  extended: "linear",
  // Managed linear degrades to the plain SDR clamp01 (`linear`): its natural
  // SDR counterpart — a hard clip into [0,1] is exactly what "linear" is once
  // the peak collapses to display white.
  "extended-clamp": "linear",
  "extended-reinhard": "reinhard",
  "extended-aces": "aces",
};

/** Resolve an operator name to its function, falling back to the default. */
export function getTonemapOperator(
  name: string | undefined | null,
): (rgb: RgbTriple) => RgbTriple {
  return (name && TONEMAP_OPERATORS[name]) || TONEMAP_OPERATORS[DEFAULT_TONEMAP]!;
}

/**
 * Apply a named tone-map operator (INCLUDING the peak-parameterized extended
 * roll-off ones) to an RGB triple — the single dispatch the GPU shader's
 * `applyOperator` mirrors and the parity harness checks. For `linear`/`srgb`/
 * `reinhard`/`aces`/`extended` it delegates to {@link TONEMAP_OPERATORS} (peak
 * ignored); for `extended-clamp`/`extended-reinhard`/`extended-aces` it applies
 * the peak curve per channel.
 */
export function applyTonemapOperatorTriple(
  rgb: RgbTriple,
  operator: string,
  peak: number,
): RgbTriple {
  if (operator === "extended-clamp") {
    return [
      extendedClampCurve(rgb[0], peak),
      extendedClampCurve(rgb[1], peak),
      extendedClampCurve(rgb[2], peak),
    ];
  }
  if (operator === "extended-reinhard") {
    return [
      extendedReinhardCurve(rgb[0], peak),
      extendedReinhardCurve(rgb[1], peak),
      extendedReinhardCurve(rgb[2], peak),
    ];
  }
  if (operator === "extended-aces") {
    return [
      extendedAcesCurve(rgb[0], peak),
      extendedAcesCurve(rgb[1], peak),
      extendedAcesCurve(rgb[2], peak),
    ];
  }
  return getTonemapOperator(operator)(rgb);
}

/**
 * Coerce an arbitrary operator name to a valid SDR operator. An SDR operator
 * passes through; an extended operator maps to its SDR counterpart
 * (`extended`→`linear`, `extended-reinhard`→`reinhard`, `extended-aces`→`aces`)
 * — the fallback for a pane that requested HDR but never engaged the surface;
 * anything else falls back to `DEFAULT_TONEMAP` ("srgb"). Returns the validated
 * NAME (not the function). Never returns an `extended*` operator.
 */
export function toSdrTonemap(name: string | undefined | null): TonemapOperator {
  if (name && EXTENDED_TO_SDR[name]) return EXTENDED_TO_SDR[name]!;
  return name && (SDR_TONEMAP_OPERATORS as readonly string[]).includes(name)
    ? (name as TonemapOperator)
    : DEFAULT_TONEMAP;
}

/**
 * The tone-map operator ACTUALLY IN EFFECT for an image pane — the value the
 * TONEMAP toolbar menu shows, and the pane's HOME-reset target:
 *
 *   - When the pane's true-HDR surface engaged (`rgba16float` + extended canvas
 *     tone-mapping active — `GpuImagePane`'s `useHdr`): if the descriptor
 *     explicitly asked for an HDR operator (`extended`/`extended-reinhard`/
 *     `extended-aces`), it is honored VERBATIM; otherwise the descriptor's SDR
 *     `tonemap=` is BYPASSED and the default-in-effect is `"extended"`
 *     (Extended · Linear).
 *   - Otherwise (SDR surface) the effective operator is the descriptor's
 *     `tonemap=` coerced to an SDR operator via {@link toSdrTonemap} — so an
 *     `extended*` descriptor falls back to its SDR counterpart (Python default
 *     "srgb").
 *
 * Pure (no DOM / GPU) so it is unit-tested directly. The panes layer a
 * view-local override on top of this default; HOME clears the override back to
 * this value.
 */
export function resolveEffectiveTonemap(
  descriptorTonemap: string | undefined | null,
  hdrSurfaceEngaged: boolean,
): TonemapOperator {
  if (hdrSurfaceEngaged) {
    return isHdrTonemap(descriptorTonemap) ? descriptorTonemap : "extended";
  }
  return toSdrTonemap(descriptorTonemap);
}

/** Apply an exposure of `ev` stops in scene-linear space: v * 2**ev. */
export function applyExposure(v: number, ev: number): number {
  return v * 2 ** ev;
}

/**
 * The TEV-convention display adjustment applied to a scene value BEFORE the
 * tone-map / colormap / output-encode stages: `v * 2**ev + offset`. Exposure is
 * multiplicative (stops), the offset is additive AFTER exposure. Both default to
 * the identity (`ev=0, offset=0` → `v`), so the display adjustment sliders leave
 * an image bit-for-bit unchanged at rest. This is the single source of truth the
 * CPU panes call; the WebGPU shaders port the same `v * exp2(ev) + offset` line
 * (see `engine/shaders/image.wgsl.ts` / `engine/kernels/prelude.wgsl.ts`). */
export function applyExposureOffset(v: number, ev: number, offset: number): number {
  return v * 2 ** ev + offset;
}

/** The standard sRGB opto-electronic transfer function (linear → sRGB code). */
export function srgbOetf(x: number): number {
  const v = clamp01(x);
  return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}

/**
 * The standard sRGB electro-optical transfer function (sRGB code → linear) —
 * the exact inverse of {@link srgbOetf}. Used to LINEARIZE an already-sRGB-
 * encoded 8-bit source at the FRONT of the display pipeline (tev-style: an SDR
 * pane decodes the stored value to linear light, applies exposure/offset, then
 * re-encodes via the selected transfer operator). `srgbOetf(srgbEotf(v)) === v`
 * to within 8-bit rounding across all 256 code values (verified: 0 byte drift),
 * so the default `srgb` operator is a bit-exact round-trip on an 8-bit source.
 */
export function srgbEotf(x: number): number {
  const v = clamp01(x);
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/**
 * OUTPUT-ENCODE: map DISPLAY-LINEAR [0,1] → display code value [0,1].
 *
 * Display encoding is INDEPENDENT of the tone-map operator: every operator
 * (`linear`/`srgb`/`reinhard`/`aces`) produces display-LINEAR light, which must
 * be encoded for the sRGB 8-bit framebuffer. So the default is the sRGB OETF for
 * ALL operators — writing raw display-linear values into an sRGB buffer would
 * render midtones too dark. `gamma` is an OPTIONAL override: when the caller
 * passes a positive number, a pure `pow(x, 1/gamma)` curve is used instead of
 * sRGB (gamma=1 → linear/no-encode, for data already in display space).
 */
export function outputEncode(x: number, gamma?: number): number {
  if (typeof gamma === "number" && gamma > 0) {
    return clamp01(Math.pow(clamp01(x), 1 / gamma));
  }
  return srgbOetf(x);
}

// ---------------------------------------------------------------------------
// Gamma(γ) display-transfer operator — the tev "Gamma" mode as a first-class
// tone-map operator. See the `gamma` entry in `TONEMAP_OPERATORS` for the
// mechanism: the operator's RANGE-MAP is the plain clamp; the γ power curve is
// applied at the OUTPUT-ENCODE stage via the existing `gamma` parameter, which
// the renderer supplies ONLY while this operator is in effect.
// ---------------------------------------------------------------------------

/** Default γ for the Gamma operator (≈ the sRGB OETF's effective exponent, so
 *  "Gamma 2.2" looks CLOSE to "sRGB" but not identical — the sRGB OETF is only
 *  approximately a 2.2 power curve; this matches tev). */
export const TONEMAP_GAMMA_DEFAULT = 2.2;
/** Gamma slider bounds (double-click to type an exact value). */
export const TONEMAP_GAMMA_MIN = 0.5;
export const TONEMAP_GAMMA_MAX = 4.0;
export const TONEMAP_GAMMA_STEP = 0.1;

/** True when `op` is the Gamma operator (drives the γ slider's visibility, the
 *  same conditional-slider precedent `tonemapHasPeak` sets for PEAK). */
export function tonemapHasGamma(name: string | undefined | null): boolean {
  return name === "gamma";
}

/**
 * The `gamma` value the OUTPUT-ENCODE stage must receive for a given operator —
 * the ONE place the operator→encode-transfer mapping lives, mirrored by the
 * GPU shader's uniform packing:
 *   - `gamma`  → `γ` (the encode does `pow(x, 1/γ)` instead of the sRGB OETF).
 *   - `linear` → `1` (the encode does `pow(x, 1) = x`, i.e. IDENTITY — raw
 *                linear to the display, tev's "Linear"/gamma-1 look; distinct
 *                from `srgb`, which sRGB-encodes).
 *   - everything else (`srgb`/`reinhard`/`aces`/`extended*`) → `undefined`
 *                (the encode uses the sRGB OETF; skipped entirely when `hdrOut`).
 * Returns `undefined` to mean "no gamma override → sRGB OETF", matching
 * `outputEncode`/`ImageParams.gamma`'s `undefined` convention.
 */
export function resolveEncodeGamma(
  operator: string | undefined | null,
  gammaValue: number,
): number | undefined {
  if (operator === "gamma") return gammaValue > 0 ? gammaValue : TONEMAP_GAMMA_DEFAULT;
  if (operator === "linear") return 1;
  return undefined;
}
