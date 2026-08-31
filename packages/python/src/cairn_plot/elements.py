"""Pure display objects for the ``cairn.plot`` path (P2-M1 packaging split).

Factored out of :mod:`cairn.sdk.elements` so the plot-only surface is
**pure** (stdlib + :mod:`cairn.sdk._plot_bundle`, no cairn app/server
coupling) and moves cleanly into the ``cairn-plot`` distribution at M2.

Contains:

* :class:`Element` — the shared display-protocol base (``_repr_html_`` /
  ``_repr_mimebundle_``) every standalone-renderable cairn Python object
  implements.
* :class:`HtmlElement` — a self-contained HTML snapshot (a Plotly
  ``fig.to_html()``, a rendered table, …). No server round trip, ever.
* :class:`PlotElement` — the plots-only display object that mounts a PURE
  ``cairn-plot`` renderer: the default return of the ``cairn.plot.*`` builders.

The **server-backed** :class:`~cairn.sdk.elements.CardElement` stays in
:mod:`cairn.sdk.elements` (it needs ``cairn.config`` + server discovery), which
re-exports :class:`Element`/:class:`HtmlElement`/:class:`PlotElement` from here
so every existing ``from cairn.sdk.elements import PlotElement`` keeps working.
"""

from __future__ import annotations

import html as _html
import json
import logging
from typing import Any

log = logging.getLogger(__name__)


class Element:
    """Base class for standalone-renderable cairn Python objects.

    Subclasses implement ``_repr_html_``; the mimebundle/marimo hooks are
    thin wrappers around it (marimo and modern Jupyter both understand
    ``_repr_mimebundle_``; classic/nbconvert falls back to ``_repr_html_``
    directly).
    """

    def _repr_html_(self) -> str:  # pragma: no cover - abstract
        raise NotImplementedError

    def _repr_mimebundle_(
        self, include: Any = None, exclude: Any = None
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        return (
            {"text/html": self._repr_html_(), "text/plain": repr(self)},
            {},
        )


class HtmlElement(Element):
    """A self-contained HTML snapshot. No server round trip, ever.

    Used for the raw-data fallback path (a plain Plotly ``Figure``, a
    rendered table, ...) — see the module docstring and ``cairn/plot.py``.
    """

    def __init__(self, html_str: str, *, label: str = "element") -> None:
        self._html = html_str
        self._label = label

    def _repr_html_(self) -> str:
        return self._html

    def __repr__(self) -> str:
        return f"<cairn.plot.{self._label} (self-contained HTML, no server needed)>"


def _node_has_figure(node: Any) -> bool:
    """Recursively: does this ``PlotNode`` dict (leaf/grid/compare) contain a
    ``figure`` plot type?"""
    if not isinstance(node, dict):
        return False
    if node.get("kind") == "plot":
        return node.get("type") == "figure"
    if node.get("kind") == "grid":
        return any(_node_has_figure(c) for c in node.get("children", []))
    return False


# The plot types carried by the Three addon.
_THREE_TYPES = frozenset({"mesh", "volume", "pointcloud", "boxes3d"})


def _node_has_three(node: Any) -> bool:
    """Recursively: does this ``PlotNode`` use a Three-backed plot type?"""
    if not isinstance(node, dict):
        return False
    kind = node.get("kind")
    if kind == "plot":
        return node.get("type") in _THREE_TYPES
    if kind == "grid":
        return any(_node_has_three(c) for c in node.get("children", []))
    if kind == "compare":
        return any(
            isinstance(operand, dict) and operand.get("kind") == "npz"
            for operand in node.get("operands", [])
        )
    return False


class PlotElement(Element):
    """A plots-only display object that mounts a PURE ``cairn-plot`` renderer —
    the default return of the ``cairn.plot.*`` builders, replacing the
    ``/embed/card`` iframe (``CardElement``).

    It emits, plotly-``include_plotlyjs``-style, three include-once-guarded
    pieces per page:

      1. the **renderer bundle** — the self-contained IIFE + design-token CSS
         inlined ONCE (LOCAL default, ``bundle="inline"``, offline), guarded by
         ``window.__cairnPlotBundleLoaded``; or a ``<script type=module
         src=…/assets/plot-*.js>`` linked from a reachable server
         (``bundle="link"``, the ENDPOINT companion, deduped by module URL);
      2. the **content-addressed store** (LOCAL only) — the baked binary blobs
         (image/npz bytes) merged additively into ``window.__cairnPlotStore``;
      3. the **mount** — a ``<div>`` + the descriptor
         ``<script application/cairn-plot+json>`` + a queue ``push`` so N plots
         mount independently on one page.

    A display hook NEVER raises: a missing dist / serialization failure
    degrades to a visible inline message.
    """

    def __init__(
        self,
        spec: Any,
        *,
        store: dict[str, dict[str, str]] | None = None,
        bundle: str = "inline",
        server: str | None = None,
        label: str = "plot",
        height: int | None = None,
    ) -> None:
        self.spec = spec  # a PlotSpec (tree) or a plain dict
        self._store = store or {}
        self._bundle = bundle
        self._server = server
        self._label = label
        self._height = height

    # ---- serialization ----

    def _descriptor_dict(self) -> dict[str, Any]:
        spec = self.spec
        if hasattr(spec, "model_dump"):
            return spec.model_dump(exclude_none=True, mode="json")
        return dict(spec)

    def _plot_type_name(self) -> str:
        try:
            root = self._descriptor_dict().get("root", {})
            return str(root.get("type", "")) if isinstance(root, dict) else ""
        except Exception:  # noqa: BLE001 - never break the display path
            return ""

    def _descriptor_has_figure(self) -> bool:
        """Whether the spec carries a ``figure`` plot anywhere. Gates the Plotly
        figure addon so a tree that
        contains a figure still inlines Plotly, while a scalar/table/image tree
        never does."""
        try:
            desc = self._descriptor_dict()
        except Exception:  # noqa: BLE001 - never break the display path
            return False
        root = desc.get("root")
        return _node_has_figure(root) if isinstance(root, dict) else False

    def _descriptor_has_three(self) -> bool:
        """Whether the spec carries a Three-backed plot anywhere. Gates the
        three.js addon so a 2D/table/image tree never inlines three."""
        try:
            desc = self._descriptor_dict()
        except Exception:  # noqa: BLE001 - never break the display path
            return False
        root = desc.get("root")
        return _node_has_three(root) if isinstance(root, dict) else False

    # ---- rendering ----

    def _bundle_html(self) -> str:
        from . import bundle as pb

        if self._bundle == "link":
            server = (self._server or "").rstrip("/")
            if not server:
                raise ValueError("PlotElement(bundle='link') requires a server URL")
            js_url, css_url = pb.link_asset_urls(server)
            css_tag = (
                f'<link rel="stylesheet" href="{_html.escape(css_url)}">' if css_url else ""
            )
            # A module is evaluated once per URL per realm, so repeating this
            # across cells is naturally include-once.
            return (
                f"{css_tag}"
                f'<script type="module" src="{_html.escape(js_url)}" crossorigin></script>'
            )

        # inline (default): the ONE shared guarded core script (bundle.py's
        # `core_bundle_script` — same fragment the Report emitter uses). O2:
        # CORE only, no Plotly; the figure addon is emitted separately.
        return pb.core_bundle_script()

    def _figure_addon_html(self) -> str:
        """The Plotly `figure` addon IIFE, guarded include-once by
        `window.__cairnPlotFigureLoaded`. Emitted ONLY for a `figure` element
        (inline mode) — so a scalar/table/image plot never carries Plotly. The
        addon reuses core's React (`window.__cairnPlotReact`), so it MUST come
        after `_bundle_html` (the core script) in the emitted HTML."""
        if self._bundle != "inline" or not self._descriptor_has_figure():
            return ""
        from . import bundle as pb

        return pb.figure_addon_script()

    def _three_addon_html(self) -> str:
        """The three.js 3D addon IIFE, guarded include-once by
        `window.__cairnPlotThreeLoaded`. Emitted ONLY for a 3D element (inline
        mode) — so 2D/table/image plots never carry three. Like the figure
        addon, it reuses core's React (`window.__cairnPlotReact`), so it MUST
        come after `_bundle_html` (the core script) in the emitted HTML."""
        if self._bundle != "inline" or not self._descriptor_has_three():
            return ""
        from . import bundle as pb

        return pb.three_addon_script()

    def _store_html(self, store_id: str) -> str:
        from . import bundle as pb

        if self._bundle != "inline" or not self._store:
            return ""
        return pb.store_script(self._store, store_id)

    def _mount_html(self, div_id: str, desc_id: str) -> str:
        from . import bundle as pb

        descriptor = pb.json_script_safe(self._descriptor_dict())
        min_h = self._height if self._height is not None else 60
        did, sid = json.dumps(div_id), json.dumps(desc_id)
        return (
            f'<div id="{_html.escape(div_id)}" class="cairn-plot-mount" '
            f'style="min-height:{int(min_h)}px"></div>'
            f'<script type="application/cairn-plot+json" id="{_html.escape(desc_id)}">'
            f"{descriptor}</script>"
            f"<script>(window.__cairnPlotQueue=window.__cairnPlotQueue||[]).push([{did},{sid}]);</script>"
        )

    def _repr_html_(self) -> str:
        try:
            import uuid as _uuid

            uid = _uuid.uuid4().hex[:12]
            div_id = f"cairn-plot-{uid}"
            desc_id = f"cairn-plot-desc-{uid}"
            store_id = f"__cairn_plot_store__{uid}"
            return (
                self._bundle_html()
                + self._figure_addon_html()
                + self._three_addon_html()
                + self._store_html(store_id)
                + self._mount_html(div_id, desc_id)
            )
        except Exception as exc:  # noqa: BLE001 - display hooks must never raise
            log.debug("cairn PlotElement render failed: %s", exc)
            return (
                "<pre>cairn-plot: could not render this plot "
                f"({_html.escape(type(exc).__name__)}: {_html.escape(str(exc))}).</pre>"
            )

    def __repr__(self) -> str:
        plot_type = self._plot_type_name() if self.spec else "?"
        return f"<cairn.plot.{self._label} (type={plot_type!r}, mode={self._bundle})>"
