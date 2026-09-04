/**
 * `renderers/display-operation.ts` — the ONE unified DISPLAY-ENCODING menu +
 * viewport encoding projection.
 *
 * An image pane's colormap and tone-map menus were TWO controls answering ONE
 * question — "how do the selected channels become RGB". This module collapses
 * them into ONE arity-gated DISPLAY menu (`displayToolbarButton`) driven by the
 * `image/encodings` registry, plus a hook (`usePaneEncoding`) that projects the
 * viewport's SINGLE `encoding` id: selecting a colormap LUT deactivates the curve
 * and vice-versa structurally. Mutable state remains in the surface settings
 * store.
 *
 * ## Arity gating (`resolveDisplayOperationIds`)
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
import type { ImageBackendCapabilities } from "../backend.ts";
import { getDisplayOperation, listDisplayOperations, type ReduceMode } from "../definition/display-operations.ts";
import { projectDisplayOperation, type CapabilityFallback } from "../definition/core.ts";

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
export interface DisplayOperationIds {
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
  return listDisplayOperations("colormap").map((e) => e.id);
}

/** The colormap LUT ids whose declared `arities` include `arity`. Colormaps now
 *  support every k∈[1,4] (a k>1 sample is REDUCED to a scalar before the LUT —
 *  the multi-channel follow-up), so this is the full set at any 1..4 arity and
 *  empty beyond it. */
function lutIdsForArity(arity: number): string[] {
  return listDisplayOperations("colormap")
    .filter((e) => e.arities.includes(arity))
    .map((e) => e.id);
}

/**
 * Which encoding ids a pane offers, given its surface mode + arity + the curve
 * set it can actually render. `curveSet` is an ORDERED list of curve/remap ids
 * (it may include `"normal"`); curves and the `normal` remap are split into
 * their sections here. Seeding stays catalogue-level; only the offered menu is
 * intersected with the backend.
 */
export function resolveDisplayOperationIds(opts: {
  mode: "sdr" | "arity";
  arity: number;
  curveSet: readonly string[];
  /** The ACTIVE backend's declaration: the menu is catalogue ∩ backend. */
  capabilities: Pick<ImageBackendCapabilities, "supportsDisplayOperation">;
}): DisplayOperationIds {
  const { mode, arity, curveSet, capabilities } = opts;
  const supported = (id: string) => capabilities.supportsDisplayOperation(id);
  const curveIds = curveSet.filter((id) => getDisplayOperation(id)?.category === "curve").filter(supported);
  const hasNormal = curveSet.some((id) => getDisplayOperation(id)?.category === "remap") && supported("normal");
  let lutIds: string[];
  let remapIds: string[];
  if (mode === "sdr") {
    // No channel-count knowledge → offer the full applicable set.
    lutIds = allLutIds().filter(supported);
    remapIds = hasNormal ? ["normal"] : [];
  } else {
    // Colormaps are legal at every k∈[1,4] (the multi-channel follow-up reduces a
    // k>1 sample to a scalar before the LUT); the `normal` remap stays k=3 only.
    lutIds = lutIdsForArity(arity).filter(supported);
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
  ids: DisplayOperationIds;
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
    for (const id of s.ids) options.push({ id, label: getDisplayOperation(id)?.label ?? id });
  }
  return {
    id: "display",
    title: "Display encoding",
    menu: { options, value, onSelect },
  };
}

/** Config for {@link usePaneEncoding}. */
export interface PaneEncodingConfig {
  /** Surface mode (see `resolveDisplayOperationIds`). */
  mode: "sdr" | "arity";
  /** Current source channel arity (used in `mode:"arity"`). */
  arity: number;
  /** Ordered curve/remap ids the pane can render (may include `"normal"`). */
  curveSet: readonly string[];
  /** Optional authored LUT seed. Absence falls back to the authored/default
   * display operation; it is not itself a display operation. */
  propColormap: string | null | undefined;
  /** Descriptor tone-map seed (a canonical curve id or undefined). */
  propTonemap: string | null | undefined;
  /** Pane-specific default-curve resolver from `propTonemap`. The CPU-SDR
   * transfer path may restrict the result to srgb/gamma/linear. */
  resolveDefaultCurve: (propTonemap: string | null | undefined) => string;
  /** The cell's settings store (the node-level accumulated
   *  `PlotSettings`). When it holds an `encoding`, that id IS the pane's
   *  encoding — derived by value every render, no local copy, no adoption
   *  effect. Applicability stays a render decision. */
  settings?: import("../../../settings/schema.ts").PlotSettings | null;
  /** The ACTIVE backend's display capability. The menu is catalogue ∩ backend;
   *  a store id the backend lacks is PROJECTED (read-time, never written back)
   *  onto the core fallback and reported through {@link PaneEncoding.fallback}. */
  capabilities: Pick<ImageBackendCapabilities, "supportsDisplayOperation">;
}

/** What a pane needs from the unified encoding state. */
export interface PaneEncoding {
  /** The active encoding id (the ONE source of truth). */
  displayOperationId: string;
  /** `true` when the active encoding is a colormap LUT. */
  isLut: boolean;
  /** Derived LUT id when the active operation uses one. */
  colormap: string | null;
  /** Derived curve id for the render/back-compat sync (the active curve, or the
   *  default curve when a LUT is active). */
  curveId: string;
  /** The section ids offered at the current arity/surface (feeds the menu). */
  ids: DisplayOperationIds;
  /** `true` when the encoding differs from the authored seed at this arity. */
  displayOperationModified: boolean;
  /** Whether the ACTIVE encoding declares a given param (drives slider gating). */
  hasParam: (name: string) => boolean;
  /** The substitution in effect when the raw store id is unsupported here, else `null`. */
  fallback: CapabilityFallback | null;
}

/** Catalogue-level pseudo-capability used for SEEDING only (never for the
 *  offered menu): every registered display operation is "supported" here, so
 *  `idsFor`/`seedFor` resolve against the full catalogue regardless of which
 *  backend is active. Only the menu (`ids`) is intersected with the real
 *  backend capabilities. */
const CATALOGUE: Pick<ImageBackendCapabilities, "supportsDisplayOperation"> = {
  supportsDisplayOperation: (id) => !!getDisplayOperation(id),
};

/**
 * Projects the viewport store's encoding into renderer-ready values. Descriptor
 * props are captured once as a bootstrap value while the owner initializes the
 * store; they are never a second mutable settings source.
 */
export function usePaneEncoding(config: PaneEncodingConfig): PaneEncoding {
  const { mode, arity, curveSet, propTonemap, resolveDefaultCurve, capabilities } = config;
  const propColormap = config.propColormap;

  // Seeding stays catalogue-level: the authored seed must resolve the same way
  // regardless of which backend is active. Only the offered menu (`ids` below)
  // is intersected with the real backend capabilities.
  const idsFor = useCallback(
    (a: number): DisplayOperationIds => resolveDisplayOperationIds({ mode, arity: a, curveSet, capabilities: CATALOGUE }),
    [mode, curveSet],
  );

  // Derived curve for a LUT, not a user selection: choosing the first supported
  // curve when the default is unavailable is intentional and needs no fallback
  // record.
  const pickDefaultCurve = useCallback(
    (avail: DisplayOperationIds): string => {
      const d = resolveDefaultCurve(propTonemap);
      if (avail.curveIds.includes(d)) return d;
      return avail.curveIds[0] ?? avail.remapIds[0] ?? "srgb";
    },
    [resolveDefaultCurve, propTonemap],
  );

  const seedFor = useCallback(
    (a: number): string => {
      const avail = idsFor(a);
      const seedIsLut = !!propColormap && avail.lutIds.includes(propColormap);
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

  // The offered menu IS the catalogue intersected with the active backend.
  const ids = useMemo(
    () => resolveDisplayOperationIds({ mode, arity, curveSet, capabilities }),
    [mode, arity, curveSet, capabilities],
  );

  // The raw store id is PROJECTED (read-time only, never written back) onto the
  // core fallback when the active backend cannot render it.
  const projection = projectDisplayOperation(rawEncodingId, capabilities);
  const displayOperationId = projection.effective;

  const activeEncoding = getDisplayOperation(displayOperationId);
  const isLut = activeEncoding?.category === "colormap";
  const curveId = isLut ? pickDefaultCurve(ids) : displayOperationId;
  const colormap = isLut ? displayOperationId : null;
  const displayOperationModified = rawEncodingId !== seedFor(arity);
  const hasParam = useCallback(
    (name: string) => !!getDisplayOperation(displayOperationId)?.parameters.includes(name as never),
    [displayOperationId],
  );

  return {
    displayOperationId,
    isLut,
    colormap,
    curveId,
    ids,
    displayOperationModified,
    hasParam,
    fallback: projection.fallback,
  };
}
