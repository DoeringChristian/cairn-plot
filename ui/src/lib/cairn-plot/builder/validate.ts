/**
 * Input validation for the `window.cairnPlot` builder surface — the SAME rules
 * the Python `cairn_plot` builders enforce (`src/cairn_plot/components.py`), so
 * a bad colormap / tonemap / compare mode fails the same way in both faces.
 *
 * The allowed string sets come from the ONE cross-language contract
 * (`schema/cairn-plot-contracts.json`), reused here via the TS sources already
 * PINNED to it (`contracts.test.ts`): `COLORMAP_NAMES`, the tonemap group
 * arrays, and the compare-kernel public names. So this file cannot drift the
 * sets without a contract guard failing.
 */
import { COLORMAP_NAMES } from "../colormaps/lut.ts";
import { SDR_TONEMAP_OPERATORS, DEPRECATED_TONEMAP_ALIASES } from "../image/tonemap.ts";

/** Named scalar colormaps a color-by-value chart accepts (mirrors Python
 *  `_COLORMAPS`). */
export const CHART_COLORMAPS: readonly string[] = COLORMAP_NAMES;

/** Image/compare colormaps = the named ramps PLUS the `"none"` passthrough
 *  (mirrors Python `_IMAGE_COLORMAPS`). */
export const IMAGE_COLORMAPS: readonly string[] = ["none", ...COLORMAP_NAMES];

/** The canonical tone-map operator set — the UNIFIED 5-operator menu (mirrors
 *  Python `_TONEMAP_OPERATORS`, ↔ contract `tonemapOperators`). */
export const TONEMAP_OPERATORS: readonly string[] = SDR_TONEMAP_OPERATORS;

/** The DEPRECATED pre-unification `extended*` names, still ACCEPTED by
 *  `checkTonemap` and resolved client-side to a (operator, peak) pair (mirrors
 *  Python `_TONEMAP_ALIASES`, ↔ contract `tonemapOperatorAliases`). */
export const TONEMAP_OPERATOR_ALIASES: readonly string[] = DEPRECATED_TONEMAP_ALIASES;

/** Every `tonemap=` name the builder accepts: canonical ∪ deprecated aliases. */
export const TONEMAP_ACCEPTED: readonly string[] = [
  ...TONEMAP_OPERATORS,
  ...TONEMAP_OPERATOR_ALIASES,
];

/** Public `compare(mode=)` diff-kernel short names → the registry kernel id
 *  carried as the descriptor `diffSubmode` (mirrors Python
 *  `_COMPARE_KERNEL_MODES`). */
export const COMPARE_KERNEL_MODES: Readonly<Record<string, string>> = {
  signed: "signed",
  abs: "absolute",
  square: "squared",
  rel_signed: "relative_signed",
  rel_abs: "relative_absolute",
  rel_square: "relative_squared",
  flip: "flip",
  flip_ldr: "flip_ldr",
  ssim: "ssim",
};

/** View compositions (mirrors Python `_COMPARE_VIEW_MODES`). */
export const COMPARE_VIEW_MODES: readonly string[] = ["slide", "blend"];

/** The full public `compare(mode=)` enum (mirrors Python `_COMPARE_PUBLIC_MODES`). */
export const COMPARE_PUBLIC_MODES: readonly string[] = [
  ...COMPARE_VIEW_MODES,
  ...Object.keys(COMPARE_KERNEL_MODES),
];

export const COMPARE_ALIGNS: readonly string[] = [
  "top-left",
  "center",
  "top-right",
  "bottom-left",
  "bottom-right",
];
export const COMPARE_FITS: readonly string[] = ["crop", "fill"];
export const PIXEL_VALUE_NOTATIONS: readonly string[] = ["decimal", "int"];

function oneOf(name: string, value: string, allowed: readonly string[]): string {
  if (!allowed.includes(value)) {
    throw new Error(
      `cairnPlot: ${name} must be one of ${JSON.stringify(allowed)}, got ${JSON.stringify(value)}`,
    );
  }
  return value;
}

export const checkChartColormap = (v: string): string => oneOf("colormap", v, CHART_COLORMAPS);
export const checkImageColormap = (v: string): string => oneOf("colormap", v, IMAGE_COLORMAPS);
export const checkTonemap = (v: string): string => oneOf("tonemap", v, TONEMAP_ACCEPTED);
export const checkCompareMode = (v: string): string => oneOf("mode", v, COMPARE_PUBLIC_MODES);
export const checkAlign = (v: string): string => oneOf("align", v, COMPARE_ALIGNS);
export const checkFit = (v: string): string => oneOf("fit", v, COMPARE_FITS);
export const checkPixelValueNotation = (v: string): string =>
  oneOf("pixelValueNotation", v, PIXEL_VALUE_NOTATIONS);
