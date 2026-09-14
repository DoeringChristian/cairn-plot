/**
 * Node test: `themedLayout` / `withAlpha` — the pure half of the figure's host
 * theming.
 *
 *   node --experimental-strip-types --test \
 *     src/plots/figure/backends/plotly/plot-theme.test.ts
 *
 * The bug this pins: the layout override used to be a hardcoded constant
 * (`DARK_LAYOUT`) that forced BOTH backgrounds transparent — so the figure
 * adopts the host page's background — while pinning `font.color` to the LIGHT
 * theme's `#1f2328` and leaving `gridcolor`/`zerolinecolor` to plotly's light
 * template (`"white"`). The figure was therefore only ever legible on a white
 * page: on a dark host the text went black-on-black, and on a light host the
 * grid went white-on-white.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { themedLayout, withAlpha, type PlotPalette } from "./plot-theme.ts";

const PALETTE: PlotPalette = {
  fg: "rgb(230, 237, 243)",
  muted: "rgb(145, 152, 161)",
  border: "rgb(48, 54, 61)",
  elevated: "rgb(22, 27, 34)",
};

test("the font colour comes from the host palette, not a constant", () => {
  const out = themedLayout({}, PALETTE);
  assert.equal((out.font as Record<string, unknown>).color, PALETTE.fg);
});

test("grid, zeroline and axis lines follow the host border colour", () => {
  const out = themedLayout({}, PALETTE);
  for (const axis of ["xaxis", "yaxis"]) {
    const a = out[axis] as Record<string, unknown>;
    assert.equal(a.gridcolor, PALETTE.border, `${axis}.gridcolor`);
    assert.equal(a.zerolinecolor, PALETTE.border, `${axis}.zerolinecolor`);
    assert.equal(a.linecolor, PALETTE.border, `${axis}.linecolor`);
  }
});

test("backgrounds stay transparent so the figure adopts the host's", () => {
  const out = themedLayout({}, PALETTE);
  assert.equal(out.paper_bgcolor, "transparent");
  assert.equal(out.plot_bgcolor, "transparent");
});

test("an author's explicit colours WIN over the theme defaults", () => {
  const base = {
    font: { color: "#ff0000", size: 18 },
    paper_bgcolor: "#123456",
    plot_bgcolor: "#654321",
    xaxis: { gridcolor: "#00ff00", title: "t" },
  };
  const out = themedLayout(base, PALETTE);
  assert.equal((out.font as Record<string, unknown>).color, "#ff0000");
  assert.equal((out.font as Record<string, unknown>).size, 18, "unrelated font keys survive");
  assert.equal(out.paper_bgcolor, "#123456");
  assert.equal(out.plot_bgcolor, "#654321");
  const x = out.xaxis as Record<string, unknown>;
  assert.equal(x.gridcolor, "#00ff00");
  assert.equal(x.title, "t", "unrelated axis keys survive");
  // …but the keys the author did NOT set are still themed.
  assert.equal(x.zerolinecolor, PALETTE.border);
});

test("EVERY axis is themed, not just the first pair", () => {
  const out = themedLayout({ xaxis2: { title: "b" }, yaxis3: {} }, PALETTE);
  assert.equal((out.xaxis2 as Record<string, unknown>).gridcolor, PALETTE.border);
  assert.equal((out.xaxis2 as Record<string, unknown>).title, "b");
  assert.equal((out.yaxis3 as Record<string, unknown>).gridcolor, PALETTE.border);
});

test("a 3D scene is themed when present and NOT invented when absent", () => {
  assert.equal(themedLayout({}, PALETTE).scene, undefined);
  const out = themedLayout({ scene: { camera: { eye: { x: 1 } } } }, PALETTE);
  const scene = out.scene as Record<string, unknown>;
  assert.deepEqual(scene.camera, { eye: { x: 1 } }, "camera survives untouched");
  for (const axis of ["xaxis", "yaxis", "zaxis"]) {
    const a = scene[axis] as Record<string, unknown>;
    assert.equal(a.gridcolor, PALETTE.border);
    assert.equal(a.backgroundcolor, "transparent");
  }
});

test("the hover label and modebar are legible on the host background", () => {
  const out = themedLayout({}, PALETTE);
  const hover = out.hoverlabel as Record<string, unknown>;
  assert.equal(hover.bgcolor, PALETTE.elevated);
  assert.equal((hover.font as Record<string, unknown>).color, PALETTE.fg);
  const modebar = out.modebar as Record<string, unknown>;
  assert.equal(modebar.color, PALETTE.muted);
  assert.equal(modebar.activecolor, PALETTE.fg);
});

test("the input layout is never mutated", () => {
  const base = { font: { size: 12 }, xaxis: { title: "x" } };
  const snapshot = JSON.parse(JSON.stringify(base));
  themedLayout(base, PALETTE);
  assert.deepEqual(base, snapshot);
});

test("fixed width/height are dropped so the figure fills its container", () => {
  const out = themedLayout({ width: 700, height: 400 }, PALETTE);
  assert.ok(!("width" in out));
  assert.ok(!("height" in out));
  assert.equal(out.autosize, true);
});

test("withAlpha fades a resolved colour, and passes anything odd through", () => {
  assert.equal(withAlpha("rgb(230, 237, 243)", 0.2), "rgba(230, 237, 243, 0.2)");
  assert.equal(withAlpha("rgba(1, 2, 3, 0.5)", 0.25), "rgba(1, 2, 3, 0.25)");
  // Not a parseable rgb()/rgba() — return it unchanged rather than emit garbage.
  assert.equal(withAlpha("#abcdef", 0.2), "#abcdef");
  assert.equal(withAlpha("", 0.2), "");
});
