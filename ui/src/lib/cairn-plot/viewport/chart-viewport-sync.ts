/**
 * 2D-chart adapter over the ONE unified settings bus (unified-viewport ruling,
 * 2026-08-26: every viewport kind shares one `ViewportSettings` dictionary and
 * one channel class — see `image-settings-sync.ts`).
 *
 * A chart publishes its DOMAIN (data-space ranges) as a settings patch
 * `{"chart.domain": ...}` whenever its OWN viewport commits (a genuine local
 * box-zoom / pan / wheel / axis-gutter / zoomIn-out / autoscale gesture); every
 * other chart subscribed to the same group applies the incoming domain to its
 * own viewport. This is Plotly "matched-axes" behaviour: peers adopt the
 * incoming data-space range directly (NOT a pixel transform), so charts of
 * different sizes/paddings still frame the exact same window. "home"
 * (autoscale / reset) rides the settings MASK convention: `"chart.domain":
 * null`.
 *
 * Because the unified channels are group-id-shared across kinds, a mixed group
 * (images + charts) simply works: image frames ignore `chart.domain` (scoped
 * subscriptions) or carry it inert, and this adapter ignores patches without
 * its key.
 *
 * Echo handling mirrors the frame appliers' patch-identity dedupe: `publish`
 * remembers the exact patch object it sent per `sourceId`; a subscriber skips
 * a patch it published itself. `lastDomains` is an adapter-local LAST-VALUE
 * cache for late joiners only (a chart mounting after peers already zoomed) —
 * it is NOT authoritative group state; each chart's own viewport remains the
 * single source of truth.
 */
import {
  publishSettingsPatch,
  subscribeSettingsPatches,
  type ViewportSettings,
} from "./image-settings-sync.ts";

/**
 * A chart-viewport broadcast. A concrete domain carries the publisher's live
 * data-space ranges (each axis nullable so a 1D chart can sync only the axis it
 * owns and leave a peer's other axis untouched); `"home"` means "autoscale /
 * reset" — a peer returns to following its own home domain.
 */
export type ChartSyncPayload =
  | { x: [number, number] | null; y: [number, number] | null }
  | "home";

// Patch-identity echo guard (same pattern as `useViewportSettings`).
const lastPublishedBySource = new Map<string, ViewportSettings>();
// Late-join memory (adapter-local convenience, not group state).
const lastDomains = new Map<string, ChartSyncPayload>();

/** Broadcasts `payload` to every OTHER subscriber of `groupId`. */
export function publishChartViewport(
  groupId: string,
  sourceId: string,
  payload: ChartSyncPayload,
): void {
  lastDomains.set(groupId, payload);
  const patch: ViewportSettings = {
    "chart.domain": payload === "home" ? null : payload,
  };
  lastPublishedBySource.set(sourceId, patch);
  publishSettingsPatch(groupId, patch);
}

/**
 * The most recent payload published on `groupId`, or `undefined` if none yet.
 * Lets a chart that JOINS a group late (mounts after peers have already
 * zoomed/panned) adopt the current window immediately instead of starting back
 * at its own home.
 */
export function getLastChartViewport(groupId: string): ChartSyncPayload | undefined {
  return lastDomains.get(groupId);
}

/**
 * Subscribes to `chart.domain` patches on `groupId`, ignoring the caller's own
 * publishes (patch-identity match via `sourceId`). Returns unsubscribe.
 */
export function subscribeChartViewport(
  groupId: string,
  sourceId: string,
  onPayload: (payload: ChartSyncPayload) => void,
): () => void {
  return subscribeSettingsPatches(groupId, (patch) => {
    if (!("chart.domain" in patch)) return;
    if (lastPublishedBySource.get(sourceId) === patch) return;
    const domain = patch["chart.domain"];
    const payload: ChartSyncPayload = domain == null ? "home" : domain;
    lastDomains.set(groupId, payload);
    onPayload(payload);
  });
}

/** Generates a per-chart-instance id for the echo guard (§ above). */
export function makeChartViewportSyncSourceId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
