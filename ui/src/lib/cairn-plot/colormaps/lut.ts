function lerp3(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

export function buildLUT(stops: Array<[number, number, number]>): Uint8Array {
  const lut = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    const seg = t * (stops.length - 1);
    const lo = Math.floor(seg);
    const hi = Math.min(lo + 1, stops.length - 1);
    const f = seg - lo;
    const [r, g, b] = lerp3(stops[lo]!, stops[hi]!, f);
    lut[i * 3] = Math.round(r);
    lut[i * 3 + 1] = Math.round(g);
    lut[i * 3 + 2] = Math.round(b);
  }
  return lut;
}

// ── Colormap CONTRACT (single source of truth) ──────────────────────────────
// `COLORMAP_STOPS` is THE canonical registry of named scalar colormaps. Every
// other colormap surface DERIVES from it rather than re-listing the names:
//   - `ColormapName` (the TS union)            = `keyof typeof COLORMAP_STOPS`
//   - `COLORMAP_NAMES` (the runtime name list) = `Object.keys(COLORMAP_STOPS)`
//   - `COLORMAP_OPTIONS` (id+label menu list)  = names zipped with COLORMAP_LABELS
//   - `types.ts` re-exports `ColormapName`; `Colormap = "none" | ColormapName`
//   - Python `_COLORMAPS` + the committed `schema/cairn-plot-contracts.json` are
//     pinned to the SAME set (asserted by `contracts.test.ts` + a pytest).
// Add a colormap by adding ONE entry here (+ its label below — the exhaustive
// `Record<ColormapName, string>` label map fails to compile otherwise) and the
// contract JSON; nothing else re-lists the names.
export const COLORMAP_STOPS = {
  viridis: [[68, 1, 84], [59, 82, 139], [33, 145, 140], [94, 201, 98], [253, 231, 37]],
  // matplotlib plasma anchors: deep blue-violet -> magenta -> orange -> yellow.
  plasma: [[13, 8, 135], [126, 3, 168], [204, 71, 120], [248, 149, 64], [240, 249, 33]],
  // matplotlib magma anchors: near-black -> purple -> magenta -> orange -> pale.
  // Sequential (NOT diverging) — the color scheme the official FLIP tools use.
  magma: [[0, 0, 4], [81, 18, 124], [183, 55, 121], [252, 137, 97], [252, 253, 191]],
  "red-green": [[215, 25, 28], [255, 255, 255], [26, 150, 65]],
  "red-blue": [[215, 25, 28], [255, 255, 255], [44, 123, 182]],
} satisfies Record<string, Array<[number, number, number]>>;

/** The registered colormap names — DERIVED from `COLORMAP_STOPS`'s keys so the
 *  union can never drift from the actual LUT registry. `"none"` (the raw /
 *  grayscale passthrough) is NOT a colormap name — it lives in `types.ts`'s
 *  `Colormap` union. */
export type ColormapName = keyof typeof COLORMAP_STOPS;

/** Runtime list of the registered colormap names (registry / insertion order),
 *  derived from `COLORMAP_STOPS`. Used by tests + menu derivation. */
export const COLORMAP_NAMES = Object.keys(COLORMAP_STOPS) as ColormapName[];

/** Human labels for the colormap menu, keyed by name. `Record<ColormapName,…>`
 *  is exhaustive, so adding a colormap to `COLORMAP_STOPS` without a label here
 *  is a COMPILE error — labels can't silently fall out of sync with the set. */
const COLORMAP_LABELS: Record<ColormapName, string> = {
  viridis: "Viridis",
  plasma: "Plasma",
  magma: "Magma",
  "red-green": "Red–Green",
  "red-blue": "Red–Blue",
};

/** The colormap menu-option list (id + label), DERIVED from the canonical set +
 *  label map. The image/compare toolbar prepends its own `"none"` passthrough
 *  (see `renderers/use-image-controller.ts`'s `COLORMAP_MENU_OPTIONS`). */
export const COLORMAP_OPTIONS: { id: ColormapName; label: string }[] =
  COLORMAP_NAMES.map((id) => ({ id, label: COLORMAP_LABELS[id] }));

export const DIVERGING_COLORMAPS = new Set<string>(["red-green", "red-blue"]);

const colormapLUTs = new Map<string, Uint8Array>();

export function getColormapLUT(name: ColormapName): Uint8Array {
  let lut = colormapLUTs.get(name);
  if (!lut) {
    // Degrade an unknown colormap name to viridis rather than crash. The G2
    // Python composable API lets a caller pass an arbitrary `shared.colormap`
    // string, so a typo must not read `undefined.length` and blank the page.
    const stops = COLORMAP_STOPS[name] ?? COLORMAP_STOPS.viridis;
    lut = buildLUT(stops);
    colormapLUTs.set(name, lut);
  }
  return lut;
}
