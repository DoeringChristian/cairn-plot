import {
  createElement,
  useRef,
  type ReactElement,
} from "react";

import type {
  BackendInput,
  RenderEnvironment,
  SettingsCommandPort,
  SemanticInvalidation,
} from "../backends/contracts.ts";
import {
  advanceReactBackendSelection,
  selectReactBackend,
  type ReactBackendSelection,
  type ReactPlotBackend,
} from "../plots/react-backend.ts";

export {
  advanceReactBackendSelection,
  selectReactBackend,
} from "../plots/react-backend.ts";
export type {
  ReactBackendProps,
  ReactBackendSelection,
  ReactPlotBackend,
} from "../plots/react-backend.ts";

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
