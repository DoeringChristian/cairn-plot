/**
 * Kernel ids are a PRIVATE implementation detail of the WebGPU backend.
 *
 * The public vocabulary is the operation registry (`definition/image-operations.ts`):
 * `flip`, `flip-hdr`, `ssim`, … Historic internal kernel names (`hdr-flip`,
 * `flip-sdr`) must not leak into the shared runtime, the CPU backend, the
 * settings layer or the compare chrome — a source-text pin, because a leak is a
 * naming regression, not a behavioural one, and no unit test would catch it.
 *
 * Three things make the pin real rather than decorative:
 *   - The SCAN ROOT is `ui/src`, not one leaf directory: a kernel id leaking
 *     into `settings/` or `layout/` is exactly the regression this guards. The
 *     root is asserted to contain `settings/schema.ts`, so a wrong relative path
 *     fails loudly instead of scanning an empty tree.
 *   - COMMENT stripping removes `/* … *\/` blocks and lines that START with
 *     `//` only. Stripping every `//` to end-of-line would also eat the tail of
 *     any line containing a URL or a path — silently blinding the scan.
 *   - The pattern is QUOTE-AGNOSTIC (`"…"`, `'…'`, backticks) but still
 *     requires the id to be a whole string literal, so prose and module paths
 *     like `hdr-flip-reference.ts` are not false positives.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

/** Drop `/* … *\/` blocks and FULL-LINE `//` comments — nothing else. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

const KERNEL_ID = /["'`](hdr-flip|flip-sdr)["'`]/;

test("kernel identifiers stay private to the WebGPU backend", () => {
  // `fileURLToPath`, not `.pathname` — the latter stays percent-encoded and
  // breaks on a checkout path containing spaces.
  const root = fileURLToPath(new URL("../../../", import.meta.url)); // ui/src
  assert.ok(existsSync(join(root, "settings/schema.ts")), "scan root is ui/src");
  let scanned = 0;
  for (const file of walk(root)) {
    // The kernels themselves, and the tests that assert ON these ids, are the
    // two places the strings legitimately appear.
    if (file.includes("/plots/image/webgpu/")) continue;
    if (/\.test\.tsx?$|__tests__/.test(file)) continue;
    scanned += 1;
    assert.doesNotMatch(stripComments(readFileSync(file, "utf8")), KERNEL_ID, file);
  }
  assert.ok(scanned > 100, `expected to scan the ui/src tree, scanned ${scanned} files`);
});

test("the comment stripper keeps code that merely trails a `//`", () => {
  const source = [
    "/* a block comment naming 'hdr-flip' */",
    "  // a full-line comment naming 'hdr-flip'",
    'const url = "https://example.test"; const id = "hdr-flip";',
  ].join("\n");
  const stripped = stripComments(source);
  assert.doesNotMatch(stripped, /comment naming/, "comments are stripped");
  assert.match(stripped, KERNEL_ID, "a live identifier after a `//`-bearing string survives");
});
