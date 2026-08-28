import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { RenderEnvironment } from "../backends/contracts.ts";
import {
  advanceReactBackendSelection,
  selectReactBackend,
  type ReactPlotBackend,
} from "./react-backend.ts";

interface Presentation { family: string; value: number }
interface Settings { exposure: number }

const environment: RenderEnvironment = { webgpu: true, webgl2: true, pixelRatio: 2 };
const component = () => null;

function backend(
  id: string,
  priority: number,
  supported = true,
): ReactPlotBackend<Presentation, Settings> {
  return {
    id,
    family: id,
    technology: "canvas2d",
    component,
    supports: () => ({ supported, priority }),
    canReuse: (previous, next) => previous.family === next.family,
  };
}

test("React backend selection uses support, priority, then declaration order", () => {
  const unsupported = backend("unsupported", 100, false);
  const first = backend("first", 10);
  const tied = backend("tied", 10);
  assert.equal(
    selectReactBackend([unsupported, first, tied], { family: "image", value: 1 }, environment),
    first,
  );
  assert.throws(
    () => selectReactBackend([unsupported], { family: "image", value: 1 }, environment),
    /no React backend supports/,
  );
});

test("same backend retains its component boundary only when canReuse permits", () => {
  const selected = backend("cpu", 1);
  const first = advanceReactBackendSelection(undefined, selected, { family: "image", value: 1 });
  const reused = advanceReactBackendSelection(first, selected, { family: "image", value: 2 });
  const remounted = advanceReactBackendSelection(reused, selected, { family: "mesh", value: 3 });
  const changed = advanceReactBackendSelection(remounted, backend("gpu", 2), { family: "mesh", value: 4 });
  assert.equal(first.revision, 0);
  assert.equal(reused.revision, 0);
  assert.equal(remounted.revision, 1);
  assert.equal(changed.revision, 2);
});

test("React backend outlet stays in the owning tree and never creates a root", () => {
  const source = readFileSync(new URL("./react-backend.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /react-dom\/client|createRoot|\.render\s*\(/);
  assert.match(source, /createElement\(selected\.component/);
});
