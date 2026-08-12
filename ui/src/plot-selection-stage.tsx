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
  useEffect,
  useId,
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
  gridColumns,
  imageCompatibleCount,
  planCompareGrid,
  type SelEntry,
} from "./lib/cairn-plot/selection/compare-grid";
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

/** The pane's display label (its `props.label`), falling back to the id. */
function paneLabel(pane: RegisteredPane): string {
  const l = pane.node.kind !== "grid" ? pane.node.props?.label : undefined;
  return typeof l === "string" && l ? l : pane.paneId;
}

/** Mark a node non-selectable so the FRESH stage leaf never mutates the page
 *  selection (the stage owns its own REF re-pick gesture). Grids aren't
 *  selectable/registered, so they pass through unchanged. */
function nonSelectable(node: PlotNode): PlotNode {
  if (node.kind === "grid") return node;
  return { ...node, props: { ...(node.props ?? {}), selectable: false } };
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
  for (const pair of plan.pairs) {
    const fg = getRegisteredPane(pair.foregroundId);
    const fgSpec = fg ? operandDataSpec(fg.node) : null;
    if (!fg || !fgSpec) continue;
    // cp.Compare(nonRef, ref): a = foreground, b = reference (baseline).
    const node: CompareNode = {
      kind: "compare",
      mode: "split",
      a: fgSpec,
      b: refSpec,
      baselineIndex: 1,
      props: { toolbar: true, selectable: false, label: paneLabel(fg) },
    };
    cells.push({
      key: `${pair.foregroundId}__vs__${plan.referenceId}`,
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

function StageCell({
  spec,
  onPickReference,
  viewportSyncGroupId,
  settingsSyncGroupId,
  isAnchor,
}: {
  spec: StageCellSpec;
  onPickReference: () => void;
  /** Shared VIEWPORT-sync group so zoom/pan on ONE cell broadcasts to every cell
   *  in the stage — the same mechanism the page-wide selection uses (via
   *  `PaneSyncContext.viewportSyncGroupId`). Omitting this was the "duplication":
   *  the stage rebuilt the sync context but dropped the viewport group, so only
   *  display settings synced, not zoom/pan. */
  viewportSyncGroupId: string;
  /** Shared settings-sync group so a colormap/tonemap/diff-mode change on ONE
   *  cell broadcasts to every cell in the stage (Bug 3). */
  settingsSyncGroupId: string;
  /** The single anchor cell seeds the group's snapshot. */
  isAnchor: boolean;
}) {
  const downRef = useRef<{ x: number; y: number; onControl: boolean } | null>(null);
  const onPointerDownCapture = useCallback((e: React.PointerEvent) => {
    const onControl = !!(e.target as Element | null)?.closest?.(
      'button, input, select, textarea, a, [role="menu"], [role="menuitem"], [contenteditable="true"]',
    );
    downRef.current = { x: e.clientX, y: e.clientY, onControl };
  }, []);
  const onPointerUpCapture = useCallback(
    (e: React.PointerEvent) => {
      const d = downRef.current;
      downRef.current = null;
      if (!d || d.onControl) return;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > REPICK_SLOP_PX) return;
      if (!spec.isReference) onPickReference();
    },
    [spec.isReference, onPickReference],
  );

  const style: React.CSSProperties = {
    position: "relative",
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
  } else {
    // The whole non-reference cell is the click-to-set-reference target.
    style.cursor = "pointer";
  }

  // Fill the cell (`height:100%`) so N cells stretch to fill the overlay height
  // (Bug 8): `ChartFillContext=true` makes the fresh `PaneSelectionFrame` +
  // `ChartBox` fill their track rather than collapse to content height. The
  // shared settings-sync group threads through the `PaneSyncContext` — the
  // non-selectable stage leaf passes it through to its inner leaf/compare.
  const paneSync = useMemo(
    () => ({ viewportSyncGroupId, settingsSyncGroupId, syncIsAnchor: isAnchor }),
    [viewportSyncGroupId, settingsSyncGroupId, isAnchor],
  );

  return (
    <div
      style={style}
      title={spec.isReference ? undefined : "Click to set as the reference"}
      data-cairn-stage-cell=""
      data-cairn-stage-ref={spec.isReference ? "true" : "false"}
      data-stage-repr-pane={spec.reprPaneId}
      onPointerDownCapture={onPointerDownCapture}
      onPointerUpCapture={onPointerUpCapture}
    >
      <div style={{ position: "relative", flex: "1 1 0%", minHeight: 0, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <ChartFillContext.Provider value={true}>
          <PaneSyncContext.Provider value={paneSync}>
            <SharedPlotContext.Provider value={{ source: spec.source, shared: spec.shared }}>
              <PlotNodeView node={spec.node} />
            </SharedPlotContext.Provider>
          </PaneSyncContext.Provider>
        </ChartFillContext.Provider>
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

      {/* No explicit "set reference" button: the WHOLE non-reference cell is the
          click target (see `onPointerUpCapture`), discoverable via the pointer
          cursor + tooltip below. An absolutely-positioned button had nowhere to
          live that didn't collide with pane chrome — top-right = toolbar,
          bottom = the compare metrics/label chips. */}
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
  const cols = gridColumns(cells.length);

  // TWO stage-wide sync groups — stable across ref re-picks / cell rebuilds
  // within a single open stage — so any zoom/pan (viewport) or display-setting
  // (colormap / tonemap / exposure / peak / diff mode) change on one cell
  // broadcasts to every other cell. Same mechanism the page-wide selection uses;
  // distinct ids because the stage renders FRESH leaves off its own buses.
  const viewportSyncGroupId = useId();
  const settingsSyncGroupId = useId();

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
        <StageModeToggle mode={mode} imageCount={imageCount} onSwitchMode={onSwitchMode} />
        <div
          data-cairn-stage-grid=""
          data-cairn-stage-mode={mode}
          style={{
            flex: "1 1 0%",
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            gridAutoRows: "1fr",
            gap: 8,
            width: "100%",
            minHeight: 0,
            padding: 8,
            overflow: "auto",
          }}
        >
          {cells.length === 0 ? (
            <div className="text-fg-muted" style={{ padding: 16, fontSize: 13 }}>
              Nothing to {mode === "compare" ? "compare" : "enlarge"}.
            </div>
          ) : (
            cells.map((spec, i) => (
              <StageCell
                key={spec.key}
                spec={spec}
                onPickReference={() => store.setReference(spec.reprPaneId)}
                viewportSyncGroupId={viewportSyncGroupId}
                settingsSyncGroupId={settingsSyncGroupId}
                isAnchor={i === 0}
              />
            ))
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
