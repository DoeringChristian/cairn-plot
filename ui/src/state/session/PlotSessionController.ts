import type { ViewportSettings } from "../settings/viewport-settings.ts";
import {
  clonePlotSession,
  emptyPlotSession,
  parsePlotSession,
  type GridSessionState,
  type PlotSession,
} from "./plot-session.ts";

export interface PlotSessionTopology {
  viewportIds: ReadonlySet<string>;
  grids: ReadonlyMap<string, { count: number; defaultMode: GridSessionState["mode"] }>;
}

export interface PlotSessionController {
  getSession(): PlotSession;
  restoreSession(input: unknown): void;
  subscribe(listener: (session: PlotSession) => void): () => void;
  setTopology(topology: PlotSessionTopology): void;
  registerViewport(id: string, replace: (settings: ViewportSettings) => void, initial: ViewportSettings): () => void;
  recordViewport(id: string, settings: ViewportSettings): void;
  seedViewport(id: string, settings: ViewportSettings): void;
  registerGrid(id: string, replace: (state: GridSessionState) => void, initial: GridSessionState): () => void;
  recordGrid(id: string, state: GridSessionState): void;
  destroy(): void;
}

const clampGrid = (state: GridSessionState, count: number): GridSessionState => ({
  mode: count >= 2 ? state.mode : "normal",
  activeSlot: Math.min(state.activeSlot, Math.max(0, count - 1)),
});

export function createPlotSessionController(initial?: unknown): PlotSessionController {
  let session = initial === undefined ? emptyPlotSession() : parsePlotSession(initial);
  let topology: PlotSessionTopology | null = null;
  let destroyed = false;
  let notificationQueued = false;
  const listeners = new Set<(value: PlotSession) => void>();
  const viewports = new Map<string, (settings: ViewportSettings) => void>();
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
    for (const id of Object.keys(session.viewports)) if (!topology.viewportIds.has(id)) delete session.viewports[id];
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
      for (const [id, replace] of viewports) {
        const value = session.viewports[id];
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
    registerViewport(id, replace, initialSettings) {
      live(); viewports.set(id, replace);
      const saved = session.viewports[id];
      if (saved) replace({ ...saved.settings });
      else session.viewports[id] = { settings: { ...initialSettings } };
      return () => { if (viewports.get(id) === replace) viewports.delete(id); };
    },
    recordViewport(id, settings) {
      live(); session.viewports[id] = { settings: { ...settings } }; notify();
    },
    seedViewport(id, settings) {
      live();
      if (session.viewports[id]) return;
      session.viewports[id] = { settings: { ...settings } };
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
      destroyed = true; listeners.clear(); viewports.clear(); grids.clear();
    },
  };
}
