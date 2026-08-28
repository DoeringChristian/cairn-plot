import assert from "node:assert/strict";
import test from "node:test";

import { SharedDeviceProvider } from "./device-provider.ts";

test("shared device provider deduplicates concurrent acquisition", async () => {
  let creates = 0;
  const device = { destroy() {} };
  const provider = new SharedDeviceProvider(async () => { creates++; return device; });
  const [a, b] = await Promise.all([provider.get(), provider.get()]);
  assert.equal(a, device);
  assert.equal(b, device);
  assert.equal(creates, 1);
});

test("reset disposes a resolved device and permits recreation", async () => {
  let creates = 0;
  let destroys = 0;
  const provider = new SharedDeviceProvider(async () => ({
    id: ++creates,
    destroy() { destroys++; },
  }));
  assert.equal((await provider.get()).id, 1);
  provider.reset();
  await Promise.resolve();
  assert.equal(destroys, 1);
  assert.equal((await provider.get()).id, 2);
});

test("a rejected generation can be reset and retried", async () => {
  let attempts = 0;
  const provider = new SharedDeviceProvider(async () => {
    if (++attempts === 1) throw new Error("lost during startup");
    return { destroy() {} };
  });
  await assert.rejects(provider.get(), /lost during startup/);
  provider.reset();
  await provider.get();
  assert.equal(attempts, 2);
});
