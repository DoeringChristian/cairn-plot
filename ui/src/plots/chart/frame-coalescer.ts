// Coalesces a rapid stream of pushed values down to at most one emit per
// animation frame, keeping only the latest value. Used to cap the rate of
// scalar-plot view-change events (wheel/pinch/pan) fired from pointer/wheel
// handlers, which can otherwise fire far faster than the screen repaints.
//
// `flush()` and `cancel()` exist so a caller can force-settle a pending
// coalesced value (flush: emit it now) or discard it (cancel: drop it)
// immediately before performing an action that must observe (or must NOT
// observe) that value synchronously — e.g. a gesture's final commit.

import { useEffect, useRef } from "react";

export interface FrameCoalescer<T> {
  push(value: T): void;
  flush(): void;
  cancel(): void;
}

/** Schedules `cb` to run on (or before) the next frame; returns a function
 *  that cancels the pending callback if it hasn't run yet. */
export type FrameScheduler = (cb: () => void) => () => void;

/** requestAnimationFrame-backed scheduler, falling back to `setTimeout(cb, 0)`
 *  when the document is hidden (rAF is throttled/suspended in background
 *  tabs) or when `requestAnimationFrame` isn't available at all (e.g. Node). */
export function defaultFrameScheduler(cb: () => void): () => void {
  const hasRaf = typeof globalThis.requestAnimationFrame === "function";
  const hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
  if (!hasRaf || hidden) {
    const id = setTimeout(cb, 0);
    return () => clearTimeout(id);
  }
  const id = globalThis.requestAnimationFrame(cb);
  return () => globalThis.cancelAnimationFrame(id);
}

export function createFrameCoalescer<T>(
  emit: (value: T) => void,
  schedule: FrameScheduler = defaultFrameScheduler,
): FrameCoalescer<T> {
  let pending = false;
  let latest: T | undefined;
  let cancelScheduled: (() => void) | null = null;

  const clearPending = () => {
    pending = false;
    latest = undefined;
    cancelScheduled = null;
  };

  const push = (value: T) => {
    latest = value;
    if (pending) return;
    pending = true;
    cancelScheduled = schedule(() => {
      // Frame fired: guard against a `cancel()` that ran in between
      // scheduling and firing (the fake/test scheduler doesn't actually
      // suppress an already-scheduled callback, and even a real one could
      // race a synchronous cancel via other paths).
      if (!pending) return;
      const value = latest as T;
      clearPending();
      emit(value);
    });
  };

  const flush = () => {
    if (!pending) return;
    const value = latest as T;
    const cancel = cancelScheduled;
    clearPending();
    cancel?.();
    emit(value);
  };

  const cancel = () => {
    if (!pending) return;
    const cancelScheduledFn = cancelScheduled;
    clearPending();
    cancelScheduledFn?.();
  };

  return { push, flush, cancel };
}

/** React hook: one `FrameCoalescer` per component instance. `emit` is
 *  ref-updated on every render so the coalescer always calls the latest
 *  closure without needing to be recreated, and any pending frame is
 *  cancelled on unmount. */
export function useFrameCoalescer<T>(emit: (value: T) => void): FrameCoalescer<T> {
  const emitRef = useRef(emit);
  emitRef.current = emit;

  const coalescerRef = useRef<FrameCoalescer<T> | null>(null);
  if (!coalescerRef.current) {
    coalescerRef.current = createFrameCoalescer<T>((value) => emitRef.current(value));
  }

  useEffect(() => {
    const coalescer = coalescerRef.current;
    return () => coalescer?.cancel();
  }, []);

  return coalescerRef.current;
}
