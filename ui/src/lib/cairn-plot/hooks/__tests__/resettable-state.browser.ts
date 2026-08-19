/**
 * `resettable-state.browser.ts` — contract harness for `useResettableState`,
 * the hook GpuImagePane's colormap + peak state were migrated onto (dedup wave;
 * they had hand-rolled the exact seed-ref / reset / isModified triple). Not a
 * jsdom unit test — the hook needs a real React render loop to drive state
 * transitions, and no test-renderer is installed (same convention as the other
 * `*.browser.ts` harnesses).
 *
 * ## What it pins (the HOME semantics the migration must keep)
 *  1. isModified starts false at the mount-captured seed.
 *  2. Setting a different value flips isModified true; setting back to the seed
 *     value flips it false again (Object.is equality).
 *  3. reset() restores the seed value and clears isModified.
 *  4. Seed is captured ONCE: changing the seed prop after mount does NOT move
 *     the reset target (reset still returns the ORIGINAL seed) — the load-
 *     bearing detail the docstring calls out, mirroring the old defaultRef.
 *
 * RUNNING:
 *   1. Bundle: cd cairn/ui && npx esbuild \
 *        src/lib/cairn-plot/hooks/__tests__/resettable-state.browser.ts \
 *        --bundle --format=esm --tsconfig=tsconfig.app.json \
 *        --outfile=src/lib/cairn-plot/hooks/__tests__/resettable-state.browser.bundle.js
 *   2. Serve: cd cairn/ui/src/lib/cairn-plot/hooks/__tests__ && python3 -m http.server 8944
 *   3. Open http://localhost:8944/resettable-state.browser.html in Chrome.
 * The generated `.bundle.js` is gitignored — regenerate when this harness or its
 * imports change.
 */
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { useResettableState, type ResettableMeta } from "../use-resettable-state";

const h = React.createElement;

function report(pass: boolean, message: string): void {
  const line = `${pass ? "PASS" : "FAIL"}: ${message}`;
  // eslint-disable-next-line no-console
  console[pass ? "log" : "error"](line);
  const el = document.getElementById("result");
  if (el) {
    const p = document.createElement("div");
    p.textContent = line;
    p.style.color = pass ? "green" : "red";
    el.appendChild(p);
  }
}
function setOverallStatus(pass: boolean): void {
  const el = document.getElementById("status");
  if (el) {
    el.textContent = pass ? "PASS" : "FAIL";
    el.style.color = pass ? "green" : "red";
  }
  document.title = pass ? "RESETTABLE PASS" : "RESETTABLE FAIL";
  (window as unknown as { __resettableResult?: string }).__resettableResult = pass ? "pass" : "fail";
}

interface Probe {
  value: string;
  set(v: string): void;
  meta: ResettableMeta<string>;
}
let probe: Probe | null = null;
let setSeedProp: ((s: string) => void) | null = null;

/** A component whose SEED comes from a state prop we can change post-mount, to
 *  prove the seed is captured once. */
function Harness() {
  const [seed, setSeed] = useState("turbo");
  setSeedProp = setSeed;
  const [value, set, meta] = useResettableState<string>(seed);
  probe = { value, set, meta };
  return h("span", null, `${value}/${meta.isModified}`);
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  let ok = true;
  const gate = (cond: boolean, msg: string) => { report(cond, msg); ok = ok && cond; };
  try {
    createRoot(document.getElementById("root") as HTMLElement).render(h(Harness));
    await wait(40);

    gate(probe!.value === "turbo" && probe!.meta.isModified === false,
      "[1] seed 'turbo', isModified=false at mount");
    gate(probe!.meta.default === "turbo", "[1] meta.default is the seed");

    // (2) set a different value → modified
    probe!.set("magma");
    await wait(40);
    gate(probe!.value === "magma" && probe!.meta.isModified === true,
      "[2] set('magma') → value magma, isModified=true");

    // set back to seed value → not modified (Object.is)
    probe!.set("turbo");
    await wait(40);
    gate(probe!.value === "turbo" && probe!.meta.isModified === false,
      "[2] set back to seed clears isModified");

    // (3) reset restores seed + clears modified
    probe!.set("turbo");
    await wait(40);
    gate(probe!.meta.isModified === true, "[3] set('turbo') → modified");
    probe!.meta.reset();
    await wait(40);
    gate(probe!.value === "turbo" && probe!.meta.isModified === false,
      "[3] reset() restores seed + clears isModified");

    // (4) seed captured ONCE — a later seed-prop change moves NEITHER the live
    // value NOR the reset target (the hook ignores it; the pane re-seeds via its
    // own effect, deliberately outside the hook). value is still "turbo".
    setSeedProp!("plasma");
    await wait(40);
    gate(probe!.value === "turbo" && probe!.meta.default === "turbo",
      "[4] later seed-prop change moves neither value nor reset target");
    probe!.set("cividis");
    await wait(40);
    probe!.meta.reset();
    await wait(40);
    gate(probe!.value === "turbo" && probe!.meta.default === "turbo",
      "[4] reset still returns the ORIGINAL mount seed (target captured once)");

    setOverallStatus(ok);
  } catch (err) {
    report(false, `threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    setOverallStatus(false);
  }
}

void main();
