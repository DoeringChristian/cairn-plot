import type { AxisSource } from "../resources/transforms/x-axis";

/** Tuning for {@link formatNum}. Both default to the historical chart behaviour. */
export interface FormatNumOptions {
  /**
   * Significant-figure precision. Drives `toPrecision(precision)` on the
   * fixed path and `toExponential(precision - 2)` on the exponential path (so
   * the default `5` reproduces the historical `toExponential(3)`). Default `5`.
   */
  precision?: number;
  /**
   * Render the ASCII sign `-` as the typographic MINUS SIGN `−` (U+2212).
   * Default `false` (plain `-`). Used by the image colorbar's tick labels.
   */
  minus?: boolean;
}

/**
 * The shared numeric formatter for chart tick/tooltip/colorbar labels: compact
 * significant figures, switching to exponential for very large/small
 * magnitudes. `precision` lets callers that want fewer digits (e.g. the TEV
 * per-pixel overlay) share the SAME rounding rules instead of re-inventing
 * them; `minus` swaps in the typographic minus glyph. Called with no options it
 * is byte-for-byte the original `formatNum`.
 */
export function formatNum(n: number, opts?: FormatNumOptions): string {
  const precision = opts?.precision ?? 5;
  const s = formatNumCore(n, precision);
  return opts?.minus ? s.replace("-", "−") : s;
}

function formatNumCore(n: number, precision: number): string {
  if (!Number.isFinite(n)) return String(n);
  if (n === 0) return "0";
  const abs = Math.abs(n);
  if (abs >= 1_000 || abs < 1e-3) {
    return n.toExponential(Math.max(0, precision - 2));
  }
  return Number(n.toPrecision(precision)).toString();
}

export function formatXTick(v: number, axis: AxisSource): string {
  if (!Number.isFinite(v)) return String(v);
  if (axis === "step") {
    return Number.isInteger(v) ? String(v) : v.toFixed(1);
  }
  if (axis === "relative_time") {
    if (v < 60) return `${v.toFixed(1)}s`;
    if (v < 3600) return `${(v / 60).toFixed(1)}m`;
    return `${(v / 3600).toFixed(2)}h`;
  }
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleTimeString();
}
