export function visibleWindow(xs: ArrayLike<number>, xMin: number | null, xMax: number | null): [number, number] {
  const n = xs.length; if (n === 0) return [0, 0];
  let start = 0, end = n;
  if (xMin !== null) { let lo = 0, hi = n; while (lo < hi) { const m = (lo + hi) >>> 1; if (xs[m]! < xMin) lo = m + 1; else hi = m; } start = Math.max(0, lo - 1); }
  if (xMax !== null) { let lo = 0, hi = n; while (lo < hi) { const m = (lo + hi) >>> 1; if (xs[m]! <= xMax) lo = m + 1; else hi = m; } end = Math.min(n, lo + 1); }
  if (end <= start) return [start, start + 1]; // start <= n-1 always holds here
  return [start, end];
}
