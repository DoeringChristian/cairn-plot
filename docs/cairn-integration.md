# Cairn integration boundary

Cairn uses cairn-plot from **Python only**, as `cairn.plot` (the `cairn-track[plot]`
extra): notebook elements and self-contained HTML reports. The Cairn browser viewer
(cairn-ui) does not depend on cairn-plot; it draws its own cards.

In `cairn.plot`, a Cairn `DataRef` (`run["tag"]`) lowers to an artifact reference.
A baked report inlines the referenced bytes into its content store; a live report
keeps the reference and fetches it from a Cairn server when opened (see
`cairn.query_url`). cairn-plot never renders or uploads derived images back into
Cairn.

Other hosts that embed the browser renderer directly use the public API:

```tsx
import { PlotHost, createEndpointDataSource } from "cairn-plot";

const dataSource = createEndpointDataSource(artifactUrl, { fetch: authenticatedFetch });

<PlotHost spec={spec} dataSource={dataSource} />;
```

The supported browser exports are `PlotHost`, `mountPlot`,
`createEndpointDataSource`, `DataSource`, the recursive specification types,
`PlotSession`, and `SessionPersistence`. `artifactUrl` must return a URL that
browser elements can load directly (same-origin cookie-authenticated or signed);
an `<img>` cannot attach the injected fetch function's Authorization header.
