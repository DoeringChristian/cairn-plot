/**
 * The page-level SELECTION STAGE + floating ACTION BAR (the "compare/enlarge via
 * selection" feature). Leverages the EXISTING page-wide selection (the one
 * document-scoped `SelectionStore`) so a user can enlarge or compare ARBITRARY
 * panes without app cards:
 *
 *   - ACTION BAR: when ≥2 panes are selected, a small floating bar (bottom-
 *     centre, body-portaled + themed) shows the count and two buttons —
 *     ENLARGE and COMPARE. Compare is disabled (with a tooltip) unless ≥2 of the
 *     selection are IMAGE-compatible (3D/chart panes can't be compared).
 *   - ENLARGE STAGE: a fullscreen grid of ALL selected panes, laid out ~√N
 *     columns. Falls back (from the per-pane enlarge button) to the single-pane
 *     overlay when <2 are selected.
 *   - COMPARE STAGE: a fullscreen grid of COMPARISONS — each selected non-
 *     reference image vs the REFERENCE (last-selected), so N image panes → N−1
 *     comparisons. Each comparison is a `CompareNode` (default `split`/"Slide").
 *   - REFERENCE RE-PICK: in BOTH stages the reference pane is badged (a REF chip
 *     + distinct ring); clicking another pane re-designates it the reference —
 *     in compare mode the comparisons recompute against the new reference.
 *
 * The stage renders FRESH leaves through `PlotNodeView` (each under the origin
 * pane's own `DataSource`, read from the pane registry) rather than reparenting
 * live canvases — the descriptors are cheap and the image data is by-reference
 * in the runtime store. It reuses the SHARED `FullscreenOverlayShell` chrome
 * (backdrop / ✕ / Escape / scroll-lock / themed portal) that the per-pane
 * enlarge also uses, so neither hand-rolls it.
 *
 * ONE host is mounted page-wide (`ensureSelectionOverlayHost`, a `document.body`
 * React root) regardless of how many `PlotApp` roots the page has — mirroring
 * the module-singleton selection store.
 */
import {
  useCallback,
  useReducer,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { PlotNodeView, SharedPlotContext, PaneSyncContext } from "./plot-node";
import { ChartFillContext } from "./plot-standalone-helpers";
import type { CompareNode, DataSpec, PlotNode, SharedProps } from "./plot-descriptor";
import type { DataSource } from "./lib/cairn-plot";
import {
  getGlobalSelectionStore,
  REFERENCE_COLOR,
  REFERENCE_COLOR_RGB,
  type SelectionSnapshot,
  type StageMode,
} from "./lib/cairn-plot/viewport/selection-store";
import {
  publishSettingsPatch,
  subscribeSettingsPatches,
  type ViewportSettings,
} from "./lib/cairn-plot/viewport/image-settings-sync";
import {
  imageCompatibleCount,
  planCompareGrid,
  type SelEntry,
} from "./lib/cairn-plot/selection/compare-grid";
import {
  packContentGrid,
  DEFAULT_STAGE_GAP,
  type Rect,
} from "./lib/cairn-plot/selection/pack-grid";
import {
  GridUniformAspectContext,
  DEFAULT_GRID_CELL_ASPECT,
  useUniformGridAspect,
  useReportCellAspect,
} from "./lib/cairn-plot/renderers/grid-uniform-aspect";
import { ReportNaturalSizeContext } from "./lib/cairn-plot/renderers/natural-size-report";
import {
  useStackKeyboard,
  StackTabStrip,
  GridModeToggle,
  stackLabelFor,
} from "./lib/cairn-plot/stack/StackedView";
import { InStackedGridContext } from "./lib/cairn-plot/stack/stack-context";
import FullscreenOverlayShell from "./lib/cairn-plot/primitives/FullscreenOverlayShell";
import { useOriginTheme } from "./lib/cairn-plot/primitives/themed-portal";
import {
  getRegisteredPane,
  getSelectionRegistryVersion,
  subscribeSelectionRegistry,
  type RegisteredPane,
} from "./plot-selection-pane-registry";

// ---------------------------------------------------------------------------
// Store bindings.
// ---------------------------------------------------------------------------

/** Subscribe to BOTH the selection store and the pane registry (a pane may
 *  finish mounting — and register — after the stage opens). */
function useSelectionSnapshot(): SelectionSnapshot {
  const store = getGlobalSelectionStore();
  const subscribe = useCallback((cb: () => void) => store.subscribe(cb), [store]);
  const getSnapshot = useCallback(() => store.getSnapshot(), [store]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function useRegistryVersion(): number {
  return useSyncExternalStore(
    subscribeSelectionRegistry,
    getSelectionRegistryVersion,
    getSelectionRegistryVersion,
  );
}

// ---------------------------------------------------------------------------
// Descriptor helpers.
// ---------------------------------------------------------------------------

/** The pane's REAL user caption (`props.label`) or undefined — NO id fallback, so
 *  a caption-less pane contributes no ugly "cp-pane-1" chip in the compare grid. */
function paneUserLabel(pane: RegisteredPane): string | undefined {
  const l = pane.node.kind !== "grid" ? pane.node.props?.label : undefined;
  return typeof l === "string" && l ? l : undefined;
}

/** Mark a node non-selectable so the FRESH stage leaf never mutates the page
 *  selection (the stage owns its own REF re-pick gesture). Grids aren't
 *  selectable/registered, so they pass through unchanged. */
// IDENTITY-STABLE wrapper cache: `built` re-runs on every reference re-pick,
// and the resolve cache keys on node OBJECT identity — fresh wrapper objects
// per rebuild forced a COLD re-resolve of every cell (a "Loading…" placeholder
// remount = the reported re-pick flicker). One wrapped node per source node
// keeps re-picked rebuilds warm.
const nonSelectableCache = new WeakMap<PlotNode, PlotNode>();
// Compare nodes per (foreground, reference) pairing — bounded by the panes on
// a page × references tried; entries die with the page (ids are page-scoped).
const compareNodeCache = new Map<string, CompareNode>();

function nonSelectable(node: PlotNode): PlotNode {
  if (node.kind === "grid") return node;
  let wrapped = nonSelectableCache.get(node);
  if (!wrapped) {
    wrapped = { ...node, props: { ...(node.props ?? {}), selectable: false } };
    nonSelectableCache.set(node, wrapped);
  }
  return wrapped;
}

/** The image DataSpec a pane contributes as a compare OPERAND: a leaf gives its
 *  own `data`; a compare pane gives its FOREGROUND side (the non-baseline one). */
function operandDataSpec(node: PlotNode): DataSpec | null {
  if (node.kind === "plot") return node.data;
  if (node.kind === "compare") return (node.baselineIndex ?? 0) === 0 ? node.b : node.a;
  return null;
}

/** Merge N panes' sources into one that can resolve any of their hashes. Same
 *  identity ⇒ that source verbatim (the common single-mount case); otherwise a
 *  thin composite that tries each in turn (cross-mount selection). URL-kind data
 *  specs never touch the source, so any works for them. */
function mergeSources(sources: DataSource[]): DataSource {
  const uniq = [...new Set(sources)];
  if (uniq.length <= 1) return uniq[0];
  return {
    artifactUrl: (h) => uniq[0].artifactUrl(h),
    async bytes(h) {
      let lastErr: unknown;
      for (const s of uniq) {
        try {
          return await s.bytes(h);
        } catch (e) {
          lastErr = e;
        }
      }
      throw lastErr ?? new Error(`no source could resolve ${h}`);
    },
    runtime(h) {
      for (const s of uniq) {
        const r = s.runtime?.(h);
        if (r) return r;
      }
      return undefined;
    },
  };
}

interface StageCellSpec {
  key: string;
  node: PlotNode;
  source: DataSource;
  shared?: SharedProps;
  /** The pane id this cell re-picks as the reference when clicked. */
  reprPaneId: string;
  /** Whether THIS cell IS the reference (enlarge stage badges its ref cell). */
  isReference: boolean;
}

/** Build the ENLARGE grid cells — one per selected (registered) pane. */
function buildEnlargeCells(entries: RegisteredPane[], referenceId: string | null): StageCellSpec[] {
  return entries.map((e) => ({
    key: e.paneId,
    node: nonSelectable(e.node),
    source: e.source,
    shared: e.shared,
    reprPaneId: e.paneId,
    isReference: e.paneId === referenceId,
  }));
}

/** Build the COMPARE grid cells — one `CompareNode` per non-reference image
 *  pane, each vs the reference. Returns the effective reference id too. */
function buildCompareCells(
  entries: RegisteredPane[],
  requestedReference: string | null,
): { cells: StageCellSpec[]; referenceId: string | null } {
  const sel: SelEntry[] = entries.map((e) => ({
    paneId: e.paneId,
    imageCompatible: e.imageCompatible,
  }));
  const plan = planCompareGrid(sel, requestedReference);
  if (!plan.referenceId) return { cells: [], referenceId: null };
  const ref = getRegisteredPane(plan.referenceId);
  const refSpec = ref ? operandDataSpec(ref.node) : null;
  if (!ref || !refSpec) return { cells: [], referenceId: plan.referenceId };

  const cells: StageCellSpec[] = [];
  let pairIndex = 0;
  for (const pair of plan.pairs) {
    const fg = getRegisteredPane(pair.foregroundId);
    const fgSpec = fg ? operandDataSpec(fg.node) : null;
    if (!fg || !fgSpec) continue;
    pairIndex += 1;
    // IDENTITY-STABLE compare node per (foreground, reference) pair: `built`
    // re-runs per re-pick and the resolve cache keys on node identity — a
    // cached node keeps a previously-seen pairing WARM (no placeholder
    // remount when toggling the reference back and forth).
    const pairKey = `${pair.foregroundId}__vs__${plan.referenceId}`;
    const cached = compareNodeCache.get(pairKey);
    // cp.Compare(nonRef, ref): a = foreground, b = reference (baseline). Thread
    // each pane's REAL caption to the matching slot (`labelA`=a=foreground,
    // `labelB`=b=reference) — the pane shows reference bottom-left, foreground
    // bottom-right (slide/blend) or folds them into the diff caption.
    // The FOREGROUND caption always gets a value (positional "View N" fallback):
    // its bottom-right chip is the stage's click-to-set-reference affordance, so
    // it must exist even for caption-less panes. The reference falls back to
    // "reference" so the left side stays identifiable.
    const node: CompareNode = cached ?? {
      kind: "compare",
      mode: "split",
      a: fgSpec,
      b: refSpec,
      baselineIndex: 1,
      props: {
        toolbar: true,
        selectable: false,
        labelA: paneUserLabel(fg) ?? `View ${pairIndex}`,
        labelB: paneUserLabel(ref) ?? "reference",
      },
    };
    if (!cached) compareNodeCache.set(pairKey, node);
    cells.push({
      key: pairKey,
      node,
      source: mergeSources([fg.source, ref.source]),
      shared: fg.shared,
      reprPaneId: pair.foregroundId,
      isReference: false,
    });
  }
  return { cells, referenceId: plan.referenceId };
}

// ---------------------------------------------------------------------------
// Stage cell — a fresh leaf + the REF badge / re-pick affordance.
// ---------------------------------------------------------------------------

const REPICK_SLOP_PX = 5;

// Per-OPEN counter for the stage's settings layer id. NOT `useId`: React can
// mint the same id for a remount at the same tree position, which would let a
// closed stage's (transient) edits haunt the next open. A monotonic counter
// guarantees every open gets a never-written layer.
let stageOpenSeq = 0;

function StageCell({
  spec,
  rect,
  fill,
  clickPicksRef,
  onPickReference,
  viewportSyncGroupId,
  stageSettingsGroupId,
  cellSettings,
  onCellSettings,
  onCellSettingsLocal,
}: {
  spec: StageCellSpec;
  /** The packed rect for this cell (content-aspect, centrally clustered). While
   *  the stage size is still being measured this is a zero box (invisible for the
   *  first frame). Ignored when `fill` is set. */
  rect: Rect | undefined;
  /** STACKED stage: fill the (single-visible) stacked pane box instead of the
   *  absolute packed rect. */
  fill?: boolean;
  /** ENLARGE mode: a plain stationary click ANYWHERE on the cell re-picks the
   *  reference (the cells are plain images — no gesture to collide with).
   *  COMPARE mode: false — compare panes own double-click-to-reset, so a cell
   *  click would hijack the first click of a double-click; there, ONLY a click
   *  on the pane's bottom-right FOREGROUND caption chip re-picks ("make this
   *  image the reference" — the chip names exactly that image). */
  clickPicksRef: boolean;
  /** Re-designate THIS cell as the reference. */
  onPickReference: () => void;
  /** Shared VIEWPORT-sync group so zoom/pan on ONE cell broadcasts to every cell
   *  in the stage — the same mechanism the page-wide selection uses (via
   *  `PaneSyncContext.viewportSyncGroupId`). Omitting this was the "duplication":
   *  the stage rebuilt the sync context but dropped the viewport group, so only
   *  display settings synced, not zoom/pan. */
  viewportSyncGroupId: string;
  /** The stage's per-open settings GROUP (NOSTACK): every cell is a NEW,
   *  INDEPENDENT viewport whose entry is seeded by COPY-ON-CREATE from its
   *  source pane's entry (the sources are group-synced, so cells open
   *  identical). Cells join this group so edits fan out across the stage —
   *  persist while open, and die with the stage's viewports on close. Stage
   *  edits never touch the original panes (user ruling: stage viewports are
   *  independent). */
  stageSettingsGroupId: string;
  /** The cell's live settings object (stage-owned) + the stage publisher. */
  cellSettings: ViewportSettings | null;
  onCellSettings: (patch: ViewportSettings) => void;
  onCellSettingsLocal: (patch: ViewportSettings) => void;
}) {
  // Re-pick gesture (stationary press, never a control press, never a drag).
  // ENLARGE: anywhere on the cell. COMPARE: only when the press started on the
  // pane's FOREGROUND caption chip (`data-cairn-compare-caption="foreground"`,
  // tagged by the shared `LabelChip` render sites) — event delegation, so the
  // compare pane itself stays presentation-only.
  const downRef = useRef<{ x: number; y: number; onControl: boolean; onFgChip: boolean } | null>(null);
  const cellClickEnabled = clickPicksRef && !spec.isReference;
  const chipClickEnabled = !clickPicksRef && !spec.isReference;
  const onPointerDownCapture = useCallback((e: React.PointerEvent) => {
    const target = e.target as Element | null;
    const onControl = !!target?.closest?.(
      'button, input, select, textarea, a, [role="menu"], [role="menuitem"], [contenteditable="true"]',
    );
    const onFgChip = !!target?.closest?.('[data-cairn-compare-caption="foreground"]');
    downRef.current = { x: e.clientX, y: e.clientY, onControl, onFgChip };
  }, []);
  const onPointerUpCapture = useCallback(
    (e: React.PointerEvent) => {
      const d = downRef.current;
      downRef.current = null;
      if (!d || d.onControl) return;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > REPICK_SLOP_PX) return;
      if (!cellClickEnabled && !d.onFgChip) return; // compare: only the fg chip picks
      onPickReference();
    },
    [cellClickEnabled, onPickReference],
  );

  // The cell is ABSOLUTELY positioned at its packed rect (content-aspect, centred
  // cluster) — not a stretch-to-fill grid track — so N panes cluster densely in
  // the middle instead of filling the quadrants (Part 2).
  const style: React.CSSProperties = {
    ...(fill
      ? { position: "relative", width: "100%", height: "100%" }
      : {
          position: "absolute",
          left: rect?.left ?? 0,
          top: rect?.top ?? 0,
          width: rect?.width ?? 0,
          height: rect?.height ?? 0,
        }),
    minWidth: 0,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    borderRadius: 6,
    overflow: "hidden",
  };
  if (spec.isReference) {
    // The reference cell rings in the DISTINCT ORANGE (`REFERENCE_COLOR`), NOT the
    // blue accent a regular cell would (Bug 2) — the pane every comparison is
    // taken against reads as special at a glance.
    style.outline = `2px solid ${REFERENCE_COLOR}`;
    style.outlineOffset = "-2px";
    style.boxShadow = `0 0 0 1px ${REFERENCE_COLOR}, 0 0 8px 1px rgb(${REFERENCE_COLOR_RGB} / 0.5)`;
    style.zIndex = 1;
  }

  // Fill the cell (`height:100%`) so N cells stretch to fill the overlay height:
  // `ChartFillContext=true` makes the fresh `PaneSelectionFrame` + `ChartBox`
  // fill their track rather than collapse to content height. The shared
  // settings-sync group threads through the `PaneSyncContext` — the
  // non-selectable stage leaf passes it through to its inner leaf/compare. The
  // pane's own content aspect flows up via `GridUniformAspectContext` (a
  // `GridCellReporter` inside `ImageStandalone`, since the stage provides that
  // context) — the SAME path `cp.Grid` uses.
  // THIS cell's settings are OWNED BY THE STAGE (see SelectionStage): the
  // cell receives its live object + the stage-channel publisher as props —
  // remounts (stacked tab flips, reference re-picks) re-attach to the same
  // persistent object, and a publish reaches every cell (hidden ones too).
  const paneSync = useMemo(
    () => ({
      viewportSyncGroupId,
      settingsSyncGroupId: stageSettingsGroupId,
      syncedSettings: cellSettings,
      setSyncedSettings: onCellSettings,
      applySyncedSettings: onCellSettingsLocal,
    }),
    [viewportSyncGroupId, stageSettingsGroupId, cellSettings, onCellSettings, onCellSettingsLocal],
  );

  // GENERAL per-cell aspect bridge: forward whatever this cell's pane publishes on
  // `ReportNaturalSizeContext` (images, COMPARE panes, any renderer with a natural
  // size) into the shared grid aspect map via the ONE keyed-report+withdraw helper,
  // so `packContentGrid` sizes to the real content aspect for ALL cell types — not
  // just images. An image leaf's inner `GridCellReporter` provides a nearer provider
  // that shadows this one, so each cell reports exactly once.
  const setCellAspect = useReportCellAspect();
  const reportAspect = useCallback(
    (w: number, h: number) => {
      if (w > 0 && h > 0) setCellAspect(w / h);
    },
    [setCellAspect],
  );

  if (cellClickEnabled) style.cursor = "pointer";
  const pickHandlersOn = cellClickEnabled || chipClickEnabled;

  return (
    <div
      style={style}
      title={cellClickEnabled ? "Click to set as the reference" : undefined}
      data-cairn-stage-cell=""
      data-cairn-stage-ref={spec.isReference ? "true" : "false"}
      data-cairn-stage-chip-pick={chipClickEnabled ? "true" : undefined}
      data-stage-repr-pane={spec.reprPaneId}
      onPointerDownCapture={pickHandlersOn ? onPointerDownCapture : undefined}
      onPointerUpCapture={pickHandlersOn ? onPointerUpCapture : undefined}
    >
      <div style={{ position: "relative", flex: "1 1 0%", minHeight: 0, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <ReportNaturalSizeContext.Provider value={reportAspect}>
          <ChartFillContext.Provider value={true}>
            <PaneSyncContext.Provider value={paneSync}>
              <SharedPlotContext.Provider value={{ source: spec.source, shared: spec.shared }}>
                <PlotNodeView node={spec.node} />
              </SharedPlotContext.Provider>
            </PaneSyncContext.Provider>
          </ChartFillContext.Provider>
        </ReportNaturalSizeContext.Provider>
      </div>

      {/* REF badge (enlarge: the reference cell; compare: the shared reference). */}
      {spec.isReference && (
        <span
          data-cairn-stage-ref-chip=""
          className="cairn-plot-doc"
          style={{
            position: "absolute",
            top: 6,
            left: 6,
            zIndex: 2,
            padding: "2px 7px",
            borderRadius: 9999,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.04em",
            background: REFERENCE_COLOR,
            color: "#fff",
            pointerEvents: "none",
          }}
        >
          REF
        </span>
      )}

      {/* COMPARE-mode re-pick affordance: the pane's OWN bottom-right FOREGROUND
          caption chip (which names exactly the image being compared) is the
          click target — see the delegated pointer handlers above. No overlay
          button: every floating placement collided with pane chrome (top-right
          toolbar, top-left ring/badge, top-centre menus, bottom captions and
          metrics). The chip's clickable styling is a ONE-per-stage scoped
          <style> in `SelectionStage`; the chip itself stays presentation-only
          in the renderer. */}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The stage overlay.
// ---------------------------------------------------------------------------

function SelectionStage({
  mode,
  entries,
  imageCount,
  requestedReference,
  originRef,
  onClose,
  onSwitchMode,
}: {
  mode: StageMode;
  entries: RegisteredPane[];
  /** How many of the selected panes can be compared (image-compatible). Compare
   *  needs ≥2; below that the toggle's Compare segment is disabled. */
  imageCount: number;
  requestedReference: string | null;
  originRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  /** Switch the live stage to the other mode (enlarge ⇄ compare) without
   *  closing — the reference pin + selection carry over. */
  onSwitchMode: (mode: StageMode) => void;
}) {
  const store = getGlobalSelectionStore();
  const built = useMemo(() => {
    if (mode === "compare") return buildCompareCells(entries, requestedReference);
    return { cells: buildEnlargeCells(entries, requestedReference), referenceId: requestedReference };
  }, [mode, entries, requestedReference]);

  const cells = built.cells;

  // STAGE SYNC LAYERS. Viewport (zoom/pan): a stage-own group — stable across
  // ref re-picks / cell rebuilds within one open stage — so a zoom on one cell
  // broadcasts to every other cell without touching the grid panes underneath.
  // Settings: the cells read THROUGH the live selection's per-episode group
  // (they open showing exactly the settings the user synced on the selection)
  // while their edits land in a FRESH per-open stage layer stacked on top —
  // synced stage-wide, discarded on close, never written into the selection
  // group (user ruling: stage edits are transient). The per-open counter — not
  // `useId`, which can repeat across remounts at the same tree position —
  // guarantees a closed stage's edits can never haunt the next open.
  const viewportSyncGroupId = useId();
  const [stageSettingsGroupId] = useState(() => `cp-stage-st-${++stageOpenSeq}`);

  // STAGE-OWNED CELL SETTINGS (the object model): the stage — the creator of
  // its cells' viewports — owns ONE plain settings object per cell for the
  // whole open, seeded by COPY from the source pane's live settings (deref
  // via the pane registry) the first time each cell appears. ONE stage-channel
  // subscription applies every published patch to ALL cell objects — mounted
  // or not — so a stacked stage's edit reaches hidden siblings and tab flips
  // re-attach to consistent, persistent state. Cells publish; the stage
  // applies; originals are never touched (independence ruling).
  const cellSettingsRef = useRef(new Map<string, ViewportSettings | null>());
  const [, bumpCellSettings] = useReducer((c: number) => c + 1, 0);
  for (const cell of cells) {
    if (!cellSettingsRef.current.has(cell.key)) {
      const src = getRegisteredPane(cell.reprPaneId)?.settings?.get() ?? null;
      cellSettingsRef.current.set(cell.key, src ? { ...src } : null);
    }
  }
  useEffect(
    () =>
      subscribeSettingsPatches(stageSettingsGroupId, (patch) => {
        for (const [key, prev] of cellSettingsRef.current) {
          cellSettingsRef.current.set(key, { ...(prev ?? {}), ...patch });
        }
        bumpCellSettings();
      }),
    [stageSettingsGroupId],
  );
  const publishCellSettings = useCallback(
    (patch: ViewportSettings) => publishSettingsPatch(stageSettingsGroupId, patch),
    [stageSettingsGroupId],
  );
  // LOCAL apply for ONE cell (initialization writes — never fanned).
  const applyCellSettings = useCallback((cellKey: string, patch: ViewportSettings) => {
    const prev = cellSettingsRef.current.get(cellKey) ?? null;
    cellSettingsRef.current.set(cellKey, { ...(prev ?? {}), ...patch });
    bumpCellSettings();
  }, []);

  // --- UNIFORM CONTENT-ASPECT PACKING ----------------------------------------
  // The stage is a UNIFORM grid, driven by the SAME size-computation mechanism as
  // `cp.Grid` ({@link useUniformGridAspect} + `GridUniformAspectContext`): each
  // cell's pane reports its content aspect (via `GridCellReporter`, reached
  // through the normal `ImageStandalone` path once the context is present), the
  // grid picks the REPRESENTATIVE (median) aspect, and `packContentGrid` packs
  // every cell to that ONE aspect — maximally filling the fullscreen box and
  // clustering centrally. Identical cells mean a synced zoom/pan lines up pixel-
  // for-pixel; a mismatched image letterboxes within its uniform cell.
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [stageSize, setStageSize] = useState<{ w: number; h: number } | null>(null);
  const gridAspectApi = useUniformGridAspect();
  const aspect = gridAspectApi.uniformAspect ?? DEFAULT_GRID_CELL_ASPECT;

  useLayoutEffect(() => {
    const el = gridRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      setStageSize((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pack = useMemo(
    () =>
      packContentGrid({
        count: cells.length,
        width: stageSize?.w ?? 0,
        height: stageSize?.h ?? 0,
        aspect,
        gap: DEFAULT_STAGE_GAP,
      }),
    [cells.length, stageSize, aspect],
  );

  // STACKED stage: show ONE selected pane at a time + a tab strip (the same
  // grid/stacked toggle as `cp.Grid`). Keyboard flips between the tabs (the stage
  // is a fullscreen overlay, so keys act unconditionally).
  const canStack = cells.length > 1;
  const [stackMode, setStackMode] = useState<"normal" | "stacked">("normal");
  const [stackActive, setStackActive] = useState(0);
  const stackedNow = canStack && stackMode === "stacked";
  const stackActiveClamped = Math.min(stackActive, Math.max(0, cells.length - 1));
  // The stage is a fullscreen overlay → tab keys act unconditionally (no
  // hover/focus), like the slide-flip. This hook runs ABOVE the overlay's own
  // context provider, so pass `inOverlay` explicitly.
  useStackKeyboard(gridRef, stackedNow, stackActiveClamped, cells.length, setStackActive, { inOverlay: true });

  return (
    <FullscreenOverlayShell
      open
      onClose={onClose}
      originRef={originRef}
      ariaLabel={mode === "compare" ? "Compare selected panes" : "Enlarge selected panes"}
      backdropAttr="data-cairn-plot-stage-backdrop"
      frameAttr="data-cairn-plot-stage-frame"
      closeAttr="data-cairn-plot-stage-close"
    >
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", minHeight: 0 }}>
        {/* COMPARE mode: the panes' bottom-right FOREGROUND caption chip is the
            click-to-set-reference target (StageCell delegates the gesture); this
            one scoped style makes it read as clickable. */}
        {mode === "compare" && (
          <style>{`
            [data-cairn-stage-chip-pick] [data-cairn-compare-caption="foreground"] {
              cursor: pointer;
              text-decoration: underline dotted;
              text-underline-offset: 2px;
            }
            [data-cairn-stage-chip-pick] [data-cairn-compare-caption="foreground"]:hover {
              outline: 1px solid ${REFERENCE_COLOR};
              color: #fff;
            }
          `}</style>
        )}
        <div className="group flex items-center gap-2">
          <StageModeToggle mode={mode} imageCount={imageCount} onSwitchMode={onSwitchMode} />
          <div style={{ flex: 1 }} />
          {canStack && <GridModeToggle mode={stackedNow ? "stacked" : "normal"} onChange={setStackMode} />}
        </div>
        {stackedNow && cells.length > 0 && (
          <div className="mt-1 flex min-w-0">
            <StackTabStrip
              labels={cells.map((spec, i) => stackLabelFor(spec.node, i))}
              active={stackActiveClamped}
              onSelect={setStackActive}
            />
          </div>
        )}
        <div
          ref={gridRef}
          data-cairn-stage-grid=""
          data-cairn-stage-mode={mode}
          data-cairn-stage-stack={stackedNow ? "stacked" : "normal"}
          data-cairn-stage-cols={pack.cols}
          data-cairn-stage-rows={pack.rows}
          style={{
            flex: "1 1 0%",
            position: "relative",
            width: "100%",
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          {cells.length === 0 ? (
            <div className="text-fg-muted" style={{ padding: 16, fontSize: 13 }}>
              Nothing to {mode === "compare" ? "compare" : "enlarge"}.
            </div>
          ) : (
            <GridUniformAspectContext.Provider value={gridAspectApi}>
              {stackedNow ? (
                // STACKED: ONE reused cell fills the overlay area and swaps its
                // source on a tab flip — same single-renderer model as `cp.Grid`
                // (no N panes, no overflow). `InStackedGridContext` marks it so a
                // compare cell routes its slide-flip to `[`/`]` (arrows drive tabs).
                <InStackedGridContext.Provider value={true}>
                  <div
                    data-cairn-stacked-view=""
                    data-cairn-stack-active={stackActiveClamped}
                    style={{ width: "100%", height: "100%", minWidth: 0, minHeight: 0 }}
                  >
                    <StageCell
                      spec={cells[stackActiveClamped]!}
                      rect={undefined}
                      fill
                      clickPicksRef={mode === "enlarge"}
                      onPickReference={() => store.setReference(cells[stackActiveClamped]!.reprPaneId)}
                      viewportSyncGroupId={viewportSyncGroupId}
                      stageSettingsGroupId={stageSettingsGroupId}
                      cellSettings={cellSettingsRef.current.get(cells[stackActiveClamped]!.key) ?? null}
                      onCellSettings={publishCellSettings}
                      onCellSettingsLocal={(patch) => applyCellSettings(cells[stackActiveClamped]!.key, patch)}
                    />
                  </div>
                </InStackedGridContext.Provider>
              ) : (
                cells.map((spec, i) => (
                  <StageCell
                    key={spec.key}
                    spec={spec}
                    rect={pack.rects[i]}
                    clickPicksRef={mode === "enlarge"}
                    onPickReference={() => store.setReference(spec.reprPaneId)}
                    viewportSyncGroupId={viewportSyncGroupId}
                    stageSettingsGroupId={stageSettingsGroupId}
                    cellSettings={cellSettingsRef.current.get(spec.key) ?? null}
                    onCellSettings={publishCellSettings}
                    onCellSettingsLocal={(patch) => applyCellSettings(spec.key, patch)}
                  />
                ))
              )}
            </GridUniformAspectContext.Provider>
          )}
        </div>
      </div>
    </FullscreenOverlayShell>
  );
}

/** The in-stage segmented control that toggles the live stage between ENLARGE
 *  and COMPARE. Answers "I picked a reference in enlarge — now compare against
 *  it": switching to Compare rebuilds the grid as each non-reference vs the
 *  (carried-over) reference. Compare is disabled below 2 image-compatible panes.
 *  Reuses the same segmented styling as the pre-stage action bar. */
function StageModeToggle({
  mode,
  imageCount,
  onSwitchMode,
}: {
  mode: StageMode;
  imageCount: number;
  onSwitchMode: (mode: StageMode) => void;
}) {
  const compareDisabled = imageCount < 2;
  const seg = (m: StageMode, label: string, disabled: boolean, title: string) => {
    const active = mode === m;
    return (
      <button
        type="button"
        data-cairn-stage-mode-btn={m}
        data-active={active ? "true" : "false"}
        disabled={disabled}
        title={title}
        onClick={() => !disabled && !active && onSwitchMode(m)}
        className={
          active
            ? "bg-accent text-white"
            : "text-fg-muted hover:text-fg hover:bg-bg-hover disabled:opacity-40 disabled:cursor-not-allowed"
        }
        style={{
          padding: "4px 14px",
          borderRadius: 9999,
          fontSize: 12,
          fontWeight: 600,
          cursor: disabled || active ? "default" : "pointer",
          border: "none",
          background: active ? undefined : "transparent",
        }}
      >
        {label}
      </button>
    );
  };
  return (
    <div
      data-cairn-stage-toolbar=""
      style={{ display: "flex", justifyContent: "center", padding: "8px 8px 0", flex: "0 0 auto" }}
    >
      <div
        className="rounded-full border border-border bg-bg-elevated shadow-sm"
        style={{ display: "flex", alignItems: "center", gap: 2, padding: 3, borderRadius: 9999 }}
      >
        {seg("enlarge", "Enlarge", false, "Show every selected pane enlarged")}
        {seg(
          "compare",
          "Compare",
          compareDisabled,
          compareDisabled
            ? "Select at least 2 image panes to compare against the reference"
            : "Compare each selected image against the reference (last-selected)",
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Floating action bar.
// ---------------------------------------------------------------------------

function SelectionActionBar({
  count,
  imageCount,
  originRef,
  onEnlarge,
  onCompare,
}: {
  count: number;
  imageCount: number;
  originRef: React.RefObject<HTMLElement | null>;
  onEnlarge: () => void;
  onCompare: () => void;
}) {
  const theme = useOriginTheme(true, originRef);
  const compareDisabled = imageCount < 2;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className={theme.className}
      data-theme={theme["data-theme"]}
      data-cairn-selection-actionbar=""
      style={{
        position: "fixed",
        left: "50%",
        bottom: 20,
        transform: "translateX(-50%)",
        zIndex: 2147482000,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 12px",
        borderRadius: 9999,
        pointerEvents: "auto",
        ...theme.style,
      }}
    >
      <div
        className="rounded-full border border-border bg-bg-elevated shadow-2xl"
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", borderRadius: 9999 }}
      >
        <span className="text-fg-muted" style={{ fontSize: 12, fontWeight: 600, paddingLeft: 4 }} data-cairn-selection-count="">
          {count} selected
        </span>
        <button
          type="button"
          data-cairn-action="enlarge"
          onClick={onEnlarge}
          title="Enlarge the selected panes (fullscreen grid)"
          className="border border-border bg-bg-elevated text-fg hover:bg-bg-hover focus:outline-none focus:ring-2 focus:ring-accent"
          style={{ padding: "5px 12px", borderRadius: 9999, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
        >
          Enlarge
        </button>
        <button
          type="button"
          data-cairn-action="compare"
          disabled={compareDisabled}
          onClick={onCompare}
          title={
            compareDisabled
              ? "Select at least 2 image panes to compare (3D/chart panes can't be compared)"
              : "Compare each selected image against the reference (last-selected)"
          }
          className="border border-border bg-bg-elevated text-fg hover:bg-bg-hover focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ padding: "5px 12px", borderRadius: 9999, fontSize: 12, fontWeight: 600, cursor: compareDisabled ? "not-allowed" : "pointer" }}
        >
          Compare
        </button>
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// The page-wide host — one per page, subscribing to the selection store.
// ---------------------------------------------------------------------------

function SelectionOverlayRoot() {
  const store = getGlobalSelectionStore();
  const snap = useSelectionSnapshot();
  useRegistryVersion(); // re-render when pane registrations change

  const [stage, setStage] = useState<StageMode | null>(null);

  // A per-pane enlarge button (≥2 selected) routes here via the store's stage
  // channel — open the ENLARGE stage. The action bar sets `stage` directly.
  useEffect(() => store.onStageRequest((m) => setStage(m)), [store]);

  // Bug 1 — CLICK EMPTY SPACE deselects. A stationary press whose target is
  // neither a selectable pane frame NOR interactive UI (the action bar, a stage
  // overlay, or any menu/control) clears the whole selection. Tracked down→up
  // with a small slop so a drag (text-select / pan that begins on the page
  // background) never counts as a deselect click. Attached at the document while
  // any selection exists; a no-op when the click lands on a pane or on UI.
  useEffect(() => {
    if (typeof document === "undefined") return;
    let down: { x: number; y: number; ignore: boolean } | null = null;
    const isInteractive = (t: EventTarget | null): boolean => {
      const el = t as Element | null;
      return !!el?.closest?.(
        '[data-plot-pane-id][data-selectable="true"],' +
          "[data-cairn-selection-actionbar]," +
          "[data-cairn-selection-overlay-host]," +
          "[data-cairn-plot-stage-backdrop]," +
          "[data-cairn-plot-enlarge-backdrop]," +
          'button,input,select,textarea,a,[role="menu"],[role="menuitem"],' +
          '[role="listbox"],[role="option"],[role="dialog"],[contenteditable="true"]',
      );
    };
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY, ignore: isInteractive(e.target) };
    };
    const onUp = (e: PointerEvent) => {
      const d = down;
      down = null;
      if (!d || d.ignore) return;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) return;
      // Never deselect from under an open stage (its own backdrop click closes it).
      if (isInteractive(e.target)) return;
      store.clear();
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("pointerup", onUp, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("pointerup", onUp, true);
    };
  }, [store]);

  const entries = useMemo(
    () => snap.selected.map((id) => getRegisteredPane(id)).filter((e): e is RegisteredPane => !!e),
    [snap.selected],
  );
  const imageCount = useMemo(
    () => imageCompatibleCount(entries.map((e) => ({ paneId: e.paneId, imageCompatible: e.imageCompatible }))),
    [entries],
  );

  // Theme origin = the first selected pane's in-tree element (stable-ish; all
  // panes on a page share the theme). Kept in a ref for the portaled overlays.
  const originRef = useRef<HTMLElement | null>(null);
  originRef.current = entries[0]?.getElement() ?? null;

  // Auto-close the stage if the selection drops below what it needs.
  useEffect(() => {
    if (stage && entries.length < 2) setStage(null);
    if (stage === "compare" && imageCount < 2) setStage(null);
  }, [stage, entries.length, imageCount]);

  const showBar = stage === null && snap.selected.length >= 2 && entries.length >= 2;

  return (
    <>
      {stage && entries.length >= 2 && (
        <SelectionStage
          mode={stage}
          entries={entries}
          imageCount={imageCount}
          requestedReference={snap.reference}
          originRef={originRef}
          onClose={() => setStage(null)}
          onSwitchMode={(m) => {
            // Guard the same invariant the action bar does: never enter compare
            // without ≥2 image-compatible panes (the toggle disables it too).
            if (m === "compare" && imageCount < 2) return;
            setStage(m);
          }}
        />
      )}
      {showBar && (
        <SelectionActionBar
          count={snap.selected.length}
          imageCount={imageCount}
          originRef={originRef}
          onEnlarge={() => setStage("enlarge")}
          onCompare={() => imageCount >= 2 && setStage("compare")}
        />
      )}
    </>
  );
}

let hostRoot: Root | null = null;
let hostEl: HTMLElement | null = null;

/**
 * Mount the ONE page-wide selection overlay host (action bar + stage) on
 * `document.body`, idempotently. Called from every `PlotApp` mount effect; the
 * singleton guard means only the first actually mounts it, so a gallery of many
 * independent `PlotApp` roots still gets exactly one host.
 */
export function ensureSelectionOverlayHost(): void {
  if (typeof document === "undefined" || hostRoot) return;
  hostEl = document.createElement("div");
  hostEl.setAttribute("data-cairn-selection-overlay-host", "");
  document.body.appendChild(hostEl);
  hostRoot = createRoot(hostEl);
  hostRoot.render(<SelectionOverlayRoot />);
}

/** Tests only — tear the host down + clear the registry. */
export function __resetSelectionOverlayHostForTest(): void {
  if (hostRoot) {
    hostRoot.unmount();
    hostRoot = null;
  }
  if (hostEl) {
    hostEl.remove();
    hostEl = null;
  }
}
