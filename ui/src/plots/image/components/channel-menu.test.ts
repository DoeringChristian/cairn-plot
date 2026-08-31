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

test("channel menu offers arbitrary RGB-display sub-groups for RGBA sources", () => {
  let picked: ChannelSelection | null | undefined;
  const button = channelToolbarButton(rgbaTree, {}, (sel) => { picked = sel; });
  assert.ok(button?.menu);
  const labels = button.menu.options.map((o) => o.label.trim());

  assert.ok(labels.some((label) => label.endsWith("RGB")));
  assert.ok(labels.some((label) => label.endsWith("R+B")));
  assert.ok(labels.some((label) => label.endsWith("G+A")));
  assert.ok(labels.some((label) => label.endsWith("A")));

  button.menu.onSelect("p0|combo:R+B");
  assert.deepEqual(picked, { layer: ["R", "B"] });

  button.menu.onSelect("p0|combo:R+G+B");
  assert.deepEqual(picked, { layer: ["R", "G", "B"] });
});

test("channel menu highlights a generated combo instead of synthetic fallback", () => {
  const button = channelToolbarButton(rgbaTree, { layer: ["R", "G", "B"] }, () => {});
  assert.equal(button?.menu?.value, "p0|combo:R+G+B");
});
