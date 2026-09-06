#!/usr/bin/env node
// @ts-check
/**
 * Self-test for scripts/test-harness.mjs — proves the RUNNER itself correctly
 * reports failures and exits nonzero.
 *
 * It has two halves.
 *
 * UNIT half — imports the runner's two pure decision functions and pins the
 * rules that decide whether a FAIL may be reported as a PASS:
 *   • `downgradeIfDeviceLost` only downgrades a genuine `webgpu-device-lost`
 *     (reason other than `destroyed`) recorded BEFORE the verdict, on a
 *     software adapter, with the explicit env opt-in. An ordinary teardown
 *     (`destroyed`), a `webgpu-backend-fallback` (which every GPU render
 *     failure emits), a loss recorded after the verdict, or a run that did not
 *     opt in must leave the FAIL a FAIL.
 *   • `parseHarnessAttributes` reads the opening `<html …>` tag only, so an
 *     attribute mentioned in an HTML COMMENT cannot quarantine a page.
 * Plus: the runner must not exit 0 when its filters selected no harness.
 *
 * END-TO-END half — it writes two throwaway "fake harness" pages into a temp dir: one that sets
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
import { downgradeIfDeviceLost, parseHarnessAttributes } from "./test-harness.mjs";

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

/** A FAIL verdict recorded at t=1000 (page clock), as `runHarness` builds it. */
function failedRun() {
  return { verdict: "fail", ms: 1234, verdictAt: 1000, result: "FAIL: parity assertion" };
}
/** True when `downgradeIfDeviceLost` left the run exactly as it found it. */
function unchanged(out, input) {
  return (
    out.verdict === input.verdict &&
    out.result === input.result &&
    !out.deviceLost
  );
}

/** Pure-function checks over the runner's two exported decision helpers. */
function unitChecks() {
  const soft = { softwareAdapter: true, allowSkips: true };

  // (a) genuine loss, software adapter, opted in, before the verdict → SKIP.
  const accepted = downgradeIfDeviceLost(failedRun(), {
    ...soft,
    losses: [{ kind: "webgpu-device-lost", reason: "unknown", message: "swiftshader gave up", t: 500 }],
  });
  // (b) an ordinary teardown is not a loss.
  const destroyed = downgradeIfDeviceLost(failedRun(), {
    ...soft,
    losses: [{ kind: "webgpu-device-lost", reason: "destroyed", t: 500 }],
  });
  // (c) a backend fallback (emitted by EVERY GPU render failure) is not a loss.
  const fallbackOnly = downgradeIfDeviceLost(failedRun(), {
    ...soft,
    losses: [{ kind: "webgpu-backend-fallback", reason: undefined, t: 500 }],
  });
  // (d) no explicit opt-in → a FAIL stays a FAIL even on a software adapter.
  const notOptedIn = downgradeIfDeviceLost(failedRun(), {
    softwareAdapter: true,
    allowSkips: false,
    losses: [{ kind: "webgpu-device-lost", reason: "unknown", t: 500 }],
  });
  // (e) a loss recorded AFTER the verdict cannot have caused it.
  const afterVerdict = downgradeIfDeviceLost(failedRun(), {
    ...soft,
    losses: [{ kind: "webgpu-device-lost", reason: "unknown", t: 1500 }],
  });
  // (f) attributes come from the declaration tags, never from a comment.
  const attrs = parseHarnessAttributes(
    '<!-- data-cairn-harness="quarantined" --><html lang="en" data-cairn-harness-dpr="2"><body>',
  );
  // …and a comment cannot fake a whole declaration tag either, while the
  // `<meta name="cairn-harness">` form the pages use keeps working.
  const commentedMeta = parseHarnessAttributes(
    '<html lang="en"><head><!-- <meta name="cairn-harness" data-cairn-harness="quarantined"> -->' +
      '<meta name="cairn-harness" data-cairn-harness="self-driving" /></head>',
  );

  return [
    [
      "genuine device loss before the verdict (software + opted in) downgrades to SKIP",
      accepted.verdict === "pass" &&
        accepted.deviceLost === true &&
        typeof accepted.result === "string" &&
        accepted.result.startsWith("SKIPPED — WebGPU device lost"),
    ],
    ["the SKIPPED line names the loss reason and time", /unknown/.test(accepted.result || "") && /500/.test(accepted.result || "")],
    ['reason "destroyed" (ordinary teardown) does NOT downgrade', unchanged(destroyed, failedRun())],
    ["a webgpu-backend-fallback event alone does NOT downgrade", unchanged(fallbackOnly, failedRun())],
    ["without HARNESS_ALLOW_DEVICE_LOSS_SKIPS the FAIL stands", unchanged(notOptedIn, failedRun())],
    ["a loss recorded after the verdict does NOT downgrade", unchanged(afterVerdict, failedRun())],
    [
      "page attributes are read from the <html> tag, not from HTML comments",
      attrs.quarantined === false && attrs.dpr === 2,
    ],
    [
      "a <meta name=cairn-harness> declaration counts; the same tag inside a comment does not",
      commentedMeta.selfDriving === true && commentedMeta.quarantined === false,
    ],
  ];
}

/** The runner must refuse (nonzero) a run whose filters selected no harness. */
function noSelectionCheck() {
  const r = spawnSync(process.execPath, [RUNNER, "--only", "zzz-nomatch"], {
    encoding: "utf-8",
    env: { ...process.env, HARNESS_ASSUME_GPU: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  // eslint-disable-next-line no-control-regex
  const out = ((r.stdout || "") + (r.stderr || "")).replace(/\x1b\[[0-9;]*m/g, "");
  return [
    [
      "an empty selection (--only zzz-nomatch) exits nonzero saying no harness selected",
      r.status !== 0 && r.status != null && /no harness selected/.test(out),
    ],
  ];
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
    ...unitChecks(),
    ...noSelectionCheck(),
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
