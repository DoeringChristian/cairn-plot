/**
 * Pure unit tests for the P2 lazy/eager mount decision (`lazy-mount.ts`). No
 * test runner is configured in this package, so this runs under Node's built-in
 * test runner with TypeScript type-stripping:
 *
 *   node --experimental-strip-types --test \
 *     src/host/lazy-mount.test.ts
 *
 * Only the DOM-free pure exports are exercised (`isEagerMount`,
 * `hasEagerQueryParam`); the observer-driven `LazyGate` is DOM and covered by
 * the gallery smoke harness (which loads the page with `?eager=1`).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isEagerMount,
  hasEagerQueryParam,
  shouldRetryObserve,
  LAZY_OBSERVE_RETRY_FRAMES,
} from "./lazy-mount.ts";

test("hasEagerQueryParam: truthy forms are eager", () => {
  assert.equal(hasEagerQueryParam("?eager=1"), true);
  assert.equal(hasEagerQueryParam("?eager"), true); // bare flag
  assert.equal(hasEagerQueryParam("?eager="), true); // empty value
  assert.equal(hasEagerQueryParam("?eager=true"), true);
  assert.equal(hasEagerQueryParam("?eager=TRUE"), true); // case-insensitive
  assert.equal(hasEagerQueryParam("?foo=1&eager=1"), true); // among others
});

test("hasEagerQueryParam: absent or falsy forms are lazy", () => {
  assert.equal(hasEagerQueryParam(""), false);
  assert.equal(hasEagerQueryParam(null), false);
  assert.equal(hasEagerQueryParam(undefined), false);
  assert.equal(hasEagerQueryParam("?foo=1"), false);
  assert.equal(hasEagerQueryParam("?eager=0"), false);
  assert.equal(hasEagerQueryParam("?eager=false"), false);
});

test("hasEagerQueryParam: tolerates a missing leading '?'", () => {
  assert.equal(hasEagerQueryParam("eager=1"), true);
  assert.equal(hasEagerQueryParam("foo=1"), false);
});

test("isEagerMount: window flag forces eager", () => {
  assert.equal(isEagerMount({ windowFlag: true }), true);
  // only strict `true` — a stray truthy value must NOT force eager.
  assert.equal(isEagerMount({ windowFlag: 1 }), false);
  assert.equal(isEagerMount({ windowFlag: "yes" }), false);
  assert.equal(isEagerMount({ windowFlag: false }), false);
  assert.equal(isEagerMount({ windowFlag: undefined }), false);
});

test("isEagerMount: print media forces eager", () => {
  assert.equal(isEagerMount({ printMedia: true }), true);
  assert.equal(isEagerMount({ printMedia: false }), false);
});

test("isEagerMount: query param forces eager", () => {
  assert.equal(isEagerMount({ search: "?eager=1" }), true);
  assert.equal(isEagerMount({ search: "?eager=0" }), false);
  assert.equal(isEagerMount({ search: "?src=foo" }), false);
});

test("isEagerMount: no signals → lazy", () => {
  assert.equal(isEagerMount({}), false);
  assert.equal(
    isEagerMount({ search: "", windowFlag: undefined, printMedia: false }),
    false,
  );
});

test("isEagerMount: any single hatch is sufficient", () => {
  assert.equal(
    isEagerMount({ search: "?x=1", windowFlag: false, printMedia: true }),
    true,
  );
  assert.equal(
    isEagerMount({ search: "?eager=1", windowFlag: false, printMedia: false }),
    true,
  );
});

// ---------------------------------------------------------------------------
// H13 — the gate's bounded observer-attach retry. `LazyGate` used to attach its
// IntersectionObserver exactly once, in an effect keyed only on `mounted`: when
// `placeholderRef.current` was still null at that moment the effect returned
// early and nothing ever re-ran it, so the pane stayed a blank placeholder for
// the life of the page. Only the bounded-retry DECISION is pure and tested
// here; the observer/ResizeObserver wiring itself is DOM and is covered by the
// self-driving compare-grid harness (CP4).
// ---------------------------------------------------------------------------

test("shouldRetryObserve: retries up to the bound, then stops", () => {
  assert.equal(LAZY_OBSERVE_RETRY_FRAMES, 10);
  assert.equal(shouldRetryObserve(0), true, "the first miss retries");
  assert.equal(shouldRetryObserve(LAZY_OBSERVE_RETRY_FRAMES - 1), true, "the last allowed attempt");
  assert.equal(shouldRetryObserve(LAZY_OBSERVE_RETRY_FRAMES), false, "bounded — never spins forever");
  assert.equal(shouldRetryObserve(LAZY_OBSERVE_RETRY_FRAMES + 5), false);
});

test("shouldRetryObserve: honours an explicit bound and rejects nonsense counts", () => {
  assert.equal(shouldRetryObserve(2, 3), true);
  assert.equal(shouldRetryObserve(3, 3), false);
  assert.equal(shouldRetryObserve(0, 0), false);
  assert.equal(shouldRetryObserve(-1), false);
  assert.equal(shouldRetryObserve(Number.NaN), false);
  assert.equal(shouldRetryObserve(Number.POSITIVE_INFINITY), false);
});
