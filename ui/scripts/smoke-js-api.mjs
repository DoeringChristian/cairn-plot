#!/usr/bin/env node
// @ts-check
/**
 * Headless smoke gate for the JS builder surface (`window.cairnPlot`).
 *
 * The companion to `smoke-plot-gallery.mjs` (which drives the PYTHON emit): this
 * one renders `examples/demo_js_api.html` — a page authored ENTIRELY in
 * JavaScript via `cairnPlot.*` against the committed offline bundles — in a real
 * headless Chromium and asserts every `cairnPlot.<builder>().mount(...)` pane
 * painted REAL content (an SVG chart, a `<canvas>`/`<img>` image, a compare
 * pane), not an empty div or an error placeholder. So the JS face can't silently
 * break even though no Python test exercises it.
 *
 * Dependency-free: plain Node + a headless Chromium `--dump-dom` + regex parsing.
 *
 * Usage:  node scripts/smoke-js-api.mjs   (or: npm run smoke:js)
 * Env:    CHROME_BIN   path to a Chromium-family browser (else auto-detected)
 *         KEEP_DUMP=1  keep the dumped DOM at $TMPDIR/cairn-js-smoke-dump.html
 */

import { spawnSync } from "node:child_process";
import { existsSync, accessSync, constants, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve, join } from "node:path";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
// scripts/ -> ui/scripts ; repo root is two levels up.
const REPO_ROOT = resolve(__dirname, "..", "..");
const DEMO_HTML = join(REPO_ROOT, "examples", "demo_js_api.html");
const DUMP_HTML = join(tmpdir(), "cairn-js-smoke-dump.html");

// Same short virtual-time budget rationale as the gallery smoke: long enough for
// every pane's first paint (incl. the async gpu-image addon + compare), short
// enough that a first-paint regression can't hide behind a long fast-forward.
const VIRTUAL_TIME_BUDGET_MS = Number(process.env.SMOKE_VT_BUDGET_MS) || 800;

const RED = (s) => `\x1b[31m${s}\x1b[0m`;
const GREEN = (s) => `\x1b[32m${s}\x1b[0m`;
const BOLD = (s) => `\x1b[1m${s}\x1b[0m`;

function die(msg) {
  console.error(RED(`\nsmoke:js FAILED — ${msg}\n`));
  process.exit(1);
}

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
    die(`CHROME_BIN is set to "${process.env.CHROME_BIN}" but it is not executable.`);
  }
  const candidates = [];
  if (process.platform === "darwin") {
    candidates.push(
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    );
  }
  for (const c of candidates) if (isExecutable(c)) return c;
  for (const name of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "brave-browser"]) {
    const w = spawnSync("command", ["-v", name], { shell: true, encoding: "utf-8" });
    const p = (w.stdout || "").trim().split("\n")[0];
    if (p && isExecutable(p)) return p;
  }
  die("no Chromium-family browser found. Set CHROME_BIN=/path/to/chrome, or install Google Chrome / Chromium.");
}

function dumpDom(chrome) {
  if (!existsSync(DEMO_HTML)) die(`demo missing: ${DEMO_HTML}`);
  // `?eager=1` forces every LazyGate to mount up front (same escape hatch the
  // gallery smoke uses) so below-fold panes render inside the short budget.
  const url = pathToFileURL(DEMO_HTML).href + "?eager=1";
  const args = [
    "--headless=new",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--enable-unsafe-swiftshader",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    `--virtual-time-budget=${VIRTUAL_TIME_BUDGET_MS}`,
    "--dump-dom",
    url,
  ];
  console.log(`• rendering ${DEMO_HTML} headlessly via ${chrome}`);
  const r = spawnSync(chrome, args, {
    encoding: "utf-8",
    maxBuffer: 512 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (r.error) die(`could not launch Chrome: ${r.error.message}`);
  const dom = r.stdout || "";
  if (dom.length < 1000) die(`Chrome --dump-dom produced almost no output (${dom.length} bytes).\n${r.stderr}`);
  if (process.env.KEEP_DUMP) {
    writeFileSync(DUMP_HTML, dom);
    console.log(`  (kept settled DOM at ${DUMP_HTML})`);
  }
  return dom;
}

// Strip <script>/<style> so we only assert against RENDERED DOM, never bundle
// source (which contains literal "<svg>"/"could not render" as text).
function stripCode(dom) {
  return dom
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
}

/** The pane container for `#id` and everything inside it, from the cleaned DOM. */
function paneHtml(clean, id) {
  const re = new RegExp(`<div\\b[^>]*\\bid=["']${id}["'][^>]*>([\\s\\S]*?)</section>`, "i");
  const m = clean.match(re);
  return m ? m[1] : null;
}

function svgDescendants(html) {
  let max = 0;
  for (const m of html.matchAll(/<svg\b[\s\S]*?<\/svg>/gi)) {
    const opens = (m[0].match(/<[a-zA-Z]/g) || []).length - 1;
    if (opens > max) max = opens;
  }
  return max;
}

const PANES = [
  { id: "p-line", label: "line", kind: "svg" },
  { id: "p-scatter", label: "scatter", kind: "svg" },
  { id: "p-image", label: "image (HDR f32)", kind: "canvas" },
  { id: "p-compare", label: "compare (abs)", kind: "canvas" },
  { id: "p-grid", label: "grid", kind: "svg" },
];

function analyze(dom) {
  const clean = stripCode(dom);
  const globalErrors = [];
  if (/could not render/i.test(clean)) globalErrors.push('renderer placeholder: "could not render"');
  if (/Plot error:/i.test(clean)) globalErrors.push('"Plot error:" surfaced');
  if (/BundleUnavailable/.test(clean)) globalErrors.push("BundleUnavailable");

  const rows = [];
  for (const p of PANES) {
    const html = paneHtml(clean, p.id);
    if (html == null) {
      rows.push({ ...p, pass: false, reason: "container not found in DOM" });
      continue;
    }
    const svg = svgDescendants(html);
    const hasCanvas = /<canvas[\s>]/i.test(html);
    const hasImg = /<img\b[^>]*\bsrc\s*=\s*["'](?!data:,|["'])/i.test(html);
    const hasSvg = svg >= 8;
    // A pane passes on ANY real body; the `kind` is the primary expectation but
    // an image pane may render as <canvas> OR <img> depending on the backend.
    const content = hasSvg || hasCanvas || hasImg;
    const localErr = /(could not render|Plot error:)/i.test(html);
    rows.push({
      ...p,
      pass: content && !localErr,
      reason: !content
        ? `no content (svg=${svg}, canvas=${hasCanvas}, img=${hasImg})`
        : localErr
          ? "error placeholder in pane"
          : "",
      detail: [hasSvg ? `svg(${svg})` : null, hasCanvas ? "canvas" : null, hasImg ? "img" : null]
        .filter(Boolean)
        .join(","),
    });
  }
  return { rows, globalErrors };
}

function report({ rows, globalErrors }) {
  console.log("\n" + BOLD(`JS API smoke — ${rows.length} panes`) + "\n");
  const w = Math.max(...rows.map((r) => r.label.length));
  let failed = 0;
  for (const r of rows) {
    const tag = r.pass ? GREEN("PASS") : RED("FAIL");
    let line = `  ${tag}  ${r.label.padEnd(w)}  [${r.detail || "—"}]`;
    if (!r.pass) line += "  " + RED("← " + r.reason);
    console.log(line);
    if (!r.pass) failed++;
  }
  console.log("");
  for (const e of globalErrors) console.log("  " + RED(`GLOBAL FAIL: ${e}`));
  const ok = failed === 0 && globalErrors.length === 0;
  if (ok) {
    console.log("\n" + GREEN(BOLD(`✓ all ${rows.length} cairnPlot.* panes render real content`)) + "\n");
    process.exit(0);
  }
  console.log(
    "\n" + RED(BOLD(`✗ ${failed} pane(s) failed${globalErrors.length ? ` + ${globalErrors.length} global error(s)` : ""}`)) + "\n",
  );
  process.exit(1);
}

const chrome = findChrome();
report(analyze(dumpDom(chrome)));
