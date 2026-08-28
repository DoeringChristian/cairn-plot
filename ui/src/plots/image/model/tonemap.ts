/**
 * The NON-registry display pipeline layer for the image panes (cairn-plot HDR-A).
 * After the display-encoding registry landed (Phases 1–5), the OPERATOR CURVES
 * live in `image/encodings` — the single source of truth shared with the GPU
 * shaders. What stays HERE is everything that is NOT an operator curve:
 *
 *   - The SHARED PIPELINE STAGES that bracket the curve: EXPOSURE/offset
 *     (`applyExposure` / `applyExposureOffset`, a scene-linear affine BEFORE the
 *     curve) and OUTPUT-ENCODE (`outputEncode` / the `extended*` HDR-out encoders,
 *     display-linear → display code AFTER the curve) plus the sRGB transfer
 *     functions (`srgbOetf` / `srgbEotf`) they are built on.
 *   - The UI CONFIG the sliders read: gamma (`TONEMAP_GAMMA_*`) and peak
 *     (`EXTENDED_TONEMAP_PEAK_*`) bounds + `resolveEncodeGamma` / `tonemapHasGamma`.
 *   - The UNIFIED RENDER-TRANSLATION: the deprecated `extended*` alias table and
 *     the `resolveEffectiveTonemap` / `resolveRenderTonemap` "pick a curve, pick a
 *     ceiling" mapping onto the engine's operator + `hdrOut` + `peak`.
 *   - The menu operator SET (`SDR_TONEMAP_OPERATORS`), DERIVED from the registry.
 *
 * The pipeline per pixel is still EXPOSURE → CURVE (registry) → OUTPUT-ENCODE; a
 * caller applies the curve via `getEncoding(id).cpu(rgb, 3, params)`.
 *
 * WHY EXPOSURE + OUTPUT-ENCODE ARE SEPARATE STAGES (not folded into the curve):
 * "sRGB" and "gamma" are output *transfer functions*, so every operator curve
 * (linear/reinhard/aces/…) can pair with any output encode; and exposure is a
 * scene-linear affine shared by all curves. The WebGPU engine
 * (`engine/shaders/image.wgsl.ts`) ports these same stages to the fragment shader.
 */

import { clamp01 } from "../../../primitives/util/clamp.ts";
// The operator CURVE math lives in the display-encoding registry
// (image/encodings) — the single source of truth shared with the GPU shaders
// (assembled WGSL) and the parity harness. After Phase 5, `tonemap.ts` no longer
// re-exports the curve math: what remains here is the NON-registry render layer
// (exposure/offset + output-encode pipeline stages, the sRGB transfer functions,
// the gamma/peak UI config, and the UNIFIED render-translation `resolve*` +
// alias tables). It reads the registry only to DERIVE the menu operator SET so
// that set can't drift from the entries.
import { listEncodingsByKind } from "./encodings/index.ts";

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
  | "normal" //            Normal map — remap [-1,1] → [0,1] per channel (inspect normal maps)
  // HDR-OUT family (selectable only when the extended surface engaged):
  | "extended" //          Extended · Linear           — unclamped pass-through
  | "extended-clamp" //    Extended · Linear (managed) — identity below P, hard ceiling at P
  | "extended-reinhard" // Extended · Reinhard         — peak/white-point roll-off
  | "extended-aces"; //    Extended · ACES             — ACES fit rescaled to the peak

// ---------------------------------------------------------------------------
// HDR-OUT roll-off operators (the "extended" family). HDR-out-only: they emit
// DISPLAY-LINEAR light in [0, peak] (NOT [0,1]) so a real HDR surface
// (`rgba16float` + extended canvas tone-mapping) preserves values above SDR
// white while rolling the very brightest ones off toward the panel's headroom.
// `peak` is the white point in multiples of SDR white (the PEAK slider; default
// EXTENDED_TONEMAP_PEAK_DEFAULT). Ported verbatim into `engine/shaders/
// image.wgsl.ts`'s `applyOperator`; the GPU-vs-TS parity harness checks them.
// ---------------------------------------------------------------------------

/** Peak-white slider bounds (×SDR white). Default 16, range 1..16, step 0.5.
 *  FOLLOW-UP: a browser-exposed display headroom (once standardized) would seed
 *  the default; until then it is a fixed 16 (the max — preserve the most HDR
 *  headroom by default). */
export const EXTENDED_TONEMAP_PEAK_DEFAULT = 16;
export const EXTENDED_TONEMAP_PEAK_MIN = 1;
export const EXTENDED_TONEMAP_PEAK_MAX = 16;
export const EXTENDED_TONEMAP_PEAK_STEP = 0.5;

// The peak-parameterized curve MATH (extendedClamp/Reinhard/Aces scalars) and
// the per-operator CPU dispatch now live entirely in the registry
// (`image/encodings`); callers apply a curve via `getEncoding(id).cpu(...)`.
// tonemap.ts no longer wraps them — see the module doc.

/** The default operator when none / an unknown key is supplied. */
export const DEFAULT_TONEMAP: TonemapOperator = "srgb";

/**
 * The user-selectable SDR tone-map operators — the ONE unified operator menu
 * (Linear · sRGB · Gamma · Reinhard · ACES · Normal map). DERIVED from the
 * display-encoding registry so it can never drift from the entries: the non-HDR
 * `kind:"curve"` operators (the `extended*` HDR-out curves declare
 * `needsHdrSurface` and are excluded — the PEAK slider is the HDR mode now, not a
 * second menu group) followed by the `kind:"remap"` entries (the `normal` map).
 * Registration order yields the historical menu order.
 */
export const SDR_TONEMAP_OPERATORS: readonly TonemapOperator[] = [
  ...listEncodingsByKind("curve").filter((e) => !e.needsHdrSurface),
  ...listEncodingsByKind("remap"),
].map((e) => e.id as TonemapOperator);

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

// The name→CPU-curve resolver and the peak-aware triple dispatch were removed in
// Phase 5: callers apply a curve straight from the registry via
// `getEncoding(id).cpu(rgb, 3, params)` (the single source of truth the GPU
// `applyOperator` mirrors), with `getEncoding(DEFAULT_TONEMAP)` as the fallback.

/**
 * Resolve a public display operator. Invalid input falls back to
 * `DEFAULT_TONEMAP` ("srgb"). Internal HDR execution operators are never
 * accepted through this public-facing seam.
 */
export function resolveDisplayOperator(name: string | undefined | null): TonemapOperator {
  return name && (SDR_TONEMAP_OPERATORS as readonly string[]).includes(name)
    ? (name as TonemapOperator)
    : DEFAULT_TONEMAP;
}

/**
 * The tone-map operator ACTUALLY IN EFFECT for an image pane — the value the
 * (single) TONEMAP toolbar menu shows, and the pane's HOME-reset target. Under
 * the UNIFIED model this is TRIVIAL: the operator (curve) is surface-independent
 * — only the PEAK ceiling `P` differs between SDR and HDR (see
 * {@link resolveRenderTonemap}). So:
 *
 *   - An explicit descriptor `tonemap=` is honored, {@link canonicalizeTonemap}d
 *     to one of the 5 (a deprecated `extended*` alias resolves to its curve).
 *   - An UNSET descriptor defaults to `"srgb"` on EVERY surface (user
 *     decision): on SDR it is the bit-exact round-trip for an already-sRGB
 *     8-bit source; on an engaged HDR surface it is the extended sRGB encode
 *     with the managed PEAK ceiling (default P=4) — the tev-default rendition.
 *     Manual PEAK=∞ recovers the raw browser-clipped look; Linear stays one
 *     menu click away.
 *
 * Pure (no DOM / GPU) so it is unit-tested directly. The panes layer a
 * view-local override on top of this default; HOME clears the override back to
 * this value.
 */
export function resolveEffectiveTonemap(
  descriptorTonemap: string | undefined | null,
  hdrSurfaceEngaged: boolean,
): TonemapOperator {
  void hdrSurfaceEngaged; // one default for every surface (see doc above)
  if (descriptorTonemap == null) return "srgb";
  return resolveDisplayOperator(descriptorTonemap);
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
// DISPLAY-SPACE post-processing (`ImageProcessing`'s brightness/contrast/flipSign).
//
// WHY THIS EXISTS. The 8-bit `processing` block (brightness/contrast/flipSign)
// is a DISPLAY-space adjustment applied to already-encoded (sRGB) pixels — on
// the CPU SDR pane it is a CSS `filter` string (`media-compare/post-processing`'s
// `buildProcessingFilterList`): `brightness(1+b) contrast(1+c) invert(1)?`. The
// DEFAULT WebGPU pane (`GpuImagePane`) ignored the block entirely, so
// `cp.Image(uint8, brightness=…, contrast=…, flip_sign=…)` rendered nothing on
// most machines (audit H1). This is the ONE numeric definition of that CSS math,
// applied as a FINAL display-space stage AFTER the output-encode — used by the
// engine parity harness as the CPU source of truth and ported BYTE-IDENTICALLY
// into `engine/shaders/image.wgsl.ts` (`cairnDisplayAdjust`) so one knob resolves
// to the same pixels on the CPU (CSS) and GPU (shader) backends.
//
// The CSS functions are LINEAR affines in the element's (encoded) color space,
// applied in list order (brightness, then contrast, then invert):
//   brightness(a): out = in · a                (a = 1 + brightness)
//   contrast(a):   out = (in − 0.5)·a + 0.5     (a = 1 + contrast)
//   invert(1):     out = 1 − in                 (flipSign)
// NOTE `exposure` is NOT folded in here (unlike `buildProcessingFilterList`,
// which folds `2^exposure` into the brightness factor): exposure/offset are now
// lifted TOP-LEVEL and applied in SCENE-LINEAR space (before the operator), so the
// `processing.exposure`/`processing.offset` slots are 0 on the unified path and
// this stage is purely the brightness/contrast/flipSign display affine. Values are
// returned UNCLAMPED; the surface write (`rgba8unorm` / `byteOf`) clamps to [0,1],
// matching CSS's rasterization-time clamp.
export interface DisplayAdjust {
  /** CSS `brightness(1 + brightness)` gain (0 = identity). */
  brightness: number;
  /** CSS `contrast(1 + contrast)` gain (0 = identity). */
  contrast: number;
  /** CSS `invert(1)` when true (sign flip; 1 − x per channel). */
  flipSign: boolean;
}

/** Identity display-adjust (brightness 0, contrast 0, no flip) — the default that
 *  leaves the encoded color untouched (bit-for-bit the pre-processing path). */
export const IDENTITY_DISPLAY_ADJUST: DisplayAdjust = { brightness: 0, contrast: 0, flipSign: false };

/** True when the adjust is a no-op (skip the stage entirely). */
export function isIdentityDisplayAdjust(a: DisplayAdjust): boolean {
  return a.brightness === 0 && a.contrast === 0 && !a.flipSign;
}

/** Apply the display-space brightness/contrast/flipSign affine to ONE encoded
 *  channel value (see the block comment for the exact CSS math). Unclamped. */
export function applyDisplayAdjust1(x: number, a: DisplayAdjust): number {
  let v = x * (1 + a.brightness);
  v = (v - 0.5) * (1 + a.contrast) + 0.5;
  if (a.flipSign) v = 1 - v;
  return v;
}

/** Apply {@link applyDisplayAdjust1} to an RGB triple. */
export function applyDisplayAdjust(rgb: RgbTriple, a: DisplayAdjust): RgbTriple {
  return [applyDisplayAdjust1(rgb[0], a), applyDisplayAdjust1(rgb[1], a), applyDisplayAdjust1(rgb[2], a)];
}

// ---------------------------------------------------------------------------
// EXTENDED output-encode (the HDR-out / extended-surface transfer).
//
// WHY THIS EXISTS. When a pane engages its true-HDR surface (`hdrOut:true` —
// `rgba16float` canvas, `toneMapping:'extended'`, colorSpace `srgb`/`display-p3`
// — see `engine/webgpu/surface.ts`'s `configureHDRSurface` + `GpuImagePane`'s
// `useHdr`), the shader used to SKIP the output-encode and write RAW
// SCENE-LINEAR values to the canvas. That is WRONG. Per the W3C ColorWeb-CG
// specs (`hdr_html_canvas_element` + `canvas-color-space`), a float16 canvas in
// `"srgb"`/`"display-p3"` stores TRANSFER-ENCODED (NON-LINEAR) signals — a
// stored 0.5 is encoded 0.5 (≈0.214 LINEAR light), and values ABOVE 1 (extended
// brightness) and BELOW 0 are legal. The separate `"srgb-linear"` color space
// is the one that stores linear light. So the extended surface needs the SAME
// transfer encode the SDR path applies — just UNCLAMPED so values past 1 (and
// below 0) survive to the compositor as extended brightness.
//
// These mirror the SDR encoders above (`srgbOetf` / `outputEncode`) but:
//   - apply the piecewise curve to ALL magnitudes (no `clamp01` on the input),
//     valid for `x > 1` (the extended-sRGB regime), and
//   - MIRROR through the origin for negatives — `sign(x)·f(|x|)` — per the
//     extended-sRGB (scRGB / bt.2100-adjacent) convention.
// Ported BYTE-IDENTICALLY into `engine/shaders/image.wgsl.ts`
// (`extendedSrgbOetf` / `extendedGammaEncode` / `extendedOutputEncodeF`); the
// GPU↔TS parity harness (`engine/__tests__/hdr-output.browser.ts`) checks them.
// ---------------------------------------------------------------------------

/**
 * EXTENDED sRGB OETF (scene-linear → non-linear extended-sRGB code). The
 * standard sRGB piecewise curve applied to ALL magnitudes (NOT clamped to
 * [0,1]) and mirrored through the origin: `sign(x)·oetf(|x|)`. For `|x| > 1`
 * this keeps the `1.055·|x|^(1/2.4) − 0.055` branch, so an above-white
 * scene-linear value maps to an above-1 encoded value the extended HDR canvas
 * renders as extended brightness. Continuous with {@link srgbOetf} on [0,1]
 * (`extendedSrgbOetf(1) === 1`).
 *
 * Goldens (tonemap.test.ts): `extendedSrgbOetf(0.5) ≈ 0.735357`;
 * `extendedSrgbOetf(4) = 1.055·4^(1/2.4) − 0.055 ≈ 1.824796`;
 * `extendedSrgbOetf(-0.5) ≈ -0.735357` (negative mirror).
 */
export function extendedSrgbOetf(x: number): number {
  const a = Math.abs(x);
  const s = Math.sign(x);
  if (a <= 0.0031308) return s * 12.92 * a;
  return s * (1.055 * Math.pow(a, 1 / 2.4) - 0.055);
}

/**
 * EXTENDED power (gamma) encode: `sign(x)·|x|^(1/γ)` — the UNCLAMPED,
 * origin-mirrored analog of the SDR `pow(x,1/γ)` transfer, used on the HDR-out
 * path when the Gamma display operator is in effect (tev "Gamma" on an HDR
 * surface). Unlike {@link outputEncode}'s gamma branch it does NOT clamp, so an
 * above-white value stays above 1 after encode; `γ` defaults are the caller's
 * (`resolveEncodeGamma`).
 */
export function extendedGammaEncode(x: number, gamma: number): number {
  const g = gamma > 0 ? gamma : TONEMAP_GAMMA_DEFAULT;
  const a = Math.abs(x);
  const s = Math.sign(x);
  return s * Math.pow(a, 1 / g);
}

/**
 * OUTPUT-ENCODE for the HDR-out (extended) surface — the extended analog of
 * {@link outputEncode}, selected by the SAME `gamma` convention: a positive
 * `gamma` uses {@link extendedGammaEncode} (the Gamma operator's transfer),
 * otherwise {@link extendedSrgbOetf}. NEVER clamps (the whole point of the
 * extended surface is that values above 1 / below 0 survive). Mirrors
 * `image.wgsl.ts`'s `extendedOutputEncodeF`.
 */
export function extendedOutputEncode(x: number, gamma?: number): number {
  if (typeof gamma === "number" && gamma > 0) return extendedGammaEncode(x, gamma);
  return extendedSrgbOetf(x);
}

// ---------------------------------------------------------------------------
// Gamma(γ) display-transfer operator — the tev "Gamma" mode as a first-class
// tone-map operator. See the `gamma` registry entry (`image/encodings/curves.ts`)
// for the mechanism: the operator's RANGE-MAP is the plain clamp; the γ power
// curve is applied at the OUTPUT-ENCODE stage via the existing `gamma` parameter,
// which the renderer supplies ONLY while this operator is in effect.
// ---------------------------------------------------------------------------

/** Default γ for the Gamma operator (≈ the sRGB OETF's effective exponent, so
 *  "Gamma 2.2" looks CLOSE to "sRGB" but not identical — the sRGB OETF is only
 *  approximately a 2.2 power curve; this matches tev). */
export const TONEMAP_GAMMA_DEFAULT = 2.2;
/** Gamma slider bounds (double-click to type an exact value). */
export const TONEMAP_GAMMA_MIN = 0.5;
export const TONEMAP_GAMMA_MAX = 4.0;
export const TONEMAP_GAMMA_STEP = 0.1;

/** True when `op` is the Gamma operator (drives the γ slider's visibility — the
 *  conditional-slider precedent the PEAK slider also follows). */
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
  // `linear` and `normal` both show their range-mapped value RAW (identity
  // output-encode, γ=1) — normal-map data must not be sRGB-encoded.
  if (operator === "linear" || operator === "normal") return 1;
  return undefined;
}

// ---------------------------------------------------------------------------
// UNIFIED render translation — "pick a curve, pick a ceiling".
//
// The USER-FACING surface is ONE 5-operator menu + the PEAK slider `P`. This
// translator maps a (display operator, P, surface, γ) tuple onto the render
// pass's ENGINE operator + `hdrOut` + `peak` + encode `gamma`, reusing the
// engine's existing peak-parameterized operators (image-engine.ts's
// `ImageOperator` / image.wgsl.ts). It is the SINGLE place the unified model is
// expressed; pure so `tonemap.test.ts` pins the whole operator × peak × surface
// matrix. Invariant: at `P = 1` (and on any non-HDR surface) it returns the
// plain SDR operator with `hdrOut:false` — the legacy SDR rendition BYTE-FOR-BYTE.
// ---------------------------------------------------------------------------

/** The PEAK at/above which the ceiling is UNBOUNDED (`P = ∞`): Linear/sRGB/Gamma
 *  degrade to RAW browser-clipped extended (engine operator `extended` — no
 *  in-shader ceiling), and Reinhard degenerates to pass-through. Manual slider
 *  entry of `inf` yields `Infinity`; ANY non-finite peak counts as unbounded. */
export const EXTENDED_TONEMAP_PEAK_UNBOUNDED = Infinity;

/** The engine render parameters a display operator + ceiling resolve to. */
export interface RenderTonemapParams {
  /** Engine `ImageOperator` name to hand the render pass. */
  operator: string;
  /** Whether the EXTENDED (HDR-out) encode + surface path runs. */
  hdrOut: boolean;
  /** GPU-safe (always FINITE) peak uniform. */
  peak: number;
  /** Output-encode gamma (`undefined` → sRGB OETF, `1` → identity, `γ` → power). */
  gamma: number | undefined;
}

/**
 * Translate a unified display operator at
 * ceiling `P` on a given surface into the engine render params. See the section
 * doc. `peak` is the PEAK slider value (`Infinity`/non-finite = unbounded);
 * `gammaValue` is the shared γ state (used only by the Gamma operator).
 *
 * Surface/ceiling rules:
 *  - Non-HDR surface OR `P ≤ 1` → SDR path: the canonical operator verbatim,
 *    `hdrOut:false`, `peak` forced to 1. This IS the degrade rule.
 *  - HDR surface, finite `P > 1` → the peak-parameterized extended operator
 *    (`linear/srgb/gamma`→`extended-clamp` clamp(x,0,P); `reinhard`→
 *    `extended-reinhard`; `aces`→`extended-aces`), `hdrOut:true`. The encode
 *    transfer is carried by `gamma` exactly as on SDR (identity/sRGB/power), so
 *    `P=1` and `P>1` share one curve family.
 *  - HDR surface, `P = ∞` → Linear/sRGB/Gamma become RAW `extended` (browser
 *    clips); Reinhard degenerates to `extended` pass-through; ACES has no
 *    meaningful `∞` (its `P·aces(x/P)` collapses toward 0), so its ceiling is
 *    CLAMPED to {@link EXTENDED_TONEMAP_PEAK_MAX} and it rolls off there.
 */
export function resolveRenderTonemap(
  displayOperator: string | undefined | null,
  peak: number,
  hdrSurfaceEngaged: boolean,
  gammaValue: number,
): RenderTonemapParams {
  const op = resolveDisplayOperator(displayOperator);
  const encGamma = resolveEncodeGamma(op, gammaValue);
  if (!hdrSurfaceEngaged || (Number.isFinite(peak) && peak <= 1)) {
    return { operator: op, hdrOut: false, peak: 1, gamma: encGamma };
  }
  const unbounded = !Number.isFinite(peak);
  switch (op) {
    case "reinhard":
      return unbounded
        ? { operator: "extended", hdrOut: true, peak: EXTENDED_TONEMAP_PEAK_MAX, gamma: undefined }
        : { operator: "extended-reinhard", hdrOut: true, peak, gamma: undefined };
    case "aces":
      return {
        operator: "extended-aces",
        hdrOut: true,
        peak: unbounded ? EXTENDED_TONEMAP_PEAK_MAX : peak,
        gamma: undefined,
      };
    default:
      // linear / srgb / gamma — one CLAMP range-map, three encode transfers.
      return unbounded
        ? { operator: "extended", hdrOut: true, peak: EXTENDED_TONEMAP_PEAK_MAX, gamma: encGamma }
        : { operator: "extended-clamp", hdrOut: true, peak, gamma: encGamma };
  }
}
