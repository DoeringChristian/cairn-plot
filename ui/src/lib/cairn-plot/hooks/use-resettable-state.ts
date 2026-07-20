/**
 * `useResettableState` — a `useState` whose SEED is captured ONCE at mount and
 * exposed as a reset target + an `isModified` flag.
 *
 * The image/compare panes each hand-rolled the same triple: a `useRef(seedProp)`
 * ("descriptor default captured at mount"), a `reset()` that writes that ref
 * back into state, and an `isModified = value !== defaultRef.current` the shell's
 * HOME button gates on. This packages that pattern so every pane expresses it
 * once, identically.
 *
 * SEED CAPTURE (the load-bearing detail): the seed is read on the FIRST render
 * only (a `useRef` initialized from `seed`). Later `seed` changes do NOT move the
 * reset target — matching the hand-rolled `defaultsRef`/`defaultColormapRef`
 * behavior, where later prop changes mirror lifted view-local state, so resetting
 * to the live prop would no-op. Use a normal controlled `useState` if you WANT
 * the reset target to track a changing prop.
 */
import { useCallback, useRef, useState } from "react";

export interface ResettableMeta<T> {
  /** Restore the value to the mount-captured seed. */
  reset(): void;
  /** True when the live value differs (by `Object.is`) from the seed. */
  isModified: boolean;
  /** The mount-captured seed (the reset target). */
  default: T;
}

export function useResettableState<T>(
  seed: T,
): [T, (v: T) => void, ResettableMeta<T>] {
  // Captured ONCE — the initializer runs on the first render only, so `seed`
  // changes on later renders never move the reset target.
  const defaultRef = useRef(seed);
  const [value, setValue] = useState(seed);
  const reset = useCallback(() => setValue(defaultRef.current), []);
  return [
    value,
    setValue,
    {
      reset,
      isModified: !Object.is(value, defaultRef.current),
      default: defaultRef.current,
    },
  ];
}
