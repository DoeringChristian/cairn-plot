/**
 * `use-surface-settings.ts` — the ONE place the CONTROLLED-vs-OWNED surface
 * policy is expressed.
 *
 * A display setting (peak / γ / bounds / encoding / …) on an image pane has
 * exactly two seeding regimes, chosen by a single axis:
 *
 *  - **Owned** (an interactive VIEWPORT — a standalone pane, a grid cell, or the
 *    ONE reused renderer of a stacked viewport): the pane OWNS the setting. It is
 *    seeded once (a `useState` initializer at the call site) and PERSISTS across
 *    descriptor prop changes / slot flips; only a user pick or HOME moves it.
 *  - **Controlled** (a `toolbar={false}` host-driven surface — a card/host hides
 *    the toolbar and drives colormap/tonemap/peak/… from its OWN menu): the pane
 *    FOLLOWS the props — every descriptor change RESEEDS the setting.
 *
 * Before this seam that policy was re-implemented per field as a bare
 * `useEffect(() => { if (controlledSurface) setX(...) }, [propX, controlledSurface])`
 * — the same shape copied across `GpuImagePane` (peak, γ, bounds) and both of
 * `CpuImagePane`'s bodies (γ ×2, bounds), the classic "policy applied N times by
 * hand" that drifts when an N+1th field is added. `useControlledReseed` names it
 * once: the Owned case is the `useState` seed at the call site (this hook is a
 * no-op for it); the Controlled case runs `reseed()` whenever `seedDeps` change.
 *
 * (This is the reseed half of the eventual `useSurfaceSettings(Controlled|Owned)`
 * seam — the per-field seed initializers still live at each call site because
 * their reseed CONDITIONS differ, e.g. γ only reseeds from a positive prop.)
 */
import { useEffect, type DependencyList } from "react";

/**
 * Apply the controlled-surface reseed policy for one display setting.
 *
 * @param controlled  true on a `toolbar={false}` host-driven surface (follow
 *                     props); false on an interactive viewport (own the setting).
 * @param reseed      re-derive the setting from the current props. Runs only when
 *                    `controlled`; the caller keeps any per-field guard inside it
 *                    (e.g. γ's "only from a positive prop").
 * @param seedDeps    the props `reseed` reads — the effect re-fires on their change
 *                    (plus `controlled` itself).
 */
export function useControlledReseed(
  controlled: boolean,
  reseed: () => void,
  seedDeps: DependencyList,
): void {
  useEffect(() => {
    if (controlled) reseed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlled, ...seedDeps]);
}
