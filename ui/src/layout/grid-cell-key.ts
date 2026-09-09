/**
 * H6 — stable React keys AND session paths for grid cells.
 *
 * `GridLayout` used to key its cells by ARRAY INDEX. On a comparison page whose
 * run set is reordered or filtered (a run finishes, a filter drops one, the
 * sort flips) React then matched cell 0 to cell 0 — so every pane kept its
 * mounted component instance but was handed a DIFFERENT node. Every WebGPU pane
 * handle, viewport, hold-previous frame and settings cell silently belonged to
 * another run: panes showed the wrong image, or froze mid-handoff.
 *
 * The same argument applies to the per-cell SESSION path (`cell:<path>`,
 * `stack:<path>`): an index-derived path hands pane 2's saved settings to
 * whichever run lands in slot 2 next. Both therefore derive from node identity.
 *
 * DOM-free and pure so it unit-tests under `node --experimental-strip-types`
 * (the .tsx layout shell itself cannot be imported by that runner).
 */

/** The identity a cell key is derived from. Deliberately structural rather than
 *  `PlotNode`, so non-spec callers (and tests) can use it too. */
export interface GridCellIdentity {
  readonly id?: string;
}

/** Positional fallback for a node that carries no identity at all. Prefixed so
 *  it can never collide with an authored `id` that happens to be a number. */
export function positionalCellKey(index: number): string {
  return `i${index}`;
}

/**
 * The key for one cell: the node's authored `id`, else its position. An empty
 * string is treated as absent (an authored `id: ""` is not an identity).
 */
export function gridCellKey(
  child: GridCellIdentity | null | undefined,
  index: number,
): string {
  const id = child?.id;
  return typeof id === "string" && id !== "" ? id : positionalCellKey(index);
}

/** Warn about duplicate ids at most once per page — a repeat is an authoring
 *  bug worth surfacing, but a 200-cell report must not emit 200 lines. */
let warnedDuplicateCellId = false;

/**
 * Keys for a whole child list, de-duplicated.
 *
 * Duplicate keys are worse than index keys (React drops siblings), and nothing
 * validates that a host's ids are unique — so a repeat falls back to its
 * positional key, and a final `#n` suffix closes the remaining hole (an
 * authored id that happens to equal another cell's positional key).
 */
export function gridCellKeys(
  children: readonly (GridCellIdentity | null | undefined)[],
): string[] {
  const used = new Set<string>();
  let duplicate: string | undefined;
  const keys = children.map((child, index) => {
    let key = gridCellKey(child, index);
    if (used.has(key)) {
      duplicate ??= key;
      key = positionalCellKey(index);
    }
    let candidate = key;
    let bump = 2;
    while (used.has(candidate)) candidate = `${key}#${bump++}`;
    used.add(candidate);
    return candidate;
  });
  if (duplicate !== undefined && !warnedDuplicateCellId) {
    warnedDuplicateCellId = true;
    // eslint-disable-next-line no-console
    console.warn(
      `cairn-plot: duplicate grid child id ${JSON.stringify(duplicate)} — cells fell back to ` +
        `positional keys, so reordering will not carry their panes or settings. Give every ` +
        `child a unique \`id\`.`,
    );
  }
  return keys;
}

/** Test seam only — re-arm the once-per-page duplicate-id warning. */
export function __resetDuplicateCellIdWarningForTest(): void {
  warnedDuplicateCellId = false;
}

/**
 * The session/descriptor path of one cell: the parent's path plus the cell's
 * identity key. `/` is the path separator, so an authored id containing one is
 * escaped rather than silently creating a phantom nesting level.
 */
export function gridCellPath(parentPath: string, cellKey: string): string {
  return `${parentPath}/${cellKey.replace(/\//g, "%2F")}`;
}
