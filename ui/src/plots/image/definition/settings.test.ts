/**
 * `compare.flipMode` is gone: HDR FLIP is its own public operation (`flip-hdr`),
 * not a modifier on `flip`. Sessions and descriptors authored before that split
 * still carry the old pair, so the settings layer migrates on READ — this test
 * pins both directions plus the untouched case.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { migrateCompareSettings } from "./settings.ts";

test("legacy flipMode=hdr under flip becomes the HDR FLIP operation", () => {
  assert.deepEqual(
    migrateCompareSettings({ "compare.operation": "flip", "compare.flipMode": "hdr" } as never),
    { "compare.operation": "flip-hdr" },
  );
  assert.deepEqual(
    migrateCompareSettings({ "compare.operation": "flip", "compare.flipMode": "sdr" } as never),
    { "compare.operation": "flip" },
  );
  assert.deepEqual(migrateCompareSettings({ "compare.operation": "ssim" } as never), { "compare.operation": "ssim" });
});

test("the migration drops the retired key without disturbing its neighbours", () => {
  assert.deepEqual(
    migrateCompareSettings({
      "compare.operation": "absolute",
      "compare.flipMode": "hdr",
      "image.exposureEV": 1,
    } as never),
    { "compare.operation": "absolute", "image.exposureEV": 1 },
  );
  // No legacy key: the very same object comes back (callers may rely on identity
  // to keep memoized settings stable across renders).
  const untouched = { "compare.operation": "flip-hdr" };
  assert.equal(migrateCompareSettings(untouched as never), untouched);
});
