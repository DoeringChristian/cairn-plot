/**
 * Pure unit tests for the capability-notice hint picker + storage-key scheme.
 * No test runner is configured in this package, so this runs under Node's
 * built-in test runner with TypeScript type-stripping:
 *
 *   node --experimental-strip-types --test \
 *     src/lib/cairn-plot/primitives/capability-notice.test.ts
 *
 * Only the DOM-free pure exports are exercised here (`detectBrowser`,
 * `pickEnableHint`, `capabilityNoticeStorageKey`); the banner-mount path is
 * DOM and covered by manual/browser verification.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  detectBrowser,
  pickEnableHint,
  capabilityNoticeStorageKey,
  type CapabilityLimit,
} from "./capability-notice.ts";

const FIREFOX =
  "Mozilla/5.0 (X11; Linux x86_64; rv:141.0) Gecko/20100101 Firefox/141.0";
const SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
const CHROME_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const CHROME_LINUX =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

test("detectBrowser: Brave flag wins over its Chrome-like UA", () => {
  assert.equal(detectBrowser(CHROME_MAC, true), "brave");
  assert.equal(detectBrowser(CHROME_LINUX, true), "brave");
});

test("detectBrowser: Firefox / Safari / Chromium / Chromium-Linux", () => {
  assert.equal(detectBrowser(FIREFOX), "firefox");
  assert.equal(detectBrowser(SAFARI), "safari");
  assert.equal(detectBrowser(CHROME_MAC), "chromium");
  assert.equal(detectBrowser(CHROME_LINUX), "chromium-linux");
});

test("detectBrowser: Safari markers do not misclassify Chrome (has 'Safari' too)", () => {
  assert.notEqual(detectBrowser(CHROME_MAC), "safari");
});

test("pickEnableHint: Firefox hint states the HDR browser-limitation inline", () => {
  const hint = pickEnableHint("no-hdr", { userAgent: FIREFOX });
  assert.match(hint, /dom\.webgpu\.enabled/);
  assert.match(hint, /HDR output is not available in Firefox/);
});

test("pickEnableHint: Safari + Brave + Chromium-Linux hints", () => {
  assert.match(pickEnableHint("no-webgpu", { userAgent: SAFARI }), /Feature Flags → WebGPU/);
  assert.match(pickEnableHint("no-webgpu", { userAgent: CHROME_MAC, isBrave: true }), /Shields/);
  assert.match(
    pickEnableHint("no-webgpu", { userAgent: CHROME_LINUX }),
    /enable-unsafe-webgpu/,
  );
});

test("pickEnableHint: default Chromium differs by kind", () => {
  assert.match(pickEnableHint("no-hdr", { userAgent: CHROME_MAC }), /requires an HDR display/);
  assert.match(pickEnableHint("no-webgpu", { userAgent: CHROME_MAC }), /enable-unsafe-webgpu/);
});

test("capabilityNoticeStorageKey: namespaced by kind + pathname", () => {
  const kinds: CapabilityLimit[] = ["no-webgpu", "no-hdr"];
  for (const kind of kinds) {
    assert.equal(
      capabilityNoticeStorageKey(kind, "/examples/rendered/gallery.html"),
      `cairn-plot:capnotice:${kind}:/examples/rendered/gallery.html`,
    );
  }
  // Distinct pages get distinct keys (per-page dismissal).
  assert.notEqual(
    capabilityNoticeStorageKey("no-hdr", "/a.html"),
    capabilityNoticeStorageKey("no-hdr", "/b.html"),
  );
});
