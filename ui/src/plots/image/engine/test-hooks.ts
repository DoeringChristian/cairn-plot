/**
 * Fault-injection test hook (browser harness only) — a `?forceEngineFail`
 * URL-param convention (`URLSearchParams` check, "current page URL, read
 * fresh on every call" semantics — no memoization, so a test can
 * navigate/reload between assertions without stale state).
 *
 * When the page URL carries `?forceEngineFail`, `engine/pool.ts`'s
 * `activateEntry()` device/surface acquisition throws synthetically instead
 * of touching real GPU
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
  /** `params.imageOperationId` (0/undefined = identity/plain image; nonzero = a
   *  direct diff/compositor op sampling slot `b`). */
  imageOperationId: number | undefined;
  /** Whether slot `b` had a real texture bound (`entry.srcTextureB != null`). */
  hasSrcB: boolean;
  /** `params.isScalar` — the display arity (a scalar-error colormap vs light). */
  isScalar: boolean | undefined;
  // ---- FULL display-encode fingerprint (sharpened orange-frame oracle) -------
  // The source-identity fields above (sourceKey/sourceBKey/imageOperationId) catch a
  // MISBOUND texture; these catch a MISMATCHED display-encode combination — the
  // orange-frame artefact, where the source is RIGHT but the encode params
  // (isScalar/lut/reduce/scalarMode) are a STALE diff's applied to a light image
  // (or vice-versa). All read straight off the `params` the pool actually
  // presented with, so it is the ground truth of the encode combination — no
  // pixel readback. Each is a separate uniform field written per `renderImage`.
  /** Registered display-operation id. */
  operator?: string;
  /** `params.hdrOut`. */
  hdrOut?: boolean;
  /** `params.reduce` (multi-channel scalar reduce). */
  reduce?: string;
  /** `params.channelCount`. */
  channelCount?: number;
  /** Scalar-mode enum the shader uses: 1=analytic, 2=scalar transfer, 3=turbo, 0=LUT.
   *  Combined from the prepared display operation so one field pins the scalar path. */
  scalarMode?: number;
  /** Whether a colormap LUT was bound (`params.colormap != null` on the scalar
   *  path). A light image binds none; a diff (magma/turbo/…) binds one. */
  hasColormap?: boolean;
  /** A cheap signature of the bound colormap LUT (a few sampled entries) so two
   *  DIFFERENT LUTs (e.g. magma vs turbo) are distinguishable, not just present. */
  colormapSig?: number;
  /** `params.contentParam` (split divider / blend alpha). */
  contentParam?: number;
  /** `params.compareIntended` — the pane set this true iff a COMPARE was intended
   *  (`hasCompare`) for this present. With `mode:"image"` + no `imageOperationId` it is
   *  the PIPELINE-MISMATCH signal: a raw identity blit of the reference primary
   *  presenting while the pane is semantically in compare mode. See
   *  {@link isPipelineMismatch}. */
  compareIntended?: boolean;
}

/**
 * PIPELINE-MISMATCH oracle (the reference-image flash, caught by PIPELINE not by
 * params). A present is a mismatch iff the pane was semantically in COMPARE mode
 * (`compareIntended`) yet the frame was produced by the plain IDENTITY/IMAGE
 * pipeline (`mode:"image"`, no `imageOperationId`, no bound `b`) — i.e. a raw blit of
 * the REFERENCE primary reached the visible surface instead of the diff result.
 * This present is fully param-COHERENT (the reference texture IS the bound
 * primary, no colormap ⇒ no orange-suspect flag), which is exactly why every
 * prior source⊗encode oracle missed it — only WHICH PIPELINE drew it is wrong.
 * Would have caught the user's flash from day one. Post-fix (the pane's compare
 * present-gate suppresses any identity present while a compare is intended) this
 * is 0.
 */
export function isPipelineMismatch(r: PaneRenderRecord): boolean {
  return r.mode === "image" && !r.imageOperationId && !r.hasSrcB && r.compareIntended === true;
}

/**
 * DEEP-MODE (paneRenderLog=2) OUTPUT-COLOR SAMPLE — the CAUSE-AGNOSTIC flash
 * catcher. Where {@link PaneRenderRecord} proves the (source ⊗ encode) PARAMS
 * were coherent, this records the ACTUAL COLOR a present produced: the pool
 * renders an extra tiny (8×8) pass with the SAME primary texture + params into
 * an offscreen readback texture (NOT the rotating swapchain) and averages it to
 * one RGB fingerprint. A present whose color matches NONE of the settled slots'
 * fingerprints is flagged — the orange flash caught by its actual color, no
 * matter WHY the params/texture produced it. Zero cost unless armed at level 2.
 */
export interface DeepColorSample {
  /** Mean RGB of the 8×8 sample, each channel normalized to [0,1] (HDR frames
   *  are tone-normalized by their own max so hue stays comparable). */
  r: number;
  g: number;
  b: number;
  /** HSV hue in degrees [0,360) of the mean color (for human readability). */
  hue: number;
  /** HSV value/brightness [0,1] and saturation [0,1] of the mean color. */
  value: number;
  saturation: number;
  /** The slot signature this present belongs to (mode|sourceKey|op|colormapSig).
   *  Baselines are grouped by it; a settled slot has ≥ MIN_SETTLED samples. */
  slot: string;
  /** Distance (Euclidean, normalized RGB) from this present's color to its OWN
   *  slot's SETTLED fingerprint. Large = a present of a settled slot whose color
   *  jumped (a garbage/torn present under the same params) = the anomaly. */
  distToOwnSettled: number;
  /** The originating present's ground-truth record (source keys + full encode
   *  fingerprint) — so an anomaly carries WHY as well as WHAT color. */
  record: PaneRenderRecord;
  /** `performance.now()` (or `Date.now()`) at capture, for correlating a flash
   *  with a flip / a context-loss event. */
  t: number;
}

/** A context/device-loss event captured while the user-facing log is armed —
 *  timestamped so a repro can correlate a graphics-context loss with the exact
 *  flip that triggered a flash. */
export interface ContextLossEvent {
  /** "webgpu-device-lost" (the 2D image/diff pane's own device) |
   *  "three-webgl-context-lost" / "three-webgl-context-restored" (a 3D viewer). */
  kind: string;
  /** `performance.now()` (or `Date.now()`) at the event. */
  t: number;
  /** Optional structured detail (device-lost reason/message, viewer id, …). */
  detail?: unknown;
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
      "cairn-plot paneRenderLog: ORANGE-suspect present — a MULTI-CHANNEL (k>1) light image " +
        "(identity op, no `b`) collapsed through a SCALAR COLORMAP (reduce → false-color): a " +
        "light source forced onto the colormap's upper ramp = orange. Record captured on " +
        "`window.__cairnPaneRenderLogSuspects`.",
      record,
    );
  }
}

// ---------------------------------------------------------------------------
// PAINT-PHASE LOG (paint-atomic flip oracle). Records, per pane RENDER SUBMIT,
// which React effect PHASE it executed in — "layout" (a `useLayoutEffect`, i.e.
// PRE-PAINT: the WebGPU work is submitted before the browser paints, so the first
// painted frame after a flip already shows the NEW slot) vs "post" (a passive
// `useEffect`, i.e. POST-PAINT: the first painted frame still shows the HELD
// previous slot — the reported one-frame stale flash). This is the RELIABLE,
// deterministic signal for the flip artefact: an in-DOM WebGPU canvas readback
// races swapchain rotation (the documented gotcha — a synchronous post-commit
// `createImageBitmap` returns a stale/rotated buffer), and the pool render log
// sees only PRESENTS (a held frame is a coherent PREVIOUS present it cannot
// distinguish from a fresh one). But the PHASE a RESIDENT flip's render runs in
// directly determines whether that first painted frame is stale: a layout-phase
// submit composites in the SAME frame, before paint; a passive-phase submit lands
// one paint later. Guarded exactly like the render log — the pane checks
// `isPaintPhaseLogActive()` before recording, so zero production cost.
// ---------------------------------------------------------------------------
export interface PaintPhaseRecord {
  /** "commit" = a pre-paint marker emitted once per flip in the layout phase (the
   *  commit boundary, before paint — the reference the submit time is classified
   *  against); "layout"/"post" = an actual render SUBMIT's effect phase. */
  phase: "commit" | "layout" | "post";
  /** Coarse slot kind of the frame submitted (the flip axis). */
  kind: "image" | "diff" | "compositor";
  /** Whether `renderPass` actually SUBMITTED (a held/guarded frame is `false`). */
  submitted: boolean;
  /** Whether the pane judged the target FULLY RESIDENT (paint-atomic eligible). */
  resident: boolean;
  /** Monotonic content epoch — bumps on each flip. A harness groups submits by
   *  epoch to find the FIRST render per flip (distinguishes even two same-kind
   *  images, which `kind` alone cannot). */
  epoch: number;
  /** `performance.now()` at submit — classified against browser PAINT boundaries
   *  (rAF timestamps). This is the RELIABLE paint-atomic signal: the `phase` label
   *  alone is ambiguous because React flushes a pending passive effect BEFORE the
   *  re-render a layout effect triggers (so an early-flushed "post" submit is still
   *  pre-paint). Comparing the submit time to the first paint after the flip's
   *  commit resolves it. */
  t: number;
}
let paintPhaseLog: PaintPhaseRecord[] | null = null;
/** Begin (or reset) capturing per-submit phase records. */
export function startPaintPhaseLog(): void {
  paintPhaseLog = [];
}
/** Stop capturing and drop the buffer. */
export function stopPaintPhaseLog(): void {
  paintPhaseLog = null;
}
/** The phase records captured since the last {@link startPaintPhaseLog}. */
export function getPaintPhaseLog(): PaintPhaseRecord[] {
  return paintPhaseLog ?? [];
}
/** True while a harness is capturing — the pane's gate (zero production cost). */
export function isPaintPhaseLogActive(): boolean {
  return paintPhaseLog !== null;
}
/** Pane-internal: record one render submit's phase. No-op unless active. */
export function recordPaintPhase(record: PaintPhaseRecord): void {
  if (paintPhaseLog) paintPhaseLog.push(record);
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
//   - each ORANGE-suspect present (a MULTI-CHANNEL light image collapsed through
//     a scalar colormap, the artefact BY CONSTRUCTION) is `console.warn`ed AND
//     pushed to `window.__cairnPaneRenderLogSuspects`;
//   - `window.__cairnPaneRenderLogRecords()` returns the full bounded buffer.
//   - context/device-loss events are timestamped to `window.__cairnContextLossEvents`.
// A repro then dumps `__cairnPaneRenderLogSuspects` (or copies the console).
//
// LEVEL 2 (`?paneRenderLog=2`) additionally arms the DEEP OUTPUT-COLOR DETECTOR:
// the pool renders a tiny extra 8×8 pass per present and averages its color, and
// any present whose color matches NO settled slot is flagged to
// `window.__cairnPaneRenderLogHueAnomalies` — the cause-agnostic flash catcher
// (it sees the orange by its actual color regardless of WHY it happened). Cheap
// enough to hold 60fps (an 8×8 render + a 256-byte async readback per present);
// zero cost at level ≤ 1 or unarmed.
// ---------------------------------------------------------------------------
const USER_CAPTURE_MAX_RECORDS = 5000;
const USER_CAPTURE_MAX_SUSPECTS = 500;
const USER_CAPTURE_MAX_HUE_ANOMALIES = 500;
const USER_CAPTURE_MAX_CONTEXT_EVENTS = 500;
let userCaptureArmed = false;
let orangeSuspects: PaneRenderRecord[] = [];

/** The orange-frame signature: an IMAGE-mode present (identity op, no `b`) that is
 *  `isScalar` with a bound colormap LUT AND whose source is MULTI-CHANNEL (k>1) —
 *  a LIGHT image (RGB/RGBA) reduced-and-collapsed through a scalar colormap (the
 *  diff's magma reaching a light image), which lands a near-white image on the
 *  colormap's upper ramp = orange.
 *
 *  FALSE-POSITIVE EXEMPTION (the k=1 authored-colormap case): a k=1 SCALAR pane
 *  whose colormap is DESCRIPTOR-AUTHORED — a scalar float image the author drew
 *  with magma/viridis/…, its NORMAL render — is ALSO `mode:image, !op, !b,
 *  isScalar, hasColormap`, but it is entirely legitimate, not the artefact. The
 *  earlier predicate flagged it on EVERY normal present (the user's console spam).
 *  Only a MULTI-channel source (`channelCount > 1`) can be the "a light image got
 *  false-colored" mismatch class, so gating on `channelCount > 1` exempts the
 *  authored scalar pane while still catching the real ch>1-colormap-on-identity
 *  mismatch. (A cached diff is `mode:"cached-diff"` and a direct diff/compositor
 *  op has a nonzero `imageOperationId` + `hasSrcB`, so both are already exempt.) */
export function isOrangeSuspect(r: PaneRenderRecord): boolean {
  return (
    r.mode === "image" &&
    !r.imageOperationId &&
    !r.hasSrcB &&
    r.isScalar === true &&
    r.hasColormap === true &&
    r.channelCount != null &&
    r.channelCount > 1
  );
}

/** Parse the requested capture level from the URL flag / window global.
 *  `?paneRenderLog=1` or `=2` (or `window.__cairnPaneRenderLog = 1|2`). Any
 *  truthy legacy value (`=1`, `true`) is level 1. Returns 0 when the flag is
 *  absent. */
function paneRenderLogLevel(): 0 | 1 | 2 {
  if (typeof window === "undefined") return 0;
  let raw: string | null = null;
  try {
    raw = new URLSearchParams(location.search).get("paneRenderLog");
  } catch {
    /* ignore */
  }
  const w = window as unknown as { __cairnPaneRenderLog?: unknown };
  const g = w.__cairnPaneRenderLog;
  if (raw === "2" || g === 2 || g === "2") return 2;
  if (raw === "1" || g === 1 || g === true || raw === "true") return 1;
  return 0;
}

// ---------------------------------------------------------------------------
// DEEP OUTPUT-COLOR DETECTOR (level 2). Fed the averaged RGB of the pool's extra
// 8×8 sample pass per present. Groups presents by SLOT SIGNATURE (the source +
// op + encode that SHOULD map to one stable color) and learns each slot's
// settled color (an EMA). A present of an ALREADY-SETTLED slot whose color jumps
// far from that slot's own settled fingerprint is a hue anomaly = the flash
// caught by color. Cause-agnostic: it does not care whether a garbage cached-
// result texture, a stale binding, or a driver artefact produced the color —
// only that the SAME slot suddenly presented a very different color. (A NEW slot
// signature — a genuinely different legitimate content — is given grace until it
// settles, so a normal flip to a new slot is never flagged. Cross-signature
// param mismatches — a light image with a scalar colormap bound — are the PARAM
// oracle's job; see `isOrangeSuspect`.)
// ---------------------------------------------------------------------------
/** A slot is "settled" once it has this many samples (its EMA has converged). */
const DEEP_MIN_SETTLED = 4;
/** Normalized-RGB Euclidean distance beyond which a color "matches no settled
 *  slot". ~0.35 cleanly separates the near-white/orange flash from a slot's own
 *  settled magma/light color while tolerating anti-alias/tone jitter. */
const DEEP_ANOMALY_DIST = 0.35;
/** EMA weight for a slot's settled color (small = stable baseline). */
const DEEP_EMA_ALPHA = 0.25;
/** Below this brightness the 8×8 sample is a held/blank frame with no meaningful
 *  hue — never flagged as a COLOR anomaly (a blank hold is not the orange). */
const DEEP_MIN_VALUE = 0.06;

interface SlotBaseline {
  r: number;
  g: number;
  b: number;
  n: number;
}
let deepDetectorArmed = false;
let hueAnomalies: DeepColorSample[] = [];
let deepSampleCount = 0;
const slotBaselines = new Map<string, SlotBaseline>();

/** True while the level-2 deep color detector is armed (pool gate). */
export function deepColorDetectorActive(): boolean {
  return deepDetectorArmed;
}

/** Test-only: force the deep detector on/off (harness drives it directly rather
 *  than through the URL flag). Resets baselines + anomalies. */
export function setDeepColorDetectorForTest(on: boolean): void {
  deepDetectorArmed = on;
  slotBaselines.clear();
  hueAnomalies = [];
  deepSampleCount = 0;
}

/** Test-only accessor for the captured hue anomalies. */
export function getHueAnomalies(): DeepColorSample[] {
  return hueAnomalies;
}

/** Test-only: how many presents the deep detector actually sampled + how many
 *  distinct slots it settled. A harness asserts `samples > 0` so a "zero
 *  anomalies" pass can't be vacuous (the 8×8 sample pass really ran). */
export function getDeepColorStats(): { samples: number; settledSlots: number } {
  let settledSlots = 0;
  for (const b of slotBaselines.values()) if (b.n >= DEEP_MIN_SETTLED) settledSlots++;
  return { samples: deepSampleCount, settledSlots };
}

function rgbToHsv(r: number, g: number, b: number): { hue: number; saturation: number; value: number } {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let hue = 0;
  if (d > 1e-6) {
    if (max === r) hue = ((g - b) / d) % 6;
    else if (max === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  const saturation = max > 1e-6 ? d / max : 0;
  return { hue, saturation, value: max };
}

/** The slot signature: presents that SHOULD be the same color share it. Groups
 *  by the PANE (`paneId` — critical: an unkeyed single-image pane has an empty
 *  `sourceKey`, so WITHOUT the pane id every distinct plain image on a page would
 *  alias to one baseline and read as a color jump against each other) + the
 *  source identity + the op + the encode. A legitimate slot-to-slot difference
 *  (image vs diff, or one pane vs another) forms distinct baselines; only the
 *  SAME slot presenting a jumped color is an anomaly. */
function slotSignature(r: PaneRenderRecord, paneId: number): string {
  return `p${paneId}|${r.mode}|${r.sourceKey ?? ""}|${r.sourceBKey ?? ""}|${r.imageOperationId ?? 0}|${r.isScalar ? "s" : "l"}|${r.colormapSig ?? ""}|${r.reduce ?? ""}`;
}

/**
 * Record one deep-mode color sample (pool → here, level 2 only). `rgb` is the
 * mean of the 8×8 sample pass, each channel already normalized to [0,1]. Learns
 * the present's own slot baseline (EMA) and flags the sample when its color is
 * far from EVERY currently-settled slot — a color matching no settled slot is
 * the flash, caught by its actual color.
 */
export function recordDeepColorSample(
  record: PaneRenderRecord,
  rgb: { r: number; g: number; b: number },
  paneId = 0,
): void {
  if (!deepDetectorArmed) return;
  deepSampleCount++;
  const { r, g, b } = rgb;
  const { hue, saturation, value } = rgbToHsv(r, g, b);
  const slot = slotSignature(record, paneId);
  const base = slotBaselines.get(slot);

  // Judge against the present's OWN slot fingerprint, but only once that slot is
  // SETTLED (enough samples that its EMA is trustworthy). A new/unsettled slot is
  // given grace (only learned), so a normal flip to a different legitimate slot
  // is never flagged.
  const distToOwnSettled = base && base.n >= DEEP_MIN_SETTLED ? Math.hypot(r - base.r, g - base.g, b - base.b) : 0;
  const isAnomaly =
    base != null &&
    base.n >= DEEP_MIN_SETTLED &&
    value >= DEEP_MIN_VALUE &&
    distToOwnSettled > DEEP_ANOMALY_DIST;

  if (isAnomaly && hueAnomalies.length < USER_CAPTURE_MAX_HUE_ANOMALIES) {
    const sample: DeepColorSample = {
      r, g, b, hue, value, saturation, slot,
      distToOwnSettled,
      record,
      t: nowMs(),
    };
    hueAnomalies.push(sample);
    if (userCaptureArmed) {
      // eslint-disable-next-line no-console
      console.warn(
        `cairn-plot paneRenderLog(deep): HUE-ANOMALY present — output color rgb(${(r * 255) | 0},${(g * 255) | 0},${(b * 255) | 0}) ` +
          `hue ${hue.toFixed(0)}° jumped from its slot's settled color (Δ=${distToOwnSettled.toFixed(2)}). ` +
          `The flash caught by its actual color. Captured on window.__cairnPaneRenderLogHueAnomalies.`,
        sample,
      );
    }
  }

  // Learn this present's own slot baseline (EMA toward the observed color) — but
  // do NOT fold a flagged anomaly into the baseline, so one flash can't drag the
  // settled fingerprint toward itself.
  if (!base) {
    slotBaselines.set(slot, { r, g, b, n: 1 });
  } else if (!isAnomaly) {
    base.r += (r - base.r) * DEEP_EMA_ALPHA;
    base.g += (g - base.g) * DEEP_EMA_ALPHA;
    base.b += (b - base.b) * DEEP_EMA_ALPHA;
    base.n += 1;
  }
}

// ---------------------------------------------------------------------------
// CONTEXT-LOSS INSTRUMENTATION (armed at any level). A timestamped log of
// WebGPU device-loss (the 2D image/diff pane's own device) and THREE/WebGL
// context loss+restore (the 3D viewers) so a repro can correlate a graphics
// context loss with the exact flip that triggered a flash. Fired only from the
// (rare) loss/restore events themselves and gated on `userCaptureArmed`, so it
// is zero-cost in production and near-zero even when armed.
// ---------------------------------------------------------------------------
let contextLossEvents: ContextLossEvent[] = [];

function nowMs(): number {
  try {
    if (typeof performance !== "undefined" && typeof performance.now === "function") return performance.now();
  } catch {
    /* ignore */
  }
  return Date.now();
}

/** Record a context/device-loss event (no-op unless the user log is armed). */
export function recordContextLossEvent(kind: string, detail?: unknown): void {
  if (!userCaptureArmed) return;
  if (contextLossEvents.length >= USER_CAPTURE_MAX_CONTEXT_EVENTS) return;
  const ev: ContextLossEvent = { kind, t: nowMs(), detail };
  contextLossEvents.push(ev);
  // eslint-disable-next-line no-console
  console.warn(`cairn-plot paneRenderLog: CONTEXT-LOSS event [${kind}] @ ${ev.t.toFixed(0)}ms — captured on window.__cairnContextLossEvents.`, ev);
}

/** Arm the user-facing capture if the flag is set. Idempotent; safe to call more
 *  than once. Installs the `window.__cairnPaneRenderLog*` accessors and starts a
 *  bounded log. Returns whether capture is now armed. */
export function armPaneRenderLogFromFlag(): boolean {
  if (userCaptureArmed) return true;
  const level = paneRenderLogLevel();
  if (level === 0) return false;
  userCaptureArmed = true;
  slotBaselines.clear();
  deepDetectorArmed = level >= 2;
  startPaneRenderLog();
  const w = window as unknown as {
    __cairnPaneRenderLogRecords?: () => PaneRenderRecord[];
    __cairnPaneRenderLogSuspects?: PaneRenderRecord[];
    __cairnPaneRenderLogHueAnomalies?: DeepColorSample[];
    __cairnContextLossEvents?: ContextLossEvent[];
  };
  // The plot ships as THREE co-resident inlined bundles (core / gpu-image /
  // three), each with its OWN copy of this module — presents land in the
  // gpu-image copy, WebGPU device-loss in the gpu-image copy, THREE context-loss
  // in the three copy. SHARE the capture arrays via the window globals (reuse an
  // array a sibling instance already installed) so a user reading
  // `window.__cairnPaneRenderLogSuspects` / `…HueAnomalies` / `…ContextLossEvents`
  // sees EVERY instance's records in one place, regardless of arm order.
  orangeSuspects = w.__cairnPaneRenderLogSuspects ?? [];
  hueAnomalies = w.__cairnPaneRenderLogHueAnomalies ?? [];
  contextLossEvents = w.__cairnContextLossEvents ?? [];
  w.__cairnPaneRenderLogSuspects = orangeSuspects;
  w.__cairnPaneRenderLogHueAnomalies = hueAnomalies;
  w.__cairnContextLossEvents = contextLossEvents;
  // The full per-present RING is per-instance; presents only ever occur in the
  // gpu-image copy, so a getter that returns the LONGEST of the instances' rings
  // (installed once, then each instance registers its own getter) reliably
  // surfaces the buffer with content regardless of arm order.
  const wg = w as unknown as { __cairnPaneRenderLogGetters?: Array<() => PaneRenderRecord[]> };
  (wg.__cairnPaneRenderLogGetters ??= []).push(() => getPaneRenderLog());
  w.__cairnPaneRenderLogRecords = () =>
    (wg.__cairnPaneRenderLogGetters ?? []).map((g) => g()).sort((a, b) => b.length - a.length)[0] ?? [];
  // eslint-disable-next-line no-console
  console.info(
    `cairn-plot: paneRenderLog capture ARMED (level ${level}) — orange-suspect presents on ` +
      "window.__cairnPaneRenderLogSuspects, context-loss events on window.__cairnContextLossEvents" +
      (level >= 2
        ? ", DEEP color anomalies on window.__cairnPaneRenderLogHueAnomalies (extra 8×8 sample per present)"
        : "") +
      " (full render buffer: window.__cairnPaneRenderLogRecords()).",
  );
  return true;
}

// Auto-arm at module load (one URL read; a no-op when the flag is absent).
armPaneRenderLogFromFlag();
