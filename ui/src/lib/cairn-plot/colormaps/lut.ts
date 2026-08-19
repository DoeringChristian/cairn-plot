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
  // TURBO (the tev-exact false-color follow-up). tev uses Google/Anton Mikhailov's
  // 256-entry turbo table VERBATIM (github.com/Tom94/tev, src/FalseColor.cpp's
  // `turbo()` → the same table as include/tev/FalseColor.h's `colormap::turbo()`);
  // this is that table stored ROW-FOR-ROW as 256 stops (round(tevFloat*255) — the
  // 8-bit LUT this codebase bakes; buildLUT over 256 stops is the identity, so the
  // LUT bytes ARE tev's table byte-for-byte). NOT Google's turbo POLYNOMIAL — the
  // actual sampled table. The turbo ENCODING (image/encodings) bakes tev's FIXED
  // log2 index over this table (see turboDataIndex); this stop list is only the
  // color ramp. Dark indigo (48,18,59) → cyan/green mid → dark red (122,4,3).
  turbo: [
    [48,18,59], [50,21,67], [51,24,74], [52,27,81], [53,30,88], [54,33,95], [55,36,102], [56,39,109],
    [57,42,115], [58,45,121], [59,47,128], [60,50,134], [61,53,139], [62,56,145], [63,59,151], [63,62,156],
    [64,64,162], [65,67,167], [65,70,172], [66,73,177], [66,75,181], [67,78,186], [68,81,191], [68,84,195],
    [68,86,199], [69,89,203], [69,92,207], [69,94,211], [70,97,214], [70,100,218], [70,102,221], [70,105,224],
    [70,107,227], [71,110,230], [71,113,233], [71,115,235], [71,118,238], [71,120,240], [71,123,242], [70,125,244],
    [70,128,246], [70,130,248], [70,133,250], [70,135,251], [69,138,252], [69,140,253], [68,143,254], [67,145,254],
    [66,148,255], [65,150,255], [64,153,255], [62,155,254], [61,158,254], [59,160,253], [58,163,252], [56,165,251],
    [55,168,250], [53,171,248], [51,173,247], [49,175,245], [47,178,244], [46,180,242], [44,183,240], [42,185,238],
    [40,188,235], [39,190,233], [37,192,231], [35,195,228], [34,197,226], [32,199,223], [31,201,221], [30,203,218],
    [28,205,216], [27,208,213], [26,210,210], [26,212,208], [25,213,205], [24,215,202], [24,217,200], [24,219,197],
    [24,221,194], [24,222,192], [24,224,189], [25,226,187], [25,227,185], [26,228,182], [28,230,180], [29,231,178],
    [31,233,175], [32,234,172], [34,235,170], [37,236,167], [39,238,164], [42,239,161], [44,240,158], [47,241,155],
    [50,242,152], [53,243,148], [56,244,145], [60,245,142], [63,246,138], [67,247,135], [70,248,132], [74,248,128],
    [78,249,125], [82,250,122], [85,250,118], [89,251,115], [93,252,111], [97,252,108], [101,253,105], [105,253,102],
    [109,254,98], [113,254,95], [117,254,92], [121,254,89], [125,255,86], [128,255,83], [132,255,81], [136,255,78],
    [139,255,75], [143,255,73], [146,255,71], [150,254,68], [153,254,66], [156,254,64], [159,253,63], [161,253,61],
    [164,252,60], [167,252,58], [169,251,57], [172,251,56], [175,250,55], [177,249,54], [180,248,54], [183,247,53],
    [185,246,53], [188,245,52], [190,244,52], [193,243,52], [195,241,52], [198,240,52], [200,239,52], [203,237,52],
    [205,236,52], [208,234,52], [210,233,53], [212,231,53], [215,229,53], [217,228,54], [219,226,54], [221,224,55],
    [223,223,55], [225,221,55], [227,219,56], [229,217,56], [231,215,57], [233,213,57], [235,211,57], [236,209,58],
    [238,207,58], [239,205,58], [241,203,58], [242,201,58], [244,199,58], [245,197,58], [246,195,58], [247,193,58],
    [248,190,57], [249,188,57], [250,186,57], [251,184,56], [251,182,55], [252,179,54], [252,177,54], [253,174,53],
    [253,172,52], [254,169,51], [254,167,50], [254,164,49], [254,161,48], [254,158,47], [254,155,45], [254,153,44],
    [254,150,43], [254,147,42], [254,144,41], [253,141,39], [253,138,38], [252,135,37], [252,132,35], [251,129,34],
    [251,126,33], [250,123,31], [249,120,30], [249,117,29], [248,114,28], [247,111,26], [246,108,25], [245,105,24],
    [244,102,23], [243,99,21], [242,96,20], [241,93,19], [240,91,18], [239,88,17], [237,85,16], [236,83,15],
    [235,80,14], [234,78,13], [232,75,12], [231,73,12], [229,71,11], [228,69,10], [226,67,10], [225,65,9],
    [223,63,8], [221,61,8], [220,59,7], [218,57,7], [216,55,6], [214,53,6], [212,51,5], [210,49,5],
    [208,47,5], [206,45,4], [204,43,4], [202,42,4], [200,40,3], [197,38,3], [195,37,3], [193,35,2],
    [190,33,2], [188,32,2], [185,30,2], [183,29,2], [180,27,1], [178,26,1], [175,24,1], [172,23,1],
    [169,22,1], [167,20,1], [164,19,1], [161,18,1], [158,16,1], [155,15,1], [152,14,1], [149,13,1],
    [146,11,1], [142,10,1], [139,9,2], [136,8,2], [133,7,2], [129,6,2], [126,5,2], [122,4,3],
  ],
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
 *  is a COMPILE error — labels can't silently fall out of sync with the set.
 *  Exported so the display-encoding LUT entries (`image/encodings/luts.ts`) label
 *  themselves from the SAME map — the registry can't drift from the menu. */
export const COLORMAP_LABELS: Record<ColormapName, string> = {
  viridis: "Viridis",
  plasma: "Plasma",
  magma: "Magma",
  turbo: "Turbo",
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

const colormapFloatLUTs = new Map<string, Float32Array>();

/**
 * The colormap LUT as a 256×4 RGBA-FLOAT table (`[0,1]`, alpha 1) — the ONE
 * representation the GPU LUT family binds as its 256×1 `rgba32float` texture
 * (`engine/image-engine.ts`'s `buildColormapTexture`, `diff-engine.ts`'s diff
 * blit, and the compare pane's diff colormap all consume THIS, not their own
 * hand-rolled `Uint8→Float` expansion). The stored bytes are the display
 * (sRGB-encoded) colormap colors; the LUT family samples them and writes them
 * straight to the display surface (no re-encode) — see `image/encodings`. Cached
 * per name (the tables are immutable). */
export function colormapFloatLUT(name: ColormapName): Float32Array {
  let out = colormapFloatLUTs.get(name);
  if (!out) {
    const bytes = getColormapLUT(name);
    out = new Float32Array(256 * 4);
    for (let i = 0; i < 256; i++) {
      out[i * 4 + 0] = bytes[i * 3 + 0]! / 255;
      out[i * 4 + 1] = bytes[i * 3 + 1]! / 255;
      out[i * 4 + 2] = bytes[i * 3 + 2]! / 255;
      out[i * 4 + 3] = 1;
    }
    colormapFloatLUTs.set(name, out);
  }
  return out;
}
