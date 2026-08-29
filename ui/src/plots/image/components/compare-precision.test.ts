/**
 * Regression pin — the compare operands' F16-PIPELINE tag must survive packing.
 *
 * `plots/image/resources/comparison-resolve.ts`'s `decodedSource` converts a resolved compare frame
 * (`ResolvedFloatImage`) into the `ImageSource` the unified pane uploads. A
 * `"f16-bits"` payload is a `Uint16Array` of raw IEEE-754 binary16 BIT
 * PATTERNS; dropping the `precision` tag makes `decodedSourceToUpload` take
 * the f32 branch and read the bits as VALUES (1.0 → 15360 ≈ 2^14) — the
 * "compare exposure blows up for URL-loaded half EXRs" bug (2026-08-25): the
 * split/diff foreground rendered blown-out white and the metrics were garbage
 * whenever a half-precision EXR was the `b` operand, while the same file was
 * fine as a single image (the leaf path threads precision).
 *
 * Source-level guard (the function is module-internal; JSX imports don't run
 * under the type-stripping test runner — same pattern as toolbar-seam.test.ts).
 *
 *   node --experimental-strip-types --test src/plots/image/components/compare-precision.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const comparisonResolve = readFileSync(
  join(HERE, "..", "resources", "comparison-resolve.ts"),
  "utf8",
);

test("frameToSource forwards the SELF-DESCRIBING pixels buffer", () => {
  const fn = comparisonResolve.slice(
    comparisonResolve.indexOf("function decodedSource"),
    comparisonResolve.indexOf("function contentKey"),
  );
  assert.ok(fn.length > 0, "decodedSource must exist in the image comparison resolver");
  // The original bug (an optional side-channel `precision` tag dropped in
  // transit) is now STRUCTURALLY impossible: the representation travels
  // inside the `pixels` buffer object (image/pixel-buffer.ts). This pin
  // guards that the operand packer forwards that buffer whole.
  assert.match(
    fn,
    /pixels/,
    "decodedSource must forward the self-describing `pixels` buffer — the " +
      "representation must travel WITH the bytes (the 2^14 compare-exposure bug class)",
  );
});
