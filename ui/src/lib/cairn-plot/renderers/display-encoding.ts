/**
 * `renderers/display-encoding.ts` — the ONE unified DISPLAY-ENCODING menu +
 * per-pane encoding state (Phase 3 of the display-encoding registry;
 * `docs/plans/2026-08-18-display-encoding-registry.md`).
 *
 * An image pane's colormap and tone-map menus were TWO controls answering ONE
 * question — "how do the selected channels become RGB". This module collapses
 * them into ONE arity-gated DISPLAY menu (`displayToolbarButton`) driven by the
 * `image/encodings` registry, plus a hook (`usePaneEncoding`) that owns the
 * SINGLE `encoding` id per pane: selecting a colormap LUT deactivates the curve
 * and vice-versa STRUCTURALLY (no more `colormap==="none" ? [...tonemap] : []`
 * per-pane conditionals). It also remembers the last-used encoding PER ARITY, so
 * flipping the channel selector back to a scalar restores its colormap.
 *
 * ## Arity gating (`resolveDisplayEncodingIds`)
 *   - `mode:"arity"` (the FLOAT/HDR path, which KNOWS its channel count from the
 *     source shape / channel selector): luts only at k=1; the `normal` remap only
 *     at k=3; curves always. This is the design's arity rule verbatim.
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ToolbarButtonSpec, ToolbarMenuOption } from "../controls/ToolbarConfig";
import { getEncoding, listEncodingsByKind, type NormMode } from "../image/encodings";

/** The DATA-encoding norm options, in menu order (Phase 4). Shown ONLY when a
 *  lut (data) encoding is active — a norm is the nonlinear domain mapping INSIDE
 *  a data encoding and is never applicable to a curve (see the design doc). */
export const NORM_MENU_OPTIONS: { id: NormMode; label: string }[] = [
  { id: "linear", label: "Linear" },
  { id: "log", label: "Log" },
  { id: "power", label: "Power" },
];

/**
 * The DATA-encoding NORM picker as a toolbar LEADING button (menu variant) — the
 * minimal 3-way selector (Linear · Log · Power) a pane shows ONLY while a
 * colormap LUT is the active encoding. `value` is the norm in effect; `onSelect`
 * receives the picked mode. Matches the display/colormap menu idiom (a
 * ToolbarButtonSpec dropdown), so it folds into the same leading-button row.
 */
export function normToolbarButton(
  value: NormMode,
  onSelect: (mode: NormMode) => void,
): ToolbarButtonSpec {
  return {
    id: "norm",
    title: "Colormap norm (Linear · Log · Power) — the nonlinear domain mapping inside the data encoding",
    menu: {
      options: NORM_MENU_OPTIONS,
      value,
      onSelect: (id: string) => onSelect(id as NormMode),
    },
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
    lutIds = arity === 1 ? allLutIds() : [];
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
  /** Set the active encoding (remembers it for the current arity). */
  setEncoding: (id: string) => void;
  /** HOME: back to the authored seed + clear per-arity memory. */
  resetEncoding: () => void;
  /** `true` when the encoding differs from the authored seed at this arity. */
  encodingModified: boolean;
  /** Whether the ACTIVE encoding declares a given param (drives slider gating). */
  hasParam: (name: string) => boolean;
}

/**
 * Owns the SINGLE per-pane encoding id: seeding (colormap wins over tonemap for
 * scalar sources), structural exclusivity (one id → curve XOR lut), per-arity
 * memory, and the arity fall-back when the channel selector flips to an arity
 * the active encoding doesn't support. The pane wraps `setEncoding` to also
 * publish to the settings-sync bus.
 */
export function usePaneEncoding(config: PaneEncodingConfig): PaneEncoding {
  const { mode, arity, curveSet, propColormap, propTonemap, resolveDefaultCurve } = config;

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

  const [encodingId, setEncodingId] = useState<string>(() => seedFor(arity));
  const memoryRef = useRef<Map<number, string>>(new Map());
  // Track the last props/arity so ONE effect can tell prop-reseed from arity-flip.
  const prevPropsRef = useRef<string>(`${propColormap} ${String(propTonemap)}`);
  const prevArityRef = useRef<number>(arity);

  useEffect(() => {
    const propsKey = `${propColormap} ${String(propTonemap)}`;
    if (propsKey !== prevPropsRef.current) {
      // Controlled surface: the descriptor changed → reseed + forget overrides.
      prevPropsRef.current = propsKey;
      prevArityRef.current = arity;
      memoryRef.current.clear();
      setEncodingId(seedFor(arity));
      return;
    }
    if (arity !== prevArityRef.current) {
      prevArityRef.current = arity;
      const avail = idsFor(arity);
      const remembered = memoryRef.current.get(arity);
      let next: string;
      if (remembered && avail.all.includes(remembered)) next = remembered;
      else if (avail.all.includes(encodingId)) next = encodingId;
      else next = pickDefaultCurve(avail);
      if (next !== encodingId) setEncodingId(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propColormap, propTonemap, arity]);

  const setEncoding = useCallback(
    (id: string) => {
      memoryRef.current.set(arity, id);
      setEncodingId(id);
    },
    [arity],
  );

  const resetEncoding = useCallback(() => {
    memoryRef.current.clear();
    setEncodingId(seedFor(arity));
  }, [seedFor, arity]);

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
    setEncoding,
    resetEncoding,
    encodingModified,
    hasParam,
  };
}
