/**
 * `diverging-zero.browser.ts` — the END-TO-END statement of the diverging
 * colormap contract, measured in painted PIXELS.
 *
 * ## The bug this pins
 * Every colormap consumer normalized `(v - lo) / (hi - lo)` over the RAW data
 * extent, so on `red-blue` / `red-green` the WHITE midpoint tracked the middle
 * of the data rather than the value zero. Data over `[-2, 8]` painted zero pink;
 * data over `[-8, 2]` painted it blue. `settings/colormaps/diverging-domain.test.ts`
 * unit-tests the arithmetic; this page pins that the arithmetic actually reaches
 * the CANVAS, and that the colorbar advertises the same domain the pixels used
 * (a legend that disagrees with the image is its own bug).
 *
 * ## What it pins
 *  1. On an asymmetric domain straddling zero, the cell whose value IS zero is
 *     painted white, and the two polarities land on opposite sides of the ramp.
 *  2. Equal magnitudes are equidistant from white (one shared scale).
 *  3. A one-sided domain is still symmetrized — no white appears, and every cell
 *     stays on a single polarity.
 *  4. A SEQUENTIAL map (turbo) is untouched: it still spans the raw extent.
 *
 * RUNNING: `npm run test:harness --only diverging-zero`, or the whole suite
 * (this page is self-driving).
 */
import React from "react";
import { createRoot } from "react-dom/client";
import Heatmap from "../backends/svg/Heatmap";
import type { ColormapName } from "../../types";
import { createHarness } from "../../../testing/harness";

const h = React.createElement;

const { report, setOverallStatus } = createHarness({
  title: "DIVERGING-ZERO",
  resultFlag: "__divergingZeroResult",
});

let ok = true;
function gate(cond: boolean, label: string) {
  if (!cond) ok = false;
  report(cond, label);
}
const note = (msg: string) => report(true, msg);

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** `cols` cells ramping linearly from `lo` to `hi`; index `i` holds value
 *  `lo + (hi-lo)*i/(cols-1)`, so the zero cell's index is exact by construction. */
function ramp(lo: number, hi: number, cols: number): number[][] {
  const row: number[] = [];
  for (let i = 0; i < cols; i++) row.push(lo + ((hi - lo) * i) / (cols - 1));
  return [row, row.slice()];
}

const COLS = 41; // [-2, 8] over 41 cells ⇒ value 0 lands exactly on index 8

function mount(hostId: string, matrix: number[][], colormap: ColormapName) {
  const host = document.getElementById(hostId) as HTMLElement;
  createRoot(host).render(
    h(Heatmap, { matrix, colormap, valueLabel: "value" }),
  );
  return host;
}

/** The painted RGB of native canvas column `x` (the canvas is cols×rows). */
function cellRgb(host: HTMLElement, x: number): [number, number, number] {
  const canvas = host.querySelector("canvas") as HTMLCanvasElement | null;
  if (!canvas) throw new Error(`no canvas mounted in #${host.id}`);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("no 2d context");
  const d = ctx.getImageData(x, 0, 1, 1).data;
  return [d[0]!, d[1]!, d[2]!];
}

const isWhite = (c: [number, number, number]) => c.every((v) => v >= 250);
const rgb = (c: [number, number, number]) => `rgb(${c[0]},${c[1]},${c[2]})`;
/** Distance from white, as a stand-in for "how far along the ramp from centre". */
const fromWhite = (c: [number, number, number]) =>
  Math.abs(255 - c[0]) + Math.abs(255 - c[1]) + Math.abs(255 - c[2]);

async function main() {
  try {
    const asym = mount("asym", ramp(-2, 8, COLS), "red-blue");
    const one = mount("onesided", ramp(2, 8, COLS), "red-blue");
    const seq = mount("seq", ramp(-2, 8, COLS), "turbo");
    await wait(600);

    // ── 1. Zero is white, and the polarities are on opposite sides ──
    const zeroCell = cellRgb(asym, 8); // value 0.0
    note(`[red-blue] cell at value 0 → ${rgb(zeroCell)}`);
    gate(isWhite(zeroCell), "[red-blue] the ZERO cell is painted white");

    const negCell = cellRgb(asym, 0); // value -2
    const posCell = cellRgb(asym, COLS - 1); // value +8
    note(`[red-blue] value -2 → ${rgb(negCell)} · value +8 → ${rgb(posCell)}`);
    gate(negCell[0] > negCell[2], "[red-blue] a NEGATIVE value is on the red side");
    gate(posCell[2] > posCell[0], "[red-blue] a POSITIVE value is on the blue side");

    // Not vacuous: a cell just left of zero must differ from one just right.
    const left = cellRgb(asym, 7);
    const right = cellRgb(asym, 9);
    gate(
      left[0] > left[2] && right[2] > right[0],
      "[red-blue] the ramp actually crosses at zero, not elsewhere",
    );

    // ── 2. The domain is SYMMETRIZED, not two-slope ──
    // This is the assertion that separates the two ways of pinning zero to the
    // midpoint. The data stops at −2 while the domain runs to −8, so the most
    // negative cell must land only PART of the way down the red arm — a pale
    // red. Under a two-slope mapping (each side scaled to its own extent) it
    // would instead be the fully saturated red END stop, and the `+8` cell and
    // the `−2` cell would be equally saturated.
    const RED_STOP: [number, number, number] = [215, 25, 28];
    note(
      `[red-blue] most-negative cell ${rgb(negCell)} vs the ramp's red end ${rgb(RED_STOP)}`,
    );
    gate(
      negCell[1] > RED_STOP[1] + 80 && negCell[2] > RED_STOP[2] + 80,
      "[red-blue] the short side is COMPRESSED (symmetric domain, not two-slope)",
    );
    // …while the side that does reach the domain edge is fully saturated.
    gate(
      Math.abs(posCell[0] - 44) < 12 &&
        Math.abs(posCell[1] - 123) < 12 &&
        Math.abs(posCell[2] - 182) < 12,
      "[red-blue] the side that reaches ±max DOES hit the ramp end",
    );
    // Monotonic on each arm: magnitude still reads as colour distance.
    const plus2 = cellRgb(asym, 16); // value +2 (−2 + 10·16/40)
    note(`[red-blue] |+2| from white = ${fromWhite(plus2)} · |+8| = ${fromWhite(posCell)}`);
    gate(
      fromWhite(plus2) < fromWhite(posCell),
      "[red-blue] a larger magnitude is farther from white",
    );

    // ── 3. The colorbar advertises the SAME (symmetrized) domain ──
    const labels = [...asym.querySelectorAll("text")].map((t) => t.textContent ?? "");
    note(`[red-blue] colorbar labels: ${JSON.stringify(labels.filter(Boolean).slice(0, 6))}`);
    gate(
      labels.some((t) => t.trim() === "-8") && labels.some((t) => t.trim() === "8"),
      "[red-blue] the colorbar shows the symmetrized bounds the pixels used",
    );

    // ── 4. A one-sided domain is still symmetrized ──
    const oneLo = cellRgb(one, 0); // value +2
    const oneHi = cellRgb(one, COLS - 1); // value +8
    note(`[one-sided] value +2 → ${rgb(oneLo)} · value +8 → ${rgb(oneHi)}`);
    gate(
      oneLo[2] > oneLo[0] && oneHi[2] > oneHi[0],
      "[one-sided] all-positive data stays on ONE polarity (blue)",
    );
    gate(
      !isWhite(oneLo) && !isWhite(oneHi),
      "[one-sided] white does not appear when the data never reaches zero",
    );

    // ── 5. Sequential maps are untouched ──
    const seqLo = cellRgb(seq, 0);
    const seqZero = cellRgb(seq, 8);
    const seqHi = cellRgb(seq, COLS - 1);
    note(`[turbo] lo → ${rgb(seqLo)} · zero → ${rgb(seqZero)} · hi → ${rgb(seqHi)}`);
    gate(!isWhite(seqZero), "[turbo] zero is NOT forced to the ramp centre");
    gate(
      fromWhite(seqLo) > 0 && rgb(seqLo) !== rgb(seqHi),
      "[turbo] the full raw extent still spans the ramp",
    );
    const seqLabels = [...seq.querySelectorAll("text")].map((t) => (t.textContent ?? "").trim());
    gate(
      seqLabels.some((t) => t === "-2") && seqLabels.some((t) => t === "8"),
      "[turbo] the colorbar still shows the RAW bounds",
    );

    setOverallStatus(ok);
  } catch (err) {
    report(false, `threw: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    setOverallStatus(false);
  }
}

void main();
