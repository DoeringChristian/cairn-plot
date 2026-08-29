import {
  createElement,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
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
} from "../backends/react.ts";

export {
  advanceReactBackendSelection,
  selectReactBackend,
} from "../backends/react.ts";
export type {
  ReactBackendProps,
  ReactBackendSelection,
  ReactPlotBackend,
} from "../backends/react.ts";

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
  const subscribeSupport = useMemo(() => (listener: () => void) => {
    const cleanups = backends.map((backend) => backend.subscribeSupport?.(listener)).filter(Boolean) as Array<() => void>;
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [backends]);
  const supportSnapshot = useMemo(() => () =>
    backends.map((backend) => backend.supportSnapshot?.() ?? 0).join("|"), [backends]);
  useSyncExternalStore(subscribeSupport, supportSnapshot, supportSnapshot);
  useEffect(() => {
    for (const backend of backends) backend.prepare?.();
  }, [backends]);
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
