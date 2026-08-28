import { test } from "node:test";
import assert from "node:assert/strict";

import {
  displayToolbarButton,
  resolveDisplayEncodingIds,
} from "../../../plots/image/components/display-encoding.ts";
import { getEncoding } from "../../../plots/image/model/encodings/index.ts";

const CURVES = ["linear", "srgb", "gamma", "reinhard", "aces"];

test("images and comparisons use one display-operation menu", () => {
  const ids = resolveDisplayEncodingIds({ mode: "arity", arity: 3, curveSet: CURVES });
  const picked: string[] = [];
  const menu = displayToolbarButton({ value: "linear", ids, onSelect: (id) => picked.push(id) });
  const selectable = menu.menu!.options.filter((option) => !option.header);

  assert.ok(selectable.some((option) => option.id === "linear"));
  assert.ok(selectable.some((option) => option.id === "turbo"));
  assert.ok(!selectable.some((option) => option.id === "none"));
  for (const option of selectable) assert.equal(option.label, getEncoding(option.id)!.label);

  menu.menu!.onSelect("magma");
  assert.deepEqual(picked, ["magma"]);
});
