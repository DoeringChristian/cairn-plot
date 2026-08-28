import { useCallback, useMemo, useRef, type ReactNode } from "react";

import {
  ChartViewportSyncProvider,
  type ChartViewportSyncTarget,
} from "../lib/cairn-plot/chart/use-chart-viewport.ts";
import type { ViewportSettings } from "../lib/cairn-plot/settings/viewport-settings.ts";
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
    (next: ViewportSettings) => patchRef.current(next as unknown as Partial<ChartSettings>),
    [],
  );
  const sync = useMemo<ChartViewportSyncTarget | null>(
    () => ({ settings: settings as ViewportSettings, set: stablePatch }),
    [settings, patch, stablePatch],
  );
  return <ChartViewportSyncProvider value={sync}>{children}</ChartViewportSyncProvider>;
}
