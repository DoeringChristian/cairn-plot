import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useDevicePixelRatio } from "../../../host/hooks/use-device-pixel-ratio";
import { shouldRetryObserve } from "../../../host/lazy-mount.ts";
import type { Interpolation } from "../../types";
import { deriveImageViewport, type ImageViewport } from "./image-viewport.ts";

/**
 * How many frames the viewport measurement waits for its element to be
 * committed before giving up (H9). Same bound, and the same pure predicate, as
 * the lazy gate's observer attach.
 */
const VIEWPORT_ATTACH_RETRY_FRAMES = 10;

interface Measured {
  box: { width: number; height: number };
  backing: { width: number; height: number };
}

function same(a: Measured | null, b: Measured): boolean {
  return !!a && a.box.width === b.box.width && a.box.height === b.box.height
    && a.backing.width === b.backing.width && a.backing.height === b.backing.height;
}

/**
 * The ONE measurement of an image pane's viewport element and the ONE
 * geometry derived from it (spec §3.2). Both backends call this with the
 * viewport ref the shell attaches; the result flows to the paint and, via the
 * shell's `viewport` prop, to every overlay. Exactly one ResizeObserver per
 * pane lives here. The device-pixel box is taken from
 * `devicePixelContentBoxSize` where the browser supports it (the snapped size
 * the browser will paint the element at), falling back to
 * `round(rect * devicePixelRatio)`.
 */
export function useImageViewport(args: {
  viewportRef: RefObject<HTMLElement | null>;
  zoom: number;
  pan: { x: number; y: number };
  naturalDims: { w: number; h: number } | null;
  interpolation: Interpolation;
}): ImageViewport | null {
  const { viewportRef, zoom, pan, naturalDims, interpolation } = args;
  const dpr = useDevicePixelRatio();
  const [measured, setMeasured] = useState<Measured | null>(null);
  const lastRef = useRef<Measured | null>(null);

  useLayoutEffect(() => {
    // H9: the element may not be committed when this effect first runs (a pane
    // whose viewport is mounted a frame late by its container). The effect's deps
    // are `[viewportRef, dpr]`, so returning here used to mean the pane was NEVER
    // measured and `useImageViewport` returned null for the page's life — a
    // permanently blank pane (the render pass holds on a null viewport). Retry on
    // the next frame instead, bounded.
    let retryHandle: { kind: "raf" | "timeout"; id: number } | null = null;
    let detach: (() => void) | null = null;
    let cancelled = false;
    const attach = (attempt: number): void => {
      if (cancelled) return;
      const el = viewportRef.current;
      if (!el) {
        if (!shouldRetryObserve(attempt, VIEWPORT_ATTACH_RETRY_FRAMES)) return;
        retryHandle = typeof requestAnimationFrame === "function"
          ? { kind: "raf", id: requestAnimationFrame(() => attach(attempt + 1)) }
          : { kind: "timeout", id: setTimeout(() => attach(attempt + 1), 16) as unknown as number };
        return;
      }
      detach = observe(el);
    };
    const observe = (el: HTMLElement): (() => void) | null => {
      const apply = (next: Measured) => {
        if (same(lastRef.current, next)) return;
        lastRef.current = next;
        setMeasured(next);
      };
      const fallback = () => {
        const r = el.getBoundingClientRect();
        const ratio = window.devicePixelRatio || 1;
        apply({
          box: { width: r.width, height: r.height },
          backing: { width: Math.round(r.width * ratio), height: Math.round(r.height * ratio) },
        });
      };
      fallback(); // synchronous first measure so the first commit can paint
      // A zero box measures as zero (`deriveImageViewport` returns null for it —
      // MEASURE-THEN-RENDER, the pane holds blank). The observer below is what
      // recovers such a pane: a container that is hidden/zero-height at attach
      // time re-measures the moment it gains a box, with no node change and no
      // remount.
      if (typeof ResizeObserver === "undefined") return null;
      const ro = new ResizeObserver((entries) => {
        const entry = entries[entries.length - 1];
        if (!entry) return;
        const cr = entry.contentRect;
        // `devicePixelContentBoxSize` may not be in the DOM lib version in use.
        const dp = (
          entry as ResizeObserverEntry & {
            devicePixelContentBoxSize?: ReadonlyArray<{ inlineSize: number; blockSize: number }>;
          }
        ).devicePixelContentBoxSize?.[0];
        if (dp) {
          apply({
            box: { width: cr.width, height: cr.height },
            backing: { width: dp.inlineSize, height: dp.blockSize },
          });
        } else {
          fallback();
        }
      });
      try {
        // Older browsers throw on this unknown box value; fall back to the default.
        ro.observe(el, { box: "device-pixel-content-box" } as ResizeObserverOptions);
      } catch {
        ro.observe(el);
      }
      return () => ro.disconnect();
    };
    attach(0);
    return () => {
      cancelled = true;
      if (retryHandle?.kind === "raf") cancelAnimationFrame(retryHandle.id);
      else if (retryHandle?.kind === "timeout") clearTimeout(retryHandle.id);
      detach?.();
      // Forget the last measurement with the observer that produced it: the next
      // attach may be measuring a DIFFERENT element (a dpr change re-runs this
      // effect; a remount gives a new element), and `same()` against a stale
      // value would swallow the first real measurement of the new one.
      lastRef.current = null;
    };
  }, [viewportRef, dpr]);

  const nw = naturalDims?.w ?? 0;
  const nh = naturalDims?.h ?? 0;
  return useMemo(
    () => measured
      ? deriveImageViewport({
          box: measured.box,
          backing: measured.backing,
          view: { zoom, pan: { x: pan.x, y: pan.y } },
          natural: nw > 0 && nh > 0 ? { w: nw, h: nh } : null,
          interpolation,
        })
      : null,
    [measured, zoom, pan.x, pan.y, nw, nh, interpolation],
  );
}
