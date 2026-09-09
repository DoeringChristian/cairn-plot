/**
 * H6 — stable React keys for grid cells.
 *
 * `GridLayout` used to key its cells by ARRAY INDEX. On a comparison page whose
 * run set is reordered or filtered (a run finishes, a filter drops one, the
 * sort flips) React then matched cell 0 to cell 0 — so every pane kept its
 * mounted component instance but was handed a DIFFERENT node. Every WebGPU pane
 * handle, viewport, hold-previous frame and settings cell silently belonged to
 * another run: panes showed the wrong image, or froze mid-handoff.
 *
 * Keying by node IDENTITY instead makes React move the instance with its node
 * (and mount/unmount only the cells that genuinely appeared/disappeared).
 *
 * DOM-free and pure so it unit-tests under `node --experimental-strip-types`
 * (the .tsx layout shell itself cannot be imported by that runner).
 */

/** The identity fields a cell key may be derived from. Deliberately structural
 *  rather than `PlotNode`, so non-spec callers (and tests) can use it too. */
export interface GridCellIdentity {
  readonly id?: string;
  readonly key?: string;
}

/** Positional fallback for a node that carries no identity at all. Prefixed so
 *  it can never collide with an authored `id` that happens to be a number. */
export function positionalCellKey(index: number): string {
  return `i${index}`;
}

/**
 * The key for one cell: the node's authored `id`, else a host-supplied `key`,
 * else its position. An empty string is treated as absent (an authored `id: ""`
 * is not an identity).
 */
export function gridCellKey(
  child: GridCellIdentity | null | undefined,
  index: number,
): string {
  const id = child?.id;
  if (typeof id === "string" && id !== "") return id;
  const key = child?.key;
  if (typeof key === "string" && key !== "") return key;
  return positionalCellKey(index);
}

/**
 * Keys for a whole child list, de-duplicated.
 *
 * Duplicate keys are worse than index keys (React drops siblings), and nothing
 * validates that a host's ids are unique — so a repeat falls back to its
 * positional key, which is unique by construction and cannot collide with the
 * `id`/`key` namespace only if that too is taken; the final `#n` suffix closes
 * that last hole deterministically.
 */
export function gridCellKeys(
  children: readonly (GridCellIdentity | null | undefined)[],
): string[] {
  const used = new Set<string>();
  return children.map((child, index) => {
    let key = gridCellKey(child, index);
    if (used.has(key)) key = positionalCellKey(index);
    let candidate = key;
    let bump = 2;
    while (used.has(candidate)) candidate = `${key}#${bump++}`;
    used.add(candidate);
    return candidate;
  });
}
