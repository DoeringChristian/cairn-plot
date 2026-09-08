#!/usr/bin/env node
// @ts-check
/**
 * Self-test for scripts/test-harness.mjs — proves the RUNNER itself correctly
 * reports failures and exits nonzero.
 *
 * It has two halves.
 *
 * UNIT half — imports the runner's pure decision functions and pins the rules
 * that decide whether a FAIL may be reported as a PASS, and which browser a page
 * runs in:
 *   • `downgradeIfDeviceLost` only downgrades a genuine `webgpu-device-lost`
 *     (reason other than `destroyed`) recorded BEFORE the verdict, on a
 *     software adapter, with the explicit env opt-in. An ordinary teardown
 *     (`destroyed`), a `webgpu-backend-fallback` (which every GPU render
 *     failure emits), a loss recorded after the verdict, or a run that did not
 *     opt in must leave the FAIL a FAIL.
 *   • `parseHarnessAttributes` reads the DECLARATION TAGS only (the opening
 *     `<html …>` tag and `<meta name="cairn-harness" …>`), so an attribute
 *     mentioned in an HTML comment, a `<script>` literal or on a `<div>`
 *     cannot quarantine a page out of the CI gate.
 *   • `groupByDpr` puts the default pages first and gives every distinct
 *     `data-cairn-harness-dpr` its own group — the runner launches one Chromium
 *     per group with `--force-device-scale-factor`, so a page landing in the
 *     wrong group would run at the wrong device pixel ratio.
 *   • `inlineWorkerPlugin` gives esbuild Vite's `?worker&inline`: the bundled
 *     module must construct a REAL `new Worker(` from an inline blob. Without
 *     it the worker is bundled as a plain module, `new mod.default()` throws,
 *     and every decode silently ran on the main thread — the harnesses would
 *     keep passing while proving nothing about the worker path.
 * Plus, as spawned runs: the runner must not exit 0 when its filters selected no
 * harness, nor accept an unparseable `HARNESS_MIN_PARITY` (which would silently
 * disable the parity floor).
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
import { build as esbuild } from "esbuild";
import {
  BASE_BUILD_OPTIONS,
  downgradeIfDeviceLost,
  groupByDpr,
  inlineWorkerPlugin,
  parseHarnessAttributes,
} from "./test-harness.mjs";

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
  // …nor may the attribute decide anything from OUTSIDE a declaration tag: a
  // script literal or a `<div>` carrying it is page content, not a declaration.
  // (This is the case a whole-file scan would fail: it would report quarantined.)
  const bodyMention = parseHarnessAttributes(
    '<html lang="en" data-cairn-harness="self-driving" data-cairn-harness-dpr="2"><body>' +
      "<script>const s = 'data-cairn-harness=\"quarantined\"'</script>" +
      '<div data-cairn-harness="quarantined"></div></body>',
  );
  // (g) pages are grouped by the device scale factor they need: the default
  // (null) group runs FIRST on the probed browser, then one forced-scale-factor
  // browser per distinct ratio. A page must appear in exactly one group.
  const grouped = groupByDpr([
    { id: "a", dpr: 2 },
    { id: "b", dpr: null },
    { id: "c", dpr: 2 },
    { id: "d", dpr: 3 },
    { id: "e", dpr: null },
  ]);
  const groupShape = grouped.map((g) => [g.dpr, g.pages.map((p) => p.id).join("")]);
  // …and a run whose pages ALL need a scale factor launches no default group.
  const forcedOnly = groupByDpr([{ id: "a", dpr: 2 }]).map((g) => g.dpr);

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
    [
      "the attribute in a <script> literal or on a <div> decides nothing (declaration tags only)",
      bodyMention.quarantined === false &&
        bodyMention.selfDriving === true &&
        bodyMention.dpr === 2,
    ],
    [
      "pages group by device scale factor, default group first then ascending ratios",
      JSON.stringify(groupShape) ===
        JSON.stringify([
          [null, "be"],
          [2, "ac"],
          [3, "d"],
        ]),
    ],
    [
      "a run with only forced-scale-factor pages has no default group",
      JSON.stringify(forcedOnly) === JSON.stringify([2]),
    ],
  ];
}

/** Run the real runner with `args`/`env` and return its exit code + plain output. */
function runRunner(args, env = {}) {
  const r = spawnSync(process.execPath, [RUNNER, ...args], {
    encoding: "utf-8",
    env: { ...process.env, HARNESS_ASSUME_GPU: "1", ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  // eslint-disable-next-line no-control-regex
  const out = ((r.stdout || "") + (r.stderr || "")).replace(/\x1b\[[0-9;]*m/g, "");
  return { status: r.status, out };
}

/**
 * Runner-level refusals: a run that selected nothing, and an unparseable parity
 * floor (which must be rejected, not silently disable the floor — `parityCount
 * < NaN` is false). The floor is validated BEFORE the selection check, so the
 * second case can also pass `--only zzz-nomatch` and stay fast.
 */
function refusalChecks() {
  const noSelection = runRunner(["--only", "zzz-nomatch"]);
  const badFloor = runRunner(["--only", "zzz-nomatch"], { HARNESS_MIN_PARITY: "abc" });
  // A default run (no --only/--all/--root) whose parity set can't possibly meet
  // an absurdly high floor must die BEFORE launching any browser, naming the
  // floor it failed — this is the actual CI gate that protects the parity set
  // from silently shrinking.
  const belowFloor = runRunner([], { HARNESS_MIN_PARITY: "999" });
  return [
    [
      "an empty selection (--only zzz-nomatch) exits nonzero saying no harness selected",
      noSelection.status !== 0 && noSelection.status != null && /no harness selected/.test(noSelection.out),
    ],
    [
      "an unparseable HARNESS_MIN_PARITY exits nonzero instead of disabling the floor",
      badFloor.status !== 0 &&
        badFloor.status != null &&
        /HARNESS_MIN_PARITY must be a number, got "abc"/.test(badFloor.out),
    ],
    [
      "a default run below an absurdly high HARNESS_MIN_PARITY=999 exits nonzero naming the floor",
      belowFloor.status !== 0 &&
        belowFloor.status != null &&
        /fewer than\s+HARNESS_MIN_PARITY=999/.test(belowFloor.out),
    ],
  ];
}

/**
 * `?worker&inline` must bundle to a real Worker constructor.
 *
 * esbuild does not implement Vite's `?worker&inline`, so without
 * `inlineWorkerPlugin` the worker module is bundled as an ordinary ESM module:
 * its default export is `undefined`, `new mod.default()` throws, and the decode
 * pool's caller silently falls back to the MAIN thread — every harness would
 * still pass while proving nothing about the worker path. This check bundles a
 * throwaway entry that imports `./x.ts?worker&inline` and asserts the output
 * really constructs a Worker (and carries the worker's own code inline).
 */
async function workerPluginChecks(dir) {
  // The worker imports a `.wasm` asset — exactly what the REAL decode worker
  // does (its OpenEXR module) — so the sub-build only compiles if it inherited
  // the page build's `loader` from `BASE_BUILD_OPTIONS`. Passing a stripped
  // options object here would fail with "No loader is configured for .wasm".
  writeFileSync(join(dir, "w.wasm"), Buffer.from([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0]));
  writeFileSync(
    join(dir, "x.ts"),
    'import wasmUrl from "./w.wasm";\nself.onmessage = () => postMessage("cairn-worker-alive:" + wasmUrl);\n',
  );
  writeFileSync(
    join(dir, "entry.ts"),
    'import W from "./x.ts?worker&inline";\n(globalThis as Record<string, unknown>).W = W;\n',
  );
  let text = "";
  let error = null;
  try {
    const out = await esbuild({
      ...BASE_BUILD_OPTIONS,
      entryPoints: [join(dir, "entry.ts")],
      bundle: true,
      write: false,
      format: "esm",
      platform: "browser",
      outdir: dir,
      plugins: [inlineWorkerPlugin(esbuild, BASE_BUILD_OPTIONS)],
    });
    text = (out.outputFiles.find((f) => f.path.endsWith(".js")) ?? out.outputFiles[0]).text;
  } catch (err) {
    error = err;
  }
  return [
    [
      "a `?worker&inline` import bundles with the page build's own options (a .wasm-importing worker compiles)",
      error === null,
    ],
    [
      "the bundled `?worker&inline` module constructs a real Worker (`new Worker(`)",
      text.includes("new Worker("),
    ],
    [
      "the worker's own code travels inline in that bundle (a Blob URL, no separate asset)",
      /createObjectURL/.test(text) && text.includes("cairn-worker-alive"),
    ],
  ];
}

async function main() {
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
  const workerChecks = await workerPluginChecks(dir);
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
    ...workerChecks,
    ...refusalChecks(),
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

main().catch((err) => {
  console.log(RED(`✗ runner self-test FAILED: ${err?.stack ?? err}`) + "\n");
  process.exit(1);
});
