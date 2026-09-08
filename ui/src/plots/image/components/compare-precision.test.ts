/**
 * Regression pin — the compare operands' F16-PIPELINE tag must survive packing.
 *
 * `plots/image/resources/comparison-resolve.ts` used to convert a resolved compare frame
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

test("the compare resolver has NO second decoder — operands come from the ONE leaf resolver", () => {
  // The original bug (an optional side-channel `precision` tag dropped in
  // transit) is now STRUCTURALLY impossible in the strongest way available:
  // the compare path does not repack operands at all. Each operand is resolved
  // by `resolveImageData` — the ONE image leaf resolver — and its `ImageSource`
  // (whose `pixels` buffer is self-describing, image/pixel-buffer.ts) is
  // forwarded whole. A private duplicate here is what dropped `precision`, and
  // what ignored `data.format` so a float (.npy) compare never decoded.
  assert.match(
    comparisonResolve,
    /resolveImageData\(/,
    "compare operands must be resolved through resolveImageData",
  );
  for (const forbidden of ["function decodedSource", "parseNpy", "decodeImageSource", "resolveImageArtifacts"]) {
    assert.ok(
      !comparisonResolve.includes(forbidden),
      `the compare resolver must not re-implement leaf decoding (found \`${forbidden}\`)`,
    );
  }
});
