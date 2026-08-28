import { useCallback, useEffect, useRef } from "react";

import type { PlotNode } from "../../../../packages/spec/src/spec.ts";
import type { PlotSettings } from "../../settings/schema.ts";

export type CompareViewMode = "split" | "diff";

export interface ImageComparisonControl {
  viewMode: CompareViewMode;
  setViewMode(mode: CompareViewMode): void;
  comparisonOperationId: string;
  setComparisonOperation(id: string): void;
  splitPos: number;
  setSplitPos(position: number): void;
  modified: boolean;
}

/**
 * Project image-comparison controls from the cell's one settings object.
 * Bootstrap values are frozen on the first comparison shown by a retained
 * cell, so changing stack slots cannot reseed its operation or divider.
 */
export function useImageComparisonControl(
  node: PlotNode,
  settings: PlotSettings | null | undefined,
  setSettings?: (patch: PlotSettings) => void,
  applySettings?: (patch: PlotSettings) => void,
): ImageComparisonControl {
  const comparison = node.kind === "compare" ? node : null;
  const props = (comparison?.props ?? {}) as Record<string, unknown>;
  const descriptorMode: CompareViewMode = comparison?.presentation === "difference"
    ? "diff"
    : "split";
  const descriptorKernel =
    (props.operation as string | undefined) ?? "absolute";
  const descriptorSplit = (props.splitPosition as number | undefined) ?? 0.5;

  const seed = useRef<{
    mode: CompareViewMode;
    operation: string;
    split: number;
  } | null>(null);
  if (comparison && seed.current === null) {
    seed.current = {
      mode: descriptorMode,
      operation: descriptorKernel,
      split: descriptorSplit,
    };
  }
  const seedMode = seed.current?.mode ?? descriptorMode;
  const seedKernel = seed.current?.operation ?? descriptorKernel;
  const seedSplit = seed.current?.split ?? descriptorSplit;

  const operation = settings?.["compare.operation"] ??
    (seedMode === "split" ? "split" : seedKernel);
  const viewMode: CompareViewMode = operation === "split" ? "split" : "diff";
  const comparisonOperationId = operation === "split" ? seedKernel : operation;
  const splitPos = settings?.["compare.split"] ?? seedSplit;

  const setViewMode = useCallback((mode: CompareViewMode) => {
    setSettings?.({ "compare.operation": mode === "split" ? "split" : comparisonOperationId });
  }, [setSettings, comparisonOperationId]);
  const setComparisonOperation = useCallback((operation: string) => {
    setSettings?.({ "compare.operation": operation });
  }, [setSettings]);
  const setSplitPos = useCallback((position: number) => {
    setSettings?.({ "compare.split": position });
  }, [setSettings]);

  const applyRef = useRef(applySettings);
  applyRef.current = applySettings;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  useEffect(() => {
    if (!comparison || !applyRef.current) return;
    const current = settingsRef.current ?? {};
    const missing: PlotSettings = {};
    if (!("compare.operation" in current)) {
      missing["compare.operation"] = seedMode === "split" ? "split" : seedKernel;
    }
    if (!("compare.split" in current)) missing["compare.split"] = seedSplit;
    if (Object.keys(missing).length > 0) applyRef.current(missing);
  });

  return {
    viewMode,
    setViewMode,
    comparisonOperationId,
    setComparisonOperation,
    splitPos,
    setSplitPos,
    modified:
      viewMode !== descriptorMode ||
      comparisonOperationId !== descriptorKernel ||
      splitPos !== descriptorSplit,
  };
}
