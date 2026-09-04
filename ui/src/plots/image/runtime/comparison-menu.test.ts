/**
 * The comparison menu is derived, never authored: registry order + registry
 * labels, filtered by the ACTIVE backend's capabilities. These tests pin both
 * halves of that split — that a backend can only ever REMOVE entries, never
 * reorder or rename them, and that a backend which cannot run an operation
 * simply does not offer it.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { comparisonMenuOptions } from "./comparison-menu.ts";
import { listImageOperations } from "../definition/image-operations.ts";

/** A capability probe supporting every id — the shape both real backends declare. */
const supportsEverything = { supportsImageOperation: () => true };

/** A capability probe for a backend without the HDR-FLIP exposure sweep. */
const withoutHdrFlip = { supportsImageOperation: (id: string) => id !== "flip-hdr" };

/** What the registry itself says the menu should be, computed independently. */
const registryExpectation = listImageOperations()
  .filter((operation) => operation.inputs === 2 && operation.id !== "split")
  .map((operation) => ({ id: operation.id, label: operation.label }));

test("a fully-capable backend is offered the registry's comparison operations, in registry order", () => {
  const options = comparisonMenuOptions(supportsEverything);

  assert.deepEqual(options, registryExpectation);
  // Both FLIP variants are PUBLIC, separately-selectable operations with the
  // registry's labels — not one entry plus a hidden mode.
  assert.ok(
    options.some((option) => option.id === "flip" && option.label === "FLIP"),
    "FLIP is offered under its registry label",
  );
  assert.ok(
    options.some((option) => option.id === "flip-hdr" && option.label === "HDR-FLIP"),
    "HDR-FLIP is offered under its registry label",
  );
  // …and FLIP precedes HDR-FLIP, as the registry declares them.
  assert.ok(
    options.findIndex((option) => option.id === "flip") <
      options.findIndex((option) => option.id === "flip-hdr"),
    "registry order is preserved",
  );
});

test("an operation the backend cannot run is absent; the rest keep their order and labels", () => {
  const options = comparisonMenuOptions(withoutHdrFlip);

  assert.equal(options.some((option) => option.id === "flip-hdr"), false, "HDR-FLIP is not offered");
  // Removal is the ONLY difference — nothing is reordered, relabelled, or
  // substituted to fill the gap.
  assert.deepEqual(options, registryExpectation.filter((option) => option.id !== "flip-hdr"));
  assert.equal(options.length, registryExpectation.length - 1);
});

test("`split` and `identity` are never comparison-menu operations", () => {
  // `split` is a compositor MODE the menu builder contributes itself, and
  // `identity` takes one input — neither is a diff the user picks here, even
  // though both are registered image operations a backend advertises.
  for (const capabilities of [supportsEverything, withoutHdrFlip]) {
    const ids = comparisonMenuOptions(capabilities).map((option) => option.id);
    assert.equal(ids.includes("split"), false);
    assert.equal(ids.includes("identity"), false);
  }
});
