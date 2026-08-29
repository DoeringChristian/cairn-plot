import type { DisplayOperationDefinition } from "../definition/display-operations.ts";
import type { ImageOperationDefinition } from "../definition/image-operations.ts";

/** Backend coverage is independent in the two pipeline stages. Every supported
 * image-operation output can flow through every supported display operation;
 * one-channel fields are expanded to gray RGB at the display boundary. */
export interface ImageBackendCapabilities {
  readonly imageOperations: readonly ImageOperationDefinition[];
  readonly displayOperations: readonly DisplayOperationDefinition[];
  supportsImageOperation(id: string): boolean;
  supportsDisplayOperation(id: string): boolean;
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

