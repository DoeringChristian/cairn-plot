import type { SettingsRegistry } from "../../spec/src/settings.ts";
import { defaultSettingsRegistry, resolveSettings } from "../../spec/src/settings.ts";
import { emptyPlotSession, type PlotSession } from "../../spec/src/session.ts";
import type { PaneId, PlotSpec, SettingsPatch } from "../../spec/src/spec.ts";
import type { CommandMetadata, PlotChange, PlotCommand } from "./commands.ts";

export interface PlotController {
  getSpec(): PlotSpec;
  getSession(): PlotSession;
  getSettings(pane: PaneId): SettingsPatch;
  updateSpec(spec: PlotSpec, metadata?: CommandMetadata): void;
  dispatch(command: PlotCommand, metadata?: CommandMetadata): void;
  subscribe(listener: (change: PlotChange) => void): () => void;
  destroy(): void;
}

function unique<T>(items: Iterable<T>): T[] {
  return [...new Set(items)];
}

function linkedPanes(spec: PlotSpec, panes: PaneId[], keys: string[]): PaneId[] {
  const targets = new Set(panes);
  let changed = true;
  while (changed) {
    changed = false;
    for (const link of spec.links ?? []) {
      if (!link.panes.some((pane) => targets.has(pane))) continue;
      const matches = keys.some((key) =>
        link.keys.some((selector) => selector === key || (selector.endsWith(".*") && key.startsWith(selector.slice(0, -1)))),
      );
      if (!matches) continue;
      for (const pane of link.panes) {
        if (!targets.has(pane)) {
          targets.add(pane);
          changed = true;
        }
      }
    }
  }
  return [...targets].filter((pane) => pane in spec.panes);
}

function replaceOverrides(
  session: PlotSession,
  panes: PaneId[],
  update: (current: SettingsPatch) => SettingsPatch,
): PlotSession {
  const overrides = { ...session.overrides };
  for (const pane of panes) {
    const next = update(overrides[pane] ?? {});
    if (Object.keys(next).length) overrides[pane] = next;
    else delete overrides[pane];
  }
  return { ...session, overrides };
}

export function createPlotController(options: {
  spec: PlotSpec;
  session?: PlotSession;
  settings?: SettingsRegistry;
}): PlotController {
  let spec = options.spec;
  let session = options.session ?? emptyPlotSession();
  const settings = options.settings ?? defaultSettingsRegistry;
  const listeners = new Set<(change: PlotChange) => void>();
  let destroyed = false;

  const publish = (change: PlotChange) => {
    for (const listener of [...listeners]) listener(change);
  };

  const dispatch = (command: PlotCommand, metadata: CommandMetadata = {}) => {
    if (destroyed) throw new Error("cairn-plot controller is destroyed");
    let specChanged = false;
    let sessionChanged = false;
    let affectedPanes: PaneId[] = [];
    let invalidation = settings.invalidation([]);

    switch (command.type) {
      case "spec.replace": {
        spec = command.spec;
        const valid = new Set(Object.keys(spec.panes));
        const overrides = Object.fromEntries(
          Object.entries(session.overrides).filter(([pane]) => valid.has(pane)),
        );
        const order = session.selection.order.filter((pane) => valid.has(pane));
        const reference = session.selection.reference && valid.has(session.selection.reference)
          ? session.selection.reference
          : null;
        const stage = session.stage
          ? { ...session.stage, panes: session.stage.panes.filter((pane) => valid.has(pane)) }
          : null;
        session = { overrides, selection: { order, reference }, stage };
        specChanged = true;
        sessionChanged = true;
        affectedPanes = Object.keys(spec.panes);
        break;
      }
      case "settings.patch": {
        settings.validate(command.patch);
        const keys = Object.keys(command.patch);
        invalidation = settings.invalidation(keys);
        affectedPanes = linkedPanes(spec, command.panes, keys);
        session = replaceOverrides(session, affectedPanes, (current) => ({
          ...current,
          ...command.patch,
        }));
        sessionChanged = affectedPanes.length > 0 && keys.length > 0;
        break;
      }
      case "settings.reset": {
        const keys = command.keys ?? unique(
          command.panes.flatMap((pane) => Object.keys(session.overrides[pane] ?? {})),
        );
        invalidation = settings.invalidation(keys);
        affectedPanes = linkedPanes(spec, command.panes, keys);
        session = replaceOverrides(session, affectedPanes, (current) => {
          if (!command.keys) return {};
          const next = { ...current };
          for (const key of command.keys) delete next[key];
          return next;
        });
        sessionChanged = affectedPanes.length > 0;
        break;
      }
      case "selection.set": {
        const order = unique(command.panes).filter((pane) => pane in spec.panes);
        session = {
          ...session,
          selection: {
            order,
            reference: order.includes(session.selection.reference ?? "")
              ? session.selection.reference
              : order[order.length - 1] ?? null,
          },
        };
        affectedPanes = order;
        sessionChanged = true;
        break;
      }
      case "selection.toggle": {
        if (!(command.pane in spec.panes)) break;
        const order = session.selection.order.includes(command.pane)
          ? session.selection.order.filter((pane) => pane !== command.pane)
          : [...session.selection.order, command.pane];
        session = {
          ...session,
          selection: {
            order,
            reference: order.includes(session.selection.reference ?? "")
              ? session.selection.reference
              : order[order.length - 1] ?? null,
          },
        };
        affectedPanes = [command.pane];
        sessionChanged = true;
        break;
      }
      case "reference.set": {
        const pane = command.pane;
        if (pane !== null && !session.selection.order.includes(pane)) break;
        if (pane === session.selection.reference) break;
        session = { ...session, selection: { ...session.selection, reference: pane } };
        affectedPanes = pane ? [pane] : [];
        sessionChanged = true;
        break;
      }
      case "stage.open": {
        const panes = unique(command.panes).filter((pane) => pane in spec.panes);
        session = { ...session, stage: { mode: command.mode, panes } };
        affectedPanes = panes;
        sessionChanged = true;
        break;
      }
      case "stage.close": {
        if (session.stage === null) break;
        affectedPanes = session.stage.panes;
        session = { ...session, stage: null };
        sessionChanged = true;
        break;
      }
    }

    if (specChanged || sessionChanged) {
      publish({ command, metadata, specChanged, sessionChanged, affectedPanes, invalidation });
    }
  };

  return {
    getSpec: () => spec,
    getSession: () => session,
    getSettings(pane) {
      const paneSpec = spec.panes[pane];
      if (!paneSpec) throw new Error(`unknown pane ${pane}`);
      return resolveSettings(settings, paneSpec, session.overrides[pane]);
    },
    updateSpec(next, metadata) {
      dispatch({ type: "spec.replace", spec: next }, metadata);
    },
    dispatch,
    subscribe(listener) {
      if (destroyed) throw new Error("cairn-plot controller is destroyed");
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy() {
      destroyed = true;
      listeners.clear();
    },
  };
}
