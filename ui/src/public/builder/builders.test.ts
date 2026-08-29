/**
 * PARITY GUARD for the JS builder surface. Runs under Node's built-in runner
 * with type-stripping (no DOM needed — descriptors are built without mounting):
 *
 *   node --experimental-strip-types --test \
 *     src/public/builder/builders.test.ts
 *
 * Three guards:
 *  1. every builder's emitted descriptor validates against the committed
 *     `schema/cairn-plot-spec.schema.json` (ajv-free — a tiny validator below);
 *  2. the builder's allowed string sets (colormaps / tonemaps / compare kernels)
 *     match the cross-language contract `schema/cairn-plot-contracts.json`;
 *  3. the JS builder NAME set mirrors the same contract's `builders` list — the
 *     Python side is pinned to it too (`tests/test_contracts.py`).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { createCairnPlot, BUILDER_NAMES } from "./builders.ts";
import {
  CHART_COLORMAPS,
  IMAGE_COLORMAPS,
  TONEMAP_OPERATORS,
  COMPARE_OPERATION_MODES,
} from "./validate.ts";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../../..");
const schema = JSON.parse(
  readFileSync(resolve(repoRoot, "schema/cairn-plot-spec.schema.json"), "utf8"),
);
const contract = JSON.parse(
  readFileSync(resolve(repoRoot, "schema/cairn-plot-contracts.json"), "utf8"),
);

// ── a tiny JSON-Schema (draft-07 subset) validator ─────────────────────────
// Supports exactly what the committed schema uses: $ref, anyOf, type (string or
// array), const, enum, properties, required, additionalProperties (false | {}),
// items, minItems/maxItems.
function deref(node: any): any {
  if (node && typeof node.$ref === "string") {
    const key = decodeURIComponent(node.$ref.replace("#/definitions/", ""));
    return schema.definitions[key];
  }
  return node;
}

function typeOk(t: string, v: any): boolean {
  switch (t) {
    case "object":
      return v !== null && typeof v === "object" && !Array.isArray(v);
    case "array":
      return Array.isArray(v);
    case "string":
      return typeof v === "string";
    case "number":
      return typeof v === "number";
    case "boolean":
      return typeof v === "boolean";
    case "null":
      return v === null;
    default:
      return false;
  }
}

function validate(schemaNode: any, value: any, path = "$"): string[] {
  const node = deref(schemaNode);
  if (!node) return [`${path}: unresolved schema`];
  if (Array.isArray(node.anyOf)) {
    const errs: string[][] = node.anyOf.map((s: any) => validate(s, value, path));
    if (errs.some((e) => e.length === 0)) return [];
    return [`${path}: matched none of anyOf (${errs.map((e) => e[0]).join(" | ")})`];
  }
  if (node.type) {
    const types = Array.isArray(node.type) ? node.type : [node.type];
    if (!types.some((t: string) => typeOk(t, value))) {
      return [`${path}: expected type ${types.join("|")}, got ${value === null ? "null" : typeof value}`];
    }
  }
  if ("const" in node && value !== node.const) return [`${path}: expected const ${JSON.stringify(node.const)}`];
  if (Array.isArray(node.enum) && !node.enum.includes(value)) {
    return [`${path}: ${JSON.stringify(value)} not in enum ${JSON.stringify(node.enum)}`];
  }
  const errors: string[] = [];
  if (node.properties && value && typeof value === "object" && !Array.isArray(value)) {
    for (const [k, sub] of Object.entries(node.properties)) {
      if (k in value) errors.push(...validate(sub, value[k], `${path}.${k}`));
    }
    for (const req of node.required ?? []) {
      if (!(req in value)) errors.push(`${path}: missing required "${req}"`);
    }
    if (node.additionalProperties === false) {
      for (const k of Object.keys(value)) {
        if (!(k in node.properties)) errors.push(`${path}: additional property "${k}" not allowed`);
      }
    }
  }
  if (node.items && Array.isArray(value)) {
    if (typeof node.minItems === "number" && value.length < node.minItems) errors.push(`${path}: too few items`);
    if (typeof node.maxItems === "number" && value.length > node.maxItems) errors.push(`${path}: too many items`);
    value.forEach((el, i) => errors.push(...validate(node.items, el, `${path}[${i}]`)));
  }
  return errors;
}

// ── sample descriptors, one per emitting builder ───────────────────────────
const cp = createCairnPlot();

const f32 = new Float32Array([0, 0.5, 1, 2, 0.25, 4]);

function samples(): Record<string, any> {
  return {
    line: cp.line([1, 2, 3, 4]),
    "line (named)": cp.line({ a: [1, 2, 3], b: [3, 2, 1] }, [0, 1, 2]),
    scatter: cp.scatter([1, 2, 3], [4, 5, 6], { color: [1, 2, 3], colormap: "plasma", xLabel: "x" }),
    bar: cp.bar([3, 1, 2], { labels: ["a", "b", "c"], valueLabel: "n" }),
    histogram: cp.histogram([1, 2, 2, 3, 3, 3], { bins: 4 }),
    "histogram (precomputed)": cp.histogram(undefined, { counts: [1, 2], edges: [0, 1, 2] }),
    heatmap: cp.heatmap([[1, 2], [3, 4]], { colormap: "magma", zmin: 0, zmax: 4 }),
    parallelCoordinates: cp.parallelCoordinates({ a: [1, 2], b: ["x", "y"] }),
    "image (hdr)": cp.image(f32, { shape: [2, 3], tonemap: "aces", exposure: 1 }),
    "image (url)": cp.image({ url: "https://example.com/a.png" }),
    table: cp.table([{ a: 1, b: "x" }, { a: 2, b: "y" }]),
    "compare (abs)": cp.compare(cp.image(f32, { shape: [2, 3] }), cp.image(f32, { shape: [2, 3] }), { mode: "abs" }),
    "compare (split)": cp.compare(cp.image({ url: "a.png" }), cp.image({ url: "b.png" }), { mode: "split" }),
    "compare (FLIP SDR)": cp.compare(cp.image({ url: "a.png" }), cp.image({ url: "b.png" }), {
      mode: "flip", flipMode: "sdr", flipMaxExposures: 7,
    }),
    grid: cp.grid([[cp.line([1, 2, 3]), cp.bar([1, 2])]], { gap: 8 }),
  };
}

test("every builder emits a schema-conformant descriptor", () => {
  for (const [name, handle] of Object.entries(samples())) {
    const errs = validate(schema, handle.spec);
    assert.equal(errs.length, 0, `${name}: ${errs.join("; ")}\n${JSON.stringify(handle.spec)}`);
  }
});

test("grid switching is enabled by omission and can be explicitly disabled", () => {
  const child = cp.line([1, 2]);
  const normal = cp.grid([child, child]).spec.root;
  const fixed = cp.grid([child, child], { switchable: false }).spec.root;
  assert.equal(normal.kind, "grid");
  assert.equal(fixed.kind, "grid");
  if (normal.kind !== "grid" || fixed.kind !== "grid") return;
  assert.equal(normal.switchable, undefined);
  assert.equal(fixed.switchable, false);
});

test("builder rejects non-JSON values at the durable descriptor boundary", () => {
  assert.throws(
    () => cp.table([{ value: 1n }]),
    /not JSON-serializable/,
  );
  const cyclic: unknown[] = [];
  cyclic.push(cyclic);
  assert.throws(
    () => cp.table([{ value: cyclic }]),
    /contains a cycle/,
  );
});

test("builder colormap/tonemap/kernel sets match the contract", () => {
  const sorted = (xs: readonly string[]) => [...xs].sort();
  assert.deepEqual(sorted(CHART_COLORMAPS), sorted(contract.colormaps));
  assert.deepEqual(sorted(IMAGE_COLORMAPS), sorted(contract.colormaps));
  assert.deepEqual(sorted(TONEMAP_OPERATORS), sorted(contract.tonemapOperators));
  assert.deepEqual(sorted(Object.keys(COMPARE_OPERATION_MODES)), sorted(contract.comparisonOperationPublicNames));
});

test("JS builder names mirror the contract's shared builder list", () => {
  const sorted = (xs: readonly string[]) => [...xs].sort();
  // The namespace exposes exactly the builders (+ the manual `registerRuntime`
  // helper, excluded from the shared name set).
  const nsNames = Object.keys(cp).filter((k) => k !== "registerRuntime");
  assert.deepEqual(sorted(nsNames), sorted(contract.builders));
  assert.deepEqual(sorted(BUILDER_NAMES), sorted(contract.builders));
});

test("3D builders throw naming the three.js addon when it isn't loaded", () => {
  for (const name of ["mesh", "pointcloud", "volume", "boxes"] as const) {
    assert.throws(() => (cp as any)[name]({}), /three\.iife\.js/);
  }
});

// ── host seam: `toolbar` passthrough (mirrors Python cp.Image/cp.Compare) ────
test("image/compare emit props.toolbar=false only when explicitly disabled", () => {
  const f32 = new Float32Array([0, 0.25, 0.5, 0.75, 1, 0.5]);
  // SDR image
  const sdr = cp.image(f32, { shape: [2, 3], toolbar: false });
  assert.equal((sdr.node as any).props.toolbar, false);
  // HDR image (offset is authored cell state)
  const hdr = cp.image(f32, { shape: [2, 3], tonemap: "aces", toolbar: false, offset: 0.2 });
  assert.equal((hdr.node as any).props.toolbar, false);
  assert.equal((hdr.node as any).settings["image.offset"], 0.2);
  // compare
  const cmp = cp.compare(cp.image(f32, { shape: [2, 3] }), cp.image(f32, { shape: [2, 3] }), {
    mode: "split",
    toolbar: false,
  });
  assert.equal((cmp.node as any).props.toolbar, false);

  // Default (unset / true) emits NOTHING — the client shows the toolbar.
  const dflt = cp.image(f32, { shape: [2, 3] });
  assert.equal((dflt.node as any).props?.toolbar, undefined);
  const dfltTrue = cp.image(f32, { shape: [2, 3], toolbar: true });
  assert.equal((dfltTrue.node as any).props?.toolbar, undefined);
});

// ── FIX 1: exposure/offset lifted TOP-LEVEL on the non-float (URL) path ──────
test("URL image emits exposure/offset as settings, not CSS processing props", () => {
  // FLOAT URL (.exr): the client decodes it to a FLOAT source, which discards
  // `processing` — exposure/offset MUST ride top-level or they are silently
  // dropped (~2× too bright). tonemap/gamma/peak already survived; this is the gap.
  const exr = cp.image({ url: "render.exr" }, { exposure: -1, offset: 0.1, tonemap: "aces" });
  const p = (exr.node as any).props;
  const settings = (exr.node as any).settings;
  assert.equal(settings["image.exposureEV"], -1);
  assert.equal(settings["image.offset"], 0.1);
  assert.equal(settings["image.encoding"], "aces");
  // and NEVER also in the CSS-filter `processing` block (would double-apply).
  assert.equal(p?.processing?.exposure, undefined);
  assert.equal(p?.processing?.offset, undefined);
  // a float URL routes to the fetch+decode seam (not a verbatim <img>).
  assert.equal((exr.node as any).data.kind, "image");

  // UINT8 URL (.png) + exposure: still applied, now top-level/in-shader — applied
  // ONCE (not dropped, not doubled by ALSO living in `processing`).
  const png = cp.image({ url: "photo.png" }, { exposure: -1 });
  const pp = (png.node as any).props;
  assert.equal((png.node as any).settings["image.exposureEV"], -1);
  assert.equal(pp?.processing, undefined);
  // a known browser-native ext keeps the verbatim <img> fast path.
  assert.equal((png.node as any).data.kind, "url");

  // Sanity: with NO exposure/offset the keys are absent (renderer defaults hold).
  const plain = cp.image({ url: "render.exr" }, { tonemap: "aces" });
  assert.equal((plain.node as any).settings["image.exposureEV"], undefined);
  assert.equal((plain.node as any).settings["image.offset"], undefined);
});

// ── FIX 2: URL decode routing matches Python (unknown/ext-less → decode seam) ─
test("URL routing: known browser-native ext → verbatim <img>; raw-buffer/unknown → decode seam", () => {
  // Known browser-native ext → verbatim <img> fast path (no fetch, byte-exact).
  assert.equal((cp.image({ url: "a.png" }).node as any).data.kind, "url");
  assert.equal((cp.image({ url: "b.jpg" }).node as any).data.kind, "url");
  assert.equal((cp.image({ url: "c.webp" }).node as any).data.kind, "url");
  // Known raw-buffer ext → client fetch+decode seam.
  assert.equal((cp.image({ url: "r.exr" }).node as any).data.kind, "image");
  assert.equal((cp.image({ url: "r.npy" }).node as any).data.kind, "image");
  // Unknown / extensionless / blob URL → decode seam too (content decides), NOT a
  // verbatim <img> that would choke on EXR bytes — mirrors Python's decode-any-URL.
  for (const u of ["https://x/no-ext", "blob:https://x/abcd-1234", "https://x/img?id=5"]) {
    const d = (cp.image({ url: u }).node as any).data;
    assert.equal(d.kind, "image", `${u} must route to the decode seam`);
    assert.equal(d.url, u);
  }
});
