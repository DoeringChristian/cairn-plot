import type { PlotSessionController } from "./PlotSessionController.ts";
import type { PlotSession } from "./plot-session.ts";

export interface SessionPersistence {
  load(): PlotSession | null | Promise<PlotSession | null>;
  save(session: PlotSession): void | Promise<void>;
  clear?(): void | Promise<void>;
}

export interface PersistenceConnection {
  ready: Promise<void>;
  dispose(): void;
}

/**
 * Attach external storage without teaching the session controller about I/O.
 * Saves are serialized and collapse to the latest snapshot while one is in
 * flight. State produced before an asynchronous load completes is not written
 * over the saved workspace.
 */
export function connectSessionPersistence(
  controller: PlotSessionController,
  persistence: SessionPersistence,
  options: { skipLoad?: boolean; onError?: (error: unknown) => void } = {},
): PersistenceConnection {
  let disposed = false;
  let loaded = !!options.skipLoad;
  let pending: PlotSession | null = null;
  let saving = false;
  const report = options.onError ?? ((error) => console.warn("cairn-plot session persistence failed", error));

  const flush = async (): Promise<void> => {
    if (saving || !loaded || disposed) return;
    saving = true;
    try {
      while (pending && !disposed) {
        const snapshot = pending;
        pending = null;
        try {
          await persistence.save(snapshot);
        } catch (error) {
          report(error);
        }
      }
    } finally {
      saving = false;
    }
  };
  const unsubscribe = controller.subscribe((session) => {
    if (!loaded || disposed) return;
    pending = session;
    void flush();
  });
  const ready = (async () => {
    if (!options.skipLoad) {
      try {
        const restored = await persistence.load();
        if (disposed) return;
        if (restored) controller.restoreSession(restored);
      } catch (error) {
        report(error);
      }
    }
    loaded = true;
  })();

  return {
    ready,
    dispose() {
      if (disposed) return;
      disposed = true;
      pending = null;
      unsubscribe();
    },
  };
}
