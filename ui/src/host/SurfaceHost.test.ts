import assert from "node:assert/strict";
import test from "node:test";

import type { BackendInput, PlotBackend, RenderEnvironment } from "../backends/contracts.ts";
import { SurfaceHost, selectBackend } from "./SurfaceHost.ts";

interface Presentation { family: string; value: number }
interface Settings { exposure: number }

const environment: RenderEnvironment = { webgpu: true, webgl2: true, pixelRatio: 2 };

function backend(id: string, priority: number, events: string[]): PlotBackend<Presentation, Settings> {
  return {
    id,
    family: id,
    technology: "webgpu",
    supports: () => ({ supported: true, priority }),
    canReuse: (previous, next) => previous.family === next.family,
    mount: (_surface, input) => {
      events.push(`mount:${id}:${input.presentation.value}`);
      return {
        update(next: BackendInput<Presentation, Settings>) {
          events.push(`update:${id}:${next.presentation.value}`);
        },
        destroy() { events.push(`destroy:${id}`); },
      };
    },
  };
}

test("selectBackend chooses the highest supported priority", () => {
  const events: string[] = [];
  const low = backend("low", 1, events);
  const high = backend("high", 10, events);
  assert.equal(selectBackend([low, high], { family: "image", value: 1 }, environment), high);
});

test("compatible presentations update one retained backend instance", () => {
  const events: string[] = [];
  const host = new SurfaceHost({
    element: {} as HTMLElement,
    backends: [backend("gpu", 10, events)],
    environment,
  });
  host.commit({ family: "image", value: 1 }, { exposure: 0 }, "content");
  host.commit({ family: "image", value: 2 }, { exposure: 1 }, "presentation");
  assert.deepEqual(events, ["mount:gpu:1", "update:gpu:2"]);
  host.destroy();
  host.destroy();
  assert.deepEqual(events, ["mount:gpu:1", "update:gpu:2", "destroy:gpu"]);
});

test("incompatible presentation remounts without replacing the host element", () => {
  const events: string[] = [];
  const host = new SurfaceHost({
    element: {} as HTMLElement,
    backends: [backend("gpu", 10, events)],
    environment,
  });
  host.commit({ family: "image", value: 1 }, { exposure: 0 }, "content");
  host.commit({ family: "mesh", value: 2 }, { exposure: 0 }, "remount");
  assert.deepEqual(events, ["mount:gpu:1", "destroy:gpu", "mount:gpu:2"]);
});
