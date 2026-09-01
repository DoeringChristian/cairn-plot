/**
 * `plot-legend-interaction.browser.ts` — contract harness for the unified
 * interactive legend (dedup wave: `PlotLegend` base + `scalar-legend` thin
 * wrapper). Not a jsdom unit test — it drives real React state through the real
 * `useSeriesVisibility` hook in a live browser (same convention as the
 * toolbar / media-compare `*.browser.ts` harnesses). No Tailwind needed: this
 * pins INTERACTION (click→toggle, dblclick→isolate) + derived ARIA/opacity, not
 * layout.
 *
 * ## What it pins (behaviour that MUST survive the PlotLegend/scalar unify)
 *  1. PlotLegend: single-click a chip TOGGLES that series (aria-pressed flips,
 *     label gets line-through, opacity → 0.35); clicking again restores it.
 *  2. PlotLegend: double-click ISOLATES (all others hidden, clicked one shown);
 *     double-click the isolated one again un-isolates (all visible).
 *  3. scalar-legend wrapper (visibility mode): same toggle/isolate semantics,
 *     PLUS a promote button per chip that fires `onToggle` (never toggles
 *     visibility), the selection-dim (non-selected chips at 0.35 while a run is
 *     selected), and the selected chip's taller swatch.
 *  4. scalar-legend legacy mode (no `visibility`): a chip click SELECTS (fires
 *     `onSelect`), no toggle/isolate.
 *
 * RUNNING:
 *   1. Bundle: cd cairn/ui && npx esbuild \
 *        src/primitives/components/__tests__/plot-legend-interaction.browser.ts \
 *        --bundle --format=esm --tsconfig=tsconfig.app.json \
 *        --outfile=src/primitives/components/__tests__/plot-legend-interaction.browser.bundle.js
 *   2. Serve: cd cairn/ui/src/primitives/components/__tests__ && python3 -m http.server 8942
 *   3. Open http://localhost:8942/plot-legend-interaction.browser.html in Chrome.
 * The generated `.bundle.js` is gitignored — regenerate when this harness or its
 * imports change.
 */
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import PlotLegend, { type LegendItem } from "../PlotLegend";
import { CustomLegend } from "../../../plots/scalar/backends/svg/support/scalar-legend";
import { useSeriesVisibility } from "../../../host/hooks/use-series-visibility";
import { createHarness } from "../../../testing/harness";

const h = React.createElement;

const ITEMS: LegendItem[] = [
  { key: "a", label: "Alpha", color: "#e00" },
  { key: "b", label: "Beta", color: "#0e0" },
  { key: "c", label: "Gamma", color: "#00e" },
];

const { report, setOverallStatus } = createHarness({ title: "LEGEND", resultFlag: "__legendResult" });

/** A base PlotLegend wired to the REAL visibility hook. */
function PlainHarness() {
  const vis = useSeriesVisibility(ITEMS.map((i) => i.key));
  return h(PlotLegend, { items: ITEMS, visibility: vis });
}

/** The scalar wrapper in visibility mode, with a live selection. */
function ScalarHarness() {
  const vis = useSeriesVisibility(ITEMS.map((i) => i.key));
  const [selected] = useState<Set<string>>(() => new Set(["a"]));
  return h(CustomLegend, {
    series: ITEMS,
    onSelect: () => {},
    selectedKeys: selected,
    visibility: vis,
  });
}

/** The scalar wrapper legacy (no visibility) select-on-click mode. */
function LegacyHarness() {
  return h(CustomLegend, {
    series: ITEMS,
    onSelect: (k: string) => {
      (window as unknown as { __selectLog: string[] }).__selectLog.push(k);
    },
    selectedKeys: new Set<string>(),
  });
}

(window as unknown as { __selectLog: string[] }).__selectLog = [];

const mount = (id: string, node: React.ReactElement) =>
  createRoot(document.getElementById(id)!).render(node);

// --- DOM probes -------------------------------------------------------------
const chipsIn = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLButtonElement>('button[aria-pressed]'));
const label = (btn: HTMLButtonElement) => (btn.textContent ?? "").trim();
const pressed = (btn: HTMLButtonElement) => btn.getAttribute("aria-pressed") === "true";
const struck = (btn: HTMLButtonElement) =>
  getComputedStyle(btn.querySelector("span:last-child") as Element).textDecorationLine.includes("line-through");
const opacity = (btn: HTMLButtonElement) => parseFloat(btn.style.opacity || "1");
const swatchH = (btn: HTMLButtonElement) =>
  parseFloat((btn.querySelector("span[aria-hidden]") as HTMLElement).style.height);

function fireClick(el: Element): void {
  for (const t of ["pointerdown", "mousedown", "mouseup", "click"] as const) {
    el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window }));
  }
}
function fireDblClick(el: Element): void {
  fireClick(el);
  el.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true, view: window }));
}
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  let ok = true;
  const gate = (cond: boolean, msg: string) => {
    report(cond, msg);
    ok = ok && cond;
  };
  try {
    mount("plain", h(PlainHarness));
    mount("scalar", h(ScalarHarness));
    mount("legacy", h(LegacyHarness));
    await wait(60);

    const plain = document.getElementById("plain") as HTMLElement;
    let chips = chipsIn(plain);
    gate(chips.length === 3, `[plain] renders 3 chips (got ${chips.length})`);
    gate(chips.every(pressed), "[plain] all start visible (aria-pressed=true)");

    // (1) single-click Alpha → hidden
    fireClick(chips[0]!);
    await wait(40);
    chips = chipsIn(plain);
    gate(
      !pressed(chips[0]!) && struck(chips[0]!) && Math.abs(opacity(chips[0]!) - 0.35) < 1e-6,
      "[plain] click toggles Alpha hidden (aria=false, line-through, opacity 0.35)",
    );
    // click again → back
    fireClick(chips[0]!);
    await wait(40);
    chips = chipsIn(plain);
    gate(pressed(chips[0]!) && !struck(chips[0]!), "[plain] second click restores Alpha");

    // (2) double-click Beta → isolate (only Beta visible)
    fireDblClick(chips[1]!);
    await wait(40);
    chips = chipsIn(plain);
    gate(
      !pressed(chips[0]!) && pressed(chips[1]!) && !pressed(chips[2]!),
      "[plain] dblclick isolates Beta (others hidden)",
    );
    // dblclick Beta again → un-isolate (all visible)
    fireDblClick(chips[1]!);
    await wait(40);
    chips = chipsIn(plain);
    gate(chips.every(pressed), "[plain] dblclick isolated series un-isolates (all visible)");

    // (3) scalar wrapper: selection dim + swatch height, one shared Y axis
    const scalar = document.getElementById("scalar") as HTMLElement;
    let schips = chipsIn(scalar);
    const alpha = schips.find((b) => label(b) === "Alpha")!;
    const beta = schips.find((b) => label(b) === "Beta")!;
    gate(
      Math.abs(opacity(alpha) - 1) < 1e-6 && Math.abs(opacity(beta) - 0.35) < 1e-6,
      "[scalar] selected Alpha at full opacity, non-selected Beta dimmed to 0.35",
    );
    gate(swatchH(alpha) === 3 && swatchH(beta) === 2, "[scalar] selected swatch 3px, others 2px");

    const extraAxisButtons = Array.from(
      scalar.querySelectorAll<HTMLButtonElement>('button:not([aria-pressed])'),
    );
    gate(extraAxisButtons.length === 0, "[scalar] no per-series Y-axis promotion controls");
    // scalar visibility toggle still works
    fireClick(beta);
    await wait(40);
    schips = chipsIn(scalar);
    gate(
      !pressed(schips.find((b) => label(b) === "Beta")!),
      "[scalar] chip click still toggles visibility",
    );

    // (4) legacy select mode
    const legacy = document.getElementById("legacy") as HTMLElement;
    const lchips = chipsIn(legacy);
    fireClick(lchips[2]!);
    await wait(20);
    const selLog = (window as unknown as { __selectLog: string[] }).__selectLog;
    gate(selLog.length === 1 && selLog[0] === "c", "[legacy] chip click SELECTS the run (onSelect)");

    setOverallStatus(ok);
  } catch (err) {
    report(false, `threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    setOverallStatus(false);
  }
}

void main();
