export type PlotKindOwner = "definition" | "legacy-renderer";

const owners = new Map<string, PlotKindOwner>();

/** Prevent one plot kind from being interpreted by both migration registries. */
export function claimPlotKind(kind: string, owner: PlotKindOwner): void {
  const existing = owners.get(kind);
  if (existing && existing !== owner) {
    throw new Error(`cairn-plot: plot kind ${JSON.stringify(kind)} is already owned by ${existing}`);
  }
  owners.set(kind, owner);
}

export function releasePlotKinds(owner: PlotKindOwner): void {
  for (const [kind, existing] of owners) {
    if (existing === owner) owners.delete(kind);
  }
}
