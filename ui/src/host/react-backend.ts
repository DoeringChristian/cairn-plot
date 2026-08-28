import {
  createElement,
  useRef,
  type ComponentType,
  type ReactElement,
} from "react";

import type {
  BackendInput,
  BackendSupport,
  BackendTechnology,
  RenderEnvironment,
  SettingsCommandPort,
  SemanticInvalidation,
} from "../backends/contracts.ts";

export interface ReactBackendProps<TPresentation, TSettings> {
  readonly input: BackendInput<TPresentation, TSettings>;
  readonly environment: RenderEnvironment;
}

/** A backend implemented as a component in the host's existing React tree. */
export interface ReactPlotBackend<TPresentation, TSettings> {
  readonly id: string;
  readonly family: string;
  readonly technology: BackendTechnology;
  readonly component: ComponentType<ReactBackendProps<TPresentation, TSettings>>;

  supports(
    presentation: TPresentation,
    environment: RenderEnvironment,
  ): BackendSupport;

  /** False forces a component remount while the surrounding host is retained. */
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

/** Pure reuse decision used by the outlet and focused without rendering React. */
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

export interface ReactBackendOutletProps<TPresentation, TSettings> {
  readonly backends: readonly ReactPlotBackend<TPresentation, TSettings>[];
  readonly environment: RenderEnvironment;
  readonly presentation: TPresentation;
  readonly settings: Readonly<TSettings>;
  readonly commands: SettingsCommandPort<TSettings>;
  readonly invalidation: SemanticInvalidation;
}

/**
 * Select and render a backend directly in the owning React tree. The keyed
 * component boundary expresses canReuse/remount semantics; no nested root or
 * imperative DOM mount exists at this seam.
 */
export function ReactBackendOutlet<TPresentation, TSettings>({
  backends,
  environment,
  presentation,
  settings,
  commands,
  invalidation,
}: ReactBackendOutletProps<TPresentation, TSettings>): ReactElement {
  const selected = selectReactBackend(backends, presentation, environment);
  const selectionRef = useRef<ReactBackendSelection<TPresentation, TSettings>>();
  const next = advanceReactBackendSelection(selectionRef.current, selected, presentation);
  selectionRef.current = next;
  const input: BackendInput<TPresentation, TSettings> = {
    presentation,
    settings,
    commands,
    invalidation,
  };
  return createElement(selected.component, {
    key: `${selected.id}:${next.revision}`,
    input,
    environment,
  });
}
