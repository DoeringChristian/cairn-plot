import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useDevicePixelRatio } from "../../../host/hooks/use-device-pixel-ratio";
import type { Interpolation } from "../../types";
import { deriveImageViewport, type ImageViewport } from "./image-viewport.ts";

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
    const el = viewportRef.current;
    if (!el) return;
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
    if (typeof ResizeObserver === "undefined") return;
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
