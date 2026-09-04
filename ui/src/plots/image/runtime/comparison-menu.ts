/**
 * The ONE place the comparison-operation menu is built.
 *
 * Every diff menu the user sees — the WebGPU pane's toolbar, the CPU pane's,
 * the compare overlay's — is this list, handed down by the host adapter
 * (`runtime/view.tsx`) as `ImageComparisonInput.operationOptions`. Neither view
 * keeps a fallback of its own, so the two backends can never disagree about
 * what is on offer.
 *
 * Order and labels come from the registry (`definition/image-operations.ts`);
 * membership comes from the ACTIVE backend's capability declaration. Splitting
 * those two concerns is the point: the registry says what an operation IS and
 * what it is called, the backend says whether it can run it here.
 */
import { listImageOperations } from "../definition/image-operations.ts";
import type { ImageBackendCapabilities } from "../backend.ts";

/** A `{id,label}` menu entry, the shape both panes' toolbars consume. */
export interface ComparisonMenuOption {
  readonly id: string;
  readonly label: string;
}

/**
 * The comparison operations to offer for `capabilities`, in registry order.
 *
 * Excludes one-input operations (`identity` — not a comparison) and `split`,
 * which is a compositor MODE reached from the same menu's "Split" entry rather
 * than a diff operation, and so is contributed by the menu builder itself.
 *
 * Takes only the capability probe, not a whole backend, so a test can pass a
 * bare object and the compiler still checks the shape.
 */
export function comparisonMenuOptions(
  capabilities: Pick<ImageBackendCapabilities, "supportsImageOperation">,
): ComparisonMenuOption[] {
  return listImageOperations()
    .filter((operation) => operation.inputs === 2 && operation.id !== "split")
    .filter((operation) => capabilities.supportsImageOperation(operation.id))
    .map((operation) => ({ id: operation.id, label: operation.label }));
}
