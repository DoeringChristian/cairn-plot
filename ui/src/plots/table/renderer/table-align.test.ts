import { test } from "node:test";
import assert from "node:assert/strict";
import { columnAlign, columnAlignClasses } from "./table-align.ts";
import type { ColumnType } from "./Table";

// The defect: numeric column HEADERS were left-aligned while their BODY cells
// were right-aligned, so the header text sat far from the numbers. The guard:
// for every column type the header and the cell must resolve to the SAME side.

const TYPES: (ColumnType | undefined)[] = [
  "number",
  "string",
  "bool",
  "other",
  undefined,
];

test("numeric columns align right, everything else left", () => {
  assert.equal(columnAlign("number"), "right");
  assert.equal(columnAlign("string"), "left");
  assert.equal(columnAlign("bool"), "left");
  assert.equal(columnAlign("other"), "left");
  assert.equal(columnAlign(undefined), "left");
});

test("header and body cell share ONE alignment side per column type", () => {
  for (const t of TYPES) {
    const { align, header, cell, arrowFirst } = columnAlignClasses(t);
    if (align === "right") {
      // header group hugs the right edge; cell text is right-aligned; arrow
      // sits left of the name so the name's right edge tracks the numbers.
      assert.ok(header.includes("justify-end"), `right header for ${t}`);
      assert.ok(cell.includes("text-right"), `right cell for ${t}`);
      assert.equal(arrowFirst, true, `arrow-first for right col ${t}`);
    } else {
      assert.ok(!header.includes("justify-end"), `left header for ${t}`);
      assert.ok(!cell.includes("text-right"), `left cell for ${t}`);
      assert.equal(arrowFirst, false, `arrow-last for left col ${t}`);
    }
  }
});
