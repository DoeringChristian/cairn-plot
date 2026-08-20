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
/** Pool-internal: record one present. No-op unless the log is active. When the
 *  USER-FACING capture (see {@link armPaneRenderLogFromFlag}) is armed the buffer
 *  is bounded (ring) and each ORANGE-suspect present is surfaced live. */
export function recordPaneRender(record: PaneRenderRecord): void {
  if (!paneRenderLog) return;
  paneRenderLog.push(record);
  if (!userCaptureArmed) return;
  // Bound the buffer in a long-lived user session (a harness never arms this
  // path, so its full-log assertions are unaffected).
  if (paneRenderLog.length > USER_CAPTURE_MAX_RECORDS) paneRenderLog.shift();
  if (isOrangeSuspect(record) && orangeSuspects.length < USER_CAPTURE_MAX_SUSPECTS) {
    orangeSuspects.push(record);
    // eslint-disable-next-line no-console
    console.warn(
      "cairn-plot paneRenderLog: ORANGE-suspect present — a plain image (identity op, no `b`) " +
        "rendered through a SCALAR COLORMAP (a light image false-colored). Record captured on " +
        "`window.__cairnPaneRenderLogSuspects`.",
      record,
    );
  }
}

// ---------------------------------------------------------------------------
// USER-FACING CAPTURE — arm the render-log oracle in a real browser so the
// reported one-frame ORANGE flash can be captured in the USER'S OWN environment
// if it ever recurs. Armed by a URL flag `?paneRenderLog=1` OR a window global
// `window.__cairnPaneRenderLog = 1` set BEFORE the plot bundle loads. Zero cost
// when unarmed: this module runs ONE `URLSearchParams` read at load and, if the
// flag is absent, never sets `userCaptureArmed`, so the pool's
// `isPaneRenderLogActive()` gate stays false and the present path is untouched.
//
// When armed:
//   - the pool logs every present (bounded ring, so no unbounded growth);
//   - each ORANGE-suspect present (an image-mode blit carrying a scalar colormap
//     — a plain image false-colored, the artefact BY CONSTRUCTION) is
//     `console.warn`ed AND pushed to `window.__cairnPaneRenderLogSuspects`;
//   - `window.__cairnPaneRenderLogRecords()` returns the full bounded buffer.
// A repro then dumps `__cairnPaneRenderLogSuspects` (or copies the console).
// ---------------------------------------------------------------------------
const USER_CAPTURE_MAX_RECORDS = 5000;
const USER_CAPTURE_MAX_SUSPECTS = 500;
let userCaptureArmed = false;
let orangeSuspects: PaneRenderRecord[] = [];

/** The orange-frame signature: an IMAGE-mode present (identity op, no `b`) that is
 *  `isScalar` with a bound colormap LUT — a plain image collapsed through a scalar
 *  colormap (the diff's magma reaching a light image), which lands a near-white
 *  image on the colormap's upper ramp = orange. */
function isOrangeSuspect(r: PaneRenderRecord): boolean {
  return (
    r.mode === "image" &&
    !r.contentOpId &&
    !r.hasSrcB &&
    r.isScalar === true &&
    r.hasColormap === true
  );
}

function paneRenderLogFlagSet(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (new URLSearchParams(location.search).get("paneRenderLog") === "1") return true;
  } catch {
    /* ignore */
  }
  const w = window as unknown as { __cairnPaneRenderLog?: unknown };
  return w.__cairnPaneRenderLog === 1 || w.__cairnPaneRenderLog === true;
}

/** Arm the user-facing capture if the flag is set. Idempotent; safe to call more
 *  than once. Installs the `window.__cairnPaneRenderLog*` accessors and starts a
 *  bounded log. Returns whether capture is now armed. */
export function armPaneRenderLogFromFlag(): boolean {
  if (userCaptureArmed) return true;
  if (!paneRenderLogFlagSet()) return false;
  userCaptureArmed = true;
  orangeSuspects = [];
  startPaneRenderLog();
  const w = window as unknown as {
    __cairnPaneRenderLogRecords?: () => PaneRenderRecord[];
    __cairnPaneRenderLogSuspects?: PaneRenderRecord[];
  };
  w.__cairnPaneRenderLogRecords = () => getPaneRenderLog();
  w.__cairnPaneRenderLogSuspects = orangeSuspects;
  // eslint-disable-next-line no-console
  console.info(
    "cairn-plot: paneRenderLog capture ARMED — orange-suspect presents will be logged to the console " +
      "and collected on window.__cairnPaneRenderLogSuspects (full buffer: window.__cairnPaneRenderLogRecords()).",
  );
  return true;
}

// Auto-arm at module load (one URL read; a no-op when the flag is absent).
armPaneRenderLogFromFlag();
