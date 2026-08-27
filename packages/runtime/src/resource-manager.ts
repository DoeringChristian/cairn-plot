import type { SourceSpec } from "../../spec/src/spec.ts";
import type { ResourceLease, ResourceManager } from "./renderers.ts";

export type ResourceResolver = (source: SourceSpec, signal: AbortSignal) => Promise<unknown>;

function sourceKey(source: SourceSpec): string {
  return JSON.stringify(source);
}

export function createResourceManager(resolve: ResourceResolver): ResourceManager {
  const entries = new Map<string, { promise: Promise<unknown>; refs: number }>();
  const controllers = new Map<string, AbortController>();
  let disposed = false;

  async function acquire<T>(source: SourceSpec, signal?: AbortSignal): Promise<ResourceLease<T>> {
    if (disposed) throw new Error("cairn-plot resource manager is disposed");
    if (signal?.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError");
    const key = sourceKey(source);
    let entry = entries.get(key);
    if (!entry) {
      const controller = new AbortController();
      controllers.set(key, controller);
      // The cache owns the resolver cancellation. A single caller aborting must
      // not poison a shared in-flight resolve used by another pane.
      const promise = resolve(source, controller.signal).finally(() => controllers.delete(key));
      entry = { promise, refs: 0 };
      entries.set(key, entry);
    }
    entry.refs += 1;
    const value = await entry.promise as T;
    let released = false;
    return {
      value,
      release() {
        if (released) return;
        released = true;
        const current = entries.get(key);
        if (!current) return;
        current.refs -= 1;
        // Keep the settled resource warm. Explicit invalidation/dispose owns
        // eviction; ref counts exist for future bounded-cache policy.
      },
    };
  }

  return {
    acquire,
    prefetch(sources) {
      for (const source of sources) void acquire(source).then((lease) => lease.release());
    },
    invalidate(source) {
      const key = sourceKey(source);
      controllers.get(key)?.abort("invalidated");
      entries.delete(key);
    },
    dispose() {
      disposed = true;
      for (const controller of controllers.values()) controller.abort("disposed");
      controllers.clear();
      entries.clear();
    },
  };
}
