/**
 * Diff-kernel registry (spec §registry). Each diff/loss method is its own
 * kernel module (NO growing switch); this registry is the single lookup the
 * diff engine (`../diff-engine.ts`), the pane (`GpuComparePane`), and the
 * toolbar menu (follow-up track) share.
 *
 * Two kernel shapes:
 *   - **Pointwise** (`kind:"pointwise"`): exposes a WGSL fragment defining
 *     `fn kernel(a: vec4f, b: vec4f) -> vec4f` returning the RAW per-channel
 *     diff (NOT display-mapped). The diff engine wraps it in a fullscreen pass
 *     that samples both sources at each texel and writes the raw result to an
 *     rgba16float texture. Display mapping (`displayRange` → colormap) happens
 *     later, at blit time — so exposure/zoom/pan/colormap never recompute.
 *   - **Multi-pass** (`kind:"multipass"`): exposes a pass-graph builder. FLIP
 *     is the first implementation (`flip.wgsl.ts`).
 *
 * `publicName` is the flat short name the Python `cp.Compare(mode=...)` enum
 * and the toolbar menu use (e.g. `absolute` → `abs`); `id` is the internal
 * kernel id also carried by the descriptor's `diffSubmode`.
 */
import type { BindGroupEntry } from "../types";

/** How the display blit maps a raw result value → [0,1] before the colormap. */
export type DisplayRange = "unit" | "signed" | "relative";

/** Result arity of a diff kernel (see `KernelMetaBase.output`). */
export type KernelOutput = "scalar" | "per-channel";

interface KernelMetaBase {
  /** Internal kernel id (also the descriptor `diffSubmode` value). */
  id: string;
  /** Menu text (long, human-readable). */
  label: string;
  /** Flat short name for the Python `mode=` enum + toolbar menu. */
  publicName: string;
  /** Result arity — drives the diff-mode TEV overlay's line count. A `"scalar"`
   *  kernel produces ONE value per pixel (a perceptual metric like FLIP)
   *  replicated across R/G/B in the rgba16float result (alpha=1), so the overlay
   *  reads the R channel and prints ONE untinted line; a `"per-channel"` kernel
   *  (the six pointwise diffs) produces a genuine R/G/B error and prints three
   *  channel-tinted lines. Printing three identical numbers for a scalar kernel
   *  was the reported bug. */
  output: KernelOutput;
  /** Display value→[0,1] mapping the blit applies before the colormap. */
  displayRange: DisplayRange;
  /** Typed default parameters (e.g. FLIP `ppd`). */
  params?: Readonly<Record<string, number>>;
}

export interface PointwiseKernel extends KernelMetaBase {
  kind: "pointwise";
  /** WGSL source defining `fn kernel(a: vec4<f32>, b: vec4<f32>) -> vec4<f32>`. */
  source: string;
}

/** One render pass in a multi-pass kernel's graph. */
export interface KernelPass {
  name: string;
  /** Full WGSL module (the diff engine prepends nothing — build it complete). */
  shader: string;
  /**
   * Ordered input refs. `"srcA"`/`"srcB"` = the two source textures; any other
   * name = a prior pass's output. Bound at logical texture bindings 0,1,2,…
   * (native 0,3,6,…).
   */
  inputs: string[];
  /** Name this pass's output texture is registered under. */
  output: string;
  /** Extra uniform bind-group entries (logical bindings ≥ inputs.length). */
  uniforms?: (ctx: KernelBuildCtx) => BindGroupEntry[];
}

export interface PassGraph {
  passes: KernelPass[];
  /** Ref of the pass output that is the final result texture. */
  final: string;
}

export interface KernelBuildCtx {
  width: number;
  height: number;
  params: Record<string, number>;
}

export interface MultipassKernel extends KernelMetaBase {
  kind: "multipass";
  buildPasses(ctx: KernelBuildCtx): PassGraph;
}

export type DiffKernel = PointwiseKernel | MultipassKernel;

const REGISTRY = new Map<string, DiffKernel>();

export function registerDiffKernel(kernel: DiffKernel): void {
  if (REGISTRY.has(kernel.id)) {
    throw new Error(`registerDiffKernel: duplicate kernel id "${kernel.id}"`);
  }
  REGISTRY.set(kernel.id, kernel);
}

export function getDiffKernel(id: string): DiffKernel | undefined {
  return REGISTRY.get(id);
}

/** All registered kernels, in registration order (menu order). */
export function listDiffKernels(): DiffKernel[] {
  return Array.from(REGISTRY.values());
}

/** Resolve a param set for a kernel: its typed defaults overlaid with `params`. */
export function resolveKernelParams(kernel: DiffKernel, params?: Record<string, number>): Record<string, number> {
  return { ...(kernel.params ?? {}), ...(params ?? {}) };
}
