/**
 * Pure keyboard mapping for a STACKED grid's tab navigation — framework-free so
 * it unit-tests under Node. Maps a keydown to a navigation action over `count`
 * tabs, or `null` when the key isn't a stack-nav key.
 *
 *   - STEP: `←`/`↑`/`h`/`k` → prev, `→`/`↓`/`l`/`j` → next (wrap at the ends).
 *     The vim `hjkl` aliases are "always arrows", so they WIN over letter-jump —
 *     i.e. `h`/`j`/`k`/`l` step rather than jump to tabs 8/10/11/12 (those stay
 *     reachable by number, arrows, or click).
 *   - NUMBER jump: `1`–`9` → tab 1–9, `0` → tab 10.
 *   - LETTER jump: `a`–`z` → tab 1–26 (minus `h`/`j`/`k`/`l`, consumed as steps).
 *
 * `Shift` (and ctrl/meta/alt) is reserved (e.g. a compare cell's slide-flip on
 * Shift+←/→), so modified keys never navigate tabs.
 */
export type StackKeyAction = { type: "prev" } | { type: "next" } | { type: "jump"; index: number } | null;

export function stackKeyAction(
  key: string,
  mods: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean },
  count: number,
): StackKeyAction {
  if (count <= 0) return null;
  if (mods.shiftKey || mods.ctrlKey || mods.metaKey || mods.altKey) return null;
  const isChar = key.length === 1;
  const c = isChar ? key.toLowerCase() : key;

  if (c === "ArrowLeft" || c === "ArrowUp" || c === "h" || c === "k") return { type: "prev" };
  if (c === "ArrowRight" || c === "ArrowDown" || c === "l" || c === "j") return { type: "next" };

  if (isChar && c >= "0" && c <= "9") {
    const index = c === "0" ? 9 : c.charCodeAt(0) - 49; // '1' → 0
    return index < count ? { type: "jump", index } : null;
  }
  if (isChar && c >= "a" && c <= "z") {
    const index = c.charCodeAt(0) - 97; // 'a' → 0 (h/j/k/l already returned above)
    return index < count ? { type: "jump", index } : null;
  }
  return null;
}

/** Resolve a nav action against the current active index → the new active index
 *  (wrapping for prev/next). */
export function applyStackAction(action: StackKeyAction, active: number, count: number): number {
  if (!action || count <= 0) return active;
  if (action.type === "prev") return (active - 1 + count) % count;
  if (action.type === "next") return (active + 1) % count;
  return Math.max(0, Math.min(count - 1, action.index));
}

/** The compact quick-jump badge for tab `i` (0-based): its 1-based number and,
 *  where it doesn't collide with the hjkl step keys, its letter. */
export function stackTabBadge(i: number): string {
  const num = String(i + 1);
  const letter = i < 26 ? String.fromCharCode(97 + i) : "";
  const stepKey = letter === "h" || letter === "j" || letter === "k" || letter === "l";
  return letter && !stepKey ? letter : num;
}
