import { type ComponentType } from "react";
import { createRoot } from "react-dom/client";

import type { Invalidation } from "../../spec/src/settings.ts";
import type { PaneSpec, SettingsPatch, SourceSpec } from "../../spec/src/spec.ts";
import type {
  RendererInstance,
  RendererPlugin,
  ResolveContext,
} from "../../runtime/src/renderers.ts";

export function createReactRendererPlugin<TResolved>(options: {
  kind: string;
  component(): ComponentType<Record<string, unknown>> | undefined;
  resolve(sources: SourceSpec[], context: ResolveContext): Promise<TResolved>;
  props(pane: PaneSpec, resolved: TResolved, settings: SettingsPatch): Record<string, unknown>;
}): RendererPlugin<TResolved> {
  return {
    kind: options.kind,
    resolve: options.resolve,
    mount(host, pane, resolved, settings): RendererInstance<TResolved> {
      const root = createRoot(host.element);
      const render = (nextResolved: TResolved, nextSettings: SettingsPatch) => {
        const Component = options.component();
        if (!Component) throw new Error(`renderer ${options.kind} is not registered`);
        root.render(<Component {...options.props(pane, nextResolved, nextSettings)} />);
      };
      render(resolved, settings);
      return {
        update(nextResolved, nextSettings, _invalidation: Invalidation) {
          render(nextResolved, nextSettings);
        },
        destroy() {
          root.unmount();
        },
      };
    },
  };
}
