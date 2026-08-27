import type { Invalidation } from "../../spec/src/settings.ts";
import type { PaneSpec, SettingsPatch, SourceSpec } from "../../spec/src/spec.ts";
import type { ReadonlySignal } from "./signal.ts";

export interface PaneStatus {
  state: "declared" | "resolving" | "ready" | "error" | "suspended";
  error?: Error;
}

export interface PaneSignals {
  status: ReadonlySignal<PaneStatus>;
  dimensions: ReadonlySignal<{ width: number; height: number } | null>;
  metrics: ReadonlySignal<Record<string, number> | null>;
  cursor: ReadonlySignal<{ x: number; y: number; values?: number[] } | null>;
}

export interface ResolveContext {
  signal: AbortSignal;
  resources: ResourceManager;
}

export interface PaneHost {
  element: HTMLElement;
  signals: PaneSignals;
}

export interface RendererInstance<TResolved = unknown, THandle = unknown> {
  update(resolved: TResolved, settings: SettingsPatch, invalidation: Invalidation): void;
  getHandle?(): THandle;
  destroy(): void;
}

export interface RendererPlugin<TResolved = unknown, THandle = unknown> {
  kind: string;
  resolve(sources: SourceSpec[], context: ResolveContext): Promise<TResolved>;
  mount(
    host: PaneHost,
    pane: PaneSpec,
    resolved: TResolved,
    settings: SettingsPatch,
  ): RendererInstance<TResolved, THandle>;
  planUpdate?(changedKeys: ReadonlySet<string>): Invalidation;
}

export interface ResourceLease<T = unknown> {
  value: T;
  release(): void;
}

export interface ResourceManager {
  acquire<T = unknown>(source: SourceSpec, signal?: AbortSignal): Promise<ResourceLease<T>>;
  prefetch(sources: SourceSpec[]): void;
  invalidate(source: SourceSpec): void;
  dispose(): void;
}

export class RendererRegistry {
  readonly #plugins = new Map<string, RendererPlugin>();

  register(plugin: RendererPlugin): () => void {
    this.#plugins.set(plugin.kind, plugin);
    return () => {
      if (this.#plugins.get(plugin.kind) === plugin) this.#plugins.delete(plugin.kind);
    };
  }

  get(kind: string): RendererPlugin | undefined {
    return this.#plugins.get(kind);
  }
}
