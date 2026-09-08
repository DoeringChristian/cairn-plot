// ---------------------------------------------------------------------------
// Shared view state synced across comparison panes.
//
// Pure module: no react-plotly.js / plotly.js import, so these helpers can be
// unit-tested under `node --experimental-strip-types --test` without pulling a
// browser-only bundle into the test process. `Figure.tsx` re-exports every
// symbol here, so existing `from ".../Figure"` imports keep working.
// ---------------------------------------------------------------------------

export type SharedView = Record<string, unknown>;

/** Extract axis ranges + scene camera from a Plotly relayout event object. */
export function extractViewState(relayoutData: Record<string, unknown>): SharedView | null {
  const view: SharedView = {};
  let any = false;
  for (const [k, v] of Object.entries(relayoutData)) {
    // 2D axis ranges: xaxis.range[0], yaxis.range[1], xaxis.autorange, etc.
    if (/^[xy]axis\d*\./.test(k)) {
      view[k] = v;
      any = true;
    }
    // 3D scene camera: both dot-path (scene.camera.eye.x) and nested object (scene)
    if (/^scene\d*\.camera/.test(k)) {
      view[k] = v;
      any = true;
    }
    // 3D scene as a nested object (Plotly sometimes sends {scene: {camera: {...}}})
    if (/^scene\d*$/.test(k) && v && typeof v === "object") {
      view[k] = v;
      any = true;
    }
    // Mapbox/geo: mapbox.center, mapbox.zoom, geo.projection, etc.
    if (/^(mapbox|geo)\d*\./.test(k)) {
      view[k] = v;
      any = true;
    }
  }
  return any ? view : null;
}

/** Deep merge b into a (returns new object). */
export function deepMerge(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
  const result = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (v && typeof v === "object" && !Array.isArray(v) && a[k] && typeof a[k] === "object" && !Array.isArray(a[k])) {
      result[k] = deepMerge(a[k] as Record<string, unknown>, v as Record<string, unknown>);
    } else {
      result[k] = v;
    }
  }
  return result;
}

/**
 * The container prefix a relayout key addresses: `"xaxis.range[0]"` → `"xaxis"`,
 * `"scene2.camera.eye.x"` → `"scene2"`, `"scene"` → `"scene"`.
 */
function viewKeyPrefix(k: string): string {
  return k.split(".")[0]!.replace(/\[\d+]$/, "");
}

/**
 * Merge one Plotly relayout event into the accumulated shared view, REPLACING
 * (not merging) every key of each axis/scene the event touches.
 *
 * Plotly emits an axis reset as `{"xaxis.autorange": true}` and a zoom as
 * `{"xaxis.range[0]": …, "xaxis.range[1]": …}`. Accumulating both — which a
 * plain `{...prev, ...incoming}` does, because the reset's key and the zoom's
 * keys are different strings — leaves `{autorange: true, range: [lo, hi]}` on
 * one axis, and Plotly resolves that pair to autorange: the zoom silently
 * becomes a no-op. Dropping the axis's previous keys first keeps the two
 * mutually exclusive, while an unrelated axis (or scene) keeps its state.
 */
export function mergeRelayout(prev: SharedView, incoming: SharedView): SharedView {
  const touched = new Set<string>();
  for (const k of Object.keys(incoming)) touched.add(viewKeyPrefix(k));
  const result: SharedView = {};
  for (const [k, v] of Object.entries(prev)) {
    if (touched.has(viewKeyPrefix(k))) continue;
    result[k] = v;
  }
  for (const [k, v] of Object.entries(incoming)) result[k] = v;
  // Identity-stable when nothing changed. Plotly echoes the ranges it was
  // just given back through `plotly_relayout`; returning `prev` for such an
  // echo keeps the state identity, so the host does not re-render, the
  // figure does not re-plot, and the echo cannot loop (re-plot → relayout →
  // new state → re-plot …), which shows up as a zoom that jitters forever.
  return sameView(prev, result) ? prev : result;
}

/** Value equality of two views; numbers compare within 1e-9 relative. */
export function sameView(a: SharedView, b: SharedView): boolean {
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  for (const k of ka) {
    if (!(k in b) || !sameValue(a[k], b[k])) return false;
  }
  return true;
}

function sameValue(x: unknown, y: unknown): boolean {
  if (x === y) return true;
  if (typeof x === "number" && typeof y === "number") {
    return Number.isNaN(x) && Number.isNaN(y) || Math.abs(x - y) <= 1e-9 * Math.max(1, Math.abs(x), Math.abs(y));
  }
  if (Array.isArray(x) && Array.isArray(y)) return x.length === y.length && x.every((v, i) => sameValue(v, y[i]));
  if (x && y && typeof x === "object" && typeof y === "object") {
    const kx = Object.keys(x as object), ky = Object.keys(y as object);
    return kx.length === ky.length && kx.every((k) => sameValue((x as Record<string, unknown>)[k], (y as Record<string, unknown>)[k]));
  }
  return false;
}

/**
 * Merge shared view overrides into a Plotly layout object.
 *
 * Never mutates `layout` (or anything reachable from it): the layout handed in
 * is usually the react-query-cached artifact JSON shared by every card that
 * renders that hash, so writing into a nested `xaxis` in place would pin all of
 * them to one pane's zoom. Every container is cloned on the way down.
 */
export function applyViewOverrides(
  layout: Record<string, unknown>,
  overrides: SharedView,
): Record<string, unknown> {
  const result = { ...layout };
  for (const [k, v] of Object.entries(overrides)) {
    // If the value is an object and key has no dots (e.g. "scene" with nested camera),
    // deep-merge it into the layout.
    if (!k.includes(".") && !k.includes("[") && v && typeof v === "object" && !Array.isArray(v)) {
      // deepMerge already returns a fresh object, so nothing is mutated here.
      result[k] = deepMerge((result[k] as Record<string, unknown>) ?? {}, v as Record<string, unknown>);
      continue;
    }
    // Plotly relayout keys are dot-separated paths like "xaxis.range[0]"
    const bracketMatch = k.match(/^(.+)\[(\d+)]$/);
    if (bracketMatch) {
      const [, path, idx] = bracketMatch;
      const parts = path!.split(".");
      let obj: Record<string, unknown> = result;
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i]!;
        if (i === parts.length - 1) {
          // Copy-on-write: never write into the input's array.
          obj[p] = Array.isArray(obj[p]) ? [...(obj[p] as unknown[])] : [];
          (obj[p] as unknown[])[Number(idx)] = v;
        } else {
          obj[p] = obj[p] && typeof obj[p] === "object" && !Array.isArray(obj[p])
            ? { ...(obj[p] as Record<string, unknown>) }
            : {};
          obj = obj[p] as Record<string, unknown>;
        }
      }
    } else {
      const parts = k.split(".");
      let obj: Record<string, unknown> = result;
      for (let i = 0; i < parts.length - 1; i++) {
        const p = parts[i]!;
        obj[p] = obj[p] && typeof obj[p] === "object" && !Array.isArray(obj[p])
          ? { ...(obj[p] as Record<string, unknown>) }
          : {};
        obj = obj[p] as Record<string, unknown>;
      }
      obj[parts[parts.length - 1]!] = v;
    }
  }
  return result;
}
