import { test } from "node:test";
import assert from "node:assert/strict";

import {
  displayToolbarButton,
  resolveDisplayOperationIds,
} from "../../../plots/image/components/display-operation.ts";
import { getDisplayOperation, DISPLAY_OPERATION_IDS } from "../../../plots/image/definition/display-operations.ts";
import { IMAGE_OPERATION_IDS } from "../../../plots/image/definition/image-operations.ts";
import { defineImageBackendCapabilities } from "../../../plots/image/backend.ts";

const CURVES = ["linear", "srgb", "gamma", "reinhard", "aces"];

const FULL_CAPABILITIES = defineImageBackendCapabilities({
  imageOperations: IMAGE_OPERATION_IDS,
  displayOperations: DISPLAY_OPERATION_IDS,
});

test("images and comparisons use one display-operation menu", () => {
  const ids = resolveDisplayOperationIds({ mode: "arity", arity: 3, curveSet: CURVES, capabilities: FULL_CAPABILITIES });
  const picked: string[] = [];
  const menu = displayToolbarButton({ value: "linear", ids, onSelect: (id) => picked.push(id) });
  const selectable = menu.menu!.options.filter((option) => !option.header);

  assert.ok(selectable.some((option) => option.id === "linear"));
  assert.ok(selectable.some((option) => option.id === "turbo"));
  assert.ok(!selectable.some((option) => option.id === "none"));
  for (const option of selectable) assert.equal(option.label, getDisplayOperation(option.id)!.label);

  menu.menu!.onSelect("magma");
  assert.deepEqual(picked, ["magma"]);
});
