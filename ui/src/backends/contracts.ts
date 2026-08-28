/** Framework-independent lifecycle shared by every concrete plot backend. */

export type BackendTechnology = "dom" | "canvas2d" | "webgpu" | "three";

export interface RenderSize {
  width: number;
  height: number;
}

/** A cell-owned drawing target. Backends may mutate only this element. */
export interface RenderSurface {
  readonly element: HTMLElement;
  readonly size: RenderSize;
  readonly pixelRatio: number;
}

export interface RenderEnvironment {
  readonly webgpu: boolean;
  readonly webgl2: boolean;
  readonly pixelRatio: number;
}

export interface BackendSupport {
  readonly supported: boolean;
  readonly priority?: number;
  readonly reason?: string;
}

export type SemanticInvalidation =
  | "none"
  | "presentation"
  | "content"
  | "layout"
  | "remount";

export interface BackendInput<TPresentation, TSettings> {
  readonly presentation: TPresentation;
  readonly settings: Readonly<TSettings>;
  readonly invalidation: SemanticInvalidation;
}

export interface BackendInstance<TPresentation, TSettings> {
  update(input: BackendInput<TPresentation, TSettings>): void;
  snapshot?(options?: { type?: string; quality?: number }): Promise<Blob>;
  /** Must be safe to call more than once. */
  destroy(): void;
}

/** One implementation of a semantic presentation using one technology. */
export interface PlotBackend<TPresentation, TSettings> {
  readonly id: string;
  /** Compatible presentations with the same family may reuse one instance. */
  readonly family: string;
  readonly technology: BackendTechnology;

  supports(
    presentation: TPresentation,
    environment: RenderEnvironment,
  ): BackendSupport;

  canReuse(previous: TPresentation, next: TPresentation): boolean;

  mount(
    surface: RenderSurface,
    input: BackendInput<TPresentation, TSettings>,
  ): BackendInstance<TPresentation, TSettings>;
}

