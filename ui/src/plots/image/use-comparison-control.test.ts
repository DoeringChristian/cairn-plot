import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./use-comparison-control.ts", import.meta.url), "utf8");

test("image comparison control has one settings source and no local state", () => {
  assert.equal(source.includes("useState"), false);
  assert.match(source, /settings\?\.\["compare\.operation"\]/);
  assert.match(source, /setSettings\?\.\(\{ "compare\.operation"/);
  assert.match(source, /seed\.current === null/);
});
