#!/usr/bin/env node
// @ts-check
/**
 * Self-test for scripts/test-harness.mjs — proves the RUNNER itself correctly
 * reports failures and exits nonzero.
 *
 * It writes two throwaway "fake harness" pages into a temp dir: one that sets
 * `#status = "PASS"` and one that sets `#status = "FAIL"` (the exact completion
 * signal every real harness emits) using plain inline scripts — no WebGPU, so
 * the check is deterministic on any machine. It then runs the real runner
 * against that temp dir (`--root <tmp>`, with HARNESS_ASSUME_GPU=1 to bypass the
 * WebGPU probe) and asserts:
 *   • exit code is NONZERO (a FAIL harness must fail the job), and
 *   • the output reports the fail-harness by name and the pass-harness as PASS.
 *
 * Run: node scripts/test-harness-selftest.mjs   (npm run test:harness:selftest)
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUNNER = resolve(__dirname, "test-harness.mjs");
const UI_ROOT = resolve(__dirname, ".."); // scripts/ -> ui/ (the runner's served root)

const RED = (s) => `\x1b[31m${s}\x1b[0m`;
const GREEN = (s) => `\x1b[32m${s}\x1b[0m`;

/** A minimal fake harness page that settles `#status` to `verdict` after a tick. */
function fakeHarness(verdict) {
  return `<!doctype html><html><head><meta charset="utf-8">
<title>selftest ${verdict} harness</title></head><body>
<div id="status">RUNNING&hellip;</div>
<div id="result"></div>
<script>
  // Mimic a real harness: emit a line, then settle #status after a microtask.
  const r = document.getElementById('result');
  const p = document.createElement('div');
  p.textContent = '${verdict}: selftest synthetic assertion';
  r.appendChild(p);
  setTimeout(() => { document.getElementById('status').textContent = '${verdict}'; }, 30);
</script></body></html>`;
}

function main() {
  // Fixtures must live UNDER ui/ so the runner's static server (rooted at ui/)
  // can serve them; a /tmp dir would 404 and every fake harness would time out.
  const dir = mkdtempSync(join(UI_ROOT, ".harness-selftest-"));
  writeFileSync(join(dir, "alpha-pass.browser.html"), fakeHarness("PASS"));
  writeFileSync(join(dir, "beta-fail.browser.html"), fakeHarness("FAIL"));

  console.log(`• running the runner against a synthetic PASS + FAIL pair in ${dir}\n`);
  const r = spawnSync(process.execPath, [RUNNER, "--root", dir], {
    encoding: "utf-8",
    env: { ...process.env, HARNESS_ASSUME_GPU: "1", HARNESS_TIMEOUT_MS: "15000" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const raw = (r.stdout || "") + (r.stderr || "");
  process.stdout.write(raw.replace(/^/gm, "    "));
  rmSync(dir, { recursive: true, force: true });

  // eslint-disable-next-line no-control-regex
  const out = raw.replace(/\x1b\[[0-9;]*m/g, ""); // strip ANSI so \b anchors work
  const passLine = /PASS\s+alpha-pass/.test(out);
  const failLine = /FAIL\s+beta-fail/.test(out);
  const checks = [
    ["runner exits NONZERO when a harness FAILs", r.status !== 0 && r.status != null],
    ["fail harness reported by name + FAIL verdict", failLine],
    ["pass harness reported as PASS (not failed by the FAIL peer)", passLine],
    ["exactly one harness failed", /1 of 2 harness\(es\) did not pass/.test(out)],
  ];

  console.log("");
  let ok = true;
  for (const [label, pass] of checks) {
    console.log(`  ${pass ? GREEN("✓") : RED("✗")} ${label}`);
    if (!pass) ok = false;
  }
  console.log("");
  if (ok) {
    console.log(GREEN(`✓ runner self-test passed (observed exit code ${r.status})`) + "\n");
    process.exit(0);
  } else {
    console.log(RED(`✗ runner self-test FAILED (observed exit code ${r.status})`) + "\n");
    process.exit(1);
  }
}

main();
