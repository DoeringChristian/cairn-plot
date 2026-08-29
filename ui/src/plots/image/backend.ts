import type { DisplayOperationDefinition } from "./definition/display-operations.ts";
import type { ImageOperationDefinition } from "./definition/image-operations.ts";

/** Executable semantic coverage advertised by an image backend. */
export interface ImageBackendCapabilities {
  readonly imageOperations: readonly ImageOperationDefinition[];
  readonly displayOperations: readonly DisplayOperationDefinition[];
  supportsImageOperation(id: string): boolean;
  supportsDisplayOperation(id: string): boolean;
}

/** A complete image backend definition. The runtime only selects these objects. */
export interface ImageBackend<TView> {
  readonly id: string;
  readonly View: TView;
  readonly capabilities: ImageBackendCapabilities;
}

export function defineImageBackendCapabilities(options: {
  imageOperations: readonly ImageOperationDefinition[];
  displayOperations: readonly DisplayOperationDefinition[];
}): ImageBackendCapabilities {
  const imageIds = new Set(options.imageOperations.map(({ id }) => id));
  const displayIds = new Set(options.displayOperations.map(({ id }) => id));
  return Object.freeze({
    imageOperations: Object.freeze([...options.imageOperations]),
    displayOperations: Object.freeze([...options.displayOperations]),
    supportsImageOperation: (id: string) => imageIds.has(id),
    supportsDisplayOperation: (id: string) => displayIds.has(id),
  });
}
