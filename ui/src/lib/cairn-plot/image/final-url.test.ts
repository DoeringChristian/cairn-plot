/**
 * `resolveFinalUrl` — content-addressing under live / redirecting query URLs.
 *
 * The integration cases stand up a tiny local HTTP server that mimics the
 * design's query→digest 302 (`/q` → `302 Location: /digest/<id>` →
 * `/api/artifacts/{digest}` shape) to PROVE the caching consequence: keying on
 * the FINAL (post-redirect) URL means two resolutions of the SAME query URL
 * that redirect to DIFFERENT digests get DIFFERENT cache identities (no stale
 * hit), while the SAME digest yields the SAME identity (cache hit / dedup).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { resolveFinalUrl } from "./final-url.ts";

/** Start a server whose `/q` 302-redirects to `/digest/<current target>`.
 *  `state.target` is mutable so a test can move "latest" to a new digest. */
async function startRedirectServer(state: { target: string }): Promise<{
  base: string;
  server: Server;
  close: () => Promise<void>;
}> {
  const server = createServer((req, res) => {
    const url = req.url ?? "/";
    // The digest endpoint: content-addressed, serves bytes (HEAD + GET).
    if (url.startsWith("/digest/")) {
      res.writeHead(200, { "content-type": "image/png", "content-length": "3" });
      res.end(req.method === "HEAD" ? undefined : "PNG");
      return;
    }
    // The query endpoint: 302 to the current digest (HEAD + GET alike).
    if (url.startsWith("/q")) {
      res.writeHead(302, { location: `/digest/${state.target}` });
      res.end();
      return;
    }
    // A plain, non-redirecting static asset.
    if (url.startsWith("/static/")) {
      res.writeHead(200, { "content-type": "image/png", "content-length": "3" });
      res.end(req.method === "HEAD" ? undefined : "PNG");
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;
  return {
    base,
    server,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

test("non-http schemes are returned unchanged with no fetch", async () => {
  // A data: URL is self-contained and never redirects — no probe, byte-identical.
  const data = "data:image/png;base64,iVBORw0KGgo=";
  assert.equal(await resolveFinalUrl(data), data);
  assert.equal(await resolveFinalUrl("blob:https://x/y"), "blob:https://x/y");
});

test("a non-redirecting http URL resolves to itself (byte-for-byte identity)", async () => {
  const { base, close } = await startRedirectServer({ target: "unused" });
  try {
    const u = `${base}/static/a.png`;
    assert.equal(await resolveFinalUrl(u), u);
  } finally {
    await close();
  }
});

test("a redirecting query URL resolves to its final digest URL", async () => {
  const { base, close } = await startRedirectServer({ target: "abc" });
  try {
    assert.equal(await resolveFinalUrl(`${base}/q?run=latest`), `${base}/digest/abc`);
  } finally {
    await close();
  }
});

test("same query URL, DIFFERENT redirect targets → DIFFERENT cache identities (no stale hit); same target → cache hit", async () => {
  const state = { target: "abc" };
  const { base, close } = await startRedirectServer(state);
  // Model the URL-keyed image cache: identity == the resolved (final) URL.
  const cache = new Map<string, string>();
  const resolveInto = async (queryUrl: string): Promise<{ id: string; hit: boolean }> => {
    const id = await resolveFinalUrl(queryUrl);
    const hit = cache.has(id);
    if (!hit) cache.set(id, "decoded-pixels");
    return { id, hit };
  };
  try {
    const q = `${base}/q?run=latest&tag=render`;

    // First resolve → digest abc, cold miss.
    const first = await resolveInto(q);
    assert.equal(first.id, `${base}/digest/abc`);
    assert.equal(first.hit, false);

    // "latest" moves to a new digest → SAME query URL, DIFFERENT identity → MISS
    // (the whole point: no stale pixels served for the superseded digest).
    state.target = "def";
    const second = await resolveInto(q);
    assert.equal(second.id, `${base}/digest/def`);
    assert.notEqual(second.id, first.id);
    assert.equal(second.hit, false);

    // "latest" resolves back to the original digest → SAME identity → HIT (the
    // content-addressed cache dedups across queries for free).
    state.target = "abc";
    const third = await resolveInto(q);
    assert.equal(third.id, first.id);
    assert.equal(third.hit, true);
  } finally {
    await close();
  }
});

test("a failed probe (unreachable host / non-2xx) falls back to the original URL", async () => {
  // Unreachable port → fetch rejects for both HEAD and GET → raw URL preserved,
  // so a cross-origin/opaque URL still renders via <img src> exactly as today.
  const u = "http://127.0.0.1:1/never";
  assert.equal(await resolveFinalUrl(u), u);

  // A 404 (non-2xx) is not a valid content address → fall back to the request URL.
  const { base, close } = await startRedirectServer({ target: "abc" });
  try {
    const missing = `${base}/nope`;
    assert.equal(await resolveFinalUrl(missing), missing);
  } finally {
    await close();
  }
});
