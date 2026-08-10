#!/usr/bin/env node
// @ts-check
/**
 * Inline a demo HTML page into ONE self-contained file for GitHub Pages.
 *
 * The hand-authored JS demos under `examples/` load the offline bundles by
 * relative path (e.g. `../ui/dist/plot-inline/core.iife.js`) so a contributor
 * can build once and open the file straight from disk. The gallery, though,
 * publishes each page as a SINGLE self-contained HTML file (no sibling assets,
 * no network) — the same contract the Python emit satisfies by inlining the
 * bundles it needs.
 *
 * This script bridges the two: it reads a demo HTML file, replaces every LOCAL
 *   <link rel="stylesheet" href="…">   →  <style>…</style>
 *   <script src="…"></script>          →  <script>…</script>
 * whose `href`/`src` resolves to a file on disk (relative to the HTML file)
 * with that file's contents inlined, and writes the result. Remote URLs
 * (`http(s):`, `//…`, `data:`) are left untouched.
 *
 * Usage:  node scripts/inline-html.mjs <input.html> <output.html>
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve, isAbsolute } from "node:path";

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) {
  console.error("usage: node scripts/inline-html.mjs <input.html> <output.html>");
  process.exit(2);
}

const inAbs = resolve(process.cwd(), inPath);
if (!existsSync(inAbs)) {
  console.error(`inline-html: input not found: ${inAbs}`);
  process.exit(1);
}
const baseDir = dirname(inAbs);
let html = readFileSync(inAbs, "utf-8");

/** Is this href/src a LOCAL path we should inline (not a remote/data URL)? */
function isLocalRef(ref) {
  return (
    !!ref &&
    !/^[a-z]+:/i.test(ref) && // http:, https:, data:, file: …
    !ref.startsWith("//") // protocol-relative
  );
}

/** Resolve a local ref against the HTML file's directory; null if missing. */
function resolveLocal(ref) {
  const clean = ref.split(/[?#]/, 1)[0];
  const abs = isAbsolute(clean) ? clean : resolve(baseDir, clean);
  return existsSync(abs) ? abs : null;
}

/** Guard raw JS/CSS embedded in an inline element against a premature
 *  `</script>`/`</style>` close (mirrors the Python emit's `js_inline_safe`). */
function guard(text, tag) {
  return text.replace(new RegExp(`</(${tag})`, "gi"), "<\\/$1");
}

let inlinedCss = 0;
let inlinedJs = 0;
const skipped = [];

// ── <link rel="stylesheet" href="…"> → <style>… ─────────────────────────────
html = html.replace(/<link\b[^>]*>/gi, (tag) => {
  if (!/\brel\s*=\s*["']?stylesheet\b/i.test(tag)) return tag;
  const m = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i);
  const ref = m && m[1];
  if (!isLocalRef(ref)) return tag;
  const abs = resolveLocal(ref);
  if (!abs) {
    skipped.push(ref);
    return tag;
  }
  inlinedCss++;
  return `<style>\n${guard(readFileSync(abs, "utf-8"), "style")}\n</style>`;
});

// ── <script src="…"></script> → <script>… ───────────────────────────────────
html = html.replace(/<script\b([^>]*)\bsrc\s*=\s*["']([^"']+)["']([^>]*)>\s*<\/script>/gi, (tag, pre, ref, post) => {
  if (!isLocalRef(ref)) return tag;
  const abs = resolveLocal(ref);
  if (!abs) {
    skipped.push(ref);
    return tag;
  }
  // Preserve any non-src attributes (e.g. type="module") from either side.
  const attrs = (pre + post).replace(/\s+/g, " ").trim();
  const open = attrs ? `<script ${attrs}>` : "<script>";
  inlinedJs++;
  return `${open}\n${guard(readFileSync(abs, "utf-8"), "script")}\n</script>`;
});

if (skipped.length) {
  console.error(`inline-html: could not resolve ${skipped.length} local ref(s):`);
  for (const s of skipped) console.error(`  - ${s}`);
  process.exit(1);
}

const outAbs = resolve(process.cwd(), outPath);
mkdirSync(dirname(outAbs), { recursive: true });
writeFileSync(outAbs, html);
const kb = Math.round(Buffer.byteLength(html) / 1024);
console.log(`inline-html: ${inPath} → ${outPath}  (${inlinedCss} css + ${inlinedJs} js inlined, ${kb} KB)`);
