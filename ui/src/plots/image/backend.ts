import { getDisplayOperation } from "./definition/display-operations.ts";
import { getImageOperation } from "./definition/image-operations.ts";
import type { BackendSupport, BackendTechnology, RenderEnvironment } from "../../backends/contracts.ts";

/**
 * Executable semantic coverage advertised by an image backend, as PUBLIC
 * registry ids. How a backend implements an id — one kernel, three passes, a
 * reference evaluator — is opaque to everything outside that backend.
 */
export interface ImageBackendCapabilities {
  readonly imageOperations: readonly string[];
  readonly displayOperations: readonly string[];
  supportsImageOperation(id: string): boolean;
  supportsDisplayOperation(id: string): boolean;
}

/** A complete image backend definition. The runtime only selects these objects. */
export interface ImageBackend<TView> {
  readonly id: string;
  readonly technology: BackendTechnology;
  readonly priority: number;
  readonly View: TView;
  readonly capabilities: ImageBackendCapabilities;
  prepare?(): void;
  subscribeSupport?(listener: () => void): () => void;
  supportSnapshot?(): string | number;
  supports(environment: RenderEnvironment): BackendSupport;
}

/**
 * Validates every advertised id against the public registries, so a backend
 * cannot advertise one of its own kernel names.
 */
export function defineImageBackendCapabilities(options: {
  imageOperations: readonly string[];
  displayOperations: readonly string[];
}): ImageBackendCapabilities {
  for (const id of options.imageOperations) {
    if (!getImageOperation(id)) throw new Error(`image backend advertises unknown image operation ${id}`);
  }
  for (const id of options.displayOperations) {
    if (!getDisplayOperation(id)) throw new Error(`image backend advertises unknown display operation ${id}`);
  }
  const imageIds = new Set(options.imageOperations);
  const displayIds = new Set(options.displayOperations);
  return Object.freeze({
    imageOperations: Object.freeze([...options.imageOperations]),
    displayOperations: Object.freeze([...options.displayOperations]),
    supportsImageOperation: (id: string) => imageIds.has(id),
    supportsDisplayOperation: (id: string) => displayIds.has(id),
  });
}
