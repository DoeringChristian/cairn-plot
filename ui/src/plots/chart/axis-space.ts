// ---------------------------------------------------------------------------
// Axis space: gestures expressed in SCREEN fractions, applied through the
// axis's scale.
//
// The scalar substrate keeps its viewport in RAW data units (Recharts owns the
// log mapping via `scale="log"`), unlike `chart-view-math.ts`, whose domains
// are already mapped. Screen space, however, is uniform in MAPPED units: on a
// log axis the middle pixel is the GEOMETRIC mean of the bounds. Interpolating
// raw bounds linearly therefore anchors a zoom at the wrong value (the cursor
// no longer pins the point under it) and can walk a bound to <= 0, which a log
// axis cannot render at all.
//
// These helpers do the one correct thing: map -> operate linearly -> unmap.
// They are the only place the scalar gestures touch axis arithmetic.
// ---------------------------------------------------------------------------

import type { AxisScale } from "../types";

export type AxisDomain = [number, number];

/**
 * Floor applied to a log domain's lower bound when the incoming domain reaches
 * <= 0 — an auto domain follows the DATA extent, and a metric that logged a
 * zero (or a negative) hands us one a log axis cannot place. Twelve decades
 * below the upper bound is far outside anything readable, so it never truncates
 * a window the user could actually see; it only keeps the arithmetic finite.
 */
const LOG_DECADES_FLOOR = 12;

/** Is this a domain we can compute on at all? */
function usable(domain: AxisDomain): boolean {
  const [lo, hi] = domain;
  return Number.isFinite(lo) && Number.isFinite(hi) && hi > lo;
}

/**
 * The domain as it exists on screen: `[log10(lo), log10(hi)]` for a log axis,
 * unchanged for a linear one — the space every gesture's linear arithmetic is
 * valid in. Returns null when a log domain has no positive part at all (the
 * caller then leaves the domain alone: nothing there is renderable).
 */
export function mapDomain(domain: AxisDomain, scale: AxisScale): AxisDomain | null {
  const [lo, hi] = domain;
  if (scale !== "log") return [lo, hi];
  if (hi <= 0) return null;
  const floor = Math.log10(hi) - LOG_DECADES_FLOOR;
  const mLo = lo > 0 ? Math.log10(lo) : floor;
  const mHi = Math.log10(hi);
  return mHi > mLo ? [mLo, mHi] : null;
}

/** Inverse of {@link mapDomain}. */
export function unmapDomain(domain: AxisDomain, scale: AxisScale): AxisDomain {
  if (scale !== "log") return domain;
  return [Math.pow(10, domain[0]), Math.pow(10, domain[1])];
}

/** The data value under screen fraction `frac` (0 = low edge, 1 = high edge). */
export function axisValueAt(domain: AxisDomain, frac: number, scale: AxisScale): number {
  if (!usable(domain)) return domain[0];
  const m = mapDomain(domain, scale);
  if (!m) return domain[0];
  const v = m[0] + frac * (m[1] - m[0]);
  return scale === "log" ? Math.pow(10, v) : v;
}

/** The screen fraction at which `value` sits. */
export function axisFractionOf(domain: AxisDomain, value: number, scale: AxisScale): number {
  if (!usable(domain)) return 0;
  const m = mapDomain(domain, scale);
  if (!m) return 0;
  const v = scale === "log" ? (value > 0 ? Math.log10(value) : m[0]) : value;
  return (v - m[0]) / (m[1] - m[0]);
}

/**
 * Scale the span by `factor` (a SPAN multiplier: < 1 zooms in) while keeping
 * the value under screen fraction `anchorFrac` pinned to that same pixel.
 */
export function zoomAxis(
  domain: AxisDomain,
  anchorFrac: number,
  factor: number,
  scale: AxisScale,
): AxisDomain {
  if (!usable(domain) || !Number.isFinite(factor) || factor <= 0) return domain;
  const m = mapDomain(domain, scale);
  if (!m) return domain;
  const anchor = m[0] + anchorFrac * (m[1] - m[0]);
  return unmapDomain([anchor - (anchor - m[0]) * factor, anchor + (m[1] - anchor) * factor], scale);
}

/**
 * Translate the domain by `fracDelta` of the plot width — the sign convention
 * of a drag: a positive fraction moves the CONTENT right, i.e. the window left.
 */
export function panAxis(domain: AxisDomain, fracDelta: number, scale: AxisScale): AxisDomain {
  if (!usable(domain) || !Number.isFinite(fracDelta)) return domain;
  const m = mapDomain(domain, scale);
  if (!m) return domain;
  const shift = fracDelta * (m[1] - m[0]);
  return unmapDomain([m[0] - shift, m[1] - shift], scale);
}

/**
 * The sub-domain between two screen fractions — a box zoom. `fLo`/`fHi` are
 * measured from the LOW edge of the axis (`fLo < fHi`).
 */
export function sliceAxis(
  domain: AxisDomain,
  fLo: number,
  fHi: number,
  scale: AxisScale,
): AxisDomain {
  if (!usable(domain) || !Number.isFinite(fLo) || !Number.isFinite(fHi)) return domain;
  const m = mapDomain(domain, scale);
  if (!m) return domain;
  const span = m[1] - m[0];
  return unmapDomain([m[0] + fLo * span, m[0] + fHi * span], scale);
}
