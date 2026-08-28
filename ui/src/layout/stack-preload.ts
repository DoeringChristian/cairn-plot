/** Previous/next slot indices, wrapping exactly like stack keyboard navigation. */
export function adjacentStackIndices(active: number, count: number): number[] {
  if (count <= 1) return [];
  const current = Math.min(Math.max(0, active), count - 1);
  const previous = (current - 1 + count) % count;
  const next = (current + 1) % count;
  return previous === next ? [previous] : [previous, next];
}

