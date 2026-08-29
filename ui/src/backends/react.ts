import type { ComponentType } from "react";
import type {
  BackendInput,
  BackendSupport,
  BackendTechnology,
  RenderEnvironment,
} from "../backends/contracts.ts";

export interface ReactBackendProps<TPresentation, TSettings> {
  readonly input: BackendInput<TPresentation, TSettings>;
  readonly environment: RenderEnvironment;
}

/** A concrete plot backend rendered inside the host's existing React tree. */
export interface ReactPlotBackend<TPresentation, TSettings> {
  readonly id: string;
  readonly family: string;
  readonly technology: BackendTechnology;
  readonly component: ComponentType<ReactBackendProps<TPresentation, TSettings>>;
  /** Start asynchronous capability discovery without mounting a surface. */
  prepare?(): void;
  /** Optional support-state signal; lets the host re-run backend selection. */
  subscribeSupport?(listener: () => void): () => void;
  supportSnapshot?(): string | number;
  supports(
    presentation: TPresentation,
    environment: RenderEnvironment,
  ): BackendSupport;
  canReuse(previous: TPresentation, next: TPresentation): boolean;
}

/** Highest supported priority wins; declaration order breaks ties. */
export function selectReactBackend<TPresentation, TSettings>(
  backends: readonly ReactPlotBackend<TPresentation, TSettings>[],
  presentation: TPresentation,
  environment: RenderEnvironment,
): ReactPlotBackend<TPresentation, TSettings> {
  const selected = backends
    .map((backend, order) => ({
      backend,
      order,
      support: backend.supports(presentation, environment),
    }))
    .filter(({ support }) => support.supported)
    .sort((a, b) =>
      (b.support.priority ?? 0) - (a.support.priority ?? 0) || a.order - b.order
    )[0]?.backend;
  if (!selected) throw new Error("cairn-plot: no React backend supports this presentation");
  return selected;
}

export interface ReactBackendSelection<TPresentation, TSettings> {
  readonly backend: ReactPlotBackend<TPresentation, TSettings>;
  readonly presentation: TPresentation;
  readonly revision: number;
}

export function advanceReactBackendSelection<TPresentation, TSettings>(
  previous: ReactBackendSelection<TPresentation, TSettings> | undefined,
  backend: ReactPlotBackend<TPresentation, TSettings>,
  presentation: TPresentation,
): ReactBackendSelection<TPresentation, TSettings> {
  const reusable = previous !== undefined && previous.backend === backend &&
    backend.canReuse(previous.presentation, presentation);
  return {
    backend,
    presentation,
    revision: reusable ? previous.revision : (previous?.revision ?? -1) + 1,
  };
}
