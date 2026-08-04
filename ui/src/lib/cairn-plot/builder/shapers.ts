/**
 * Pure data-shaping for the JS builder surface — the TS mirror of
 * `src/cairn_plot/shapers.py`. Each function turns raw JS inputs (plain arrays,
 * nested arrays, TypedArrays, plain objects) into the exact inline data-contract
 * the matching renderer consumes (`Series[]`, `ScatterPoint[]`, `BarDatum[]`,
 * histogram `counts`/`edges`, heatmap `matrix`, parallel `columns`/`rows`/
 * `columnDomains`) — byte-for-byte the same shapes the Python emitter produces,
 * so a JS-authored plot is identical to the Python one.
 */
import { SERIES_COLORS } from "../types.ts";

type NumArrayLike = ArrayLike<number> | number[];
export type Dict<T> = Record<string, T>;

const isFinite_ = (v: number): boolean => Number.isFinite(v);

function isArrayLike(x: unknown): x is NumArrayLike {
  return (
    Array.isArray(x) ||
    ArrayBuffer.isView(x) ||
    (typeof x === "object" && x !== null && typeof (x as ArrayLike<number>).length === "number")
  );
}

/** A plain `{name: values}` object (not an array / TypedArray). */
export function isPlainObject(x: unknown): x is Dict<unknown> {
  return (
    typeof x === "object" &&
    x !== null &&
    !Array.isArray(x) &&
    !ArrayBuffer.isView(x)
  );
}

/** Coerce an array-like of numbers → `number[]` (a copy). */
export function toNumbers(x: unknown, ctx: string): number[] {
  if (ArrayBuffer.isView(x) && !(x instanceof DataView)) {
    return Array.from(x as unknown as ArrayLike<number>, Number);
  }
  if (Array.isArray(x)) return x.map(Number);
  if (isArrayLike(x)) return Array.from(x as ArrayLike<number>, Number);
  throw new Error(`cairnPlot: ${ctx} expects an array of numbers`);
}

// ---- line / scalar --------------------------------------------------------

interface Series {
  key: string;
  label: string;
  color: string;
  points: Array<{ x: number; y: number }>;
}

function oneSeries(key: string, values: unknown, x: unknown, idx: number): Series {
  const yarr = toNumbers(values, "line(...) each series");
  if (yarr.length === 0) {
    throw new Error("cairnPlot: line(...) each series must be a non-empty sequence");
  }
  let xs: number[];
  let xIsIndex: boolean;
  if (x == null) {
    xs = yarr.map((_, i) => i);
    xIsIndex = true;
  } else {
    xs = toNumbers(x, "line(x)");
    if (xs.length !== yarr.length) {
      throw new Error(
        `cairnPlot: line(x=...) length ${xs.length} does not match the series length ${yarr.length}`,
      );
    }
    xIsIndex = false;
  }
  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < yarr.length; i++) {
    const v = yarr[i]!;
    if (!isFinite_(v)) continue;
    points.push({ x: xIsIndex ? Math.trunc(xs[i]!) : xs[i]!, y: v });
  }
  return {
    key: String(key),
    label: String(key),
    color: SERIES_COLORS[idx % SERIES_COLORS.length]!,
    points,
  };
}

/** Raw `line()` input → `Series[]`. Accepts a single 1-D sequence, a
 *  `{name: seq}` object, or a 2-D array (one series per row). */
export function lineSeriesList(
  y: unknown,
  opts: { x?: unknown; label?: string } = {},
): Series[] {
  const { x, label } = opts;
  if (isPlainObject(y)) {
    const entries = Object.entries(y);
    if (entries.length === 0) {
      throw new Error("cairnPlot: line({}) requires at least one named series");
    }
    return entries.map(([k, v], i) => oneSeries(k, v, x, i));
  }
  const seq = Array.from(y as ArrayLike<unknown>);
  if (seq.length > 0 && isArrayLike(seq[0])) {
    return seq.map((row, i) => oneSeries(`series_${i}`, row, x, i));
  }
  return [oneSeries(label ?? "value", y, x, 0)];
}

// ---- scatter --------------------------------------------------------------

interface ScatterPoint {
  id: string;
  x: number;
  y: number;
  color: number | null;
  label?: string;
}

export function scatterPoints(
  x: unknown,
  y: unknown,
  opts: { color?: unknown; labels?: unknown } = {},
): ScatterPoint[] {
  const xa = toNumbers(x, "scatter(...) x");
  const ya = toNumbers(y, "scatter(...) y");
  if (xa.length === 0) throw new Error("cairnPlot: scatter(...) x/y must not be empty");
  if (xa.length !== ya.length) {
    throw new Error(
      `cairnPlot: scatter(...) x and y must have the same length (${xa.length} vs ${ya.length})`,
    );
  }
  const n = xa.length;
  let ca: number[] | null = null;
  if (opts.color != null) {
    ca = toNumbers(opts.color, "scatter(color)");
    if (ca.length !== n) throw new Error("cairnPlot: scatter(color=...) must match x/y length");
  }
  let labs: unknown[] | null = null;
  if (opts.labels != null) {
    labs = Array.from(opts.labels as ArrayLike<unknown>);
    if (labs.length !== n) throw new Error("cairnPlot: scatter(labels=...) must match x/y length");
  }
  const points: ScatterPoint[] = [];
  for (let i = 0; i < n; i++) {
    const pt: ScatterPoint = {
      id: String(i),
      x: xa[i]!,
      y: ya[i]!,
      color: ca ? ca[i]! : null,
    };
    if (labs) pt.label = String(labs[i]);
    points.push(pt);
  }
  return points;
}

// ---- bar ------------------------------------------------------------------

interface BarDatum {
  id: string;
  label: string;
  value: number;
  color?: string;
}

export function barData(
  values: unknown,
  opts: { labels?: unknown; colors?: unknown } = {},
): BarDatum[] {
  const va = toNumbers(values, "bar(...) values");
  if (va.length === 0) throw new Error("cairnPlot: bar(...) values must not be empty");
  const n = va.length;
  const labs = opts.labels != null ? Array.from(opts.labels as ArrayLike<unknown>) : va.map((_, i) => String(i));
  if (labs.length !== n) {
    throw new Error(`cairnPlot: bar(labels=...) length ${labs.length} must match values length ${n}`);
  }
  const cols = opts.colors != null ? Array.from(opts.colors as ArrayLike<unknown>) : null;
  if (cols && cols.length !== n) throw new Error("cairnPlot: bar(colors=...) must match values length");
  const bars: BarDatum[] = [];
  for (let i = 0; i < n; i++) {
    const b: BarDatum = { id: String(i), label: String(labs[i]), value: va[i]! };
    if (cols) b.color = String(cols[i]);
    bars.push(b);
  }
  return bars;
}

// ---- histogram ------------------------------------------------------------

/** Uniform-bin histogram mirroring `numpy.histogram` (right-closed last bin);
 *  `len(edges) == len(counts) + 1`. */
export function histogramFromSamples(
  x: unknown,
  bins = 30,
): { counts: number[]; edges: number[] } {
  const xa = toNumbers(x, "histogram(...) samples").filter(isFinite_);
  if (xa.length === 0) {
    throw new Error(
      "cairnPlot: histogram(...) samples must not be empty (after dropping non-finite values)",
    );
  }
  let lo = xa[0]!;
  let hi = xa[0]!;
  for (const v of xa) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  if (lo === hi) {
    // numpy widens a zero-width range to [lo-0.5, hi+0.5].
    lo -= 0.5;
    hi += 0.5;
  }
  const counts = new Array<number>(bins).fill(0);
  const width = (hi - lo) / bins;
  for (const v of xa) {
    let b = Math.floor((v - lo) / width);
    if (b === bins) b = bins - 1; // right edge closed on the last bin
    if (b >= 0 && b < bins) counts[b]! += 1;
  }
  const edges = new Array<number>(bins + 1);
  for (let i = 0; i <= bins; i++) edges[i] = lo + i * width;
  return { counts, edges };
}

export function histogramCheckPrecomputed(
  counts: unknown,
  edges: unknown,
): { counts: number[]; edges: number[] } {
  const c = toNumbers(counts, "histogram(counts)");
  const e = toNumbers(edges, "histogram(edges)");
  if (e.length !== c.length + 1) {
    throw new Error(
      `cairnPlot: histogram(counts, edges): len(edges) must equal len(counts)+1, got ${e.length} edges for ${c.length} counts`,
    );
  }
  return { counts: c, edges: e };
}

// ---- heatmap --------------------------------------------------------------

export function heatmapMatrix(z: unknown): number[][] {
  if (!isArrayLike(z)) throw new Error("cairnPlot: heatmap(...) expects a 2-D matrix");
  const rows = Array.from(z as ArrayLike<unknown>);
  if (rows.length === 0) throw new Error("cairnPlot: heatmap(...) matrix must not be empty");
  if (!isArrayLike(rows[0])) {
    throw new Error("cairnPlot: heatmap(...) expects a 2-D matrix (array of rows)");
  }
  return rows.map((row) => toNumbers(row, "heatmap(...) row"));
}

// ---- parallel coordinates -------------------------------------------------

interface ParallelColumn {
  key: string;
  source: string;
}
interface ParallelRow {
  id: string;
  values: Array<number | null>;
  raw: string[];
}
interface ParallelDomain {
  min: number;
  max: number;
  isNumeric: boolean;
}

function numStr(v: number): string {
  if (!isFinite_(v)) return "";
  if (v === Math.trunc(v) && Math.abs(v) < 1e15) return String(Math.trunc(v));
  return v.toPrecision(4).replace(/\.?0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

/** Normalize `dimensions` → `[label, values][]`. Accepts a list of
 *  `{label, values}`, a `{label: values}` object. */
function normalizeParallelDims(dimensions: unknown): Array<[string, unknown[]]> {
  if (isPlainObject(dimensions)) {
    return Object.entries(dimensions).map(([k, v]) => [String(k), Array.from(v as ArrayLike<unknown>)]);
  }
  const out: Array<[string, unknown[]]> = [];
  for (const d of Array.from(dimensions as ArrayLike<unknown>)) {
    if (!isPlainObject(d) || !("label" in d) || !("values" in d)) {
      throw new Error(
        "cairnPlot: parallelCoordinates(...) list entries must be objects with 'label' and 'values' keys",
      );
    }
    out.push([String((d as Dict<unknown>).label), Array.from((d as Dict<unknown>).values as ArrayLike<unknown>)]);
  }
  return out;
}

function parallelColumn(vals: unknown[]): {
  values: Array<number | null>;
  raw: string[];
  domain: ParallelDomain;
} {
  const nums: Array<number | null> = [];
  let isNumeric = true;
  for (const v of vals) {
    if (v == null) {
      nums.push(null);
      continue;
    }
    const f = Number(v);
    if (Number.isNaN(f) && typeof v !== "number") {
      isNumeric = false;
      break;
    }
    nums.push(f);
  }
  if (isNumeric) {
    const finite = nums.filter((x): x is number => x != null && isFinite_(x));
    const lo = finite.length ? Math.min(...finite) : 0;
    const hi = finite.length ? Math.max(...finite) : 1;
    return {
      values: vals.map((v) => (v == null ? null : Number(v))),
      raw: vals.map((v) => (v == null ? "" : numStr(Number(v)))),
      domain: { min: lo, max: hi, isNumeric: true },
    };
  }
  const seen = new Map<string, number>();
  for (const v of vals) {
    if (v != null && !seen.has(String(v))) seen.set(String(v), seen.size);
  }
  return {
    values: vals.map((v) => (v == null ? null : seen.get(String(v))!)),
    raw: vals.map((v) => (v == null ? "" : String(v))),
    domain: { min: 0, max: Math.max(seen.size - 1, 1), isNumeric: false },
  };
}

// ---- table ----------------------------------------------------------------

type ColumnType = "number" | "string" | "bool" | "other";

function colType(v: unknown): ColumnType {
  if (typeof v === "number") return "number";
  if (typeof v === "boolean") return "bool";
  if (typeof v === "string") return "string";
  return "other";
}

/** Raw tabular input → the Table renderer's `{columns, data}` contract.
 *  Accepts a list-of-objects (`[{a,b}, …]`) or a columnar `{ cols: {name: values} }`. */
export function tableData(input: unknown): {
  columns: Array<{ name: string; type: ColumnType }>;
  data: unknown[][];
} {
  // Columnar form: { cols: { name: values[] } }.
  if (isPlainObject(input) && isPlainObject((input as Dict<unknown>).cols)) {
    const cols = (input as Dict<unknown>).cols as Dict<unknown>;
    const names = Object.keys(cols);
    if (names.length === 0) throw new Error("cairnPlot: table({cols}) requires at least one column");
    const colArrays = names.map((n) => Array.from(cols[n] as ArrayLike<unknown>));
    const nrows = colArrays[0]!.length;
    for (let i = 0; i < names.length; i++) {
      if (colArrays[i]!.length !== nrows) {
        throw new Error(`cairnPlot: table({cols}) column ${JSON.stringify(names[i])} has a different length`);
      }
    }
    const columns = names.map((name, i) => ({ name, type: colType(colArrays[i]!.find((v) => v != null)) }));
    const data: unknown[][] = [];
    for (let r = 0; r < nrows; r++) data.push(colArrays.map((c) => c[r]));
    return { columns, data };
  }
  // List-of-objects form: [{a, b}, …].
  const rows = Array.from(input as ArrayLike<unknown>);
  if (rows.length === 0) throw new Error("cairnPlot: table(...) requires at least one row");
  if (!isPlainObject(rows[0])) {
    throw new Error("cairnPlot: table(rows) expects an array of row objects, or { cols: {name: values} }");
  }
  const names = Object.keys(rows[0] as Dict<unknown>);
  const columns = names.map((name) => {
    const sample = (rows as Dict<unknown>[]).map((r) => r[name]).find((v) => v != null);
    return { name, type: colType(sample) };
  });
  const data = (rows as Dict<unknown>[]).map((r) => names.map((n) => r[n] ?? null));
  return { columns, data };
}

export function parallelFromDimensions(dimensions: unknown): {
  columns: ParallelColumn[];
  rows: ParallelRow[];
  columnDomains: ParallelDomain[];
} {
  const dims = normalizeParallelDims(dimensions);
  if (dims.length === 0) {
    throw new Error("cairnPlot: parallelCoordinates(...) requires at least one dimension");
  }
  const nrows = dims[0]![1].length;
  for (const [label, vals] of dims) {
    if (vals.length !== nrows) {
      throw new Error(
        `cairnPlot: parallelCoordinates(...) dimension ${JSON.stringify(label)} has ${vals.length} rows but the first has ${nrows}`,
      );
    }
  }
  const columns: ParallelColumn[] = [];
  const columnDomains: ParallelDomain[] = [];
  const perCol: Array<{ values: Array<number | null>; raw: string[] }> = [];
  for (const [label, vals] of dims) {
    const { values, raw, domain } = parallelColumn(vals);
    columns.push({ key: String(label), source: "param" });
    columnDomains.push(domain);
    perCol.push({ values, raw });
  }
  const rows: ParallelRow[] = [];
  for (let i = 0; i < nrows; i++) {
    rows.push({
      id: String(i),
      values: perCol.map((c) => c.values[i]!),
      raw: perCol.map((c) => c.raw[i]!),
    });
  }
  return { columns, rows, columnDomains };
}
