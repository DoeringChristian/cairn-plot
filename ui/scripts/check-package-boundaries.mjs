#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const packages = join(repo, "packages");
const sourceExt = new Set([".ts", ".tsx", ".js", ".mjs"]);
const importRe = /(?:import|export)\s+(?:type\s+)?(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g;

const allowed = {
  spec: new Set(["spec"]),
  runtime: new Set(["runtime", "spec"]),
  "render-core": new Set(["render-core", "runtime", "spec"]),
  "render-gpu": new Set(["render-gpu", "runtime", "spec"]),
  "render-three": new Set(["render-three", "runtime", "spec"]),
  react: new Set(["react", "runtime", "spec", "render-core"]),
};

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function packageOf(path) {
  const rel = relative(packages, path);
  return rel.startsWith("..") ? null : rel.split("/")[0];
}

function resolveImport(file, specifier) {
  if (!specifier.startsWith(".")) return null;
  const base = resolve(dirname(file), specifier);
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return base;
}

const violations = [];
for (const [owner, dependencies] of Object.entries(allowed)) {
  for (const file of walk(join(packages, owner, "src"))) {
    if (!sourceExt.has(extname(file)) || file.endsWith(".test.ts")) continue;
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(importRe)) {
      const target = resolveImport(file, match[1]);
      if (!target) continue;
      const dependency = packageOf(target);
      if (dependency && dependencies.has(dependency)) continue;
      violations.push(`${relative(repo, file)} imports ${relative(repo, target)}`);
    }
  }
}

if (violations.length) {
  console.error("Package boundary violations:\n" + violations.map((v) => `  ${v}`).join("\n"));
  process.exit(1);
}
console.log("check:package-boundaries OK — dependency direction is acyclic.");
