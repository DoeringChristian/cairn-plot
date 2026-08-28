/**
 * Pure unit tests for the capability-notice hint picker + storage-key scheme +
 * the three diagnosed limitation kinds. No test runner is configured in this
 * package, so this runs under Node's built-in test runner with TypeScript
 * type-stripping:
 *
 *   node --experimental-strip-types --test \
 *     src/primitives/components/capability-notice.test.ts
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
  noWebgpuKind,
  gpuUnavailableConsoleMessage,
  warnGpuUnavailable,
  __resetGpuUnavailableWarnedForTest,
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

test("limitMessage: four distinct diagnosed messages", () => {
  assert.match(limitMessage("no-webgpu"), /GPU renderer unavailable/);
  assert.match(limitMessage("no-webgpu-insecure"), /insecure origin/);
  assert.match(limitMessage("no-hdr-browser"), /fundamental browser limitation/);
  assert.match(limitMessage("no-hdr-display"), /display\/OS is not in HDR mode/);
  // All four are genuinely distinct strings.
  const msgs = new Set(
    (["no-webgpu", "no-webgpu-insecure", "no-hdr-browser", "no-hdr-display"] as CapabilityLimit[]).map(
      limitMessage,
    ),
  );
  assert.equal(msgs.size, 4);
});

test("noWebgpuKind: insecure origin (gpu hidden + not secure) vs unsupported browser", () => {
  // navigator.gpu is [SecureContext]-gated: absent + insecure ⇒ the ORIGIN
  // disabled it, a fixable misconfiguration.
  assert.equal(
    noWebgpuKind({ hasGpu: false, isSecureContext: false }),
    "no-webgpu-insecure",
  );
  // gpu absent on a SECURE origin ⇒ genuinely unsupported browser.
  assert.equal(noWebgpuKind({ hasGpu: false, isSecureContext: true }), "no-webgpu");
  // gpu PRESENT but init failed (e.g. requestAdapter returned null) ⇒ unsupported,
  // regardless of origin — the insecure-origin path only fires when gpu is hidden.
  assert.equal(noWebgpuKind({ hasGpu: true, isSecureContext: false }), "no-webgpu");
  assert.equal(noWebgpuKind({ hasGpu: true, isSecureContext: true }), "no-webgpu");
});

test("pickEnableHint: no-webgpu-insecure points at localhost/https (origin-fix, not browser)", () => {
  // Same origin-fix hint on every browser — the origin, not the browser, is wrong.
  for (const ua of [FIREFOX, SAFARI, CHROME_MAC, CHROME_WIN, CHROME_LINUX]) {
    const hint = pickEnableHint("no-webgpu-insecure", { userAgent: ua });
    assert.match(hint, /localhost/);
    assert.match(hint, /https/);
    assert.match(hint, /ssh -L/);
  }
  // And it must NOT hand out browser-enable steps (those are the no-webgpu path).
  assert.doesNotMatch(
    pickEnableHint("no-webgpu-insecure", { userAgent: FIREFOX }),
    /dom\.webgpu\.enabled/,
  );
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

test("gpuUnavailableConsoleMessage: two distinct console cases (insecure vs unsupported)", () => {
  const insecure = gpuUnavailableConsoleMessage("no-webgpu-insecure");
  assert.match(insecure, /not a secure context/);
  assert.match(insecure, /http:\/\/localhost or https/);
  const unsupported = gpuUnavailableConsoleMessage("no-webgpu");
  assert.match(unsupported, /unavailable in this browser/);
  assert.match(unsupported, /browser-support\.md/);
  assert.notEqual(insecure, unsupported);
  // Both are prefixed for greppability in the console.
  assert.match(insecure, /^cairn-plot: WebGPU is unavailable/);
  assert.match(unsupported, /^cairn-plot: WebGPU is unavailable/);
});

test("warnGpuUnavailable: classifies from env, and fires at most ONCE per page", () => {
  const orig = console.warn;
  const seen: string[] = [];
  console.warn = (...a: unknown[]) => void seen.push(String(a[0]));
  try {
    // (a) insecure origin: gpu hidden + not secure → the insecure console case.
    __resetGpuUnavailableWarnedForTest();
    seen.length = 0;
    let kind = warnGpuUnavailable({ hasGpu: false, isSecureContext: false });
    assert.equal(kind, "no-webgpu-insecure");
    assert.equal(seen.length, 1);
    assert.match(seen[0]!, /not a secure context/);
    // Once-per-page: a second call is suppressed (returns null, no extra warn).
    kind = warnGpuUnavailable({ hasGpu: false, isSecureContext: false });
    assert.equal(kind, null);
    assert.equal(seen.length, 1);

    // (b) unsupported browser: gpu hidden on a SECURE origin → the browser case.
    __resetGpuUnavailableWarnedForTest();
    seen.length = 0;
    kind = warnGpuUnavailable({ hasGpu: false, isSecureContext: true });
    assert.equal(kind, "no-webgpu");
    assert.equal(seen.length, 1);
    assert.match(seen[0]!, /unavailable in this browser/);

    // gpu PRESENT but init failed ⇒ unsupported (never the insecure case).
    __resetGpuUnavailableWarnedForTest();
    seen.length = 0;
    kind = warnGpuUnavailable({ hasGpu: true, isSecureContext: false });
    assert.equal(kind, "no-webgpu");
  } finally {
    console.warn = orig;
  }
});

test("capabilityNoticeStorageKey: namespaced by kind + pathname", () => {
  const kinds: CapabilityLimit[] = [
    "no-webgpu",
    "no-webgpu-insecure",
    "no-hdr-browser",
    "no-hdr-display",
  ];
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
