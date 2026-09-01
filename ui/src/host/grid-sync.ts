import type { SharedProps } from "../../../packages/spec/src/spec.ts";

/** Stable channel ids for authored grid-wide synchronization. */
export function gridSyncGroups(
  sync: SharedProps["sync"],
  localId: string,
): { viewSettingsGroupId: string | null; settingsGroupId: string | null } {
  const settingsGroupId = sync?.settings ? `plot-grid-settings-${localId}` : null;
  const viewSettingsGroupId = sync?.view && !sync.settings
    ? `plot-grid-view-${localId}`
    : null;
  return { viewSettingsGroupId, settingsGroupId };
}
