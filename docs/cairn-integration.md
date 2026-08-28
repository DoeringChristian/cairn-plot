# Cairn integration boundary

Cairn supplies authored plot descriptors and one artifact data source. Cairn
Plot owns all rendering and interactive viewport behavior.

```tsx
import { PlotHost, createEndpointDataSource } from "cairn-plot";

const dataSource = createEndpointDataSource(api.artifactUrl, {
  fetch: api.authenticatedFetch,
});

<PlotHost descriptor={descriptor} dataSource={dataSource} />;
```

Imperative hosts use the same implementation:

```ts
const plot = mountPlot(element, { descriptor, dataSource });
plot.update({ descriptor: nextDescriptor, dataSource });
saveWorkspace(plot.getSession());
plot.destroy();
```

Cairn owns runs, series, training steps, artifact identity, card chrome,
downloads and persistence location. Cairn Plot owns internal viewports,
settings, grid/stack interpretation, comparison, linking, selection, stage,
decoding, resources and concrete renderers.

Cairn must not import viewport stores, renderer components, registries, camera
synchronization or comparison internals. The supported browser exports are
`PlotHost`, `mountPlot`, `createEndpointDataSource`, `DataSource`, the recursive
descriptor types, `PlotSession`, and `SessionPersistence`. Cairn may hydrate a
versioned runtime session explicitly with `initialSession`/`restoreSession`, or
inject a persistence adapter. Persistence is disabled by default and can be
made explicit with `persistence={false}`; this never disables the in-memory
session or manual import/export.

The injected fetch function is used for byte/decode requests. `artifactUrl`
must still return a URL that browser elements can load directly (for example a
same-origin cookie-authenticated or signed URL); an `<img>` cannot attach the
fetch function's Authorization header.

The Python integration remains an authoring concern: a Cairn `DataRef` lowers
to an artifact reference. It does not render or upload derived images.
