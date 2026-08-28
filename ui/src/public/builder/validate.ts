/**
 * Input validation for the `window.cairnPlot` builder surface — the SAME rules
 * the Python `cairn_plot` builders enforce (`packages/python/src/cairn_plot/components.py`), so
 * a bad colormap / tonemap / compare mode fails the same way in both faces.
 *
 * The allowed string sets come from the ONE cross-language contract
 * (`schema/cairn-plot-contracts.json`), reused here via the TS sources already
 * PINNED to it (`contracts.test.ts`): `COLORMAP_NAMES`, the tonemap group
 * arrays, and the compare-kernel public names. So this file cannot drift the
 * sets without a contract guard failing.
 */
import { COLORMAP_NAMES } from "../../settings/colormaps/lut.ts";
import { SDR_TONEMAP_OPERATORS } from "../../plots/image/model/tonemap.ts";

/** Named scalar colormaps a color-by-value chart accepts (mirrors Python
 *  `_COLORMAPS`). */
export const CHART_COLORMAPS: readonly string[] = COLORMAP_NAMES;

/** Named display colormaps accepted by image and comparison builders. An
 * omitted colormap selects the normal display-operation default; omission is
 * not represented by a synthetic colormap name. */
export const IMAGE_COLORMAPS: readonly string[] = COLORMAP_NAMES;

/** The canonical tone-map operator set — the UNIFIED 5-operator menu (mirrors
 *  Python `_TONEMAP_OPERATORS`, ↔ contract `tonemapOperators`). */
export const TONEMAP_OPERATORS: readonly string[] = SDR_TONEMAP_OPERATORS;

/** Public `compare(mode=)` diff-kernel short names → the registry kernel id
 *  carried as the descriptor `operation` (mirrors Python
 *  `_COMPARE_OPERATION_MODES`). */
export const COMPARE_OPERATION_MODES: Readonly<Record<string, string>> = {
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
export const COMPARE_VIEW_MODES: readonly string[] = ["split"];

/** The full public `compare(mode=)` enum (mirrors Python `_COMPARE_PUBLIC_MODES`). */
export const COMPARE_PUBLIC_MODES: readonly string[] = [
  ...COMPARE_VIEW_MODES,
  ...Object.keys(COMPARE_OPERATION_MODES),
];

export const COMPARE_ALIGNS: readonly string[] = [
  "top-left",
  "center",
  "top-right",
  "bottom-left",
  "bottom-right",
];
export const COMPARE_FITS: readonly string[] = ["crop", "fill"];
/** TEV pixel-value overlay notations. The single runtime source of truth: the
 *  rendering type union `PixelValueNotation` (primitives/PixelValueOverlay.tsx)
 *  is DERIVED from this tuple (no third hand-kept copy), and the cross-language
 *  contract pins it to Python `_PIXEL_VALUE_NOTATIONS`. `as const` keeps the
 *  literal element types so the derived union stays `"decimal" | "int"`. */
export const PIXEL_VALUE_NOTATIONS = ["decimal", "int"] as const;

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
export const checkTonemap = (v: string): string => oneOf("tonemap", v, TONEMAP_OPERATORS);
export const checkCompareMode = (v: string): string => oneOf("mode", v, COMPARE_PUBLIC_MODES);
export const checkAlign = (v: string): string => oneOf("align", v, COMPARE_ALIGNS);
export const checkFit = (v: string): string => oneOf("fit", v, COMPARE_FITS);
export const checkPixelValueNotation = (v: string): string =>
  oneOf("pixelValueNotation", v, PIXEL_VALUE_NOTATIONS);
