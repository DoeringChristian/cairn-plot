import type { PlotSettings } from "../../settings/schema.ts";
import {
  clonePlotSession,
  emptyPlotSession,
  parsePlotSession,
  type GridSessionState,
  type PlotSession,
} from "./plot-session.ts";

export interface PlotSessionTopology {
  cellIds: ReadonlySet<string>;
  grids: ReadonlyMap<string, { count: number; defaultLayout: GridSessionState["layout"] }>;
}

export interface PlotSessionController {
  getSession(): PlotSession;
  restoreSession(input: unknown): void;
  subscribe(listener: (session: PlotSession) => void): () => void;
  setTopology(topology: PlotSessionTopology): void;
  registerCell(id: string, replace: (settings: PlotSettings) => void, initial: PlotSettings): () => void;
  recordCell(id: string, settings: PlotSettings): void;
  seedCell(id: string, settings: PlotSettings): void;
  registerGrid(id: string, replace: (state: GridSessionState) => void, initial: GridSessionState): () => void;
  recordGrid(id: string, state: GridSessionState): void;
  destroy(): void;
}

const clampGrid = (state: GridSessionState, count: number): GridSessionState => ({
  layout: count >= 2 ? state.layout : "grid",
  activeSlot: Math.min(state.activeSlot, Math.max(0, count - 1)),
});

export function createPlotSessionController(initial?: unknown): PlotSessionController {
  let session = initial === undefined ? emptyPlotSession() : parsePlotSession(initial);
  let topology: PlotSessionTopology | null = null;
  let destroyed = false;
  let notificationQueued = false;
  const listeners = new Set<(value: PlotSession) => void>();
  const cells = new Map<string, (settings: PlotSettings) => void>();
  const grids = new Map<string, (state: GridSessionState) => void>();

  const live = () => {
    if (destroyed) throw new Error("PlotSessionController has been destroyed");
  };
  const notify = () => {
    if (notificationQueued) return;
    notificationQueued = true;
    queueMicrotask(() => {
      notificationQueued = false;
      if (destroyed) return;
      const snapshot = clonePlotSession(session);
      for (const listener of [...listeners]) listener(snapshot);
    });
  };
  const prune = () => {
    if (!topology) return;
    for (const id of Object.keys(session.cells)) if (!topology.cellIds.has(id)) delete session.cells[id];
    for (const id of Object.keys(session.grids)) if (!topology.grids.has(id)) delete session.grids[id];
    for (const [id, value] of Object.entries(session.grids)) {
      value.activeSlot = clampGrid(value, topology.grids.get(id)!.count).activeSlot;
    }
  };

  return {
    getSession() { live(); return clonePlotSession(session); },
    restoreSession(input) {
      live();
      session = parsePlotSession(input);
      prune();
      for (const [id, replace] of cells) {
        const value = session.cells[id];
        if (value) replace({ ...value.settings });
      }
      for (const [id, replace] of grids) {
        const value = session.grids[id];
        const metadata = topology?.grids.get(id);
        if (value && metadata) replace(clampGrid(value, metadata.count));
      }
      notify();
    },
    subscribe(listener) { live(); listeners.add(listener); return () => listeners.delete(listener); },
    setTopology(next) { live(); topology = next; prune(); notify(); },
    registerCell(id, replace, initialSettings) {
      live(); cells.set(id, replace);
      const saved = session.cells[id];
      if (saved) replace({ ...saved.settings });
      else session.cells[id] = { settings: { ...initialSettings } };
      return () => { if (cells.get(id) === replace) cells.delete(id); };
    },
    recordCell(id, settings) {
      live(); session.cells[id] = { settings: { ...settings } }; notify();
    },
    seedCell(id, settings) {
      live();
      if (session.cells[id]) return;
      session.cells[id] = { settings: { ...settings } };
      notify();
    },
    registerGrid(id, replace, initialState) {
      live(); grids.set(id, replace);
      const metadata = topology?.grids.get(id);
      const saved = session.grids[id];
      if (saved) replace(metadata ? clampGrid(saved, metadata.count) : saved);
      else session.grids[id] = metadata ? clampGrid(initialState, metadata.count) : initialState;
      return () => { if (grids.get(id) === replace) grids.delete(id); };
    },
    recordGrid(id, state) {
      live();
      const metadata = topology?.grids.get(id);
      session.grids[id] = metadata ? clampGrid(state, metadata.count) : { ...state };
      notify();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true; listeners.clear(); cells.clear(); grids.clear();
    },
  };
}
