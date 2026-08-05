// ---------------------------------------------------------------------------
// Reference resolution — pure/data-only half of the media-compare reference
// machinery, extracted from ImageGalleryCard's baseline logic.
//
// The other half (react-query fetching of the reference sequence data) lives
// in card-kit (`components/card-kit/use-media-reference.ts`), which composes
// these pure functions. Together they are the "one hook/function family"
// spec-visual-compare.md calls for: cards must call this shared code, not
// keep a private per-card copy.
// ---------------------------------------------------------------------------

/** Minimal point shape needed to resolve an artifact at a step — matches
 *  api/types.SequencePoint's relevant fields without importing the API layer
 *  into cairn-plot (which stays app-agnostic). */
export interface StepArtifactPoint {
  step: number;
  artifact_hash?: string | null;
}

export type MissingArtifactMode = "nothing" | "last_available";

/**
 * Resolve the artifact hash to show at `targetStep` from a per-series step
 * map. Falls back to the most recent step at or before `targetStep` when
 * `mode !== "nothing"` (default: fall back). Moved verbatim from
 * ImageGalleryCard's `resolveArtifact` — this is now the ONLY implementation;
 * every artifact-at-step lookup in the image card (foreground image,
 * overlays, `series-same-step` reference, per-run `external` reference,
 * screenshot export) goes through this function.
 */
export function resolveArtifactAtStep<T extends StepArtifactPoint>(
  stepMap: Map<number, T>,
  targetStep: number,
  sortedSteps: number[],
  mode?: MissingArtifactMode,
): { hash: string | undefined; fallbackStep: number | null } {
  const exact = stepMap.get(targetStep);
  if (exact?.artifact_hash) return { hash: exact.artifact_hash, fallbackStep: null };
  if (mode === "nothing") return { hash: undefined, fallbackStep: null };
  for (let i = sortedSteps.length - 1; i >= 0; i--) {
    if (sortedSteps[i]! > targetStep) continue;
    const pt = stepMap.get(sortedSteps[i]!);
    if (pt?.artifact_hash) {
      return { hash: pt.artifact_hash, fallbackStep: pt.step };
    }
  }
  return { hash: undefined, fallbackStep: null };
}

/**
 * Resolve a reference by *position* (not step-matching): the Nth point of a
 * separately-tracked reference series, clamped to its own bounds. This is
 * the "external, global" resolution path — a single shared reference image
 * that tracks the step slider's *index*, not the foreground series' step
 * values (the reference series may have a different, unrelated step axis).
 */
export function resolveGlobalPositionalReference<T extends StepArtifactPoint>(
  points: T[],
  safeIdx: number,
): string | undefined {
  if (points.length === 0) return undefined;
  return points[Math.min(safeIdx, Math.max(0, points.length - 1))]?.artifact_hash ?? undefined;
}

/**
 * Resolve the reference *point* (not just its hash) to show at `targetStep`:
 * the largest point with `step <= targetStep`, falling back to the first
 * point when none qualifies (e.g. `targetStep` precedes the reference
 * series' own first logged step). `points` must be artifact-bearing and
 * sorted ascending by step (the scan short-circuits once it passes
 * `targetStep`). Returns `undefined` only for an empty input.
 *
 * This is the point-returning sibling of `resolveArtifactAtStep` (which
 * returns a hash) — a caller that needs the reference's own metadata (not
 * just its hash), e.g. a 3D card's compare-mode topology check reading the
 * reference `artifact_metadata`, resolves the point here and reads the field
 * it needs, sharing one resolution rule instead of a per-card copy.
 */
export function resolveArtifactPointAtStep<T extends StepArtifactPoint>(
  points: T[],
  targetStep: number,
): T | undefined {
  if (points.length === 0) return undefined;
  let best: T | undefined;
  for (const p of points) {
    if (p.step <= targetStep) best = p;
    else break;
  }
  return best ?? points[0];
}

// ---------------------------------------------------------------------------
// Reference resolution DISPATCH — the pure/data-only half of the global-vs-
// per-run + external + series-same-step decision, extracted verbatim in
// behavior from `card-kit/use-media-reference.ts`. The app hook keeps the
// react-query fetching (which run/tag to fetch, refetch intervals) and the
// artifact-hash filtering; it hands the ALREADY-FETCHED candidate data plus
// the persisted policy to this function, which decides which candidate wins
// per pane. No react-query / API concept enters here.
// ---------------------------------------------------------------------------

/**
 * The persisted reference policy, condensed to the fields the resolution
 * DISPATCH actually branches on. Mirrors `ReferenceSelection` but split into
 * the two independent axes the image/3D cards persist today:
 *  - an optional `external` tag with a `global | per-run` scope, and
 *  - a `series-same-step` fallback (`seriesBaselineIndex`), optionally pinned
 *    to `seriesBaselineFixedStep`.
 */
export interface ReferenceResolutionPolicy {
  /** True when an external reference tag is set (a series not among the
   *  card's own loaded series). When false, `externalScope` is ignored and
   *  resolution falls through to the `seriesBaselineIndex` baseline — this is
   *  the gate that keeps a STALE persisted `externalScope: "per-run"` (whose
   *  tag was cleared) from hiding an otherwise-valid series baseline. */
  hasExternal: boolean;
  /** How an external tag resolves: "global" = one positional reference shared
   *  by every pane; "per-run" = each pane resolves its own step-matched copy. */
  externalScope: "global" | "per-run";
  /** series-same-step fallback: index into the card's own series list, or
   *  `undefined` for "no series baseline" (then `globalHash` is undefined
   *  unless an external-global tag supplies it). */
  seriesBaselineIndex?: number;
  /** Pins the series-same-step baseline to an explicit step instead of
   *  tracking `currentStep` 1:1 (`ReferenceSelection.source === "fixed-step"`). */
  seriesBaselineFixedStep?: number;
}

/**
 * The already-fetched, already-artifact-filtered candidate data the dispatch
 * chooses between. The app hook builds these from its react-query results.
 */
export interface ReferenceResolutionData<T extends StepArtifactPoint> {
  /** external "global": the external series' own points (positional axis). */
  externalPoints: T[];
  /** external "per-run": each pane's own fetched external points, index-
   *  aligned with the card's rendered panes. */
  perPaneExternalPoints: T[][];
  /** series-same-step fallback: the step→point map for the chosen baseline
   *  series (`perSeriesStepMap[seriesBaselineIndex]`). */
  seriesStepMap: Map<number, T>;
  /** series-same-step fallback: the chosen baseline series' sorted step list. */
  seriesSteps: number[];
}

export interface ReferenceResolutionContext {
  /** The primary series' live current step (drives step-matched resolution). */
  currentStep: number;
  /** The step slider's *index* (drives external-global positional resolution). */
  safeIdx: number;
  /** Missing-artifact fallback policy for step-matched resolution. */
  missingMode?: MissingArtifactMode;
}

export interface ResolvedReferenceHashes {
  /** The single shared reference hash: external-global (positional) when an
   *  external tag is set with global scope, else the series-same-step
   *  baseline. Broadcast to every pane by `perPaneHash` in every case except
   *  external "per-run". */
  globalHash: string | undefined;
  /** The reference hash for one pane: external "per-run" resolves that pane's
   *  own step-matched copy; every other case broadcasts `globalHash`. */
  perPaneHash: (paneIdx: number) => string | undefined;
}

/**
 * Pure reference-resolution dispatch. Given the persisted `policy`, the
 * already-fetched candidate `data`, and the live `ctx`, decide which
 * reference hash each pane shows — the exact branching the pre-extraction
 * `useMediaReference` performed, with zero data-fetching. See the module doc
 * comment above for the app/lib split.
 */
export function resolveReferenceHashes<T extends StepArtifactPoint>(
  policy: ReferenceResolutionPolicy,
  data: ReferenceResolutionData<T>,
  ctx: ReferenceResolutionContext,
): ResolvedReferenceHashes {
  const usingPerRunExternal = policy.hasExternal && policy.externalScope === "per-run";

  let globalHash: string | undefined;
  if (policy.hasExternal && policy.externalScope === "global") {
    globalHash = resolveGlobalPositionalReference(data.externalPoints, ctx.safeIdx);
  } else if (policy.seriesBaselineIndex != null) {
    globalHash = resolveArtifactAtStep(
      data.seriesStepMap,
      policy.seriesBaselineFixedStep ?? ctx.currentStep,
      data.seriesSteps,
      ctx.missingMode,
    ).hash;
  }

  const perPaneHash = (paneIdx: number): string | undefined => {
    if (!usingPerRunExternal) return globalHash;
    const points = data.perPaneExternalPoints[paneIdx] ?? [];
    if (points.length === 0) return undefined;
    const stepMap = new Map<number, T>();
    for (const p of points) stepMap.set(p.step, p);
    const steps = points.map((p) => p.step);
    return resolveArtifactAtStep(stepMap, ctx.currentStep, steps, ctx.missingMode).hash;
  };

  return { globalHash, perPaneHash };
}

// ---------------------------------------------------------------------------
// Reference selection — the {source} contract from spec-visual-compare.md.
// ---------------------------------------------------------------------------

/**
 * Where the reference (baseline) comes from:
 *  - "series-same-step": another series already loaded on the card (picked
 *    by index), evaluated at the SAME step as the foreground — one shared
 *    reference broadcast to every pane. Covers today's `baselineIndex`.
 *  - "fixed-step": like "series-same-step", but pinned to an explicit step
 *    instead of tracking the live step slider. Covers the (currently
 *    unwired) `perRunBaselineStep` field — modeled here so a future UI can
 *    turn it on without a second resolution implementation.
 *  - "external": a series NOT among the card's loaded series (a dragged-in
 *    tag / different metric name), resolved with an explicit `scope`:
 *      - "global": positional (`resolveGlobalPositionalReference`) — one
 *        shared reference image for every pane.
 *      - "per-run": each run fetches its own copy of the same tag name and
 *        resolves it step-matched (`resolveArtifactAtStep`) — a per-pane
 *        reference.
 */
export type ReferenceSource = "series-same-step" | "fixed-step" | "external";

export interface ReferenceSelection {
  source: ReferenceSource;
  /** source === "series-same-step" | "fixed-step": index into the card's own series list. */
  seriesIndex?: number;
  /** source === "fixed-step": resolve at this step instead of the live current step. */
  fixedStep?: number;
  /** source === "external": which scope resolves the tag (see ReferenceSource docs). */
  externalScope?: "global" | "per-run";
}
