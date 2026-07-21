/**
 * Pure unit tests for the capability-notice hint picker + storage-key scheme +
 * the three diagnosed limitation kinds. No test runner is configured in this
 * package, so this runs under Node's built-in test runner with TypeScript
 * type-stripping:
 *
 *   node --experimental-strip-types --test \
 *     src/lib/cairn-plot/primitives/capability-notice.test.ts
 *
 * Only the DOM-free pure exports are exercised here (`detectBrowser`,
 * `detectOS`, `pickEnableHint`, `limitMessage`, `capabilityNoticeStorageKey`);
 * the banner-mount path is DOM and covered by manual/browser verification.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  detectBrowser,
  detectOS,
  pickEnableHint,
  limitMessage,
  capabilityNoticeStorageKey,
  type CapabilityLimit,
} from "./capability-notice.ts";

const FIREFOX =
  "Mozilla/5.0 (X11; Linux x86_64; rv:141.0) Gecko/20100101 Firefox/141.0";
const FIREFOX_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:141.0) Gecko/20100101 Firefox/141.0";
const SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
const CHROME_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const CHROME_WIN =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
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

test("detectOS: macOS / Windows / other", () => {
  assert.equal(detectOS(CHROME_MAC), "macos");
  assert.equal(detectOS(SAFARI), "macos");
  assert.equal(detectOS(CHROME_WIN), "windows");
  assert.equal(detectOS(CHROME_LINUX), "other");
});

test("limitMessage: three distinct diagnosed messages", () => {
  assert.match(limitMessage("no-webgpu"), /GPU renderer unavailable/);
  assert.match(limitMessage("no-hdr-browser"), /fundamental browser limitation/);
  assert.match(limitMessage("no-hdr-display"), /display\/OS is not in HDR mode/);
  // All three are genuinely distinct strings.
  const msgs = new Set(
    (["no-webgpu", "no-hdr-browser", "no-hdr-display"] as CapabilityLimit[]).map(limitMessage),
  );
  assert.equal(msgs.size, 3);
});

test("pickEnableHint: no-webgpu is browser-specific (WebGPU enable steps)", () => {
  assert.match(pickEnableHint("no-webgpu", { userAgent: FIREFOX }), /dom\.webgpu\.enabled/);
  assert.match(pickEnableHint("no-webgpu", { userAgent: SAFARI }), /Feature Flags → WebGPU/);
  assert.match(pickEnableHint("no-webgpu", { userAgent: CHROME_MAC, isBrave: true }), /Shields/);
  assert.match(pickEnableHint("no-webgpu", { userAgent: CHROME_LINUX }), /enable-unsafe-webgpu/);
  assert.match(pickEnableHint("no-webgpu", { userAgent: CHROME_MAC }), /enable-unsafe-webgpu/);
});

test("pickEnableHint: no-hdr-browser states a BROWSER limitation, per browser", () => {
  const ff = pickEnableHint("no-hdr-browser", { userAgent: FIREFOX_MAC });
  assert.match(ff, /Firefox/);
  assert.match(ff, /fundamental browser limitation/);
  assert.match(pickEnableHint("no-hdr-browser", { userAgent: SAFARI }), /Safari/);
  assert.match(pickEnableHint("no-hdr-browser", { userAgent: CHROME_MAC }), /129\+/);
});

test("pickEnableHint: no-hdr-display gives an OS/display HDR hint, per OS", () => {
  assert.match(pickEnableHint("no-hdr-display", { userAgent: CHROME_MAC }), /macOS: EDR/);
  assert.match(pickEnableHint("no-hdr-display", { userAgent: CHROME_WIN }), /Use HDR/);
  assert.match(pickEnableHint("no-hdr-display", { userAgent: CHROME_LINUX }), /display and OS settings/);
});

test("pickEnableHint: display sub-case ignores browser, browser sub-case ignores OS", () => {
  // no-hdr-display hint is OS-driven even on a browser we could name.
  assert.match(pickEnableHint("no-hdr-display", { userAgent: FIREFOX_MAC }), /macOS/);
  // no-hdr-browser hint is browser-driven even on an HDR-capable OS.
  assert.match(pickEnableHint("no-hdr-browser", { userAgent: FIREFOX_MAC }), /Firefox/);
});

test("capabilityNoticeStorageKey: namespaced by kind + pathname", () => {
  const kinds: CapabilityLimit[] = ["no-webgpu", "no-hdr-browser", "no-hdr-display"];
  for (const kind of kinds) {
    assert.equal(
      capabilityNoticeStorageKey(kind, "/examples/rendered/gallery.html"),
      `cairn-plot:capnotice:${kind}:/examples/rendered/gallery.html`,
    );
  }
  // Distinct pages get distinct keys (per-page dismissal).
  assert.notEqual(
    capabilityNoticeStorageKey("no-hdr-browser", "/a.html"),
    capabilityNoticeStorageKey("no-hdr-browser", "/b.html"),
  );
  // Distinct kinds on the same page get distinct keys.
  assert.notEqual(
    capabilityNoticeStorageKey("no-hdr-browser", "/a.html"),
    capabilityNoticeStorageKey("no-hdr-display", "/a.html"),
  );
});
