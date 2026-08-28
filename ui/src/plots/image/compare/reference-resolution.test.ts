/**
 * Pure reference-resolution DISPATCH cases (the app-agnostic half absorbed
 * from `card-kit/use-media-reference.ts` + `use-compare-reference-meta.ts`).
 *
 *   node --experimental-strip-types --test \
 *     src/plots/image/compare/reference-resolution.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveArtifactPointAtStep,
  resolveReferenceHashes,
  type ReferenceResolutionData,
  type ReferenceResolutionPolicy,
  type StepArtifactPoint,
} from "./reference.ts";

type P = StepArtifactPoint & { artifact_hash?: string };

const externalPoints: P[] = [
  { step: 0, artifact_hash: "e0" },
  { step: 5, artifact_hash: "e5" },
  { step: 9, artifact_hash: "e9" },
];

const seriesPoints: P[] = [
  { step: 0, artifact_hash: "s0" },
  { step: 10, artifact_hash: "s10" },
];
const seriesStepMap = new Map<number, P>(seriesPoints.map((p) => [p.step, p]));
const seriesSteps = seriesPoints.map((p) => p.step);

/** Base data with both a series baseline and empty external candidates —
 *  individual tests override the relevant slice. */
function baseData(over: Partial<ReferenceResolutionData<P>> = {}): ReferenceResolutionData<P> {
  return {
    externalPoints: [],
    perPaneExternalPoints: [],
    seriesStepMap,
    seriesSteps,
    ...over,
  };
}

test("external + global → positional hash, broadcast to every pane", () => {
  const policy: ReferenceResolutionPolicy = { hasExternal: true, externalScope: "global" };
  const r = resolveReferenceHashes(policy, baseData({ externalPoints }), {
    currentStep: 3,
    safeIdx: 1,
  });
  assert.equal(r.globalHash, "e5", "safeIdx 1 → 2nd external point");
  assert.equal(r.perPaneHash(0), "e5", "global broadcasts to pane 0");
  assert.equal(r.perPaneHash(7), "e5", "global broadcasts to any pane index");
});

test("external + global clamps safeIdx past the end", () => {
  const policy: ReferenceResolutionPolicy = { hasExternal: true, externalScope: "global" };
  const r = resolveReferenceHashes(policy, baseData({ externalPoints }), {
    currentStep: 0,
    safeIdx: 99,
  });
  assert.equal(r.globalHash, "e9", "clamped to last external point");
});

test("series-same-step → step-matched baseline (exact + fallback)", () => {
  const policy: ReferenceResolutionPolicy = {
    hasExternal: false,
    externalScope: "global",
    seriesBaselineIndex: 0,
  };
  const exact = resolveReferenceHashes(policy, baseData(), { currentStep: 10, safeIdx: 0 });
  assert.equal(exact.globalHash, "s10", "exact step hit");

  const fallback = resolveReferenceHashes(policy, baseData(), { currentStep: 5, safeIdx: 0 });
  assert.equal(fallback.globalHash, "s0", "no artifact at 5 → last available (step 0)");

  const strict = resolveReferenceHashes(policy, baseData(), {
    currentStep: 5,
    safeIdx: 0,
    missingMode: "nothing",
  });
  assert.equal(strict.globalHash, undefined, "missingMode 'nothing' suppresses fallback");
});

test("fixed-step pins the series baseline to an explicit step", () => {
  const policy: ReferenceResolutionPolicy = {
    hasExternal: false,
    externalScope: "global",
    seriesBaselineIndex: 0,
    seriesBaselineFixedStep: 10,
  };
  // currentStep is 5 but the fixed step (10) wins.
  const r = resolveReferenceHashes(policy, baseData(), { currentStep: 5, safeIdx: 0 });
  assert.equal(r.globalHash, "s10", "resolves at fixedStep, ignoring currentStep");
});

test("external + per-run → each pane resolves its OWN step-matched copy", () => {
  const policy: ReferenceResolutionPolicy = { hasExternal: true, externalScope: "per-run" };
  const perPaneExternalPoints: P[][] = [
    [
      { step: 0, artifact_hash: "run0@0" },
      { step: 10, artifact_hash: "run0@10" },
    ],
    [{ step: 0, artifact_hash: "run1@0" }],
    [], // pane 2 has no reference data yet
  ];
  const r = resolveReferenceHashes(policy, baseData({ perPaneExternalPoints }), {
    currentStep: 10,
    safeIdx: 0,
  });
  assert.equal(r.perPaneHash(0), "run0@10", "pane 0 own series, exact step");
  assert.equal(r.perPaneHash(1), "run1@0", "pane 1 own series, fallback to step 0");
  assert.equal(r.perPaneHash(2), undefined, "pane 2 has no candidate → undefined");
});

test("gate: stale externalScope='per-run' with NO external tag still shows the series baseline", () => {
  // Regression guard for the exact bug the app comment documents: a persisted
  // externalScope that outlived its (now-cleared) external tag must NOT hide
  // the series-same-step fallback.
  const policy: ReferenceResolutionPolicy = {
    hasExternal: false, // tag was cleared
    externalScope: "per-run", // but scope is stale
    seriesBaselineIndex: 0,
  };
  const r = resolveReferenceHashes(policy, baseData(), { currentStep: 10, safeIdx: 0 });
  assert.equal(r.globalHash, "s10", "series baseline still resolves");
  assert.equal(r.perPaneHash(0), "s10", "and is broadcast, not shadowed by the stale scope");
  assert.equal(r.perPaneHash(3), "s10");
});

test("no external + no series baseline → undefined everywhere", () => {
  const policy: ReferenceResolutionPolicy = { hasExternal: false, externalScope: "global" };
  const r = resolveReferenceHashes(policy, baseData(), { currentStep: 10, safeIdx: 0 });
  assert.equal(r.globalHash, undefined);
  assert.equal(r.perPaneHash(0), undefined);
});

test("resolveArtifactPointAtStep returns the point (for metadata reads), with fallback", () => {
  assert.equal(resolveArtifactPointAtStep(seriesPoints, 10)?.artifact_hash, "s10", "exact");
  assert.equal(resolveArtifactPointAtStep(seriesPoints, 7)?.artifact_hash, "s0", "largest <= step");
  assert.equal(
    resolveArtifactPointAtStep(seriesPoints, -5)?.artifact_hash,
    "s0",
    "before first step → first point fallback (not undefined)",
  );
  assert.equal(resolveArtifactPointAtStep([], 3), undefined, "empty → undefined");
});
