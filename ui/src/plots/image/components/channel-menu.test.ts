import { test } from "node:test";
import assert from "node:assert/strict";
import { channelToolbarButton, type ChannelSelection, type ChannelMenuTree } from "./channel-menu.ts";

const rgbaTree: ChannelMenuTree = {
  parts: [
    {
      name: "",
      index: 0,
      deep: false,
      groups: [{ name: "", kind: "color", channels: ["R", "G", "B", "A"] }],
    },
  ],
};

test("channel menu exposes direct channel toggles instead of enumerating combinations", () => {
  let picked: ChannelSelection | null | undefined;
  const button = channelToolbarButton(rgbaTree, {}, (sel) => { picked = sel; });
  assert.ok(button?.menu);
  assert.equal(button.menu.closeOnSelect, false);

  const options = button.menu.options;
  const labels = options.map((o) => o.label.trim());
  assert.deepEqual(labels, ["RGBA", "R", "G", "B", "A"]);
  assert.equal(options.find((o) => o.id === "p0|toggle:A")?.checked, true);

  // Directly unchecking A from an RGBA image yields the desired RGB subset.
  button.menu.onSelect("p0|toggle:A");
  assert.deepEqual(picked, { layer: ["R", "G", "B"] });
});

test("channel menu toggles within an authored arbitrary subset", () => {
  let picked: ChannelSelection | null | undefined;
  const button = channelToolbarButton(rgbaTree, { layer: ["R", "B"] }, (sel) => { picked = sel; });
  assert.ok(button?.menu);
  assert.equal(button.menu.value, "__combo");
  assert.equal(button.menu.options.find((o) => o.id === "p0|toggle:R")?.checked, true);
  assert.equal(button.menu.options.find((o) => o.id === "p0|toggle:G")?.checked, false);

  button.menu.onSelect("p0|toggle:G");
  assert.deepEqual(picked, { layer: ["R", "G", "B"] });
});
