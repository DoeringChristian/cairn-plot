import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CBAR,
  colorbarReservedRight,
  colorbarPlacement,
  type ColorbarLabel,
} from "./colorbar-layout.ts";

// Geometry regression guards for the shared chart colorbar. These encode the
// two defects the fix addresses:
//   (1) Scatter — the rotated caption OVERLAPPED the mid tick number.
//   (2) Scatter + Heatmap — full-precision `formatNum` labels OVERFLOWED the
//       fixed right pad past the svg's right edge.
// Both reduce to: the drawn colorbar must fit inside the reserved right pad,
// and the number band must not intersect the caption band.

const PLOT_RIGHT = 800;
const TOP = 20;
const HEIGHT = 340;

/** Right edge of the widest number label (anchor="start"). */
function numbersRight(labels: readonly ColorbarLabel[]): number {
  const p = colorbarPlacement({
    plotRight: PLOT_RIGHT,
    top: TOP,
    height: HEIGHT,
    reservedRight: colorbarReservedRight(
      labels.map((l) => l.text),
      false,
    ),
    labels,
    title: null,
  });
  // numbers all share x (anchor start); width = maxChars*charW + numPad.
  const maxChars = labels.reduce((m, l) => Math.max(m, l.text.length), 0);
  return p.numbers[0]!.x + maxChars * CBAR.charW + CBAR.numPad;
}

test("reserved right grows with the widest formatted label", () => {
  const narrow = colorbarReservedRight(["0", "1"], false);
  const wide = colorbarReservedRight(["0", "-0.98999"], false);
  assert.ok(wide > narrow, "a wider label must reserve more right pad");
});

test("colorbar bar sits entirely to the RIGHT of the plot rect", () => {
  const labels: ColorbarLabel[] = [
    { text: "0", frac: 0 },
    { text: "1", frac: 1 },
  ];
  const reserved = colorbarReservedRight(["0", "1"], false);
  const p = colorbarPlacement({
    plotRight: PLOT_RIGHT,
    top: TOP,
    height: HEIGHT,
    reservedRight: reserved,
    labels,
    title: null,
  });
  // Bar left edge is strictly right of the plot's right edge → no overlap with
  // the axis / plot area (the reported "axis overlaps the colorbar" defect).
  assert.ok(p.bar.x >= PLOT_RIGHT, "bar must not intrude into the plot rect");
});

test("SCATTER regression: numbers never overlap the rotated caption", () => {
  // The exact labels the gallery scatter produced, where the mid number
  // "0.52846" used to sit under the vertical "score" caption.
  const labels: ColorbarLabel[] = [
    { text: "0.062895", frac: 0 },
    { text: "0.52846", frac: 0.5 },
    { text: "0.99403", frac: 1 },
  ];
  const reserved = colorbarReservedRight(
    labels.map((l) => l.text),
    true,
  );
  const p = colorbarPlacement({
    plotRight: PLOT_RIGHT,
    top: TOP,
    height: HEIGHT,
    reservedRight: reserved,
    labels,
    title: "score",
  });
  assert.ok(p.title, "caption present");
  const titleLeft = p.title!.x - CBAR.titleW / 2;
  assert.ok(
    numbersRight(labels) <= titleLeft,
    `numbers (right=${numbersRight(labels)}) must clear caption (left=${titleLeft})`,
  );
});

test("everything fits inside the reserved right pad (no svg overflow)", () => {
  // HEATMAP regression: "-0.98999" overflowed the fixed 64px pad past the edge.
  for (const [labels, title] of [
    [
      [
        { text: "2", frac: 1 },
        { text: "-0.98999", frac: 0 },
      ] as ColorbarLabel[],
      null,
    ],
    [
      [
        { text: "0.062895", frac: 0 },
        { text: "0.52846", frac: 0.5 },
        { text: "0.99403", frac: 1 },
      ] as ColorbarLabel[],
      "score",
    ],
  ] as const) {
    const reserved = colorbarReservedRight(
      labels.map((l) => l.text),
      !!title,
    );
    const p = colorbarPlacement({
      plotRight: PLOT_RIGHT,
      top: TOP,
      height: HEIGHT,
      reservedRight: reserved,
      labels,
      title,
    });
    // The svg width is plotRight + reservedRight; nothing may reach past it.
    assert.ok(
      p.rightExtent <= PLOT_RIGHT + reserved + 0.001,
      `rightExtent ${p.rightExtent} exceeds reserved band ${PLOT_RIGHT + reserved}`,
    );
  }
});

test("number label baselines land inside the bar's vertical span", () => {
  const labels: ColorbarLabel[] = [
    { text: "0", frac: 0 },
    { text: "0.5", frac: 0.5 },
    { text: "1", frac: 1 },
  ];
  const p = colorbarPlacement({
    plotRight: PLOT_RIGHT,
    top: TOP,
    height: HEIGHT,
    reservedRight: colorbarReservedRight(["0", "0.5", "1"], false),
    labels,
    title: null,
  });
  for (const n of p.numbers) {
    assert.ok(
      n.y >= TOP && n.y <= TOP + HEIGHT + CBAR.baseline + 0.001,
      `label y=${n.y} outside bar span`,
    );
  }
});
