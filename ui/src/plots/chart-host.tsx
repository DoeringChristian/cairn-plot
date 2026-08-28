import { useCallback, useMemo, useRef, type ReactNode } from "react";

import {
  ChartViewSyncProvider,
  type ChartViewSyncTarget,
} from "./chart/use-chart-view.ts";
import type { PlotSettings } from "../settings/schema.ts";
import type { ChartSettings } from "./chart-settings.ts";

/** Connect a cell's chart-domain settings to the shared 2D chart controls. */
export function ChartSettingsBoundary({ settings, patch, children }: {
  settings: Readonly<ChartSettings>;
  patch: (patch: Partial<ChartSettings>) => void;
  children: ReactNode;
}) {
  const patchRef = useRef(patch);
  patchRef.current = patch;
  const stablePatch = useCallback(
    (next: PlotSettings) => patchRef.current(next as unknown as Partial<ChartSettings>),
    [],
  );
  const sync = useMemo<ChartViewSyncTarget | null>(
    () => ({ settings: settings as PlotSettings, set: stablePatch }),
    [settings, patch, stablePatch],
  );
  return <ChartViewSyncProvider value={sync}>{children}</ChartViewSyncProvider>;
}
