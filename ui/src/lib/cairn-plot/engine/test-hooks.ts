/**
 * Fault-injection test hook (browser harness only) — a `?forceEngineFail`
 * URL-param convention (`URLSearchParams` check, "current page URL, read
 * fresh on every call" semantics — no memoization, so a test can
 * navigate/reload between assertions without stale state).
 *
 * When the page URL carries `?forceEngineFail`, `engine/pool.ts`'s
 * `activateEntry()` and `media-compare/GpuComparePane.tsx`'s device/surface
 * acquisition both throw synthetically instead of touching real GPU
 * resources — deterministically exercising the C1 hard-failure path (any
 * GPU init failure, e.g. driver/context exhaustion) without needing to
 * actually exhaust a real GPU resource cap. This is also the mechanism used
 * to exercise the capability-gate + C1-error-boundary fallback to the
 * legacy CPU pane (see `plot-renderers.tsx`'s `resolveImageRenderer`).
 *
 * See `renderers/__tests__/engine-fallback.browser.ts` for the fault
 * injection + legacy-fallback assertions this hook exists for.
 */
export function forceEngineFailRequested(): boolean {
  if (typeof location === "undefined") return false;
  try {
    return new URLSearchParams(location.search).has("forceEngineFail");
  } catch {
    return false;
  }
}

/**
 * PER-PRESENT RENDER LOG (browser harness only) — records the GROUND-TRUTH
 * (bound source keys, content-op id, display mode) of EVERY actual GPU present
 * the pool performs (`engine/pool.ts`'s `attemptRender`/`attemptRenderDiffCached`).
 *
 * Its purpose is the present-coherency proof (the stacked-diff-flip STRESS
 * harness): under rapid image↔diff flipping a present can slip through with a
 * MISMATCHED combination — e.g. an image-mode blit while the pool's primary
 * texture is still the diff's keyed reference (`sourceKey === "flip:ref"`), or
 * a diff blit before the foreground slot's `sourceBKey` caught up. Because this
 * log captures what the pool ACTUALLY had bound at the moment of each present
 * (not the pane's React intent), the harness can flag any present whose bound
 * keys don't match the slot it belongs to — the objective artefact signal, with
 * no reliance on flaky mid-present canvas readback.
 *
 * Off by default (a single null check on the pool hot path); a harness calls
 * {@link startPaneRenderLog} to begin capturing. Never used by production code.
 */
export interface PaneRenderRecord {
  /** "image" (plain / direct-op blit via `attemptRender`) or "cached-diff"
   *  (FLIP/HDR-FLIP/SSIM via `attemptRenderDiffCached`). */
  mode: "image" | "cached-diff";
  /** The pool entry's CURRENTLY-BOUND primary source key (`entry.sourceKey`) —
   *  the retention key of the texture actually sampled (undefined = unkeyed
   *  single-image). Ground truth, independent of the pane's React state. */
  sourceKey: string | undefined;
  /** The pool entry's currently-bound `b` source key (`entry.sourceBKey`). */
  sourceBKey: string | undefined;
  /** `params.contentOpId` (0/undefined = identity/plain image; nonzero = a
   *  direct diff/compositor op sampling slot `b`). */
  contentOpId: number | undefined;
  /** Whether slot `b` had a real texture bound (`entry.srcTextureB != null`). */
  hasSrcB: boolean;
  /** `params.isScalar` — the display arity (a scalar-error colormap vs light). */
  isScalar: boolean | undefined;
  // ---- FULL display-encode fingerprint (sharpened orange-frame oracle) -------
  // The source-identity fields above (sourceKey/sourceBKey/contentOpId) catch a
  // MISBOUND texture; these catch a MISMATCHED display-encode combination — the
  // orange-frame artefact, where the source is RIGHT but the encode params
  // (isScalar/lut/reduce/scalarMode) are a STALE diff's applied to a light image
  // (or vice-versa). All read straight off the `params` the pool actually
  // presented with, so it is the ground truth of the encode combination — no
  // pixel readback. Each is a separate uniform field written per `renderImage`.
  /** `params.operator` (tone-map operator). */
  operator?: string;
  /** `params.hdrOut`. */
  hdrOut?: boolean;
  /** `params.reduce` (multi-channel scalar reduce). */
  reduce?: string;
  /** `params.channelCount`. */
  channelCount?: number;
  /** Scalar-mode enum the shader uses: 1=analytic, 2=grayNone, 3=turbo, 0=LUT.
   *  Combined from analytic/grayNone/turbo so one field pins the scalar path. */
  scalarMode?: number;
  /** Whether a colormap LUT was bound (`params.colormap != null` on the scalar
   *  path). A light image binds none; a diff (magma/turbo/…) binds one. */
  hasColormap?: boolean;
  /** A cheap signature of the bound colormap LUT (a few sampled entries) so two
   *  DIFFERENT LUTs (e.g. magma vs turbo) are distinguishable, not just present. */
  colormapSig?: number;
  /** `params.contentParam` (split divider / blend alpha). */
  contentParam?: number;
}

let paneRenderLog: PaneRenderRecord[] | null = null;

/** Begin (or reset) capturing per-present records. */
export function startPaneRenderLog(): void {
  paneRenderLog = [];
}
/** Stop capturing and drop the buffer. */
export function stopPaneRenderLog(): void {
  paneRenderLog = null;
}
/** The records captured since the last {@link startPaneRenderLog}. */
export function getPaneRenderLog(): PaneRenderRecord[] {
  return paneRenderLog ?? [];
}
/** True while a harness is capturing. The pool checks this BEFORE building the
 *  (now full-fingerprint) record, so no per-present cost is paid in production —
 *  the record + its display fingerprint are assembled only when logging is on. */
export function isPaneRenderLogActive(): boolean {
  return paneRenderLog !== null;
}
/** Pool-internal: record one present. No-op unless a harness started the log. */
export function recordPaneRender(record: PaneRenderRecord): void {
  if (paneRenderLog) paneRenderLog.push(record);
}
