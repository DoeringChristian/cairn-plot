#!/usr/bin/env node
// @ts-check
/**
 * Headless WebGPU parity-harness runner for cairn-plot.
 *
 * WHAT IT GUARDS. The `*.browser.ts` harnesses under
 * `src/plots/image/webgpu/__tests__/` are WebGPU↔TS *parity proofs*: each
 * renders on the GPU (WGSL) and asserts the readback equals what the CPU/TS
 * source of truth computes — tonemap curves (image-pass), HDR-out activation
 * (hdr-output), FLIP/SSIM perceptual metrics, deep-EXR compositing, backend
 * readback, device singleton. jsdom has no WebGPU, so none can be a `*.test.ts`
 * unit test; historically each said "open in Chrome by hand", so `npm test`
 * (which globs only `*.test.ts`) never ran them and the parity proofs only
 * executed when a human remembered. This runner makes them a headless,
 * CI-gated check — it drives every one to completion on a real/software GPU.
 *
 * The other `*.browser.ts` harnesses (media-compare / renderers / primitives)
 * are INTERACTION harnesses: they mount live React panes and settle only in
 * response to real layout + pointer/keyboard gestures, so headless navigation
 * alone never completes them. They stay human-run and are listed (not run)
 * unless `--all` is passed. Default = the WebGPU parity set.
 *
 * WHAT IT DOES.
 *   1. Discovers every `*.browser.html` harness page and the `*.browser.ts`
 *      sources its `<script src>` bundles come from.
 *   2. Bundles those sources to sibling `*.browser.bundle.js` via esbuild (the
 *      exact artifact each page's `<script type=module>` already loads; the
 *      bundles are gitignored and regenerated here).
 *   3. Serves the `ui/` root over http (module scripts are blocked on file://,
 *      and deep-composite resolves a committed .exr fixture from import.meta.url
 *      relative to that root).
 *   4. Launches ONE headless Chromium with WebGPU enabled and drives each page
 *      over the DevTools Protocol (raw ws, no npm deps): navigate, then poll the
 *      `#status` element — every harness sets it to exactly "PASS"/"FAIL" when
 *      done (and on a thrown error). Reads back the `#result` lines for output.
 *   5. Exits nonzero if ANY harness FAILs, TIMEs out, or errors.
 *
 * WEBGPU IN CI (the crux). Tries, in order:
 *   (a) `--enable-unsafe-webgpu --enable-features=Vulkan` (real adapter);
 *   (b) software fallback `--use-webgpu-adapter=swiftshader --use-angle=swiftshader`
 *       (Linux CI SwiftShader/Dawn);
 *   (c) if NO adapter can be obtained, the run SKIPS LOUDLY — prints a banner
 *       and emits a GitHub `::warning::` annotation naming every parity proof
 *       that did not run, and exits 0. It never silently passes.
 *
 * Dependency-free: plain Node (>=22, for the global `WebSocket`) + esbuild
 * (always installed — it is Vite's own bundler dependency) + a headless
 * Chromium invocation. No new npm dependency is added.
 *
 * PAGE ATTRIBUTES (read off each `*.browser.html` source; no JS is executed).
 * They are read from the opening `<html …>` tag or a `<meta name="cairn-harness" …>`
 * tag ONLY, with HTML comments stripped first — prose quoting an attribute
 * cannot decide how a page runs (see `parseHarnessAttributes`):
 *   data-cairn-harness="self-driving"  opt this page into the DEFAULT run (it
 *       dispatches its own gestures and settles `#status` headlessly).
 *   data-cairn-harness="quarantined" (+ data-cairn-harness-reason="…") — a
 *       known-unstable diagnostic: listed, not run, unless `--all`.
 *   data-cairn-harness-query="a=1&b=2"  appended to the page URL as its query
 *       string (for a harness that parameterises itself from `location.search`).
 *   data-cairn-harness-dpr="2"  drive this page at a NON-DEFAULT device pixel
 *       ratio. The runner GROUPS pages by this attribute and launches a SECOND
 *       Chromium per distinct ratio with `--force-device-scale-factor=<dpr>`
 *       (same GPU strategy flags as the default browser), runs that group's
 *       pages there, and kills it. A launch flag — not a CDP
 *       `Emulation.setDeviceMetricsOverride`, which a HEADLESS Chromium does
 *       NOT apply to `devicePixelContentBoxSize`: the override moved
 *       `window.devicePixelRatio` while the device-pixel content box stayed 1x,
 *       so a "DPR 2" page silently re-ran the DPR-1 case. The scale factor is
 *       per BROWSER, so a harness that must be proven at two ratios ships two
 *       `.html` pages pointing at the SAME bundle — one carrying the attribute,
 *       one without (see `cpu-label-alignment{,-dpr1}.browser.html`).
 *
 * Usage:   node scripts/test-harness.mjs            (or: npm run test:harness)
 * Flags:   --only <substr>     run only harnesses whose id contains <substr>
 *          --root <dir>        harness search root (default: src)
 *          --keep-bundles      do not delete generated .browser.bundle.js on exit
 * Env:     CHROME_BIN          path to a Chromium-family browser (else auto)
 *          HARNESS_TIMEOUT_MS  per-harness completion timeout (default 60000)
 *          HARNESS_SKIP        comma list of harness-id substrings to SKIP-LOUD
 *          HARNESS_ALLOW_DEVICE_LOSS_SKIPS=1  opt in to the software-adapter
 *              device-loss downgrade: a FAIL preceded by a GENUINE
 *              `webgpu-device-lost` (reason other than `destroyed`) recorded
 *              before the verdict becomes a loud SKIP. Off by default — without
 *              it a lost device is a FAIL. CI (no GPU) sets it; see
 *              `downgradeIfDeviceLost`.
 *          HARNESS_MIN_PARITY  minimum parity pages a DEFAULT run must select
 *              before it is allowed to pass (default 10). Must parse as a
 *              non-negative number — anything else is a hard error, never a
 *              silently disabled floor.
 *          HARNESS_FORCE_STRATEGY  pin GPU strategy selection to one strategy
 *              instead of trying (a) then (b) — `swiftshader`/`software`/`sw`/
 *              `dawn` forces the software SwiftShader/Dawn adapter CI actually
 *              runs (the ONLY way to reproduce a CI-only software-WebGPU
 *              failure on a box with a hardware adapter); `hardware`/`native`/
 *              `hw` forces the real adapter. No fallback to other strategies.
 */

import { build as esbuild } from "esbuild";
import { spawn } from "node:child_process";
import {
  existsSync,
  accessSync,
  constants,
  readdirSync,
  readFileSync,
  statSync,
  rmSync,
  mkdtempSync,
} from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve, join, relative, extname } from "node:path";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const UI_ROOT = resolve(__dirname, ".."); // scripts/ -> ui/

// ── CLI / env ───────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
function flag(name) {
  const i = argv.indexOf(name);
  return i >= 0 ? (argv[i + 1] ?? "") : undefined;
}
const ONLY = flag("--only");
const DEFAULT_SEARCH_ROOT = resolve(UI_ROOT, "src");
const SEARCH_ROOT = resolve(UI_ROOT, flag("--root") ?? "src");
const KEEP_BUNDLES = argv.includes("--keep-bundles");
// `--all` also drives the INTERACTION harnesses (media-compare / renderers /
// primitives). Those mount live React panes and settle their `#status` only in
// response to real layout + pointer/keyboard gestures, so they DO NOT complete
// under headless navigation alone (verified: every one times out). They stay
// human-run; the default set is the WebGPU WGSL↔TS parity proofs — exactly the
// harnesses the finding flagged as invisible to CI — which all settle headlessly.
const RUN_ALL = argv.includes("--all");

/** A parity proof (headless-drivable) vs an interaction harness (human-run). */
function isParityHarness(h) {
  return h.htmlPath.split("\\").join("/").includes("/webgpu/__tests__/");
}
const HARNESS_TIMEOUT_MS = Number(process.env.HARNESS_TIMEOUT_MS) || 60_000;
const SKIP_SUBSTR = (process.env.HARNESS_SKIP ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
/** Floor of parity pages a DEFAULT run must select (see the check in `main`). */
const MIN_PARITY_RAW = process.env.HARNESS_MIN_PARITY;
const MIN_PARITY = MIN_PARITY_RAW === undefined ? 10 : Number(MIN_PARITY_RAW);

const RED = (s) => `\x1b[31m${s}\x1b[0m`;
const GREEN = (s) => `\x1b[32m${s}\x1b[0m`;
const YELLOW = (s) => `\x1b[33m${s}\x1b[0m`;
const BOLD = (s) => `\x1b[1m${s}\x1b[0m`;
const DIM = (s) => `\x1b[2m${s}\x1b[0m`;

function die(msg) {
  console.error(RED(`\ntest:harness FAILED — ${msg}\n`));
  process.exit(1);
}

// Validated as early as `die` allows — BEFORE any selection check — because an
// unparseable floor would otherwise disable the floor silently: `Number("abc")`
// is NaN and `parityCount < NaN` is false, so a typo'd override would let a
// shrunken default run go green. An empty value is a typo too (`Number("")` is 0).
if (
  MIN_PARITY_RAW !== undefined &&
  (MIN_PARITY_RAW.trim() === "" || !Number.isFinite(MIN_PARITY) || MIN_PARITY < 0)
) {
  die(
    `HARNESS_MIN_PARITY must be a number, got "${MIN_PARITY_RAW}" — ` +
      `it is the minimum number of parity pages a default run must select`,
  );
}

/** GitHub Actions workflow-command annotation (loud, survives log folding). */
function ghAnnotate(level, msg) {
  // Only meaningful on CI; harmless (just a line) locally.
  const line = msg.replace(/\r?\n/g, "%0A");
  console.log(`::${level}::${line}`);
}

// ── 1. Discover harness pages ─────────────────────────────────────────────────
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === ".git") continue;
      walk(p, out);
    } else if (name.endsWith(".browser.html")) {
      out.push(p);
    }
  }
  return out;
}

/**
 * @typedef {{ id:string, htmlPath:string, dir:string, urlPath:string,
 *             query:string, dpr:number|null,
 *             sources:string[], selfDriving:boolean, quarantined:boolean,
 *             quarantineReason:string }} Harness
 */

/**
 * Read the `data-cairn-harness*` page attributes from the page's DECLARATION
 * TAGS only: the opening `<html …>` tag (first `/<html\b[^>]*>/i` match) and any
 * `<meta name="cairn-harness" …>` tag — the two places the harness pages
 * actually declare them — after HTML comments have been stripped.
 *
 * Scanning the whole file would let any mention of an attribute anywhere in the
 * page decide how it runs: several pages carry a prose comment quoting
 * `data-cairn-harness="self-driving"`, and a comment quoting `"quarantined"`
 * would silently drop a proof out of the CI gate. Only a real tag declares.
 *
 * @param {string} html
 * @returns {{ selfDriving:boolean, quarantined:boolean, quarantineReason:string,
 *             query:string, dpr:number|null }}
 */
export function parseHarnessAttributes(html) {
  const source = String(html).replace(/<!--[\s\S]*?-->/g, "");
  const htmlTag = source.match(/<html\b[^>]*>/i)?.[0] ?? "";
  const metaTags = [
    ...source.matchAll(/<meta\b[^>]*\bname\s*=\s*["']cairn-harness["'][^>]*>/gi),
  ]
    .map((m) => m[0])
    .join(" ");
  const tag = `${htmlTag} ${metaTags}`;
  // A harness that dispatches its OWN gestures (and sets #status to PASS/FAIL
  // without any external driving) opts into the DEFAULT run by declaring
  // `data-cairn-harness="self-driving"` in its HTML — so a non-WebGPU DOM proof
  // (e.g. page-wide selection) is gated by CI just like the WebGPU parity
  // proofs, unlike the gesture-dependent interaction harnesses.
  const selfDriving = /data-cairn-harness\s*=\s*["']self-driving["']/i.test(tag);
  const quarantined = /data-cairn-harness\s*=\s*["']quarantined["']/i.test(tag);
  const quarantineReason =
    tag.match(/data-cairn-harness-reason\s*=\s*["']([^"']*)["']/i)?.[1] ??
    "known unstable diagnostic";
  const query = tag.match(/data-cairn-harness-query\s*=\s*["']([^"']*)["']/i)?.[1] ?? "";
  // `data-cairn-harness-dpr="2"` — run this page in a browser launched at that
  // device scale factor (see PAGE ATTRIBUTES in the header).
  // Absent / non-numeric / <= 0 ⇒ null (the default browser's own ratio).
  const dprRaw = tag.match(/data-cairn-harness-dpr\s*=\s*["']([^"']*)["']/i)?.[1];
  const dprNum = dprRaw === undefined ? NaN : Number(dprRaw);
  const dpr = Number.isFinite(dprNum) && dprNum > 0 ? dprNum : null;
  return { selfDriving, quarantined, quarantineReason, query, dpr };
}

/** @returns {Harness[]} */
function discoverHarnesses() {
  const pages = walk(SEARCH_ROOT).sort();
  /** @type {Harness[]} */
  const harnesses = [];
  for (const htmlPath of pages) {
    const html = readFileSync(htmlPath, "utf-8");
    const dir = dirname(htmlPath);
    const id = relative(SEARCH_ROOT, htmlPath).replace(/\.browser\.html$/, "");
    const { selfDriving, quarantined, quarantineReason, query, dpr } =
      parseHarnessAttributes(html);
    // Every `<script ... src="./X.browser.bundle.js">` maps to source X.browser.ts
    const sources = [];
    for (const m of html.matchAll(
      /<script\b[^>]*\bsrc\s*=\s*["']\.\/([^"'?]+\.browser\.bundle\.js)(?:\?[^"']*)?["']/gi,
    )) {
      const bundle = m[1];
      const src = join(dir, bundle.replace(/\.bundle\.js$/, ".ts"));
      if (!existsSync(src)) die(`${htmlPath}\n  references ${bundle} but ${src} does not exist`);
      sources.push(src);
    }
    const urlPath = "/" + relative(UI_ROOT, htmlPath).split("\\").join("/");
    harnesses.push({
      id,
      htmlPath,
      dir,
      urlPath,
      query,
      dpr,
      sources,
      selfDriving,
      quarantined,
      quarantineReason,
    });
  }
  return harnesses;
}

// ── 2. Bundle sources with esbuild ────────────────────────────────────────────
async function bundleAll(harnesses) {
  const sources = [...new Set(harnesses.flatMap((h) => h.sources))];
  if (sources.length === 0) return [];
  console.log(`• bundling ${sources.length} harness source(s) via esbuild`);
  const outfiles = [];
  await Promise.all(
    sources.map(async (src) => {
      const outfile = src.replace(/\.ts$/, ".bundle.js");
      await esbuild({
        entryPoints: [src],
        bundle: true,
        format: "esm",
        platform: "browser",
        target: "es2022",
        outfile,
        logLevel: "silent",
        // Some public package sources live beside ui/, so normal ancestor
        // lookup does not reach ui/node_modules. Keep one dependency install
        // authoritative instead of requiring duplicate package installs.
        nodePaths: [join(UI_ROOT, "node_modules")],
        // Harnesses that import React components (`*.tsx`, e.g. the pane
        // harnesses) need the automatic JSX runtime: the project's root
        // tsconfig.json is a references-only stub esbuild does not resolve
        // through to `tsconfig.app.json`'s `"jsx": "react-jsx"`, so without this
        // esbuild falls back to the classic `React.createElement` factory and
        // the component modules throw "React is not defined" at eval (the same
        // gotcha the gpu-image-pane harness's RUNNING doc calls out). Engine
        // parity harnesses import no JSX, so this is a no-op for them.
        jsx: "automatic",
        // Inline .wasm/.exr etc. that harnesses import via new URL(...import.meta.url)
        // are left as URL references resolved against the served ui/ root.
        loader: { ".wasm": "file" },
      }).catch((err) => {
        die(`esbuild failed on ${relative(UI_ROOT, src)}:\n${err.message ?? err}`);
      });
      outfiles.push(outfile);
    }),
  );
  return outfiles;
}

// ── 3. Static file server rooted at ui/ ───────────────────────────────────────
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".wasm": "application/wasm",
  ".png": "image/png",
  ".exr": "application/octet-stream",
  ".map": "application/json; charset=utf-8",
};
function startServer(rootDir) {
  return new Promise((resolveServer) => {
    const server = createServer((req, res) => {
      try {
        const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
        // Synthetic probe page — a real http (localhost = secure) origin so
        // navigator.gpu is exposed (about:blank / data: URLs do not expose it).
        if (urlPath === "/__webgpu_probe__") {
          res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
          res.end("<!doctype html><meta charset=utf-8><title>probe</title><body></body>");
          return;
        }
        const filePath = resolve(rootDir, "." + urlPath);
        if (!filePath.startsWith(rootDir)) {
          res.writeHead(403).end("forbidden");
          return;
        }
        if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
          res.writeHead(404).end("not found");
          return;
        }
        res.writeHead(200, {
          "content-type": MIME[extname(filePath)] || "application/octet-stream",
          // COOP/COEP so cross-origin-isolated features (SharedArrayBuffer used
          // by some wasm decoders) work if a harness needs them.
          "cross-origin-opener-policy": "same-origin",
          "cross-origin-embedder-policy": "require-corp",
          "cross-origin-resource-policy": "cross-origin",
        });
        res.end(readFileSync(filePath));
      } catch (err) {
        res.writeHead(500).end(String(err));
      }
    });
    server.listen(0, "127.0.0.1", () => {
      const port = /** @type {any} */ (server.address()).port;
      resolveServer({ server, port });
    });
  });
}

// ── 4. Chromium launch + minimal DevTools-Protocol client ─────────────────────
function isExecutable(p) {
  try {
    accessSync(p, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
function findChrome() {
  if (process.env.CHROME_BIN) {
    if (isExecutable(process.env.CHROME_BIN)) return process.env.CHROME_BIN;
    die(`CHROME_BIN="${process.env.CHROME_BIN}" is not executable.`);
  }
  const mac = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  ];
  const lin = [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/opt/google/chrome/chrome",
  ];
  for (const c of process.platform === "darwin" ? mac : lin) if (isExecutable(c)) return c;
  die(
    "no Chromium-family browser found. Set CHROME_BIN=/path/to/chrome or install " +
      "Google Chrome / Chromium.",
  );
}

/** Base flags shared by every launch attempt. */
const BASE_FLAGS = [
  "--headless=new",
  // Deterministic, generous viewport so layout-geometry harnesses (e.g. the
  // enlarge overlay's gutter-placed ✕) get a stable window.innerWidth/Height.
  "--window-size=1600,1000",
  "--no-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu-sandbox",
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-background-networking",
  // Stress/benchmark harnesses report real JS heap usage instead of Chrome's
  // default quantized performance.memory values.
  "--enable-precise-memory-info",
];

/**
 * WebGPU launch strategies, tried in order until an adapter is obtained.
 * `key` is a stable, lowercase handle for `HARNESS_FORCE_STRATEGY` (below).
 * @type {{key:string, name:string, flags:string[]}[]}
 */
const GPU_STRATEGIES = [
  {
    key: "hardware",
    name: "hardware/native (--enable-unsafe-webgpu --enable-features=Vulkan)",
    flags: ["--enable-unsafe-webgpu", "--enable-features=Vulkan"],
  },
  {
    key: "swiftshader",
    name: "software (SwiftShader/Dawn: --use-webgpu-adapter=swiftshader --use-angle=swiftshader)",
    flags: [
      "--enable-unsafe-webgpu",
      "--enable-features=Vulkan",
      "--use-webgpu-adapter=swiftshader",
      "--use-angle=swiftshader",
    ],
  },
];

/**
 * `HARNESS_FORCE_STRATEGY` pins strategy selection to a single strategy
 * instead of trying them in order — the ONLY way to reproduce a CI-only
 * (software-WebGPU-only) failure on a dev box whose hardware adapter would
 * otherwise be picked first (strategy (a) always wins locally, so the
 * SwiftShader/Dawn path CI actually runs is never exercised by a plain local
 * run). Accepted aliases (case-insensitive): `hardware`/`native`/`hw` and
 * `swiftshader`/`software`/`sw`/`dawn`. When set and no strategy matches (or
 * the forced adapter can't be obtained), the runner does NOT silently fall
 * through to another strategy — it skip-loudly/exits per the normal
 * no-adapter path, so a forced run can never masquerade as a different
 * backend.
 */
const FORCE_STRATEGY = (process.env.HARNESS_FORCE_STRATEGY ?? "").trim().toLowerCase();
const STRATEGY_ALIASES = {
  hardware: "hardware",
  native: "hardware",
  hw: "hardware",
  swiftshader: "swiftshader",
  software: "swiftshader",
  sw: "swiftshader",
  dawn: "swiftshader",
};
function selectStrategies() {
  if (!FORCE_STRATEGY) return GPU_STRATEGIES;
  const wantKey = STRATEGY_ALIASES[FORCE_STRATEGY];
  if (!wantKey) {
    die(
      `HARNESS_FORCE_STRATEGY="${FORCE_STRATEGY}" is not a known strategy. ` +
        `Use one of: ${Object.keys(STRATEGY_ALIASES).join(", ")}.`,
    );
  }
  return GPU_STRATEGIES.filter((s) => s.key === wantKey);
}

class CDP {
  /** @param {string} wsUrl */
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    /** @type {Map<number,{resolve:Function,reject:Function}>} */
    this.pending = new Map();
    this.ready = new Promise((res, rej) => {
      this.ws.addEventListener("open", () => res(undefined), { once: true });
      this.ws.addEventListener("error", (e) => rej(new Error("ws error: " + (e.message || e.type))), {
        once: true,
      });
    });
    this.ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(typeof ev.data === "string" ? ev.data : ev.data.toString());
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve: r, reject: j } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) j(new Error(msg.error.message || JSON.stringify(msg.error)));
        else r(msg.result);
      }
    });
  }
  /** @param {string} method @param {object} [params] @param {string} [sessionId] */
  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((res, rej) => {
      this.pending.set(id, { resolve: res, reject: rej });
      this.ws.send(JSON.stringify(payload));
    });
  }
  close() {
    try {
      this.ws.close();
    } catch {
      /* noop */
    }
  }
}

async function launchChrome(chrome, gpuFlags) {
  const userDataDir = mkdtempSync(join(tmpdir(), "cairn-harness-"));
  const args = [
    ...BASE_FLAGS,
    ...gpuFlags,
    `--user-data-dir=${userDataDir}`,
    "--remote-debugging-port=0",
    "about:blank",
  ];
  const proc = spawn(chrome, args, { stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";
  proc.stderr.on("data", (d) => (stderr += d.toString()));

  // Chrome writes the chosen port to <user-data-dir>/DevToolsActivePort (line 1).
  const portFile = join(userDataDir, "DevToolsActivePort");
  const deadline = Date.now() + 15_000;
  let port = 0;
  while (Date.now() < deadline) {
    if (proc.exitCode !== null) {
      throw new Error(`Chrome exited (${proc.exitCode}) during startup:\n${stderr.slice(-2000)}`);
    }
    if (existsSync(portFile)) {
      const first = readFileSync(portFile, "utf-8").split("\n")[0].trim();
      if (first) {
        port = Number(first);
        break;
      }
    }
    await sleep(50);
  }
  if (!port) throw new Error(`Chrome did not report a debugging port.\n${stderr.slice(-2000)}`);

  const verRes = await fetch(`http://127.0.0.1:${port}/json/version`);
  const ver = await verRes.json();
  const cdp = new CDP(ver.webSocketDebuggerUrl);
  await cdp.ready;
  return { proc, cdp, userDataDir, stderr: () => stderr };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Best-effort recursive remove — Chrome may still be flushing the profile dir. */
function safeRmDir(dir) {
  try {
    rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  } catch {
    /* leftover temp profile dir is harmless */
  }
}

/**
 * Open `url` in a fresh target, run `fn(sessionId)`, then close the target.
 *
 * A page's device pixel ratio is NOT set here: it comes from the browser this
 * `cdp` is attached to (`--force-device-scale-factor`, see the per-DPR group
 * loop in `main`), so the
 * page's very first layout and paint already happen at that ratio and the
 * device-pixel content box really is that many device pixels wide.
 */
async function withPage(cdp, url, fn) {
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  try {
    await cdp.send("Page.enable", {}, sessionId);
    // Arm the library's context-loss diagnostics BEFORE the page's scripts run:
    // `recordContextLossEvent` (src/engines/context-loss-diagnostics.ts) only
    // records when this array exists. `runHarness` reads it to tell "the proof
    // failed" from "the software adapter dropped the device under the proof".
    await cdp.send("Page.addScriptToEvaluateOnNewDocument",
      { source: "window.__cairnContextLossEvents = [];" }, sessionId).catch(() => {});
    await cdp.send("Runtime.enable", {}, sessionId);
    await cdp.send("Page.navigate", { url }, sessionId);
    return await fn(sessionId);
  } finally {
    await cdp.send("Target.closeTarget", { targetId }).catch(() => {});
  }
}

/** Evaluate an expression in the page and return its by-value result. */
async function evalInPage(cdp, sessionId, expression, awaitPromise = false) {
  const r = await cdp.send(
    "Runtime.evaluate",
    { expression, returnByValue: true, awaitPromise },
    sessionId,
  );
  if (r.exceptionDetails) {
    throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  }
  return r.result?.value;
}

/** Probe whether this Chrome instance can obtain a WebGPU adapter. */
async function probeAdapter(cdp, baseUrl) {
  return withPage(cdp, `${baseUrl}/__webgpu_probe__`, async (sessionId) => {
    await sleep(200);
    return await evalInPage(
      cdp,
      sessionId,
      `(async () => {
         if (!navigator.gpu) return { ok:false, why:'no navigator.gpu' };
         try {
           const a = await navigator.gpu.requestAdapter();
           if (!a) return { ok:false, why:'requestAdapter() returned null' };
           const i = a.info || (a.requestAdapterInfo ? await a.requestAdapterInfo() : {});
           return { ok:true, info: { vendor:i.vendor, architecture:i.architecture, description:i.description } };
         } catch (e) { return { ok:false, why:String(e && e.message || e) }; }
       })()`,
      true,
    );
  });
}

/**
 * The GENUINE-device-loss events the page recorded (the sink is armed in
 * `withPage`), as `{kind, reason, message, t}` — `t` is the page's
 * `performance.now()` at the moment of the loss, so it can be compared with the
 * verdict time.
 *
 * Only `webgpu-device-lost` is collected. `webgpu-backend-fallback` is
 * deliberately NOT: the runtime emits it whenever a GPU render fails for ANY
 * reason and the cell falls back to the CPU backend — i.e. it is emitted BY the
 * very failure a harness is meant to catch, so treating it as evidence of a
 * lost device would let any GPU defect excuse itself.
 */
async function deviceLossEvents(cdp, sessionId) {
  try {
    return await evalInPage(
      cdp,
      sessionId,
      `(window.__cairnContextLossEvents || [])
         .filter((e) => e.kind === 'webgpu-device-lost')
         .map((e) => ({ kind: e.kind,
                        reason: e.detail && e.detail.reason,
                        message: e.detail && e.detail.message,
                        t: e.t }))`,
    );
  } catch {
    return [];
  }
}

/**
 * SOFTWARE-ADAPTER POLICY. On a software WebGPU adapter (SwiftShader/Dawn — what
 * CI runs) the device is genuinely lost under a running proof; the panes then
 * fall back to the CPU backend (correct product behaviour) and every later GPU
 * assertion fails for a reason that is not a defect. Several harnesses already
 * encode this by hand (report a loud "SKIPPED — device lost" instead of a FAIL).
 * This applies the same rule centrally — but ONLY when every one of these holds,
 * because each missing condition is a way for a real FAIL to go green:
 *
 *   • `ctx.softwareAdapter` — a hardware adapter never downgrades anything;
 *   • `ctx.allowSkips` — the job explicitly opted in with
 *     `HARNESS_ALLOW_DEVICE_LOSS_SKIPS=1` (CI does; a local run does not);
 *   • the run did not pass (nothing to downgrade otherwise);
 *   • some `webgpu-device-lost` event has `reason !== "destroyed"` — a
 *     `destroyed` device is ORDINARY teardown, not a loss; and
 *   • that event happened at or before the verdict (`t <= r.verdictAt`) — a loss
 *     recorded after the verdict cannot have caused it.
 *
 * A `webgpu-backend-fallback` event never qualifies (see `deviceLossEvents`).
 * The downgrade produces a PASS carrying a SKIPPED line naming the reason and
 * time — surfaced as a warning annotation and counted in the summary by the
 * caller, so it can never go green invisibly.
 *
 * @param {{verdict:string, verdictAt?:number, result?:string}} r
 * @param {{softwareAdapter?:boolean, allowSkips?:boolean,
 *          losses?:{kind?:string, reason?:string, message?:string, t?:number}[]}} ctx
 * @returns {{verdict:string, verdictAt?:number, result?:string, deviceLost?:boolean}}
 */
export function downgradeIfDeviceLost(r, ctx = {}) {
  const { softwareAdapter = false, allowSkips = false, losses = [] } = ctx;
  if (!softwareAdapter || !allowSkips) return r;
  if (!r || r.verdict === "pass") return r;
  const verdictAt = typeof r.verdictAt === "number" ? r.verdictAt : Number.NaN;
  const genuine = (losses || []).filter(
    (e) =>
      e &&
      e.kind === "webgpu-device-lost" &&
      e.reason !== "destroyed" &&
      typeof e.t === "number" &&
      e.t <= verdictAt,
  );
  if (genuine.length === 0) return r;
  const detail = genuine
    .map(
      (e) =>
        `reason=${e.reason ?? "unspecified"} at ${Math.round(e.t)}ms` +
        (e.message ? `: ${e.message}` : ""),
    )
    .join(" | ");
  const line =
    `SKIPPED — WebGPU device lost on the software adapter (${detail}; verdict at ` +
    `${Math.round(verdictAt)}ms); the ${r.verdict === "timeout" ? "proof timed out" : "proof failed"} ` +
    `after the loss and could not run (not a parity failure)`;
  return { ...r, verdict: "pass", deviceLost: true, result: `${line}\n${r.result || ""}` };
}

/** Drive one harness page to completion; poll #status until PASS/FAIL or timeout. */
async function runHarness(cdp, baseUrl, harness, ctx = {}) {
  const { softwareAdapter = false, allowSkips = false } = ctx;
  const url = baseUrl + harness.urlPath + (harness.query ? `?${harness.query}` : "");
  return withPage(cdp, url, async (sessionId) => {
    const start = Date.now();
    // `now` is the PAGE clock (`performance.now()`), the same clock
    // `recordContextLossEvent` stamps its events with — so `verdictAt` and a
    // loss `t` are comparable and "the loss happened before the verdict" is a
    // real causality check rather than a guess.
    const poll = `(() => {
      const s = document.getElementById('status');
      const status = s ? (s.textContent || '').trim() : '';
      const res = document.getElementById('result');
      return { status, verdict: /^(PASS|FAIL)$/.test(status) ? status.toLowerCase() : null,
               now: performance.now(),
               result: res ? (res.innerText || '') : '' };
    })()`;
    let lastNow = Number.NaN;
    while (Date.now() - start < HARNESS_TIMEOUT_MS) {
      let snap;
      try {
        snap = await evalInPage(cdp, sessionId, poll);
      } catch {
        // navigation may not have committed yet; retry
        await sleep(100);
        continue;
      }
      if (snap && typeof snap.now === "number") lastNow = snap.now;
      if (snap && snap.verdict) {
        const r = {
          verdict: snap.verdict, // 'pass' | 'fail'
          ms: Date.now() - start,
          verdictAt: snap.now,
          result: snap.result,
        };
        if (r.verdict !== "pass" && softwareAdapter && allowSkips) {
          return downgradeIfDeviceLost(r, {
            softwareAdapter,
            allowSkips,
            losses: await deviceLossEvents(cdp, sessionId),
          });
        }
        return r;
      }
      await sleep(150);
    }
    // timeout: grab whatever the page managed to render
    let tail = "";
    try {
      tail = await evalInPage(
        cdp,
        sessionId,
        `(document.getElementById('result')||{}).innerText || ''`,
      );
    } catch {
      /* noop */
    }
    let verdictAt = lastNow;
    try {
      verdictAt = await evalInPage(cdp, sessionId, `performance.now()`);
    } catch {
      /* keep the last polled page clock */
    }
    const r = { verdict: "timeout", ms: Date.now() - start, verdictAt, result: tail };
    return softwareAdapter && allowSkips
      ? downgradeIfDeviceLost(r, {
          softwareAdapter,
          allowSkips,
          losses: await deviceLossEvents(cdp, sessionId),
        })
      : r;
  });
}

/**
 * Run `group` (harness pages sharing one device scale factor) sequentially on
 * the browser behind `cdp`, printing each verdict and appending a row to `rows`.
 * Each page gets its own target — and so its own fresh GPU device.
 */
async function runGroup(cdp, baseUrl, group, ctx, rows) {
  for (const h of group) {
    process.stdout.write(`  running ${h.id} … `);
    let r;
    try {
      r = await runHarness(cdp, baseUrl, h, ctx);
    } catch (err) {
      r = { verdict: "error", ms: 0, result: String(err.message || err) };
    }
    const tag =
      r.verdict === "pass"
        ? GREEN("PASS")
        : r.verdict === "fail"
          ? RED("FAIL")
          : r.verdict === "timeout"
            ? YELLOW("TIMEOUT")
            : RED("ERROR");
    console.log(`${tag} ${DIM(`(${r.ms}ms)`)}`);
    if (r.verdict !== "pass" && r.result) console.log(indent(r.result));
    // A harness can PASS while loudly SKIPPING a sub-case (e.g. the WebGPU engine
    // reported a `DeviceLostError` mid-readback — the software backend gave up
    // on the device, which is not a parity defect). Surface those lines even
    // on PASS so a chronically-skipped proof can never go green *invisibly* —
    // the runner's "never silently passes" contract applied at sub-case grain.
    const passLines = (r.verdict === "pass" && r.result ? r.result : "").split("\n");
    const benchmarkLines = passLines.filter((l) => /BENCH:/i.test(l));
    for (const l of benchmarkLines) console.log("        " + l.trim());
    const skipLines = passLines.filter((l) => /SKIPPED/i.test(l));
    if (skipLines.length) {
      for (const l of skipLines) console.log("        " + YELLOW(l.trim()));
      ghAnnotate("warning", `${h.id}: sub-case(s) SKIPPED — ${skipLines.map((l) => l.trim()).join(" | ")}`);
    }
    rows.push({ id: h.id, ...r, skipped: skipLines.length });
  }
}

/**
 * Split `harnesses` into one group per device scale factor, `null` (the default
 * browser) FIRST and the forced-scale-factor groups after it in ascending
 * order — so the default run is never held up by an extra browser launch.
 *
 * @param {Harness[]} harnesses
 * @returns {{ dpr:number|null, pages:Harness[] }[]}
 */
export function groupByDpr(harnesses) {
  /** @type {Map<number|null, Harness[]>} */
  const byDpr = new Map();
  for (const h of harnesses) {
    const key = h.dpr ?? null;
    if (!byDpr.has(key)) byDpr.set(key, []);
    byDpr.get(key).push(h);
  }
  const forced = [...byDpr.keys()].filter((k) => k !== null).sort((a, b) => a - b);
  const keys = byDpr.has(null) ? [null, ...forced] : forced;
  return keys.map((dpr) => ({ dpr, pages: byDpr.get(dpr) }));
}

// ── 5. Report / main ──────────────────────────────────────────────────────────
function indent(text, pad = "        ") {
  return String(text)
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => pad + DIM(l))
    .join("\n");
}

async function main() {
  console.log(BOLD("\ncairn-plot WebGPU parity-harness runner\n"));

  let harnesses = discoverHarnesses();
  if (harnesses.length === 0) die(`no *.browser.html harnesses found under ${SEARCH_ROOT}`);
  if (ONLY) harnesses = harnesses.filter((h) => h.id.includes(ONLY));

  // Interaction harnesses are human-run (see isParityHarness / RUN_ALL notes).
  // With a custom --root (e.g. the self-test), treat everything as runnable.
  const customRoot = SEARCH_ROOT !== DEFAULT_SEARCH_ROOT;
  const interactionSkips = [];
  const quarantinedSkips = [];
  if (!RUN_ALL && !customRoot) {
    harnesses = harnesses.filter((h) => {
      // Known unstable diagnostics stay available under --all but may not make
      // the required default CI gate permanently red while their issue remains
      // explicitly open and reproducible.
      if (h.quarantined) {
        quarantinedSkips.push({ id: h.id, reason: h.quarantineReason });
        return false;
      }
      // The default set = WebGPU WGSL↔TS parity proofs PLUS any SELF-DRIVING
      // harness (dispatches its own gestures, settles headlessly). Only the
      // gesture-DEPENDENT interaction harnesses are deferred to `--all`.
      if (!isParityHarness(h) && !h.selfDriving) {
        interactionSkips.push(h.id);
        return false;
      }
      return true;
    });
  }

  // Partition explicit skips (loud).
  const loudSkips = [];
  harnesses = harnesses.filter((h) => {
    if (SKIP_SUBSTR.some((s) => h.id.includes(s))) {
      loudSkips.push(h.id);
      return false;
    }
    return true;
  });

  // A run that selected NOTHING is not a green run: exiting 0 here would let a
  // typo'd `--only`, an over-broad `HARNESS_SKIP`, or a renamed/quarantined page
  // report success while proving nothing.
  if (harnesses.length === 0) {
    die(
      `no harness selected after filters (root ${SEARCH_ROOT}` +
        `${ONLY ? `, --only "${ONLY}"` : ""}${SKIP_SUBSTR.length ? `, HARNESS_SKIP=${SKIP_SUBSTR.join(",")}` : ""}` +
        `) — a run that proves nothing must not pass`,
    );
  }
  // A DEFAULT run (the CI gate) must actually drive the parity set. If the page
  // set silently shrinks — a moved directory, a mass quarantine — the job would
  // otherwise stay green on a handful of pages. `--only`/`--all`/`HARNESS_SKIP`
  // and a custom `--root` are deliberate narrowings and are exempt.
  const parityCount = harnesses.filter(isParityHarness).length;
  if (!ONLY && !RUN_ALL && !process.env.HARNESS_SKIP && !customRoot && parityCount < MIN_PARITY) {
    die(
      `a default run selected only ${parityCount} parity harness page(s), fewer than ` +
        `HARNESS_MIN_PARITY=${MIN_PARITY}. The parity set shrank (moved, renamed or ` +
        `quarantined pages?) — fix the set, or set HARNESS_MIN_PARITY deliberately.`,
    );
  }

  console.log(`• running ${harnesses.length} parity harness page(s):`);
  for (const h of harnesses) console.log(`    ${h.id}`);
  if (quarantinedSkips.length) {
    console.log(
      YELLOW(
        `• ${quarantinedSkips.length} known-failing diagnostic harness(es) quarantined ` +
          `(run explicitly with --all while fixing):`,
      ),
    );
    for (const h of quarantinedSkips) console.log(YELLOW(`    ${h.id} — ${h.reason}`));
  }
  if (interactionSkips.length) {
    console.log(
      YELLOW(
        `• ${interactionSkips.length} interaction harness(es) NOT run (human-run; ` +
          `need live layout + gestures — pass --all to attempt):`,
      ),
    );
    for (const id of interactionSkips) console.log(YELLOW(`    ${id}`));
  }
  if (loudSkips.length) {
    console.log(YELLOW(`• HARNESS_SKIP excludes: ${loudSkips.join(", ")}`));
  }
  console.log("");

  const generated = await bundleAll(harnesses);
  const cleanup = () => {
    if (!KEEP_BUNDLES) for (const f of generated) rmSync(f, { force: true });
  };

  const { server, port: serverPort } = await startServer(UI_ROOT);
  const baseUrl = `http://127.0.0.1:${serverPort}`;

  const chrome = findChrome();
  console.log(`• chrome: ${chrome}`);

  // Try each GPU strategy until an adapter is available.
  // HARNESS_ASSUME_GPU=1 bypasses the WebGPU adapter probe (used by the runner's
  // own self-test, whose fake harnesses use no WebGPU) so the drive/parse/exit
  // path can be exercised deterministically on a GPU-less machine.
  const assumeGpu = process.env.HARNESS_ASSUME_GPU === "1";
  const strategies = selectStrategies();
  if (FORCE_STRATEGY) {
    console.log(
      YELLOW(
        `• HARNESS_FORCE_STRATEGY=${FORCE_STRATEGY} — pinned to strategy "${strategies[0]?.key}" ` +
          `(no fallback to other strategies)`,
      ),
    );
  }
  let launched = null;
  let adapter = null;
  let strategyUsed = "";
  // The flags of the strategy that actually got an adapter. The per-DPR
  // browsers below reuse them verbatim (plus `--force-device-scale-factor`), so
  // every page in the run talks to the same kind of WebGPU adapter — the
  // adapter is probed ONCE, on this default browser.
  let strategyFlags = [];
  for (const strat of strategies) {
    console.log(`• launching Chromium — ${strat.name}`);
    let l;
    try {
      l = await launchChrome(chrome, strat.flags);
    } catch (err) {
      console.log(YELLOW(`    launch failed: ${err.message}`));
      continue;
    }
    let a;
    if (assumeGpu) {
      a = { ok: true, info: { vendor: "(probe bypassed: HARNESS_ASSUME_GPU=1)" } };
    } else {
      try {
        a = await probeAdapter(l.cdp, baseUrl);
      } catch (err) {
        a = { ok: false, why: `probe threw: ${err.message}` };
      }
    }
    if (a && a.ok) {
      launched = l;
      adapter = a;
      strategyFlags = strat.flags;
      strategyUsed = assumeGpu ? strat.name + " [probe bypassed]" : strat.name;
      break;
    }
    console.log(YELLOW(`    no WebGPU adapter (${a && a.why}) — trying next strategy`));
    l.cdp.close();
    l.proc.kill("SIGKILL");
    safeRmDir(l.userDataDir);
  }

  // (c) SKIP-LOUDLY: no adapter anywhere.
  if (!launched) {
    cleanup();
    server.close();
    const names = harnesses.map((h) => h.id).join(", ");
    console.log("");
    console.log(YELLOW(BOLD("╔══════════════════════════════════════════════════════════════╗")));
    console.log(YELLOW(BOLD("║  WEBGPU UNAVAILABLE — PARITY HARNESSES SKIPPED (NOT PASSED)  ║")));
    console.log(YELLOW(BOLD("╚══════════════════════════════════════════════════════════════╝")));
    console.log(
      YELLOW(
        `This runner could not obtain a WebGPU adapter via any strategy on this\n` +
          `runner. The following WGSL↔TS parity proofs DID NOT RUN and are\n` +
          `unverified by this job:\n  ${names}\n`,
      ),
    );
    ghAnnotate(
      "warning",
      `WebGPU unavailable on this runner — ${harnesses.length} cairn-plot parity ` +
        `harness(es) SKIPPED (not verified): ${names}. ` +
        `Install a Chromium with a working WebGPU adapter (hardware or SwiftShader/Dawn).`,
    );
    // Skip-loudly is not a failure of the code under test — exit 0.
    process.exit(0);
  }

  const { cdp, proc, userDataDir, stderr } = launched;
  console.log(GREEN(`• WebGPU OK via ${strategyUsed}`));
  console.log(`    adapter: ${JSON.stringify(adapter.info)}\n`);
  // See `downgradeIfDeviceLost`: only a SOFTWARE adapter gets the device-loss
  // downgrade. Detected from the adapter info first (CI's "hardware" strategy
  // still lands on SwiftShader), then from the strategy that was forced.
  const softwareAdapter =
    /swiftshader|software|llvmpipe|lavapipe/i.test(JSON.stringify(adapter.info || {})) ||
    /swiftshader|software/i.test(strategyUsed);
  // The device-loss downgrade is OPT-IN per job: a run that has not asked for it
  // reports a lost device as the FAIL it is (see `downgradeIfDeviceLost`).
  const allowSkips = process.env.HARNESS_ALLOW_DEVICE_LOSS_SKIPS === "1";
  if (softwareAdapter && allowSkips) {
    console.log(
      YELLOW(
        "    software adapter + HARNESS_ALLOW_DEVICE_LOSS_SKIPS=1: a FAIL preceded by a genuine\n" +
          "    WebGPU device loss (reason other than \"destroyed\") is reported as a loud SKIP\n" +
          "    (see downgradeIfDeviceLost)\n",
      ),
    );
  } else if (softwareAdapter) {
    console.log(
      YELLOW(
        "    software adapter, but HARNESS_ALLOW_DEVICE_LOSS_SKIPS is not \"1\": a WebGPU device\n" +
          "    loss will be reported as a FAIL. Set it to 1 to allow the loud-SKIP downgrade.\n",
      ),
    );
  }

  // Run harnesses sequentially, grouped by the device scale factor they need.
  // The default group runs on the browser the adapter was probed on; each other
  // group gets its OWN Chromium launched with `--force-device-scale-factor`,
  // because that is the only way a headless Chromium gives the page a truly
  // scaled `devicePixelContentBoxSize` (a CDP metrics override moves
  // `devicePixelRatio` alone and the DPR page silently re-runs the 1x case).
  const ctx = { softwareAdapter, allowSkips };
  const rows = [];
  for (const { dpr, pages } of groupByDpr(harnesses)) {
    if (dpr === null) {
      await runGroup(cdp, baseUrl, pages, ctx, rows);
      continue;
    }
    console.log(
      `• launching Chromium at device scale factor ${dpr} for ${pages.length} page(s)`,
    );
    let scaled;
    try {
      scaled = await launchChrome(chrome, [
        ...strategyFlags,
        `--force-device-scale-factor=${dpr}`,
      ]);
    } catch (err) {
      // The scaled browser is the ONLY thing that can run these pages: report
      // them as errors rather than quietly running them at the wrong ratio.
      console.log(RED(`    launch failed: ${err.message}`));
      for (const h of pages) {
        rows.push({
          id: h.id,
          verdict: "error",
          ms: 0,
          result: `could not launch Chromium at device scale factor ${dpr}: ${err.message}`,
        });
      }
      continue;
    }
    try {
      await runGroup(scaled.cdp, baseUrl, pages, ctx, rows);
    } finally {
      scaled.cdp.close();
      scaled.proc.kill("SIGKILL");
      safeRmDir(scaled.userDataDir);
    }
  }

  // Teardown.
  cdp.close();
  proc.kill("SIGKILL");
  safeRmDir(userDataDir);
  cleanup();
  server.close();
  void stderr;

  // Summary.
  const passed = rows.filter((r) => r.verdict === "pass");
  const failed = rows.filter((r) => r.verdict !== "pass");
  console.log("");
  console.log(BOLD(`Harness summary — ${rows.length} harness(es), strategy: ${strategyUsed}`));
  for (const r of rows) {
    const tag =
      r.verdict === "pass"
        ? GREEN("PASS   ")
        : r.verdict === "fail"
          ? RED("FAIL   ")
          : r.verdict === "timeout"
            ? YELLOW("TIMEOUT")
            : RED("ERROR  ");
    console.log(`  ${tag} ${r.id}`);
  }
  const downgraded = rows.filter((r) => r.deviceLost);
  if (downgraded.length) {
    console.log("");
    console.log(
      YELLOW(
        `  ${downgraded.length} page(s) downgraded to SKIP (device lost on the software adapter)`,
      ),
    );
    for (const r of downgraded) console.log(YELLOW(`    ${r.id}`));
  }
  if (loudSkips.length) {
    console.log("");
    for (const id of loudSkips) console.log(YELLOW(`  SKIP    ${id} (HARNESS_SKIP)`));
    ghAnnotate("warning", `Explicitly skipped harness(es) (HARNESS_SKIP): ${loudSkips.join(", ")}`);
  }
  console.log("");

  if (failed.length === 0) {
    console.log(GREEN(BOLD(`✓ all ${passed.length} parity harness(es) passed`)) + "\n");
    process.exit(0);
  } else {
    for (const r of failed) {
      ghAnnotate("error", `cairn-plot parity harness ${r.verdict.toUpperCase()}: ${r.id}`);
    }
    console.log(
      RED(BOLD(`✗ ${failed.length} of ${rows.length} harness(es) did not pass`)) + "\n",
    );
    process.exit(1);
  }
}

// Run only when invoked as a program. The self-test imports
// `downgradeIfDeviceLost` / `parseHarnessAttributes` from this module to pin the
// rules that decide whether a FAIL may be reported as a PASS; importing must not
// launch a browser.
const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main().catch((err) => die(err.stack || String(err)));
}
