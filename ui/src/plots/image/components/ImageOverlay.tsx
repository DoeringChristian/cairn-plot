import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type {
  ImageOverlayData,
  ImageOverlaySettings,
  OverlayBox,
} from "../../types";
import { overlayClassColor } from "../../types";
import type { ImageViewport } from "./image-viewport.ts";
import { placeBox } from "./image-overlay-placement.ts";

export interface ImageOverlayProps {
  data: ImageOverlayData;
  settings: ImageOverlaySettings;
  /** The pane's shared viewport geometry (box/backing/quad/natural). */
  viewport: ImageViewport;
}

/** Hex "#rrggbb" -> [r, g, b]. */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function boxVisible(
  box: OverlayBox,
  settings: ImageOverlaySettings,
  hidden: Set<number>,
): boolean {
  if (hidden.has(box.class_id)) return false;
  if (box.score != null && box.score < settings.scoreThreshold) return false;
  return true;
}

/**
 * Annotation layer (boxes + masks) drawn on ONE canvas that fills the pane and
 * is sized from `viewport.backing`. Everything is placed through the shared
 * `viewport.quad` (the image's on-screen rect under the current zoom/pan), so
 * the annotations follow the image exactly the way the pane's own draw does —
 * no self-measurement, no CSS transform inheritance. Box labels stay HTML chips
 * so their font never scales with zoom.
 */
export default function ImageOverlay({
  data,
  settings,
  viewport,
}: ImageOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskSourceRef = useRef<HTMLCanvasElement | null>(null);
  const [maskVersion, setMaskVersion] = useState(0);

  const hidden = useMemo(
    () => new Set(settings.hiddenClasses),
    [settings.hiddenClasses],
  );

  const { natural, quad, backing, dpr } = viewport;

  // -----------------------------------------------------------------------
  // Masks: decode each PNG, colorize by class id, composite onto ONE offscreen
  // native-resolution canvas. Bumping `maskVersion` repaints the draw effect.
  // -----------------------------------------------------------------------
  const masks = data.masks;
  const showMasks = settings.showMasks && !!masks && masks.length > 0;
  const hiddenKey = useMemo(
    () => settings.hiddenClasses.join(","),
    [settings.hiddenClasses],
  );
  const naturalWidth = natural.w;
  const naturalHeight = natural.h;

  useEffect(() => {
    if (!showMasks || !masks) return;
    if (naturalWidth <= 0 || naturalHeight <= 0) return;
    let canvas = maskSourceRef.current;
    if (!canvas) {
      canvas = document.createElement("canvas");
      maskSourceRef.current = canvas;
    }
    if (canvas.width !== naturalWidth || canvas.height !== naturalHeight) {
      canvas.width = naturalWidth;
      canvas.height = naturalHeight;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let cancelled = false;
    const out = ctx.createImageData(naturalWidth, naturalHeight);
    const outData = out.data;
    let pending = masks.length;
    let anyDrawn = false;

    const finish = () => {
      if (cancelled) return;
      if (anyDrawn) ctx.putImageData(out, 0, 0);
      setMaskVersion((v) => v + 1);
    };

    const decode = document.createElement("canvas");
    decode.width = naturalWidth;
    decode.height = naturalHeight;
    const dctx = decode.getContext("2d", { willReadFrequently: true });

    for (const mask of masks) {
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        if (dctx) {
          dctx.clearRect(0, 0, naturalWidth, naturalHeight);
          dctx.drawImage(img, 0, 0, naturalWidth, naturalHeight);
          const src = dctx.getImageData(0, 0, naturalWidth, naturalHeight).data;
          for (let i = 0; i < naturalWidth * naturalHeight; i++) {
            const classId = src[i * 4]!; // grayscale -> class id
            if (classId === 0) continue; // background
            if (hidden.has(classId)) continue;
            const [r, g, b] = hexToRgb(overlayClassColor(classId));
            outData[i * 4] = r;
            outData[i * 4 + 1] = g;
            outData[i * 4 + 2] = b;
            outData[i * 4 + 3] = 255;
            anyDrawn = true;
          }
        }
        pending -= 1;
        if (pending === 0) finish();
      };
      img.onerror = () => {
        pending -= 1;
        if (pending === 0) finish();
      };
      img.src = `data:image/png;base64,${mask.png_b64}`;
    }

    return () => {
      cancelled = true;
    };
    // hiddenKey drives re-colorize when class visibility changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMasks, masks, naturalWidth, naturalHeight, hiddenKey]);

  // -----------------------------------------------------------------------
  // Draw: masks + box strokes onto the pane-sized canvas, in device pixels.
  // -----------------------------------------------------------------------
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (canvas.width !== backing.width || canvas.height !== backing.height) {
      canvas.width = backing.width;
      canvas.height = backing.height;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const sx = backing.width / viewport.box.width;
    const sy = backing.height / viewport.box.height;
    const drawMasks =
      settings.showMasks && !!data.masks && data.masks.length > 0;
    if (drawMasks && maskSourceRef.current) {
      ctx.globalAlpha = settings.maskOpacity;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        maskSourceRef.current,
        quad.left * sx,
        quad.top * sy,
        quad.width * sx,
        quad.height * sy,
      );
      ctx.globalAlpha = 1;
    }
    const boxes = data.boxes ?? [];
    if (settings.showBoxes && boxes.length > 0) {
      ctx.lineWidth = 2 * dpr;
      for (const box of boxes) {
        if (!boxVisible(box, settings, hidden)) continue;
        const r = placeBox(box, quad, natural);
        ctx.strokeStyle = overlayClassColor(box.class_id);
        ctx.strokeRect(r.left * sx, r.top * sy, r.width * sx, r.height * sy);
      }
    }
  }, [viewport, data, settings, hidden, maskVersion, natural, quad, backing, dpr]);

  const boxes = data.boxes ?? [];
  const classLabels = data.class_labels ?? {};

  return (
    <div
      data-image-overlay=""
      className="absolute inset-0 pointer-events-none overflow-hidden"
    >
      {/* Structural, not cosmetic: the viewport element measures itself, so this
          canvas must stay OUT of flow even on a page with no Tailwind. */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
        aria-hidden
      />
      {settings.showBoxes &&
        boxes.map((box, i) => {
          if (!boxVisible(box, settings, hidden)) return null;
          const r = placeBox(box, quad, natural);
          const name =
            box.label ?? classLabels[String(box.class_id)] ?? `#${box.class_id}`;
          const scoreTxt =
            box.score != null ? ` ${(box.score * 100).toFixed(0)}%` : "";
          if (!name && !scoreTxt) return null;
          return (
            <span
              key={i}
              className="absolute whitespace-nowrap rounded px-1 text-[10px] leading-tight text-white"
              style={{
                left: r.left,
                top: r.top,
                transform: "translateY(-100%)",
                backgroundColor: overlayClassColor(box.class_id),
              }}
            >
              <span className="mono">
                {name}
                {scoreTxt}
              </span>
            </span>
          );
        })}
    </div>
  );
}
