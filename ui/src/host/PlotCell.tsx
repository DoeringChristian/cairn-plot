import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import type { PlotNode } from "../../../packages/spec/src/spec.ts";
import {
  getGlobalSelectionStore,
  nextSelectionPaneId,
  paneSyncGroups,
  GLOBAL_SELECTION_BASE,
  REFERENCE_COLOR,
  REFERENCE_COLOR_RGB,
  type SelectionMode,
} from "../state/selection/selection-store.ts";
import {
  EnlargeInterceptContext,
  type EnlargeIntercept,
} from "./enlarge-intercept.ts";
import {
  getRegisteredPane,
  isImageCompatibleNode,
  registerSelectionPane,
  unregisterSelectionPane,
} from "../state/selection/pane-registry.ts";
import {
  GridUniformAspectContext,
  DEFAULT_GRID_CELL_ASPECT,
} from "../layout/grid-uniform-aspect.tsx";
import { ChartFillContext } from "./standalone-helpers.tsx";
import { useCellSettings } from "../state/settings/use-cell-settings.ts";
import { defaultSettingsForNode } from "../plots/settings.ts";
import type { PlotSettings } from "../settings/schema.ts";
import { CellSettingsContext, useSharedPlot, type CellSettingsContextValue } from "./plot-context.ts";
import { usePlotSessionController } from "../state/session/session-context.ts";

/** The authored grid `sync.view` group fans only view transforms. */
const VIEW_TRANSFORM_KEYS = [
  "image.view",
  "chart.domainX",
  "chart.domainY",
  "scene3d.camera",
] as const;

const SELECTION_CLICK_SLOP_PX = 5;

/**
 * One internal render surface: owns settings, selection membership and its
 * visible selection frame while content beneath it may change.
 */
export function PlotCell({
  sessionId,
  selectable,
  node,
  children,
}: {
  sessionId: string;
  selectable: boolean;
  node: PlotNode;
  children: React.ReactNode;
}) {
  const store = getGlobalSelectionStore();
  const {
    source,
    shared,
    viewSettingsGroupId: gridViewGroupId,
    settingsGroupId: gridSettingsGroupId,
  } = useSharedPlot();
  const [paneId] = useState(nextSelectionPaneId);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const fill = useContext(ChartFillContext);
  const gridUniform = useContext(GridUniformAspectContext);
  const uniformImageCell = !!gridUniform && !fill && isImageCompatibleNode(node);
  const inheritedPaneSync = useContext(CellSettingsContext);
  const sessionController = usePlotSessionController();

  const initialSettingsRef = useRef<{
    captured: boolean;
    value: PlotSettings | null;
  }>({ captured: false, value: null });
  if (!initialSettingsRef.current.captured && node.kind !== "grid") {
    initialSettingsRef.current = {
      captured: true,
      value: defaultSettingsForNode(node, shared),
    };
  }

  const subscribe = useCallback((cb: () => void) => store.subscribe(cb), [store]);
  const getSnapshot = useCallback(() => store.getSnapshot(), [store]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const selected = snapshot.selected;

  const groups = selectable ? paneSyncGroups(store, paneId, GLOBAL_SELECTION_BASE) : null;
  const recordSessionSettings = useCallback((settings: PlotSettings) => {
    sessionController?.recordCell(sessionId, settings);
  }, [sessionController, sessionId]);
  const vst = useCellSettings(
    [
      ...(groups?.settingsGroupId ? [{ id: groups.settingsGroupId }] : []),
      ...(gridSettingsGroupId ? [{ id: gridSettingsGroupId }] : []),
      ...(gridViewGroupId ? [{ id: gridViewGroupId, keys: VIEW_TRANSFORM_KEYS }] : []),
    ],
    initialSettingsRef.current.value,
    recordSessionSettings,
  );

  useEffect(() => {
    if (!sessionController) return;
    return sessionController.registerCell(
      sessionId,
      vst.replaceLocal,
      vst.get() ?? {},
    );
  }, [sessionController, sessionId, vst.replaceLocal, vst.get]);

  useEffect(() => {
    if (!selectable) return;
    registerSelectionPane({
      paneId,
      sessionId,
      node,
      source,
      settings: { get: vst.get, set: vst.set },
      shared,
      imageCompatible: isImageCompatibleNode(node),
      getElement: () => frameRef.current,
    });
    return () => unregisterSelectionPane(paneId);
  }, [paneId, sessionId, selectable, node, source, shared]);

  useEffect(() => {
    if (!selectable) return;
    return () => store.remove(paneId);
  }, [store, paneId, selectable]);

  const settingsGroupId = groups?.settingsGroupId;
  const isJoinAnchor = !!groups?.isAnchor;
  const anchorPaneId = selected[0];
  useEffect(() => {
    if (!settingsGroupId || isJoinAnchor || !anchorPaneId) return;
    const anchor = getRegisteredPane(anchorPaneId)?.settings?.get();
    if (anchor) vst.apply({ ...anchor });
    // Adoption happens exactly when membership/anchor changes; vst is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsGroupId, isJoinAnchor, anchorPaneId]);

  const enlargeIntercept = useMemo<EnlargeIntercept>(
    () => ({
      onEnlarge() {
        if (selectable && store.count() >= 2 && store.isSelected(paneId)) {
          store.requestStage("enlarge");
          return true;
        }
        return false;
      },
    }),
    [store, paneId, selectable],
  );

  const isSelected = selectable && selected.includes(paneId);
  const isReference = isSelected && selected.length >= 2 && snapshot.reference === paneId;
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
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > SELECTION_CLICK_SLOP_PX) return;
      const mode: SelectionMode = e.shiftKey || e.ctrlKey || e.metaKey ? "toggle" : "replace";
      store.select(paneId, mode);
    },
    [store, paneId],
  );

  const style: React.CSSProperties = {
    minWidth: 0,
    position: "relative",
    ...(fill ? { height: "100%" } : null),
    ...(uniformImageCell
      ? {
          width: "100%",
          aspectRatio: String(gridUniform!.uniformAspect ?? DEFAULT_GRID_CELL_ASPECT),
          alignSelf: "start",
        }
      : null),
  };
  if (isSelected) {
    if (isReference) {
      style.outline = `2px solid ${REFERENCE_COLOR}`;
      style.boxShadow = `0 0 0 1px ${REFERENCE_COLOR}, 0 0 8px 1px rgb(${REFERENCE_COLOR_RGB} / 0.5)`;
    } else {
      style.outline = "2px solid var(--color-accent)";
      style.boxShadow =
        "0 0 0 1px var(--color-accent), 0 0 8px 1px rgb(var(--color-accent-rgb) / 0.45)";
    }
    style.outlineOffset = "-2px";
    style.borderRadius = "4px";
    style.zIndex = 1;
  }

  const paneSync = useMemo<CellSettingsContextValue | null>(
    () =>
      groups
        ? {
            syncedSettings: vst.settings,
            cellDefaults: initialSettingsRef.current.value,
            setSyncedSettings: vst.set,
            resetSyncedSettings: vst.replace,
          }
        : null,
    [groups?.settingsGroupId, groups?.isAnchor, vst.settings, vst.set, vst.replace],
  );
  const ownsViewState = node.kind !== "grid";
  const localSync = useMemo<CellSettingsContextValue | null>(
    () =>
      ownsViewState
        ? {
            syncedSettings: vst.settings,
            cellDefaults: initialSettingsRef.current.value,
            setSyncedSettings: vst.set,
            resetSyncedSettings: vst.replace,
          }
        : null,
    [ownsViewState, vst.settings, vst.set, vst.replace],
  );

  return (
    <div
      ref={frameRef}
      style={style}
      data-plot-pane-id={paneId}
      data-selectable={selectable ? "true" : "false"}
      data-selected={isSelected ? "true" : undefined}
      data-reference={isReference ? "true" : undefined}
      onPointerDownCapture={selectable ? onPointerDownCapture : undefined}
      onPointerUpCapture={selectable ? onPointerUpCapture : undefined}
    >
      <CellSettingsContext.Provider value={paneSync ?? inheritedPaneSync ?? localSync}>
        <EnlargeInterceptContext.Provider value={enlargeIntercept}>
          {children}
        </EnlargeInterceptContext.Provider>
      </CellSettingsContext.Provider>
    </div>
  );
}
