// filterOutliers' interpolated percentile on a sorted copy of the finite values
export function percentile(values: ArrayLike<number>, p: number): number {
  let n = 0; const a = new Float64Array(values.length);
  for (let i = 0; i < values.length; i++) { const v = values[i]!; if (Number.isFinite(v)) a[n++] = v; }
  if (n === 0) return NaN;
  const sorted = a.subarray(0, n).sort();
  if (p <= 0) return sorted[0]!; if (p >= 100) return sorted[n - 1]!;
  const r = (p / 100) * (n - 1); const lo = Math.floor(r), hi = Math.ceil(r), f = r - lo;
  return sorted[lo]! * (1 - f) + sorted[hi]! * f;
}
