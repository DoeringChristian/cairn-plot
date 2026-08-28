import type {
  BackendInput,
  BackendInstance,
  PlotBackend,
  RenderEnvironment,
  RenderSize,
  RenderSurface,
  SemanticInvalidation,
} from "../backends/contracts.ts";

export interface SurfaceHostOptions<TPresentation, TSettings> {
  readonly element: HTMLElement;
  readonly backends: readonly PlotBackend<TPresentation, TSettings>[];
  readonly environment: RenderEnvironment;
  readonly initialSize?: RenderSize;
}

/** Owns the concrete backend instance mounted into one persistent plot cell. */
export class SurfaceHost<TPresentation, TSettings> {
  private readonly element: HTMLElement;
  private readonly backends: readonly PlotBackend<TPresentation, TSettings>[];
  private readonly environment: RenderEnvironment;
  private size: RenderSize;
  private backend: PlotBackend<TPresentation, TSettings> | undefined;
  private instance: BackendInstance<TPresentation, TSettings> | undefined;
  private presentation: TPresentation | undefined;
  private destroyed = false;

  constructor(options: SurfaceHostOptions<TPresentation, TSettings>) {
    this.element = options.element;
    this.backends = options.backends;
    this.environment = options.environment;
    this.size = options.initialSize ?? { width: 0, height: 0 };
  }

  resize(size: RenderSize): void {
    this.assertAlive();
    this.size = size;
  }

  commit(
    presentation: TPresentation,
    settings: Readonly<TSettings>,
    invalidation: SemanticInvalidation,
  ): void {
    this.assertAlive();
    const selected = selectBackend(this.backends, presentation, this.environment);
    const reusable = this.backend === selected && this.instance !== undefined &&
      this.presentation !== undefined && selected.canReuse(this.presentation, presentation);
    const input: BackendInput<TPresentation, TSettings> = {
      presentation,
      settings,
      invalidation,
    };

    if (reusable) {
      this.instance!.update(input);
    } else {
      this.instance?.destroy();
      this.instance = selected.mount(this.surface(), input);
      this.backend = selected;
    }
    this.presentation = presentation;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.instance?.destroy();
    this.instance = undefined;
    this.backend = undefined;
    this.presentation = undefined;
  }

  private surface(): RenderSurface {
    return {
      element: this.element,
      size: this.size,
      pixelRatio: this.environment.pixelRatio,
    };
  }

  private assertAlive(): void {
    if (this.destroyed) throw new Error("cairn-plot: surface host is destroyed");
  }
}

export function selectBackend<TPresentation, TSettings>(
  backends: readonly PlotBackend<TPresentation, TSettings>[],
  presentation: TPresentation,
  environment: RenderEnvironment,
): PlotBackend<TPresentation, TSettings> {
  const supported = backends
    .map((backend, order) => ({ backend, order, support: backend.supports(presentation, environment) }))
    .filter(({ support }) => support.supported)
    .sort((a, b) => (b.support.priority ?? 0) - (a.support.priority ?? 0) || a.order - b.order);
  const selected = supported[0]?.backend;
  if (!selected) throw new Error("cairn-plot: no backend supports this presentation");
  return selected;
}
