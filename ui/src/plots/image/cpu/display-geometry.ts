export interface CpuDisplayGeometry {
  /** Untransformed contained source rectangle inside the CPU wrapper. */
  home: { left: number; top: number; width: number; height: number };
  /** Transformed source rectangle in viewport-local CSS pixels. */
  quad: { left: number; top: number; width: number; height: number };
  grid: { width: number; height: number };
}

/**
 * The single source-to-screen affine geometry used by CPU image paint and
 * numeric overlays. `translate(pan) scale(zoom)` maps a source texel edge
 * `(x,y)` to:
 *
 *   screen = pan + zoom * (homeOrigin + homeScale * source)
 */
export function computeCpuDisplayGeometry(
  box: { width: number; height: number },
  source: { width: number; height: number },
  zoom: number,
  pan: { x: number; y: number },
): CpuDisplayGeometry | null {
  if (
    box.width <= 0 || box.height <= 0 ||
    source.width <= 0 || source.height <= 0 ||
    !Number.isFinite(zoom) || zoom <= 0 ||
    !Number.isFinite(pan.x) || !Number.isFinite(pan.y)
  ) return null;
  const homeScale = Math.min(box.width / source.width, box.height / source.height);
  const width = source.width * homeScale;
  const height = source.height * homeScale;
  const left = (box.width - width) / 2;
  const top = (box.height - height) / 2;
  return {
    home: { left, top, width, height },
    quad: {
      left: pan.x + left * zoom,
      top: pan.y + top * zoom,
      width: width * zoom,
      height: height * zoom,
    },
    grid: { width: source.width, height: source.height },
  };
}
