/**
 * `renderers/display-encoding.ts` — the ONE unified DISPLAY-ENCODING menu +
 * viewport encoding projection (Phase 3 of the display-encoding registry;
 * `docs/plans/2026-08-18-display-encoding-registry.md`).
 *
 * An image pane's colormap and tone-map menus were TWO controls answering ONE
 * question — "how do the selected channels become RGB". This module collapses
 * them into ONE arity-gated DISPLAY menu (`displayToolbarButton`) driven by the
 * `image/encodings` registry, plus a hook (`usePaneEncoding`) that projects the
 * viewport's SINGLE `encoding` id: selecting a colormap LUT deactivates the curve
 * and vice-versa STRUCTURALLY (no more `colormap==="none" ? [...tonemap] : []`
 * per-pane conditionals). Mutable state remains in the viewport store.
 *
 * ## Arity gating (`resolveDisplayEncodingIds`)
 *   - `mode:"arity"` (the FLOAT/HDR path, which KNOWS its channel count from the
 *     source shape / channel selector): luts at every k∈[1,4] (a k>1 sample is
 *     REDUCED to a scalar before the LUT — the multi-channel-colormap follow-up,
 *     with a Lum/Mean reduce picker in the second toolbar row); the `normal` remap
 *     only at k=3; curves always. Per-arity memory still applies (flipping the
 *     channel selector remembers the last encoding chosen at each k).
 *   - `mode:"sdr"` (the 8-bit `imageUrl` path): a decoded PNG has no meaningful
 *     scalar-vs-RGB channel-count signal (its false-color colormap treats it as
 *     scalar, its normal-map view treats it as RGB), so it offers the FULL
 *     applicable set — curves + luts + (if the pane's curve set carries it) the
 *     `normal` remap — exactly as before. (Deviation from strict arity gating,
 *     documented: SDR has no channel-count knowledge to gate on. Phase 5 can
 *     revisit once decoded-channel introspection exists.)
 *
 * Core-safe (registry + React only) — CpuImagePane ships in `core.iife.js`.
 */
import { useCallback, useMemo, useRef } from "react";
import type { ToolbarButtonSpec, ToolbarMenuOption, ToolbarSegmentSpec } from "../../../primitives/controls/ToolbarConfig";
import { getEncoding, listEncodingsByKind, type ReduceMode } from "../model/encodings/index.ts";

/** The DATA-encoding multi-channel REDUCE options, in order (the multi-channel-
 *  colormap follow-up). Shown ONLY while a colormap LUT is active AND the source
 *  has >1 channel — how ℝᵏ collapses to the scalar the LUT indexes. */
export const REDUCE_MENU_OPTIONS: { id: ReduceMode; label: string }[] = [
  { id: "luminance", label: "Lum" },
  { id: "mean", label: "Mean" },
];

/**
 * The DATA-encoding multi-channel REDUCE picker as a SECOND-ROW segmented control
 * (Lum · Mean) — shown ONLY while a colormap LUT is active AND the source arity
 * is >1. Selects how the color channels collapse to the scalar the LUT indexes
 * (luminance = Rec.709, mean = average). Lives in the second toolbar row with the
 * norm picker + sliders (controls-row-separation directive). `value` is the reduce
 * mode in effect; `onSelect` receives the picked mode.
 */
export function reduceSegment(
  value: ReduceMode,
  onSelect: (mode: ReduceMode) => void,
): ToolbarSegmentSpec {
  return {
    id: "reduce",
    label: "reduce",
    title: "Multi-channel reduce (Luminance · Mean) — how the selected channels collapse to the scalar the colormap indexes",
    options: REDUCE_MENU_OPTIONS,
    value,
    onSelect: (id: string) => onSelect(id as ReduceMode),
  };
}

/** The encoding ids offered in each menu SECTION, resolved for the current
 *  arity/surface. `all` is the flat union (membership = "supported here"). */
export interface DisplayEncodingIds {
  /** Light tone-map curves (linear / srgb / gamma / reinhard / aces …). */
  curveIds: string[];
  /** Data colormap LUTs (viridis / magma / …). */
  lutIds: string[];
  /** Structural remaps (the `normal` map). */
  remapIds: string[];
  /** Flat union of the three, in menu order. */
  all: string[];
}

/** Every registered colormap LUT id, in registry (== menu) order. */
function allLutIds(): string[] {
  return listEncodingsByKind("lut").map((e) => e.id);
}

/** The colormap LUT ids whose declared `arities` include `arity`. Colormaps now
 *  support every k∈[1,4] (a k>1 sample is REDUCED to a scalar before the LUT —
 *  the multi-channel follow-up), so this is the full set at any 1..4 arity and
 *  empty beyond it. */
function lutIdsForArity(arity: number): string[] {
  return listEncodingsByKind("lut")
    .filter((e) => e.arities.includes(arity))
    .map((e) => e.id);
}

/**
 * Which encoding ids a pane offers, given its surface mode + arity + the curve
 * set it can actually render. `curveSet` is an ORDERED list of curve/remap ids
 * (it may include `"normal"`); curves and the `normal` remap are split into
 * their sections here.
 */
export function resolveDisplayEncodingIds(opts: {
  mode: "sdr" | "arity";
  arity: number;
  curveSet: readonly string[];
}): DisplayEncodingIds {
  const { mode, arity, curveSet } = opts;
  const curveIds = curveSet.filter((id) => getEncoding(id)?.kind === "curve");
  const hasNormal = curveSet.some((id) => getEncoding(id)?.kind === "remap");
  let lutIds: string[];
  let remapIds: string[];
  if (mode === "sdr") {
    // No channel-count knowledge → offer the full applicable set.
    lutIds = allLutIds();
    remapIds = hasNormal ? ["normal"] : [];
  } else {
    // Colormaps are legal at every k∈[1,4] (the multi-channel follow-up reduces a
    // k>1 sample to a scalar before the LUT); the `normal` remap stays k=3 only.
    lutIds = lutIdsForArity(arity);
    remapIds = arity === 3 && hasNormal ? ["normal"] : [];
  }
  return { curveIds, lutIds, remapIds, all: [...curveIds, ...lutIds, ...remapIds] };
}

/** A section-header option row (non-interactive) for the flat menu. */
function header(id: string, label: string): ToolbarMenuOption {
  return { id: `__display_${id}`, label, header: true };
}

/**
 * The ONE DISPLAY-encoding dropdown as a toolbar LEADING button — replaces the
 * separate colormap + tone-map menus. Options are grouped into CURVES /
 * COLORMAPS / REMAPS sections (emulated with disabled header rows, since
 * `ToolbarMenuSpec` is flat); `value` is the active encoding id; `onSelect`
 * receives the picked id. Sections with no entries are omitted; a single non-
 * empty section renders WITHOUT a header (no point labelling the only group).
 */
export function displayToolbarButton(args: {
  value: string;
  ids: DisplayEncodingIds;
  onSelect: (id: string) => void;
}): ToolbarButtonSpec {
  const { value, ids, onSelect } = args;
  const sections: Array<{ label: string; ids: string[] }> = [
    { label: "Curves", ids: ids.curveIds },
    { label: "Colormaps", ids: ids.lutIds },
    { label: "Remaps", ids: ids.remapIds },
  ].filter((s) => s.ids.length > 0);
  const showHeaders = sections.length > 1;
  const options: ToolbarMenuOption[] = [];
  for (const s of sections) {
    if (showHeaders) options.push(header(s.label, s.label));
    for (const id of s.ids) options.push({ id, label: getEncoding(id)?.label ?? id });
  }
  return {
    id: "display",
    title: "Display encoding",
    menu: { options, value, onSelect },
  };
}

/**
 * The ONE DISPLAY menu for the COMPARE pane — the mode-dependent twin of
 * {@link displayToolbarButton}, replacing the compare pane's separate
 * tone-map (slide) + colormap (diff) buttons. The compare pane's two
 * encoding FACES are structurally exclusive by MODE (a slide composite is
 * LIGHT → curves; a diff is a SCALAR error map → data LUTs), so only ONE section
 * ever applies — that IS the arity gating, so each face renders as a single
 * section (no hairline header, exactly like the image panes' Display menu when
 * only one section is applicable).
 *
 *  - `mode:"light"` (slide): the LIGHT curves (Linear · sRGB · Gamma ·
 *    Reinhard · ACES). `value` is the active curve id. Luts are gated out — a
 *    colormap on a light composite is meaningless (the compose path has no LUT
 *    stage). The `normal` remap is gated out too (the compose shader assembles
 *    with `remaps:false`, so it was a latent no-op on this path).
 *  - `mode:"scalar"` (diff): a `None` entry (the raw per-channel error, no
 *    false-color) + the colormap LUTs. `value` is `"none"` or a lut id. Curves
 *    are gated out — the diff display has no tone-map stage (error values aren't
 *    light; the design doc's DATA-encoding model: scalar error → sensitivity →
 *    LUT).
 */
export function compareDisplayToolbarButton(args: {
  mode: "light" | "scalar";
  /** LIGHT-mode curve ids to offer (ignored in scalar mode). */
  curveIds: readonly string[];
  /** Active curve id (light) — the value when `mode:"light"`. */
  curveValue: string;
  /** Active colormap (`"none"` or a lut id) — the value when `mode:"scalar"`. */
  lutValue: string;
  onSelectCurve: (id: string) => void;
  onSelectLut: (id: string) => void;
}): ToolbarButtonSpec {
  const { mode, curveIds, curveValue, lutValue, onSelectCurve, onSelectLut } = args;
  let options: ToolbarMenuOption[];
  let value: string;
  let onSelect: (id: string) => void;
  if (mode === "light") {
    options = curveIds.map((id) => ({ id, label: getEncoding(id)?.label ?? id }));
    value = curveValue;
    onSelect = onSelectCurve;
  } else {
    options = [
      { id: "none", label: "None" },
      ...listEncodingsByKind("lut").map((e) => ({ id: e.id, label: e.label })),
    ];
    value = lutValue;
    onSelect = onSelectLut;
  }
  return {
    id: "display",
    title: "Display encoding",
    menu: { options, value, onSelect },
  };
}

/**
 * The compare pane's ONE `encoding` id for the settings-sync bus (item 4 of the
 * compare-pane-on-DISPLAY-conventions follow-up), derived from the pane's two
 * mode-scoped faces so it carries the SAME `encoding` key the image panes
 * publish. In diff mode the active encoding IS the chosen colormap LUT (a data
 * encoding); with no colormap (`"none"`) OR in slide the active encoding is
 * the LIGHT curve — always a valid registry id, so an image-pane peer applying
 * `encoding` never lands on a non-registry token. The pane also publishes the
 * derived `colormap`/`tonemap` for pre-registry back-compat.
 */
export function deriveCompareEncodingId(
  mode: "light" | "scalar",
  curveId: string,
  colormap: string,
): string {
  if (mode === "scalar" && colormap && colormap !== "none") return colormap;
  return curveId;
}

/**
 * The colormap a SCALAR face (a diff) renders with, resolved from the
 * viewport's ONE encoding by APPLICABILITY (ruling 5): a LUT encoding IS the
 * colormap; a CURVE encoding doesn't apply to a scalar face, so the face's own
 * default (the diff kernel's) stands. Pure — panes consume this instead of
 * inspecting encoding kinds themselves.
 */
export function scalarFaceColormap(
  enc: Pick<PaneEncoding, "isLut" | "colormap">,
  faceDefault: string,
): string {
  return enc.isLut ? enc.colormap : faceDefault;
}

/** Config for {@link usePaneEncoding}. */
export interface PaneEncodingConfig {
  /** Surface mode (see `resolveDisplayEncodingIds`). */
  mode: "sdr" | "arity";
  /** Current source channel arity (used in `mode:"arity"`). */
  arity: number;
  /** Ordered curve/remap ids the pane can render (may include `"normal"`). */
  curveSet: readonly string[];
  /** Descriptor colormap seed (`"none"` or a LUT id). */
  propColormap: string;
  /** Descriptor tone-map seed (a curve id / deprecated alias / undefined). */
  propTonemap: string | null | undefined;
  /** Pane-specific default-curve resolver from `propTonemap` (HDR uses
   *  `resolveEffectiveTonemap`; the CPU-SDR transfer path coerces to
   *  srgb/gamma/linear). Must return a curve id. */
  resolveDefaultCurve: (propTonemap: string | null | undefined) => string;
  /** The viewport's settings store (the node-level accumulated
   *  `PlotSettings`). When it holds an `encoding`, that id IS the pane's
   *  encoding — derived by value every render, no local copy, no adoption
   *  effect. Applicability stays a render decision. */
  settings?: import("../../../settings/schema.ts").PlotSettings | null;
}

/** What a pane needs from the unified encoding state. */
export interface PaneEncoding {
  /** The active encoding id (the ONE source of truth). */
  encodingId: string;
  /** `true` when the active encoding is a colormap LUT. */
  isLut: boolean;
  /** Derived colormap value for the render/back-compat sync (`"none"` or a LUT id). */
  colormap: string;
  /** Derived curve id for the render/back-compat sync (the active curve, or the
   *  default curve when a LUT is active). */
  curveId: string;
  /** The section ids offered at the current arity/surface (feeds the menu). */
  ids: DisplayEncodingIds;
  /** `true` when the encoding differs from the authored seed at this arity. */
  encodingModified: boolean;
  /** Whether the ACTIVE encoding declares a given param (drives slider gating). */
  hasParam: (name: string) => boolean;
}

/**
 * Projects the viewport store's encoding into renderer-ready values. Descriptor
 * props are captured once as a bootstrap value while the owner initializes the
 * store; they are never a second mutable settings source.
 */
export function usePaneEncoding(config: PaneEncodingConfig): PaneEncoding {
  const { mode, arity, curveSet, propTonemap, resolveDefaultCurve } = config;
  const propColormap = config.propColormap;

  const idsFor = useCallback(
    (a: number): DisplayEncodingIds => resolveDisplayEncodingIds({ mode, arity: a, curveSet }),
    [mode, curveSet],
  );

  const pickDefaultCurve = useCallback(
    (avail: DisplayEncodingIds): string => {
      const d = resolveDefaultCurve(propTonemap);
      if (avail.curveIds.includes(d)) return d;
      return avail.curveIds[0] ?? avail.remapIds[0] ?? "srgb";
    },
    [resolveDefaultCurve, propTonemap],
  );

  const seedFor = useCallback(
    (a: number): string => {
      const avail = idsFor(a);
      const seedIsLut =
        !!propColormap && propColormap !== "none" && avail.lutIds.includes(propColormap);
      // "both set → colormap wins for scalars": lut is only in `lutIds` when the
      // arity permits it, so this already scopes the colormap win to scalars.
      return seedIsLut ? propColormap : pickDefaultCurve(avail);
    },
    [idsFor, pickDefaultCurve, propColormap],
  );

  const initialSeedRef = useRef<string>();
  if (initialSeedRef.current === undefined) initialSeedRef.current = seedFor(arity);

  // ONE owner: the viewport store. The immutable bootstrap seed exists only for
  // the first render before the owner's initialization effect fills the store.
  const storeId = config.settings?.["image.encoding"];
  const rawEncodingId = storeId ?? initialSeedRef.current;
  const encodingId = rawEncodingId;

  const ids = useMemo(() => idsFor(arity), [idsFor, arity]);
  const activeEncoding = getEncoding(encodingId);
  const isLut = activeEncoding?.kind === "lut";
  const curveId = isLut ? pickDefaultCurve(ids) : encodingId;
  const colormap = isLut ? encodingId : "none";
  const encodingModified = encodingId !== seedFor(arity);
  const hasParam = useCallback(
    (name: string) => !!getEncoding(encodingId)?.params.includes(name as never),
    [encodingId],
  );

  return {
    encodingId,
    isLut,
    colormap,
    curveId,
    ids,
    encodingModified,
    hasParam,
  };
}
