# cairn-plot Host API — the public interface for embedding hosts (v3)

Status: v3 FINAL DRAFT (2026-08-26) — the result of two adversarial review
rounds (round 1: 10 lenses, 79 findings; round 2 on the revised design:
4 lenses, 32 findings; all confirmed blockers incorporated — dispositions
in §12). v1 and v2 are the previous git revisions of this file. NOT yet
implemented; §10 M0 defines the enabling refactors. Awaiting owner review.

Owner: cairn-plot. Primary consumer: cairn-track's UI cards (`cairn/ui`).

## 1. Motivation

cairn-track's cards consume cairn-plot as a parts bin: 65 import statements
across 27 files reach into internal modules, compiled first-party through a
vite alias on the git submodule. Every internal refactor breaks the host's
typecheck; every submodule bump is adoption work. The Python surface
(`cairn.plot`) consumes cairn-plot through a narrow seam-based contract and
never breaks.

This spec defines the JS/TS equivalent: the **descriptor-driven Host API**.
A host authors plots as data (the existing `cairnPlot.*` builder), mounts
them, and exchanges **settings** — plain serializable data — with the mounted
panes. Internals return to being private.

## 2. Current state (corrected by review round 1)

What exists and is sound:
- **JS builder** (`builder/builders.ts`): full leaf/container surface,
  React-free, returns `PlotHandle`; tested and smoke-gated. Its option bags
  are currently `unknown`/`Record<string, unknown>` — no typed contract yet.
- **Mounter seam** (`builder/handle.ts` + `plot-bootstrap.tsx`).
- **Settings-layer model** (`viewport/image-settings-sync.ts`): per-viewport
  ordered layer stacks, shared-by-reference layers, cached top-shadows merge,
  write-to-top, transient semantics. BUT: the stack is a **pure per-render
  value** composed by the UI scopes that own the layers (pane, selection,
  stage) — there is deliberately no mutable stack an outsider can splice
  into. A host layer cannot currently survive a selection re-render.
- **Only the image family has a settings store.** 3D view state lives in
  live `OrbitControls`/component state; and there are TWO image-settings
  vocabularies in flight (the store shape and the legacy wire keys).
- **Resolve cache** (`resolve-cache.ts`): subscribable, but keyed by
  descriptor-node **object identity** (`sourceKey` WeakMap), append-only
  ("resolve once, reuse forever"), no invalidation, no eviction, errors
  cached forever.
- **Runtime store** (`viewport/runtime-store.ts`): a `window`-global Map,
  register-only; no unregister.
- **Descriptor JSON schema is CLOSED** (`additionalProperties: false` in the
  committed schema) — "additive evolution" is not currently true.
- **Engine pool** (`engine/pool.ts`): page-global caps that count textures
  (`MAX_LIVE_SWAPCHAINS = 12`, `MAX_RETAINED_SOURCE_TEXTURES = 6`), not
  bytes; visibility-driven park/restore per pane; one memoized shared
  GPUDevice with no loss-recovery path.
- **Page-global UI**: the selection overlay host, enlarge fullscreen overlay,
  and document-level capture-phase listeners are installed globally and are
  not scoped to a mount.

## 3. Goals / non-goals

Goals:
1. One public API covering everything cairn-track's cards need; deep imports
   become lint errors.
2. Settings as the host boundary: plain data, host-owned layers, composing
   with in-page transients by construction — with write-routing and
   serialization rules that are actually implementable (§6.4).
3. Live data as a first-class concern with a real freshness/eviction model
   (§6.5).
4. In-place updates: a data or descriptor change NEVER creates a new pane
   (generalizing the channel-pick ruling), at acceptable cost (§6.2).
5. Host-visible status, errors, and interaction events (§6.3) — a live
   dashboard must be able to tell "stale" from "current".
6. Incremental migration; both worlds coexist until the last card converts.

Non-goals:
- Publishing to npm (submodule + entry points + lint enforce the boundary).
- A stable custom-renderer SDK (§6.9 is deliberately minimal, experimental).
- cairn-track's server protocol (the data-source adapter is host-owned).
- Multi-window/BroadcastChannel sync.

## 4. Naming and concepts

- **`PlotHandle`** — authored, pure data (descriptor + data refs).
- **`MountedPlot`** — one living instance of a handle in one element.
- **`Pane`** — the host-addressable unit inside a mount: one rendered leaf,
  the owner of one settings object. (Renamed from v1's `Viewport`: the word
  "viewport" already publicly means the zoom/pan window/transform in
  cairn-plot — `ImageViewState.viewport`, `viewportSyncGroupId` — and the
  collision would be permanent. "Pane" matches the codebase's own name for
  these units.)
- **`SettingsLayer`** — a host-owned, shareable bundle of settings values.
- **pane key** — the author-supplied stable identity of a leaf (§6.1); the
  basis of settings identity and update() correspondence.

## 5. Public entry points

| Entry | Contents | Stability |
| --- | --- | --- |
| `cairn-plot` | builder, `PlotHandle`, `MountedPlot`, `Pane`, settings layers, data sources, descriptor + settings types, option/capability enumeration | stable |
| `cairn-plot/react` | `<Plot>`, `useSettingsLayer`, `usePlotHandle` | stable |
| `cairn-plot/extend` | `registerRenderer` + the pane-renderer contract | experimental |

Everything else under `lib/cairn-plot/**` is private; cairn-track adds an
ESLint `no-restricted-imports` rule per migrated directory. The "stable"
tier means: within the submodule workflow, changes to these surfaces come
with migrations and a CHANGELOG entry, and removing/reshaping anything
requires a deprecation cycle. Settings and descriptor SHAPES are always
stable-tier, even when the module that defines them is experimental (WIRE-5).

## 6. Core API

### 6.1 Authoring

```ts
import { cairnPlot } from "cairn-plot";
const h = cairnPlot.grid(
  [
    cairnPlot.image(f32, { shape, tonemap: "aces", key: "render" }),
    cairnPlot.compare(a, b, { mode: "diff", kernel: "flip", key: "diff" }),
  ],
  { cols: 2 },
);
```

Changes vs today:
- **Typed option bags.** Each builder gets a typed options interface
  (`ImageOpts`, `CompareOpts`, ...) replacing `unknown`/`Record`; unknown
  keys are a type error for TS hosts and a dev-mode console warning at
  runtime (API-2). The descriptor stays permissive at the wire level (§8).
- **`key?: string`** on every leaf/container: the stable identity used for
  settings addressing and `update()` correspondence (§6.2). Keys are unique
  among siblings. Unkeyed nodes fall back to positional identity, documented
  as unstable under reordering (API-3, F3, HA-4).
- Builder inputs that are large arrays continue to ride the runtime store by
  reference; the handle records which runtime entries it owns (see disposal,
  §6.5/§7).

### 6.2 Mounting

```ts
const m: MountedPlot = h.mount(el, opts?);

interface MountOptions {
  /** Scope/disable page-global features for embedded use (HA-R6, F8):
   *  selection: false disables the page-wide selection/action-bar for panes
   *  of this mount; enlarge: "overlay" (default) | "disabled". Document-level
   *  listeners are reference-counted and removed when the last mount using
   *  them unmounts. */
  selection?: boolean;
  /** Whether this mount's panes join the page-wide selection set or a
   *  mount-private one (§6.3; R2-4). Default "page". */
  selectionScope?: "page" | "mount";
  enlarge?: "overlay" | "disabled";
  /** "stub" renders placeholder panes with full settings/pane API but no
   *  GPU/canvas work — the host testing mode (§9, F7). */
  mode?: "full" | "stub";
}

interface MountedPlot {
  readonly element: Element;
  /** Resolves when the descriptor tree is mounted and panes are enumerable.
   *  Rendering is async (renderer registration, decodes) — pane access
   *  before ready() throws a clear error (F5, API-4). */
  ready(): Promise<void>;
  /** All panes, tree order. Lazy/offscreen panes are included as fully
   *  functional Pane objects — settings and events work; pixels may not be
   *  live until scrolled into view (PERF-6). */
  readonly panes: readonly Pane[];
  pane(key: string): Pane;            // throws on unknown key
  readonly onlyPane: Pane;            // exactly-one shortcut; throws otherwise
  /** Reconcile IN PLACE against a new handle. Correspondence is BY PANE KEY
   *  (falling back to position for unkeyed nodes). A leaf with the same key
   *  keeps its Pane object, settings, view state, and GPU resources; its new
   *  data swaps in under the hold discipline (previous frame until the new
   *  payload resolves — never a loading flash, never a remount). A key that
   *  disappears unmounts that pane (its settings are dropped after
   *  `paneRemoved` fires); a new key mounts fresh. Renderer changes at the
   *  same key remount that pane only — EXCEPT the homogeneous image family
   *  (image/compare/diff), which stays remount-free per the stacked-flip
   *  design (F4). */
  update(next: PlotHandle): Promise<void>;
  screenshot(opts?: ScreenshotOpts): Promise<Blob>;
  on(ev: "selectionChange", cb: (panes: Pane[]) => void): Unsub;
  unmount(): void;
}
```

`update()` internals (this is M0 work, not free):
- **Content-derived resolve keys** replace node-object identity, so an
  updated handle whose leaf data is unchanged re-uses the cached resolution
  and GPU upload (LD1, HA-R1, PERF-1, F1). For JS-authored (runtime-store)
  data this REQUIRES content identity the store deliberately lacks today
  (V2-4, M0D-RUNTIME-KEYS): the builder re-registering the SAME buffer
  object returns the SAME runtime hash (WeakMap buffer→hash), and builder
  opts accept an explicit `contentKey` for hosts that mutate buffers in
  place. Without either, an update misses the cache (correct, just slower)
  — never a correctness issue, always documented cost.
- **Hold across update** is gated on PANE KEY, not resolve-key equality
  (M0D-HOLD): the pane whose key matches holds its previous frame while the
  new payload (any resolve key) decodes. The channel-pick hold becomes the
  special case key-equal + suffix-changed.
- **Generations**: each update() gets a generation number; overlapping
  calls coalesce latest-wins (an in-flight superseded generation never
  becomes visible — R2-UPDATE-7); the returned promise resolves when its
  generation is live OR superseded (with `{ superseded: true }`).
- **Release is reference-counted** (M0-DISPOSAL-SHARED): runtime entries,
  blob URLs (`objectUrlCache` gains revocation — V2-4), and decode-cache
  entries are shared page-wide; a generation/mount drop releases its
  references, and an entry frees when its count reaches zero.

**Lazy/offscreen panes** (V2-7): panes below a lazy gate exist as Pane
objects with `status: "lazy"`; settings READS resolve from the layer stack
(descriptor defaults included), settings WRITES apply immediately to the
stores (they are store operations, not component operations), and events
fire on mount. What "lazy" withholds is pixels and per-content state
(capabilities may widen after mount — §6.7).

**Mount events**: `m.on("paneAdded" | "paneRemoved", cb)` (fired by
update() reconciliation) and `m.on("error", cb)` (mount-level failures —
renderer registration timeouts, device loss; R2-7). `ready()` rejects on a
fatal mount failure instead of hanging.

### 6.3 Panes

```ts
interface Pane<K extends PaneKind = PaneKind> {
  readonly key: string;               // author key (or positional fallback)
  readonly kind: K;                   // narrows settings/event types (API-1)
  readonly status: PaneStatus;        // "loading" | "ready" | "error" | "stale"

  getSettings(): PaneSettings[K];
  /** Host write: lands in the pane's LOCAL tier (never in a transient — see
   *  §6.4 write routing; HA-R3). */
  setSettings(patch: Partial<PaneSettings[K]>): void;

  pushLayer(layer: SettingsLayer): void;
  removeLayer(layer: SettingsLayer): void;

  on(ev: "settings", cb: (e: {
    resolved: PaneSettings[K];   // full-stack merge (what renders)
    pending: PaneSettings[K];    // merge WITHOUT transients (§6.4, V2-1)
    origin: "host" | "gesture" | "layer" | "sync";
  }) => void): Unsub;
  on(ev: "status", cb: (s: PaneStatus, detail?: { error?: string }) => void): Unsub;
  /** Pane→host interactions that are NOT settings: reference picks, deep
   *  cursor readouts requested by the host, follow-link style activations
   *  (F1-events, HA-5). The event vocabulary is per-kind and part of the
   *  stable contract. */
  on(ev: "interaction", cb: (e: PaneInteraction[K]) => void): Unsub;

  screenshot(opts?: ScreenshotOpts): Promise<Blob>;

  /** Read-only view of the pane's RESOLVED payload + metadata (shape, dims,
   *  channel names, table columns, series ids, value ranges) — the channel
   *  for host-side derived work: table diffs between runs, figure merging,
   *  composed exports, content-driven menus (R2-READBACK-4, R2-FACET-3).
   *  Resolves after status "ready"; large buffers are exposed as typed
   *  arrays without copying where safe. */
  getData(): Promise<PaneDataView[K]>;

  /** Per-PANE capabilities/options: which settings fields exist for THIS
   *  pane's resolved content (channel arity, curve set, compare modes gated
   *  by operand kinds, 3D property names, overlay class lists). Static
   *  per-kind projections are not enough — the real option sets are
   *  content-dependent (V2-6, R2-FACET-3). May widen when content resolves;
   *  `on("capabilities", cb)` fires then. */
  getCapabilities(): PaneCapabilities[K];
  on(ev: "capabilities", cb: (c: PaneCapabilities[K]) => void): Unsub;

  /** Selection & reference (public face of the page-wide selection store —
   *  R2-SEL-1): */
  readonly selected: boolean;
  readonly isReference: boolean;
  select(opts?: { additive?: boolean }): void;
  setAsReference(): void;

  /** Runtime narrowing helper (V2-8, API-1): returns this pane typed as K
   *  or throws — `pane.as("image").getSettings()` narrows without casts. */
  as<K2 extends PaneKind>(kind: K2): Pane<K2>;
}
```

Interaction events include a **drag-source hook** (R2-DRAG-2): the
`dragStart` interaction fires synchronously inside the pane's native
dragstart with a `setData(mime, payload)` capability on the event, so hosts
can implement drag-to-compare across cards without owning the pane DOM.
`MountedPlot.on("selectionChange")` reports `Pane` references scoped to the
mount; cross-mount selection state (the store is page-wide by design) is
addressed via `mount(opts.selectionScope: "page" | "mount")` with "page" the
default (R2-4).

- **`PaneSettings` is a per-kind typed map** (generic narrowing, not a bare
  union — API-1, VP-8): `PaneSettings["image"]` is the image settings shape
  (ONE canonical public shape; the legacy wire keys are accepted on ingest
  and never emitted — WIRE-2), `PaneSettings["mesh"]` the mesh view state,
  etc. **View state (zoom/pan, 3D camera) is included** — it is already
  sync-group state internally for images; M3 lifts 3D camera state into the
  same model (F6, F4-linking).
- **`status`** surfaces the resolve/live pipeline: `stale` means "showing
  the previous frame while a newer payload is pending or failed" — the hold
  discipline plus live invalidation make staleness a real state a dashboard
  must render (F6-status, API-5, LD4).
- Settings identity: keyed by **(mount id, pane key)** in the internal
  registries — not by mount-order counters, and not by tree position — so
  settings survive `update()` reorders and can be re-associated on remount
  of the same key (SL-8, HA-R4, VP-6).

### 6.4 Settings model

**Three tiers per pane** (SL-1, HA-R2; tier ORDER revised by round 2 —
V2-2). The internal implementation gains a per-pane layer *registry* with
explicit tiers; the pure stack VALUE the rendering path consumes is composed
from it per render:

```
[ ...host layers (push order), local, ...transients (selection ep, stage) ]
```

**Host layers are SEEDS**: persistent host-owned values that shadow the
descriptor's authored props but sit BELOW the pane's local tier — so the
existing invariant "a user gesture always wins and is always visible"
(write-to-top today) is preserved exactly. Round 2 killed the v2 draft's
host-above-local ordering: a host layer above local turns every control
whose key it sets into a dead control (the gesture lands below the shadow
and the menu snaps back — V2-2). With host-below-local there is nothing to
route around, and the v2 draft's `gestureSink` concept is DELETED.

- `pushLayer` inserts into the **host tier** regardless of what transients
  are live; the selection/stage scopes push into the **transient tier**
  through the same registry. In-page transient behavior is UNCHANGED
  (episode layers, transient-per-layer revert, per-episode ids — all
  existing rulings stand).
- **Write routing** (SL-2, HA-R3, F7, V2-2):
  - **User gestures** → topmost layer, exactly as today: the transient when
    an episode is live (reverts on episode end — unchanged ruling), the
    local tier otherwise. Gestures never touch host layers.
  - `pane.setSettings(patch)` → the pane's **local** tier (gesture-
    equivalent, always visible when no transient shadows it).
  - `layer.set(patch)` → that layer. Host layers only ever change through
    this call, so `layer.get()` is always exactly what the host put there.
  - **Persistence of user tweaks** is by observation, not by routing: the
    host listens to `pane.on("settings")` (origin-tagged, §Echo) and copies
    what it wants into its own layer/store. Explicit beats magical — the
    v2 `gestureSink` write-redirection is gone.
- **Transient shadowing is observable** (V2-1): while an episode is live,
  the transient's formation seed (a full snapshot, per the group ruling)
  shadows lower tiers — including host writes made DURING the episode. The
  `settings` event therefore carries `{ resolved, pending }`: `pending` is
  the value the lower tiers would resolve to if the transient dropped now,
  so a host write that is currently shadowed is visible to the host, and
  the post-deselect "jump" is predictable. **Episode end** additionally
  emits `pane.on("interaction", { type: "episodeEnd", changed })` with the
  transient's final values (the "keep these changes?" hook). The library
  never commits transients (ruling stands).
- **Masking and serialization** (SL-4, WIRE-3): a layer's contents are
  `{ set: {...values}, cleared: [...keys] }`. `layer.set(patch)` writes
  values; `layer.clear(keys)` records an explicit mask ("hide lower tiers'
  value; fall back to descriptor default"); `layer.unset(keys)` removes the
  key from the layer entirely (fall through to lower tiers).
  `layer.toJSON()`/`createSettingsLayer(json)` round-trip exactly. The
  internal `undefined`-as-mask convention maps to `cleared` at the boundary
  and is never exposed.
- **HOME/double-click** (SL-3, revised by V2-5): the recorded ruling stands
  UNCHANGED — HOME sets the whole group to the clicked pane's defaults, as
  a VALUE snapshot (round 2 showed the v2 draft's clear-based HOME would
  make group members diverge to their own descriptor defaults, weakening
  the ruling). With host-below-local ordering the hazard v1/v2 wrestled
  with disappears: HOME writes the transient (episode live) or the local
  tier — never a host layer. A host that wants "HOME also resets my seed"
  does it explicitly via `layer.unset`/`clear` on the episodeEnd or
  settings event.
- **Layer lifecycle** (HA-8, API-7): layers are objects with identity;
  `layer.dispose()` detaches them everywhere and frees the store slot.
  Attaching one layer to panes of DIFFERENT kinds is allowed only for the
  shared-key subset (typed as the intersection); a dev warning fires on
  writes of keys a pane's kind does not know.
- **Echo semantics** (SL-6, HA-R8, HA-7): `pane.on("settings")` fires once
  per change of `{resolved, pending}`, coalesced per frame, INCLUDING
  changes caused by the host's own writes (simple mental model), with
  `origin: "host" | "gesture" | "layer" | "sync"` so hosts can break
  persistence loops without value-diffing. `layer.onChange` fires only on
  writes into that layer (which, with the revised routing, means only the
  host's own `set`/`clear`/`unset` calls).
- **Per-entity settings** (R2-SUBKEY-6): keys whose values are maps keyed by
  entity id (per-series promotion/color, per-class overlay visibility,
  per-column hiding) are DECLARED as map-valued in the per-kind schema;
  patches merge one level deep for those keys, and `cleared` may name
  `key.entityId` sub-paths. Undeclared keys keep whole-value replacement.

### 6.5 Live data

**Tier 1 — snapshots + `update()`** (M1): the host fetches, authors a new
handle, `m.update(h2)`. With content-derived resolve keys and generation
disposal (§6.2) this is bounded-memory and cheap for unchanged leaves.
Suitable for ~Hz scalar updates. Error recovery ships IN M1 (R2-6): a
resolve failure is NOT cached permanently — the errored entry is dropped
when the next `update()` (or `m.refresh()`) references its key, so a flaky
first fetch heals on the next tick instead of bricking the pane for the
page lifetime. (M0d adds `invalidateResolved(key)`/error-drop to the
resolve cache — the current behavior caches rejections forever.)

**Tier 2 — registered data sources** (M2):

```ts
registerDataSource("track", {
  get(ref, { signal }): Promise<DataResult>;
  subscribe?(ref, onInvalidate): Unsub;
}): DisposableRegistration;

interface DataResult {
  payload: DataPayload;
  /** Content identity for caching. Required: this is how `@latest`-style
   *  refs get dedupe — the adapter names the content (e.g. its step/etag),
   *  cairn-plot never guesses (LD7). */
  contentKey: string;
}
```

- Backed by a NEW **RefStore** that sits IN FRONT of descriptor resolution
  (LD2, LD3, PERF-2; layering fixed by V2-3): a pane whose leaf carries a
  `src` ref subscribes to the RefStore's `(ref → version)`; the decode/
  upload cache below it is keyed by the fetched `contentKey` — a value that
  exists only after `get()` returns, which is exactly why freshness cannot
  be modeled as a descriptor-derived resolve key. On `onInvalidate`:
  re-`get` (coalesced latest-wins per ref, superseded fetches aborted via
  the signal); unchanged `contentKey` → dropped without touching panes;
  changed → the pane re-resolves through the hold discipline (same pane,
  frame swaps when decoded). Eviction: LRU under a byte budget; entries
  referenced by a mounted pane are pinned. The v2 draft's "RefStore behind
  the identity-keyed resolve cache" was unimplementable — an append-only
  cache in front of the freshness source can never deliver an update.
- **Errors don't brick panes** (LD4): a failed `get` sets pane status
  `error` (first load) or `stale` (had content), keeps the last frame, and
  retries on the NEXT invalidation or an explicit `m.refresh(ref?)`. Retry
  backoff policy belongs to the adapter (it owns the transport).
- **Payloads** (LD6): `DataPayload` is a spec-defined union aligned with
  the decoders' input types (float image {data,shape,dtype,precision}, u8
  url/bytes, npy/npz bytes, table blob, series arrays, mesh/pointcloud/
  volume/boxes buffers) — NOT "whatever runtime-store holds" (that union is
  two members and insufficient). The runtime store learns these shapes as
  part of M2.
- **Appending series** (LD8): a series `DataResult` may return
  `{ payload: { kind: "series-delta", baseContentKey, append: {...} } }`;
  the RefStore materializes base+delta. Adapters that cannot produce deltas
  return full arrays (correct, just costlier).
- `subscribe` lifetime: refs are subscribed while ≥1 mounted pane references
  them; unmount/update release. `DisposableRegistration.dispose()` removes
  the source and errors panes still referencing its scheme.

### 6.6 React adapter (`cairn-plot/react`)

```tsx
<Plot handle={h} layers={[hostLayer]} mountOptions={{ selection: false }}
      onPaneEvent={(pane, ev) => ...} onReady={(m) => ...} />
```

- Own React root per mount, INTENTIONALLY isolated from host context; theme
  and sizing cross via DOM (`data-theme` ancestors; container box). The
  spec documents this as the contract (F5-styling): the styling entry is
  the plot stylesheet (already shipped as `style.css` with the bundles) +
  the theme attribute; no host CSS reaches pane internals.
- StrictMode: the adapter is idempotent under double-invoke; the library
  does NOT wrap host content in StrictMode (HA-R5 — current forced wrapper
  removed as M0 work).
- `handle` prop identity change → `m.update(handle)`; `layers` diffed by
  identity to push/remove; both effects cleanup-ordered after unmount
  checks.
- ESM binding: `mount()` resolves the mounter by direct import (the global
  indirection remains only for the IIFE/script-tag world) — API-4. A
  dev-mode duplicate-React check warns when two React copies are detected
  (HA-R7).

### 6.7 Host chrome support (enumerations & capabilities)

Reversal of v1's over-privatization (HA-2, API-6), revised by round 2
(V2-6, R2-FACET-3, R2-2, R2-3):

- **Per-pane, content-aware**: `pane.getCapabilities()` (§6.3) is the
  primary API — option sets depend on the pane's resolved content (channel
  arity, operand kinds, property names), not just its kind, and the
  registries behind them load asynchronously with the render bundles. It is
  synchronous-after-ready and event-updated, never a static module-level
  constant.
- **Kind-global subset**: `enumerateOptions(kind, field)` remains for the
  genuinely static vocabularies (colormap ids/labels, tonemap curves) and
  is documented as the subset that cannot depend on content. It reflects
  the registries of the LOADED bundles; calling it before the relevant
  bundle loads returns the core set (documented).
- **One vocabulary** (R2-3): the PUBLIC ids are the builder's short names;
  where internal registry ids differ, the mapping the builder already owns
  becomes the single canonical alias table, used by settings ingest,
  capabilities, and enumerations alike. Value-enum evolution is governed by
  §8's alias rule.

### 6.8 View linking (cross-mount)

Zoom/pan/camera sync across cards (F4-linking) reuses the internal
view-sync groups: `linkViews(panes: Pane[], opts?): ViewLink` puts panes
(same kind) into one sync group; `ViewLink.dispose()` dissolves it. This is
the public face of `viewportSyncGroupId`/3D camera sync — no new machinery,
but M3 for the 3D kinds.

### 6.9 Extension seam (`cairn-plot/extend`, EXPERIMENTAL)

v1's `registerViewport(ViewportModule)` is dropped (VP-1..4): that contract
is card-shaped (host chrome, host hooks) and cannot mount from a
descriptor. Instead the existing renderer registry is exposed, minimally:

```ts
registerRenderer(name, component: PaneRenderer, meta?: {
  settingsAdapter?: SettingsAdapter;   // opt into layers/settings
});
```

- `PaneRenderer` receives resolved data props + the standard pane frame
  (selection, enlarge, sizing) — the same contract built-in leaves use.
- Without a `settingsAdapter`, a custom pane gets NO settings/layers (and
  the docs say so — nothing is "for free"; VP-4).
- Host data access happens through data sources (§6.5) — refs in the
  descriptor — never through host React context (VP-2).
- Explicitly experimental: shape may change per submodule bump; the
  settings SHAPES an adapter declares still follow stable-tier rules.

## 7. Resource management & performance contract

- **Budgets are configurable, not global-only** (PERF-3):
  `configureEngine({ maxLiveSwapchains?, retainedTextureBytes? })` — and
  retention caps move from texture-count to **byte** accounting (PERF-4) as
  M-perf work. Defaults documented; a 30-card dashboard behaves like
  today's gallery (visibility parking; the LRU prefers offscreen victims).
- **Screenshot of parked/offscreen panes** (PERF-5): `screenshot()`
  restores the pane, renders to an offscreen target, reads back, and
  re-parks if it was parked — documented as potentially slow; whole-mount
  screenshots compose per-pane readbacks (no synchronous cross-pane
  present).
- **Device loss** (PERF-7): the shared-device module gains re-acquisition;
  panes park on loss and restore on the new device. M-perf.
- **Park hysteresis** (PERF-8): the pane IntersectionObserver gains a
  rootMargin so scroll jitter doesn't thrash the retained-texture set.
- **Disposal invariants** (F3-disposal, LD2): every acquire has a release —
  mounts own REFERENCES to runtime entries, blob URLs, and decode-cache
  entries (all page-shared, reference-counted; freed at zero — V2-4,
  M0-DISPOSAL-SHARED), the RefStore evicts by budget, layers dispose, data
  sources deregister. §9's harness gates include a leak test (mount →
  update ×100 → unmount → assert stores empty AND all blob URLs revoked).
- **Page-global registration rules** (R2-8): `registerDataSource` — one
  adapter per scheme; re-registration replaces with a dev warning and
  returns a disposable. `configureEngine` — page-global by nature (the
  GPU device is shared); last call wins, logged. `registerRenderer` — first
  registration wins, duplicates warn. All three are documented as
  page-scoped, not mount-scoped.
- **Mixed-vintage registries** (WIRE-REGISTRY-SHAPE): the `globalThis`
  settings/runtime registries carry a shape version; a newer bundle
  migrates older-shape entries in place on read, so pages mixing bundle
  vintages (embedded reports next to the app) keep working during the
  transition.

## 8. Wire contract & versioning

- **Descriptor**: gains `schemaVersion` (emitted by both builders). The JSON
  schema's `additionalProperties: false` is relaxed to a warn-only validator
  policy for forward keys (WIRE-1) in coordination with the Python emitter —
  old bundles ignore unknown keys; validators warn instead of reject.
- **Settings**: ONE public shape per kind; legacy wire keys accepted on
  ingest forever, emitted never (WIRE-2). Persisted host JSON from version N
  loads in N+1 via the ingest migrations (`migrateLegacyMode` pattern
  generalized into per-kind `migrateSettings`).
- **Value enums** (WIRE-7): removing an id requires an alias entry (the
  blend→split, viridis→turbo precedent becomes the rule): settings ingest
  maps aliased ids; `enumerateOptions` never returns aliased ids.
- **Three shipped copies** (WIRE-6): the source of truth is the TS library;
  the Python-package assets and cairn's dist are build artifacts with sync
  gates (`sync:plot-assets` + cairn's dist hook). The spec adds a version
  stamp (`__cairnPlotBuildId`) surfaced in all three so drift is detectable
  at runtime; mixing vintages on one page logs a warning (WIRE-8).
- API stability tiers per §5. "Experimental" never exempts settings or
  descriptor shapes (WIRE-5).

## 9. Testing story (for hosts)

- `mode: "stub"` mounts (§6.2): full pane/settings/event API, no GPU, no
  canvas — jsdom-safe. cairn-track unit-tests cards against stubs.
- The settings layers + builder are pure and node-testable already.
- A published harness pattern (the `*.browser.ts` runner) remains the
  GPU-truth gate on the cairn-plot side; hosts don't need GPUs in CI.

## 10. Migration plan (re-cut; M0 is real work)

M0 (cairn-plot enabling refactors — the reviews' blockers):
  a. Layer REGISTRY with tiers (host BELOW local — §6.4); selection/stage
     push through it; the registry is owned by the MOUNT and pane layer
     ids derive from (mount, pane key) — replacing the three independent
     component-local minting sites, so the stage's rebuilt pane instance
     resolves the same identity (SL-1, M0A-LAYER-OWNER, SL-8).
  b. Write-routing per §6.4; internal programmatic writes (formation seed,
     HOME, adoption paths) get origin tags so routing/echo can classify
     them (SL-2, M0B-WRITE-ROUTING-SEED).
  c. Layer contents as {set, cleared}; toJSON/fromJSON; clear/unset;
     declared map-valued keys (SL-4, R2-SUBKEY-6).
  d. Content-derived resolve keys (runtime store gains buffer-identity
     content addressing + optional authored contentKey) + reference-counted
     release incl. blob-URL revocation; resolve-cache `invalidateResolved`
     + error-entry drop; pane-key-gated hold (LD1/2, PERF-1, V2-3/4,
     M0D-*).
  e. Pane keys in builder + descriptor schema + Python emitter; settings
     keyed by (mount, key); grid children reconcile by key (API-3, HA-R4,
     M0E).
  f. Mount options (selection/enlarge scoping, selectionScope, stub mode);
     ready()/error; Pane objects incl. lazy semantics; the EFFECTIVE-
     SETTINGS MIRROR: panes publish their resolved effective settings +
     status into a mount-scoped registry so `getSettings()`/`status`/events
     are answerable outside the React tree (M0F-PANE-READBACK).
  g. Remove the forced StrictMode wrapper; ESM mounter binding; registry
     shape-version migration (WIRE-REGISTRY-SHAPE).
  Gates: typecheck, unit, full harness suite + new leak/reconcile/routing
  harnesses.
M1. `<Plot>` adapter; a MINIMAL chart-family settings model (smoothing,
    outlier filter, axis scales, promoted series — today component-local
    state in the chart components; R2-KINDS-5); Tier-1 error recovery;
    migrate ScalarPlotCard (proves update(), settings round-trip, events,
    stub tests).
M2. RefStore + registerDataSource + DataPayload union + series deltas;
    re-base ScalarPlotCard; migrate image/compare cards.
M3. 3D settings-store unification (camera state into the settings model),
    view linking public; migrate 3D cards.
M4. Remaining cards (Table/Figure/Histogram/ParallelCoords); repo-wide
    deep-import lint; delete dead card plumbing + `cairn/sdk` shims review.
M-perf (parallel, after M1): byte budgets, device-loss recovery, park
    hysteresis, screenshot-restore path.

## 11. What becomes private

As v1 §6 (chart components, LUT internals, decoders, fetch helpers, series
utils, offscreen compare, table-diff internals, three/* viewers, viewport
kits, hooks) — MINUS the §6.7 enumerations/capabilities, which stay public
as data.

## 12. Review dispositions

**Round 1** (10 lenses on v1, 79 findings); all blockers incorporated:
- Layer registry + tiers + write routing + serialization: SL-1..8, HA-R2/R3,
  F7, WIRE-3/4 → §6.4, M0a-c.
- Identity: pane keys + content-derived resolve keys: API-3, F1/F3/F4, LD1,
  HA-R4, HA-4, VP-6 → §6.1/6.2, M0d-e.
- Settings shapes reality (image-only stores, two vocabularies, 3D gap):
  SL-7, HA-1, F6, WIRE-2, API-1 → §6.3, M3.
- Live data rebuilt (RefStore, contentKey, eviction, errors, deltas):
  PERF-1/2, LD1..8, HA-R1 → §6.5.
- Missing surfaces (events, status, enumerations, view linking, disposal,
  testing, theming): F1/F2/F5/F6/F7, HA-2/5/6, API-5/6 → §6.3/6.7/6.8/9.
- Embedding/globals/StrictMode/ESM: HA-R5/R6/R7, F8, API-4 → §6.2/6.6, M0f-g.
- Perf/resources: PERF-3..8 → §7.
- Wire: WIRE-1/5/6/7/8, VP-7 → §8.
- Extension seam redefined: VP-1..4 → §6.9. Naming: VP-5, API-8 → §4.
Deferred/rejected: cross-window sync (out of scope); commit-transients-
by-default (contradicts the transient ruling — episodeEnd event instead).

**Round 2** (4 lenses on v2, 32 findings, 8 blockers) — dispositions:
- Tier order flipped to host-BELOW-local; `gestureSink` deleted;
  persistence-by-observation: V2-1/2, R2-5, M0B → §6.4.
- HOME back to the value-snapshot ruling (clear-based HOME rejected as a
  ruling change): V2-5 → §6.4.
- RefStore moved IN FRONT of resolution; contentKey-keyed decode cache;
  error entries dropped; Tier-1 recovery pulled into M1: V2-3, R2-6 →
  §6.5/6.2.
- Runtime-store content addressing (buffer identity + authored contentKey);
  blob-URL revocation; refcounted shared release: V2-4, M0D-RUNTIME-KEYS,
  M0-DISPOSAL-SHARED → §6.2/7.
- Hold re-gated on pane key: M0D-HOLD → §6.2.
- update() generations/coalescing/abort: R2-UPDATE-7 → §6.2.
- Capabilities made per-pane + content-aware + async-honest; one alias
  vocabulary: V2-6, R2-FACET-3, R2-2, R2-3 → §6.3/6.7.
- Selection/reference/drag surfaces added; selectionChange scoped:
  R2-SEL-1, R2-DRAG-2, R2-4 → §6.3.
- `pane.getData()` for cross-pane derived work; ScreenshotOpts to be
  defined with the composed-export note: R2-READBACK-4, R2-SHOT-8 →
  §6.3 (+§13).
- Chart-family settings model scheduled in M1: R2-KINDS-5 → §10.
- Lazy panes' honest semantics: V2-7 → §6.2. Mount error/paneRemoved:
  R2-7 → §6.2. Registration collision rules + registry shape versioning:
  R2-8, WIRE-REGISTRY-SHAPE → §7. Typed narrowing via `pane.as()`: V2-8,
  API-1 → §6.3. Mount-owned layer identity: M0A/M0F → §10.

## 13. Open questions

1. `episodeEnd` payload: full transient snapshot vs per-key diff of what
   the episode actually changed (round 2's diff-seed idea would make the
   diff exact — but changes formation seeding; needs a ruling).
2. RefStore byte budget defaults; interaction with the GPU byte budget.
3. Should `linkViews` accept mixed kinds (image + mesh) as a no-op subset
   or throw?
4. Descriptor `schemaVersion` adoption sequencing across the three shipped
   copies.
5. Whether `cairn-plot/extend` ships in M0 or waits for a concrete
   cairn-track custom pane.
6. `ScreenshotOpts` definition (scale, background, HDR handling) and how
   far the library goes toward composed exports (per-pane labels,
   colorbars) vs leaving composition to hosts over `pane.screenshot()` +
   `getData()` (R2-SHOT-8).
7. Whether `pane.getData()` returns zero-copy views or defensive copies
   for mutable runtime buffers.
8. `selectionScope: "mount"` interaction with cross-mount compare flows
   (a reference in mount A, foreground in mount B).
