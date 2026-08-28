import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  GridUniformAspectContext,
  VIEWPORT_HEIGHT_MARGIN,
  useUniformGridAspect,
} from "./grid-uniform-aspect.tsx";
import {
  GridModeToggle,
  StackTabStrip,
  useStackKeyboard,
} from "./stack/StackedView.tsx";
import { InStackedGridContext } from "./stack/stack-context.ts";
import { ChartFillContext } from "./chart-fill.ts";
import { adjacentStackIndices } from "./stack-preload.ts";

export type GridMode = "normal" | "stacked";
export interface GridLayoutState { mode: GridMode; activeSlot: number }

export interface GridLayoutProps {
  count: number;
  cols: number;
  colWidths?: Array<number | string>;
  rowHeights?: Array<number | string>;
  gap?: number | string;
  initialMode?: GridMode;
  state?: GridLayoutState;
  onStateChange?(state: GridLayoutState): void;
  switchable?: boolean;
  labels: string[];
  renderNormal(index: number): React.ReactNode;
  renderStacked(index: number): React.ReactNode;
  preload?(indices: number[]): void;
}

function trackList(
  sizes: Array<number | string> | undefined,
  fallbackCount: number,
): string {
  if (!sizes || sizes.length === 0) return `repeat(${fallbackCount}, 1fr)`;
  return sizes.map((size) => (typeof size === "number" ? `${size}fr` : size)).join(" ");
}

/**
 * Renderer-agnostic grid/stack shell. It owns layout state and sizing only;
 * callers retain content interpretation, viewport ownership and preloading.
 */
export function GridLayout({
  count,
  cols,
  colWidths,
  rowHeights,
  gap,
  initialMode = "normal",
  state,
  onStateChange,
  switchable = true,
  labels,
  renderNormal,
  renderStacked,
  preload,
}: GridLayoutProps) {
  const fill = !!rowHeights && rowHeights.length > 0;
  const gridAspectApi = useUniformGridAspect();
  const supportsStack = count >= 2;
  const canSwitch = supportsStack && switchable;
  const [localState, setLocalState] = useState<GridLayoutState>({ mode: initialMode, activeSlot: 0 });
  const current = state ?? localState;
  const updateState = useCallback((next: GridLayoutState | ((prev: GridLayoutState) => GridLayoutState)) => {
    const value = typeof next === "function" ? next(current) : next;
    if (!state) setLocalState(value);
    onStateChange?.(value);
  }, [current, state, onStateChange]);
  const setMode = useCallback((mode: GridMode) => updateState({ ...current, mode }), [current, updateState]);
  const setActive = useCallback<React.Dispatch<React.SetStateAction<number>>>(
    (next) => updateState((previous) => ({
      ...previous,
      activeSlot: typeof next === "function" ? next(previous.activeSlot) : next,
    })),
    [updateState],
  );
  const mode = current.mode;
  const active = current.activeSlot;
  const effectiveMode = supportsStack ? mode : "normal";
  const clampedActive = Math.min(active, Math.max(0, count - 1));
  const stackRootRef = useRef<HTMLDivElement | null>(null);

  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: trackList(colWidths, Math.max(cols, 1)),
    width: "100%",
  };
  if (fill) gridStyle.gridTemplateRows = trackList(rowHeights, 1);
  const gapPx = typeof gap === "number" ? gap : 0;
  if (gap != null) gridStyle.gap = typeof gap === "number" ? `${gap}px` : gap;
  if (!fill && gridAspectApi.uniformAspect != null && gridAspectApi.uniformAspect > 0) {
    const columnCount = Math.max(cols, 1);
    gridStyle.maxWidth = `calc(${columnCount} * (100vh - ${VIEWPORT_HEIGHT_MARGIN}px) * ${gridAspectApi.uniformAspect} + ${(columnCount - 1) * gapPx}px)`;
    gridStyle.marginInline = "auto";
  }

  // One stacked viewport keeps one physical box. Freeze its first established
  // aspect and letterbox differently-shaped content inside it.
  const stackAspectRef = useRef<number | null>(null);
  if (effectiveMode === "stacked") {
    if (stackAspectRef.current == null && gridAspectApi.uniformAspect != null) {
      stackAspectRef.current = gridAspectApi.uniformAspect;
    }
  } else {
    stackAspectRef.current = null;
  }
  const stackAspect = stackAspectRef.current ?? gridAspectApi.uniformAspect;
  const stackedAspectApi = useMemo<typeof gridAspectApi>(
    () => ({ ...gridAspectApi, uniformAspect: stackAspect }),
    [gridAspectApi, stackAspect],
  );
  const stackedViewStyle: React.CSSProperties = fill
    ? { width: "100%", height: "100%" }
    : stackAspect != null && stackAspect > 0
      ? {
          maxWidth: `calc((100vh - ${VIEWPORT_HEIGHT_MARGIN}px) * ${stackAspect})`,
          marginInline: "auto",
        }
      : {};

  useStackKeyboard(stackRootRef, effectiveMode === "stacked", clampedActive, count, setActive);
  useEffect(() => {
    if (effectiveMode !== "stacked" || !preload) return;
    preload(adjacentStackIndices(clampedActive, count));
  }, [effectiveMode, clampedActive, count, preload]);

  const stackedPane = count > 0 ? (
    <InStackedGridContext.Provider value={true}>
      <GridUniformAspectContext.Provider value={stackedAspectApi}>
        <div
          data-cairn-stacked-view=""
          data-cairn-stack-active={clampedActive}
          style={{ minWidth: 0, minHeight: 0, ...(fill ? { height: "100%" } : null), ...stackedViewStyle }}
        >
          <div
            data-cairn-stacked-pane="active"
            style={{ minWidth: 0, ...(fill ? { height: "100%" } : null) }}
          >
            {renderStacked(clampedActive)}
          </div>
        </div>
      </GridUniformAspectContext.Provider>
    </InStackedGridContext.Provider>
  ) : null;

  return (
    <ChartFillContext.Provider value={fill}>
      <GridUniformAspectContext.Provider value={gridAspectApi}>
        <div
          ref={stackRootRef}
          data-cairn-grid-root=""
          className={canSwitch ? "group" : undefined}
          style={{ minWidth: 0, width: "100%" }}
        >
          {canSwitch && (
            <div data-cairn-grid-header="" className="mb-1 flex items-center gap-2" style={{ minHeight: 26 }}>
              {effectiveMode === "stacked" ? (
                <StackTabStrip labels={labels} active={clampedActive} onSelect={setActive} />
              ) : (
                <div className="flex-1" />
              )}
              <GridModeToggle mode={effectiveMode} onChange={setMode} />
            </div>
          )}
          {effectiveMode === "stacked" ? (
            stackedPane
          ) : (
            <div style={gridStyle}>
              {Array.from({ length: count }, (_, index) => (
                <React.Fragment key={index}>{renderNormal(index)}</React.Fragment>
              ))}
            </div>
          )}
        </div>
      </GridUniformAspectContext.Provider>
    </ChartFillContext.Provider>
  );
}
