import type { ViewportSettings } from "../settings/viewport-settings.ts";

export const PLOT_SESSION_VERSION = 1 as const;

export interface GridSessionState {
  mode: "normal" | "stacked";
  activeSlot: number;
}

export interface PlotSession {
  version: typeof PLOT_SESSION_VERSION;
  viewports: Record<string, { settings: ViewportSettings }>;
  grids: Record<string, GridSessionState>;
}

export class PlotSessionError extends Error {
  override name = "PlotSessionError";
}

export function emptyPlotSession(): PlotSession {
  return { version: PLOT_SESSION_VERSION, viewports: {}, grids: {} };
}

function record(value: unknown, at: string): Record<string, unknown> {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    throw new PlotSessionError(`${at} must be an object`);
  }
  return value as Record<string, unknown>;
}

function jsonValue(value: unknown, at: string): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new PlotSessionError(`${at} must be finite`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => jsonValue(item, `${at}[${index}]`));
    return;
  }
  const object = record(value, at);
  for (const [key, item] of Object.entries(object)) jsonValue(item, `${at}.${key}`);
}

/** Translate the one pre-session compare representation accepted as input. */
function normalizeSettings(input: unknown, at: string): ViewportSettings {
  const source = record(input, at);
  jsonValue(source, at);
  const settings = { ...source } as Record<string, unknown>;
  if (settings["compare.operation"] == null) {
    const mode = settings["compare.mode"];
    const kernel = settings["compare.kernel"];
    if (typeof mode === "string" && mode !== "diff") settings["compare.operation"] = mode;
    else if (typeof kernel === "string") settings["compare.operation"] = kernel;
    else if (typeof mode === "string") settings["compare.operation"] = mode;
  }
  delete settings["compare.mode"];
  delete settings["compare.kernel"];
  return settings as ViewportSettings;
}

export function parsePlotSession(input: unknown): PlotSession {
  const root = record(input, "session");
  if (!Number.isInteger(root.version)) throw new PlotSessionError("session.version must be an integer");
  if (root.version !== PLOT_SESSION_VERSION) {
    throw new PlotSessionError(`unsupported plot session version ${String(root.version)}`);
  }
  const viewports = record(root.viewports, "session.viewports");
  const grids = record(root.grids, "session.grids");
  const parsed = emptyPlotSession();
  for (const [id, value] of Object.entries(viewports)) {
    const viewport = record(value, `session.viewports.${id}`);
    parsed.viewports[id] = { settings: normalizeSettings(viewport.settings, `session.viewports.${id}.settings`) };
  }
  for (const [id, value] of Object.entries(grids)) {
    const grid = record(value, `session.grids.${id}`);
    if (grid.mode !== "normal" && grid.mode !== "stacked") {
      throw new PlotSessionError(`session.grids.${id}.mode is invalid`);
    }
    if (!Number.isInteger(grid.activeSlot) || (grid.activeSlot as number) < 0) {
      throw new PlotSessionError(`session.grids.${id}.activeSlot must be a non-negative integer`);
    }
    parsed.grids[id] = { mode: grid.mode, activeSlot: grid.activeSlot as number };
  }
  return parsed;
}

export const migratePlotSession = parsePlotSession;

export function clonePlotSession(session: PlotSession): PlotSession {
  return parsePlotSession(JSON.parse(JSON.stringify(session)));
}
