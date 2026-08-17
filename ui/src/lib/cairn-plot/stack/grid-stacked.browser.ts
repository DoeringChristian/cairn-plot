/**
 * STACKED GRID — a `cp.Grid(mode="stacked")` shows ONE child at a time with a
 * keyboard-driven tab strip, plus a live normal⇄stacked toggle on the grid.
 * Verifies: the toggle exists (the reported "no such button"); stacked shows one
 * pane + N tabs; arrows / hjkl / number / letter switch the active tab; clicking
 * the toggle flips modes; a single-child grid has no toggle. CPU float panes —
 * no WebGPU needed.
 */
import { createRoot, type Root } from "react-dom/client";
import { createElement } from "react";
import { PlotApp } from "../../../plot-bootstrap";
import { registerCoreRenderers } from "../../../plot-renderers";
import type { PlotDescriptor } from "../../../plot-descriptor";

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
  document.title = pass ? "GRID-STACKED PASS" : "GRID-STACKED FAIL";
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function waitFor(pred: () => boolean, timeoutMs = 5000, step = 20): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (pred()) return true;
    await sleep(step);
  }
  return pred();
}

function floatLeaf(w: number, h: number, label: string): unknown {
  const data = new Float32Array(h * w * 3);
  for (let i = 0; i < data.length; i++) data[i] = ((i % 97) / 97) * 0.8;
  return {
    kind: "plot",
    renderer: "image",
    data: { kind: "inline", props: { source: { dtype: "float", data, shape: [h, w, 3], precision: "f32" } } },
    props: { toolbar: true, label },
  };
}
function stackedGrid(labels: string[], mode: "normal" | "stacked"): PlotDescriptor {
  return {
    mode: "local",
    root: { kind: "grid", cols: labels.length, gap: 8, mode, children: labels.map((l) => floatLeaf(96, 96, l)) },
  } as unknown as PlotDescriptor;
}

function host(id: string): HTMLElement {
  const el = document.getElementById(id)!;
  el.style.cssText = "width:640px;background:#222";
  return el;
}
const q = (id: string, sel: string) => document.getElementById(id)!.querySelector<HTMLElement>(sel);
const qa = (id: string, sel: string) => Array.from(document.getElementById(id)!.querySelectorAll<HTMLElement>(sel));
// Stacked mode renders ONE reused pane; the active tab index lives on the
// stacked-view container (`data-cairn-stack-active`), not per-child panes.
const activePaneIndex = (id: string): number => {
  const el = q(id, "[data-cairn-stack-active]");
  const v = el?.getAttribute("data-cairn-stack-active");
  return v == null ? -1 : parseInt(v, 10);
};
const key = (k: string, extra: KeyboardEventInit = {}) =>
  window.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...extra }));

async function run(): Promise<boolean> {
  let ok = true;
  registerCoreRenderers();
  (window as unknown as { __cairnPlotRenderMode?: string }).__cairnPlotRenderMode = "cpu";
  (window as unknown as { __cairnPlotEagerMount?: boolean }).__cairnPlotEagerMount = true;
  const roots: Root[] = [];

  // ── A stacked grid of 3 labelled panes ────────────────────────────────────
  const rootA = createRoot(host("m1"));
  rootA.render(createElement(PlotApp, { descriptor: stackedGrid(["Alpha", "Bravo", "Charlie"], "stacked") }));
  roots.push(rootA);

  const up = await waitFor(() => qa("m1", "[data-cairn-stack-tab]").length >= 1 || qa("m1", "[role='tab']").length >= 3);
  const tabs = qa("m1", "[role='tab']");
  report(tabs.length === 3, `stacked grid renders a tab strip with 3 tabs (got ${tabs.length})`);
  report(!!q("m1", "[data-cairn-grid-header]"), "grid header (holds tabs + toggle, above the viewports) present");
  report(!!q("m1", "[data-cairn-stacked-view]"), "stacked panes container present");
  // Single-renderer model: exactly ONE pane is rendered (the active source), not
  // three hidden ones — flipping swaps the source on this reused instance.
  const oneVisible =
    qa("m1", "[data-cairn-stacked-pane]").length === 1 &&
    qa("m1", '[data-cairn-stacked-pane="active"]').length === 1;
  report(oneVisible, "exactly ONE pane rendered (single reused renderer, not N hidden panes)");
  report(activePaneIndex("m1") === 0, `tab 0 active initially (got ${activePaneIndex("m1")})`);
  ok = ok && up && tabs.length === 3 && oneVisible && activePaneIndex("m1") === 0;

  // hover the stack so keys are in scope, then navigate.
  q("m1", "[data-cairn-grid-root]")!.dispatchEvent(new PointerEvent("pointerenter", { bubbles: false }));

  key("ArrowRight");
  report(await waitFor(() => activePaneIndex("m1") === 1), `→ moves to tab 1 (got ${activePaneIndex("m1")})`);
  key("l"); // vim next
  report(await waitFor(() => activePaneIndex("m1") === 2), `l (vim) → tab 2 (got ${activePaneIndex("m1")})`);
  key("l"); // wrap
  report(await waitFor(() => activePaneIndex("m1") === 0), `l wraps 2→0 (got ${activePaneIndex("m1")})`);
  key("h"); // vim prev wraps
  report(await waitFor(() => activePaneIndex("m1") === 2), `h (vim) wraps 0→2 (got ${activePaneIndex("m1")})`);
  key("1"); // number jump
  report(await waitFor(() => activePaneIndex("m1") === 0), `number 1 → tab 0 (got ${activePaneIndex("m1")})`);
  key("c"); // letter jump
  report(await waitFor(() => activePaneIndex("m1") === 2), `letter c → tab 2 (got ${activePaneIndex("m1")})`);
  ok =
    ok &&
    activePaneIndex("m1") === 2;

  // ── The live toggle: a NORMAL grid has the button; click → stacked ────────
  const rootB = createRoot(host("m2"));
  rootB.render(createElement(PlotApp, { descriptor: stackedGrid(["one", "two", "three"], "normal") }));
  roots.push(rootB);
  const toggleUp = await waitFor(() => !!q("m2", "[data-cairn-grid-mode-toggle]"));
  report(toggleUp, "NORMAL grid shows the normal|stacked toggle button (the missing button)");
  const startsNormal = await waitFor(() => qa("m2", "[role='tab']").length === 0);
  report(startsNormal, "normal grid shows NO tab strip");
  const stackedBtn = q("m2", '[data-cairn-grid-mode="stacked"]');
  report(!!stackedBtn, "toggle has a 'stacked' button");
  stackedBtn?.click();
  const flipped = await waitFor(() => qa("m2", "[role='tab']").length === 3);
  report(flipped, "clicking the toggle switches the grid to stacked (tab strip appears)");
  ok = ok && toggleUp && startsNormal && !!stackedBtn && flipped;

  // ── Single-child grid: no toggle (stacking a lone child is a no-op) ───────
  const rootC = createRoot(host("m3"));
  rootC.render(createElement(PlotApp, { descriptor: stackedGrid(["solo"], "normal") }));
  roots.push(rootC);
  await sleep(150);
  const noToggle = !q("m3", "[data-cairn-grid-mode-toggle]");
  report(noToggle, "single-child grid has NO mode toggle");
  ok = ok && noToggle;

  roots.forEach((r) => r.unmount());
  return ok;
}

run()
  .then((ok) => setOverallStatus(ok))
  .catch((err) => {
    report(false, `threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    setOverallStatus(false);
  });
