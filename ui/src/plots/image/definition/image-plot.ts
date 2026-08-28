import { DISPLAY_OPERATIONS } from "./display-operations.ts";
import { IMAGE_OPERATIONS } from "./image-operations.ts";
import { IMAGE_SETTINGS } from "./settings.ts";

/** The complete semantic surface consumed by hosts, controls, and sessions. */
export const IMAGE_PLOT_DEFINITION = {
  type: "image",
  settings: IMAGE_SETTINGS,
  imageOperations: IMAGE_OPERATIONS,
  displayOperations: DISPLAY_OPERATIONS,
  comparison: {
    strategy: "reference",
    presentations: ["split", "difference"],
    operations: IMAGE_OPERATIONS.filter((operation) => operation.inputs === 2),
  },
} as const;
