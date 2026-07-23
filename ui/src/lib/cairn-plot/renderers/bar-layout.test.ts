import { test } from "node:test";
import assert from "node:assert/strict";
import { AXIS } from "../theme.ts";
import {
  barChartPads,
  BAR_TICK_BAND,
  BAR_TITLE_BAND,
  BAR_LEGEND_BAND,
  BAR_TOP_MARGIN,
} from "./bar-layout.ts";

// The defect: the bar chart reserved vertical space it didn't need — a flat
// bottom pad that included caption room with no caption, and a top pad larger
// than the legend. These guard that pads track the rendered content.

const LEFT = 80;
const RIGHT = 56;

test("bottom pad clears tick labels and NOTHING more when there is no caption", () => {
  const p = barChartPads({
    showLegend: false,
    hasValueLabel: false,
    left: LEFT,
    right: RIGHT,
  });
  // Tick-label baseline (from the Axis primitive) must fit; derive it from AXIS
  // so this isn't a magic constant.
  const tickBaseline = AXIS.tickLength + AXIS.tickFontSize;
  assert.ok(p.bottom >= tickBaseline, "tick labels must not be clipped");
  // …but no caption band is reserved.
  assert.equal(p.bottom, BAR_TICK_BAND);
  assert.ok(p.bottom < BAR_TICK_BAND + BAR_TITLE_BAND);
});

test("a value label adds exactly the caption band", () => {
  const withCap = barChartPads({
    showLegend: false,
    hasValueLabel: true,
    left: LEFT,
    right: RIGHT,
  });
  const noCap = barChartPads({
    showLegend: false,
    hasValueLabel: false,
    left: LEFT,
    right: RIGHT,
  });
  assert.equal(withCap.bottom - noCap.bottom, BAR_TITLE_BAND);
  assert.equal(withCap.bottom, BAR_TICK_BAND + BAR_TITLE_BAND);
});

test("legend adds a band on top; absent legend reserves only a bare gutter", () => {
  const withLegend = barChartPads({
    showLegend: true,
    hasValueLabel: false,
    left: LEFT,
    right: RIGHT,
  });
  const noLegend = barChartPads({
    showLegend: false,
    hasValueLabel: false,
    left: LEFT,
    right: RIGHT,
  });
  assert.equal(withLegend.top, BAR_LEGEND_BAND);
  assert.equal(noLegend.top, BAR_TOP_MARGIN);
  assert.ok(noLegend.top < withLegend.top, "no-legend top must be tighter");
});

test("total vertical pad never exceeds the all-elements-present bound", () => {
  const bound = BAR_LEGEND_BAND + BAR_TICK_BAND + BAR_TITLE_BAND;
  for (const showLegend of [false, true]) {
    for (const hasValueLabel of [false, true]) {
      const p = barChartPads({ showLegend, hasValueLabel, left: LEFT, right: RIGHT });
      assert.ok(
        p.top + p.bottom <= bound,
        `pads ${p.top}+${p.bottom} exceed content bound ${bound}`,
      );
      // present bands add, absent bands don't:
      const expectedTop = showLegend ? BAR_LEGEND_BAND : BAR_TOP_MARGIN;
      const expectedBottom = BAR_TICK_BAND + (hasValueLabel ? BAR_TITLE_BAND : 0);
      assert.equal(p.top, expectedTop);
      assert.equal(p.bottom, expectedBottom);
    }
  }
});

test("old flat pads were looser than the new content-sized ones", () => {
  // Regression witness: the demo case (legend + caption) used to be 26 + 34;
  // it is now tighter while still clearing the same text.
  const demo = barChartPads({
    showLegend: true,
    hasValueLabel: true,
    left: LEFT,
    right: RIGHT,
  });
  assert.ok(demo.top < 26, `top ${demo.top} should be < old 26`);
  assert.ok(demo.bottom <= 34, `bottom ${demo.bottom} should be <= old 34`);
  // and the no-caption case reclaims the whole caption band vs the old flat 34.
  const noCap = barChartPads({
    showLegend: false,
    hasValueLabel: false,
    left: LEFT,
    right: RIGHT,
  });
  assert.ok(noCap.bottom < 34, `no-caption bottom ${noCap.bottom} < old 34`);
});
