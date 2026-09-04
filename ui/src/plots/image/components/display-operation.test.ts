import assert from "node:assert/strict";
import test from "node:test";

import { defineImageBackendCapabilities } from "../backend.ts";
import { DISPLAY_OPERATION_IDS } from "../definition/display-operations.ts";
import { IMAGE_OPERATION_IDS } from "../definition/image-operations.ts";
import { resolveDisplayOperationIds } from "./display-operation.ts";

const full = defineImageBackendCapabilities({
  imageOperations: IMAGE_OPERATION_IDS,
  displayOperations: DISPLAY_OPERATION_IDS,
});
const partial = defineImageBackendCapabilities({
  imageOperations: IMAGE_OPERATION_IDS,
  displayOperations: DISPLAY_OPERATION_IDS.filter((id) => !["plasma", "aces", "normal"].includes(id)),
});

test("the encoding menu is the catalogue intersected with the backend, in registry order", () => {
  const all = resolveDisplayOperationIds({ mode: "arity", arity: 3, curveSet: DISPLAY_OPERATION_IDS, capabilities: full });
  const some = resolveDisplayOperationIds({ mode: "arity", arity: 3, curveSet: DISPLAY_OPERATION_IDS, capabilities: partial });
  assert.ok(all.curveIds.includes("aces"));
  assert.ok(all.lutIds.includes("plasma"));
  assert.deepEqual(all.remapIds, ["normal"]);
  assert.deepEqual(some.curveIds, all.curveIds.filter((id) => id !== "aces"));
  assert.deepEqual(some.lutIds, all.lutIds.filter((id) => id !== "plasma"));
  assert.deepEqual(some.remapIds, []);
  assert.deepEqual(some.all, [...some.curveIds, ...some.lutIds, ...some.remapIds]);
});

test("sdr mode filters the same way", () => {
  const some = resolveDisplayOperationIds({ mode: "sdr", arity: 1, curveSet: DISPLAY_OPERATION_IDS, capabilities: partial });
  assert.ok(!some.lutIds.includes("plasma"));
  assert.ok(some.lutIds.includes("turbo"));
  assert.ok(!some.curveIds.includes("aces"));
  assert.ok(some.curveIds.includes("srgb"));
});
