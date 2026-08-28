import type { PlotSettings } from "../../settings/schema.ts";

export interface GridSessionState {
  mode: "normal" | "stacked";
  activeSlot: number;
}

export interface PlotSession {
  cells: Record<string, { settings: PlotSettings }>;
  grids: Record<string, GridSessionState>;
}

export class PlotSessionError extends Error {
  override name = "PlotSessionError";
}

export function emptyPlotSession(): PlotSession {
  return { cells: {}, grids: {} };
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

function parseSettings(input: unknown, at: string): PlotSettings {
  const source = record(input, at);
  jsonValue(source, at);
  return { ...source } as PlotSettings;
}

export function parsePlotSession(input: unknown): PlotSession {
  const root = record(input, "session");
  const cells = record(root.cells, "session.cells");
  const grids = record(root.grids, "session.grids");
  const parsed = emptyPlotSession();
  for (const [id, value] of Object.entries(cells)) {
    const cell = record(value, `session.cells.${id}`);
    parsed.cells[id] = { settings: parseSettings(cell.settings, `session.cells.${id}.settings`) };
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

export function clonePlotSession(session: PlotSession): PlotSession {
  return parsePlotSession(JSON.parse(JSON.stringify(session)));
}
