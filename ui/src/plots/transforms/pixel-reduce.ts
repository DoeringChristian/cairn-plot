/**
 * The column index a point at axis position `pos` falls in.
 *
 * The ONE definition of the column grid: `reduceToColumns` picks the points of a
 * column with it and `plots/scalar/render-rows.ts` snaps those picks back onto
 * the same column with it. Two spellings of the same arithmetic (a multiply by
 * `columns / span` here, a divide by `span / columns` there) disagree by an ULP
 * at column boundaries, which would put a pick in a column the reducer never
 * opened — so they share this.
 */
export function columnOf(pos: number, binLo: number, width: number, columns: number): number {
  return Math.min(columns - 1, Math.max(0, Math.floor((pos - binLo) / width)));
}

// M4 reduction with one gap marker per column
export function reduceToColumns(
  xs: ArrayLike<number>, ys: ArrayLike<number>, start: number, end: number,
  xMin: number, xMax: number, columns: number, lo = -Infinity, hi = Infinity,
): Int32Array {
  const count = end - start; if (count <= 0) return new Int32Array(0);
  if (count <= 2 * columns || !(xMax > xMin)) { const all = new Int32Array(count); for (let i = 0; i < count; i++) all[i] = start + i; return all; }
  const cap = 5 * columns + 2;
  const out = new Int32Array(cap); let n = 0;
  const width = (xMax - xMin) / columns;
  let col = -1, first = -1, last = -1, minI = -1, maxI = -1, gap = -1;
  const flush = () => {
    const c: number[] = [];
    for (const v of [first, minI, maxI, last, gap]) if (v >= 0 && !c.includes(v)) c.push(v);
    c.sort((a, b) => a - b);
    for (const i of c) if (n < cap) out[n++] = i;
    first = last = minI = maxI = gap = -1;
  };
  for (let i = start; i < end; i++) {
    const c = columnOf(xs[i]!, xMin, width, columns);
    if (c !== col) { flush(); col = c; }
    const y = ys[i]!;
    if (Number.isNaN(y)) { if (gap < 0) gap = i; continue; } // one gap marker per column
    if (y < lo || y > hi) continue;                           // never opens a column
    if (first < 0) first = i;
    last = i;
    if (minI < 0 || y < ys[minI]!) minI = i;
    if (maxI < 0 || y > ys[maxI]!) maxI = i;
  }
  flush();
  return out.slice(0, n);
}
