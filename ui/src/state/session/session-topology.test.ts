// node --experimental-strip-types --test src/state/session/session-topology.test.ts
//
// The topology must name EXACTLY the session ids the tree registers once
// mounted; anything else is silently pruned from a restored session and skipped
// by the host's `patchSettings` fan-out. The regression these guard: `GridView`
// moved to identity-derived cell paths while this compiler still walked by
// index, so on a grid with authored ids the two sets stopped intersecting.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { PlotNode, PlotSpec } from "../../../../packages/spec/src/spec.ts";
import { compileSessionTopology } from "./session-topology.ts";
import { createPlotSessionController } from "./PlotSessionController.ts";
import { gridCellKeys, gridCellPath } from "../../layout/grid-cell-key.ts";
import { clearPlotTypesForTest } from "../../plots/registry.ts";
import { clearReactPlotTypesForTest } from "../../plots/react-registry.ts";
import { ensureImagePlotType } from "../../plots/image/runtime/register.ts";
import type { ImageBackend } from "../../plots/image/backend.ts";
import type { ImageBackendView } from "../../plots/image/runtime/contracts.ts";

const leaf = (id?: string): PlotNode => ({
  kind: "plot",
  type: "image",
  ...(id ? { id } : {}),
  data: { kind: "image", hash: id ?? "h" },
});
const specOf = (root: PlotNode): PlotSpec => ({ root });

/** The cell id `GridView`/`PlotNodeView` will register for one grid child —
 *  written out from the render path rather than reusing the compiler. */
const viewCellId = (gridPath: string, children: readonly PlotNode[], index: number): string =>
  `cell:${gridCellPath(gridPath, gridCellKeys(children)[index]!)}`;

test("id-less grid children get positional cell ids", () => {
  const children = [leaf(), leaf()];
  const { cellIds, grids } = compileSessionTopology(specOf({ kind: "grid", children }));
  assert.deepEqual([...cellIds].sort(), ["cell:root/i0", "cell:root/i1", "stack:root"]);
  assert.deepEqual([...grids.keys()], ["grid:root"]);
  for (const index of [0, 1]) {
    assert.ok(cellIds.has(viewCellId("root", children, index)), "matches what the view registers");
  }
});

test("id-carrying grid children get identity cell ids that survive a reorder", () => {
  const a = leaf("run-a");
  const b = leaf("run-b");
  const before = compileSessionTopology(specOf({ kind: "grid", children: [a, b] }));
  const after = compileSessionTopology(specOf({ kind: "grid", children: [b, a] }));
  assert.deepEqual([...before.cellIds].sort(), ["cell:root/run-a", "cell:root/run-b", "stack:root"]);
  assert.deepEqual([...before.cellIds].sort(), [...after.cellIds].sort(),
    "a reorder must not invalidate a single saved cell");
  assert.ok(before.cellIds.has(viewCellId("root", [a, b], 0)));
  assert.ok(after.cellIds.has(viewCellId("root", [b, a], 0)));
});

test("nested grids nest their identity paths", () => {
  const inner: PlotNode = { kind: "grid", id: "inner", children: [leaf("x"), leaf()] };
  const { cellIds, grids } = compileSessionTopology(
    specOf({ kind: "grid", children: [inner, leaf("y")] }),
  );
  assert.deepEqual([...cellIds].sort(), [
    "cell:root/inner/i1",
    "cell:root/inner/x",
    "cell:root/y",
    "stack:root",
    "stack:root/inner",
  ]);
  assert.deepEqual([...grids.keys()].sort(), ["grid:root", "grid:root/inner"]);
  // The stacked viewport is per GRID, at the grid's own path — deliberately not
  // identity-derived, because every slot shares that one cell.
  assert.ok(cellIds.has("stack:root/inner"));
});

const testImageBackend = (): ImageBackend<ImageBackendView> => ({
  id: "test",
  technology: "canvas2d",
  priority: 1,
  View: (() => null) as ImageBackendView,
  supports: () => ({ supported: true, priority: 1 }),
  capabilities: {
    imageOperations: [],
    displayOperations: [],
    supportsImageOperation: () => false,
    supportsDisplayOperation: () => false,
  },
});

test("an expanded image comparison contributes cells one level deeper", () => {
  clearReactPlotTypesForTest();
  clearPlotTypesForTest();
  ensureImagePlotType((() => null) as never, [testImageBackend()]);
  const compare: PlotNode = {
    kind: "compare",
    type: "image",
    id: "cmp",
    presentation: "difference",
    strategy: "reference",
    referenceIndex: 1,
    operands: [
      { kind: "image", hash: "a" },
      { kind: "image", hash: "reference" },
      { kind: "image", hash: "c" },
    ],
  };
  const { cellIds, grids } = compileSessionTopology(specOf({ kind: "grid", children: [compare] }));
  // `PlotNodeView` lowers a multi-output image compare into a grid dispatched at
  // `<path>/comparison`; its two pair panes are that grid's children.
  assert.ok(grids.has("grid:root/cmp/comparison"), [...grids.keys()].join(", "));
  // The pair children carry an `id` derived from the parent's identity + the
  // foreground's role (`comparison-plan.ts`'s `pairChildId`), so their cell keys
  // — and therefore these session ids — follow the run rather than the slot.
  assert.deepEqual([...cellIds].sort(), [
    "cell:root/cmp/comparison/cmp|0",
    "cell:root/cmp/comparison/cmp|1",
    "stack:root",
    "stack:root/cmp/comparison",
  ]);
  // DUPLICATE LABELS stay distinct cells: the id leads with the output INDEX and
  // only appends the label, so two operands the author labelled the same do not
  // collide (a duplicate id would drop both back to positional keys and warn).
  const labelled: PlotNode = { ...compare, props: { labels: ["dup", "reference", "dup"] } };
  const duplicated = compileSessionTopology(specOf({ kind: "grid", children: [labelled] }));
  assert.deepEqual([...duplicated.cellIds].sort(), [
    "cell:root/cmp/comparison/cmp|0:dup",
    "cell:root/cmp/comparison/cmp|1:dup",
    "stack:root",
    "stack:root/cmp/comparison",
  ]);
  clearReactPlotTypesForTest();
  clearPlotTypesForTest();
});

const twoOperandCompare = (): PlotNode => ({
  kind: "compare",
  type: "image",
  presentation: "split",
  strategy: "reference",
  operands: [{ kind: "image", hash: "a" }, { kind: "image", hash: "b" }],
});

test("an unplannable comparison stays one cell at its own path", () => {
  // With no image plot type registered `planComparison` throws; the topology
  // must degrade to the unexpanded cell rather than propagate the error — the
  // view renders the plan error in that same one cell's place.
  clearReactPlotTypesForTest();
  clearPlotTypesForTest();
  const { cellIds } = compileSessionTopology(
    specOf({ kind: "grid", children: [twoOperandCompare()] }),
  );
  assert.deepEqual([...cellIds].sort(), ["cell:root/i0", "stack:root"]);
});

test("a REGISTERED two-operand comparison is one output, so it stays one cell", () => {
  // The other half of that branch, and the one the unplannable case cannot
  // reach: planning SUCCEEDS, but a single output means `expandImageComparison`
  // returns null and there is no `/comparison` level to nest under.
  clearReactPlotTypesForTest();
  clearPlotTypesForTest();
  ensureImagePlotType((() => null) as never, [testImageBackend()]);
  try {
    const { cellIds, grids } = compileSessionTopology(
      specOf({ kind: "grid", children: [twoOperandCompare()] }),
    );
    assert.deepEqual([...cellIds].sort(), ["cell:root/i0", "stack:root"]);
    assert.deepEqual([...grids.keys()], ["grid:root"], "no nested comparison grid");
  } finally {
    clearReactPlotTypesForTest();
    clearPlotTypesForTest();
  }
});

test("PlotNodeView still derives its cell path from the shared helper", () => {
  // A SOURCE pin, because the bug this file exists for is the two sides drifting
  // apart: if `GridView` went back to `${path}/${index}` every assertion above
  // would keep passing while prune/patch silently missed every grid cell again.
  // Same technique as `plots/image/runtime/register.test.ts`'s CORE_RENDERERS pin.
  const source = readFileSync(new URL("../../host/PlotNodeView.tsx", import.meta.url), "utf8");
  assert.match(
    source,
    /gridCellPath\(path, cellKeys\[index\]/,
    "GridView must build cell paths with gridCellPath(path, cellKeys[index] …) — " +
      "session-topology.ts derives the same ids and the two must not drift",
  );
  assert.match(source, /cellKeys=\{cellKeys\}/, "and hand the same keys to GridLayout");
});

test("patchCellSettings reaches a grid cell through the compiled topology", () => {
  const children = [leaf("run-a"), leaf("run-b")];
  const topology = compileSessionTopology(specOf({ kind: "grid", children }));
  const controller = createPlotSessionController();
  controller.setTopology(topology);

  // Register exactly as `PlotCell` does, with the id the view derives.
  const seen: Record<string, unknown>[] = [];
  const id = viewCellId("root", children, 1);
  controller.registerCell(id, (settings) => { seen.push(settings); }, { "image.exposureEV": 0 } as never);

  controller.patchCellSettings({ "image.exposureEV": 2 } as never);
  assert.deepEqual(seen.at(-1), { "image.exposureEV": 2 },
    "the host's patchSettings must still reach an identity-keyed grid cell");
  assert.deepEqual(controller.getSession().cells[id]?.settings, { "image.exposureEV": 2 });
  controller.destroy();
});

test("a restored session for an identity-keyed cell is not pruned", () => {
  const children = [leaf("run-a"), leaf("run-b")];
  const id = viewCellId("root", children, 0);
  const controller = createPlotSessionController();
  controller.setTopology(compileSessionTopology(specOf({ kind: "grid", children })));
  controller.restoreSession({
    cells: { [id]: { settings: { "image.exposureEV": 3 } }, "cell:root/gone": { settings: {} } },
    grids: {},
  });
  const session = controller.getSession();
  assert.deepEqual(session.cells[id]?.settings, { "image.exposureEV": 3 }, "kept");
  assert.equal(session.cells["cell:root/gone"], undefined, "pruned");
  controller.destroy();
});
