const SETTINGS_PLUMBING_KEYS = new Set([
  "syncedSettings",
  "setSyncedSettings",
  "applySyncedSettings",
  "resetSettings",
]);

/** Runtime settings enter typed backends only through BackendInput. */
export function withoutSettingsPlumbing(
  presentation: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(presentation).filter(([key]) => !SETTINGS_PLUMBING_KEYS.has(key)),
  );
}
