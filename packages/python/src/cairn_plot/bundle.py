"""cairn-plot bundle access + safe HTML/JSON serialization.

The Python emit (``PlotElement`` in ``elements.py``) ships the SAME pure
``cairn-plot`` renderers the viewer app uses — read from the committed Vite
``dist/`` — in one of two shapes:

* **inline** (default, offline/self-contained): O2 bundle-split — a small
  **core** IIFE ``dist/plot-inline/core.iife.js`` + its ``style.css`` (built by
  ``vite.plot-core.config.ts``) carries the bootstrap + 2D/image/table
  renderers and is emitted for EVERY plot; the **figure addon**
  ``dist/plot-inline/figure.iife.js`` (built by ``vite.plot-figure.config.ts``)
  carries Plotly + the Figure renderer and is emitted ONLY for a ``figure``
  element. Both are self-contained (no ``/assets`` requests, work on
  ``file://`` with no server) and each is include-once guarded, so a page with
  a figure + a scalar loads core once + the figure addon once. This is the
  LOCAL data-mode companion.
* **link** (opt-in, needs a reachable server): a ``<script type="module"
  src="…/assets/plot-*.js">`` pointed at the code-split ``plot.html`` build,
  resolved from ``dist/plot.html`` so the hashed filename is never stale. The
  ENDPOINT data-mode companion.

Also home to the two serialization safety helpers:

* :func:`json_script_safe` — JSON for embedding inside a ``<script>`` element,
  with ``<``/``>``/``&`` (and the JS line separators U+2028/U+2029)
  unicode-escaped so a payload containing ``</script>`` can never break out of
  the tag (acceptance criterion M1). ``JSON.parse`` decodes the escapes back
  transparently.
* :func:`js_inline_safe` — defensive ``</script`` guard for the raw bundle JS.
"""

from __future__ import annotations

import json
import re
from functools import lru_cache
from importlib.resources import files as _ir_files
from pathlib import Path
from typing import Any


def _resolve_inline_dir() -> Path:
    """The ``plot-inline`` asset dir the emit reads its IIFE bundles from.

    Resolution order:

    1. the package's OWN payload — ``cairn_plot/_assets/plot-inline`` shipped as
       package data (the canonical copy in an installed ``cairn-plot`` wheel);
    2. a repo-checkout fallback — ``ui/dist/plot-inline`` relative to a source
       tree — so an editable/dev checkout that has not run the asset-sync step
       still finds the freshly-built dist.
    """
    try:
        packaged = _ir_files("cairn_plot") / "_assets" / "plot-inline"
        if (packaged / "core.iife.js").is_file():  # type: ignore[operator]
            return Path(str(packaged))
    except (ModuleNotFoundError, FileNotFoundError, TypeError, OSError):
        pass
    # Dev fallback: this file lives at ``src/cairn_plot/bundle.py``; walk up to
    # the repo root and read the freshly-built standalone UI dist
    # (``ui/dist/plot-inline``) so an editable/dev checkout that has not run the
    # asset-sync step still finds the just-built bundles.
    here = Path(__file__).resolve()
    for parent in here.parents:
        candidate = parent / "ui" / "dist" / "plot-inline"
        if (candidate / "core.iife.js").is_file():
            return candidate
    # Last resort: the packaged location (so errors point at the canonical path).
    return Path(str(_ir_files("cairn_plot") / "_assets" / "plot-inline"))


_INLINE_DIR = _resolve_inline_dir()
_DIST = _INLINE_DIR.parent
# O2 bundle-split: core (always) + figure addon (only for `figure` elements).
_CORE_JS = _INLINE_DIR / "core.iife.js"
# The core design-token CSS. `vite.plot-core.config.ts` pins the emitted
# filename to `style.css` (via `cssFileName: "style"`, robust to a future vite
# honoring the option) — keep this path in lock-step with that config.
_CORE_CSS = _INLINE_DIR / "style.css"
_FIGURE_JS = _INLINE_DIR / "figure.iife.js"
_THREE_JS = _INLINE_DIR / "three.iife.js"
_PLOT_HTML = _DIST / "plot.html"


class BundleUnavailable(RuntimeError):
    """The committed cairn-plot dist is missing (a broken install/build)."""


# ---------------------------------------------------------------------------
# Serialization safety
# ---------------------------------------------------------------------------


def json_script_safe(obj: Any) -> str:
    """``json.dumps(obj)`` safe to embed between ``<script>``…``</script>``.

    Unicode-escapes ``<`` ``>`` ``&`` and U+2028/U+2029 so no substring can
    close the script element or open an HTML comment — the M1 XSS fix. The
    escapes are valid JSON (``\\uXXXX``) and ``JSON.parse`` restores the
    original characters, so a string field containing literal ``</script>``
    round-trips intact while being inert in the DOM.
    """
    raw = json.dumps(obj, separators=(",", ":"))
    return (
        raw.replace("<", "\\u003c")
        .replace(">", "\\u003e")
        .replace("&", "\\u0026")
        .replace("\u2028", "\\u2028")
        .replace("\u2029", "\\u2029")
    )


_SCRIPT_CLOSE = re.compile(r"</script", re.IGNORECASE)


def js_inline_safe(js: str) -> str:
    """Defensive guard for raw bundle JS embedded in an inline ``<script>``:
    rewrite any ``</script`` to ``<\\/script`` (equivalent inside the JS
    string/regex literals where it could only legitimately appear)."""
    return _SCRIPT_CLOSE.sub(r"<\\/script", js)


# ---------------------------------------------------------------------------
# Bundle readers (cached — the dist is immutable at runtime)
# ---------------------------------------------------------------------------


@lru_cache(maxsize=1)
def inline_core_js() -> str:
    """The self-contained **core** IIFE JS (bootstrap + 2D/image/table
    renderers; NO Plotly/three.js), ``</script``-guarded. Emitted for EVERY
    inline plot."""
    if not _CORE_JS.exists():
        raise BundleUnavailable(
            f"cairn-plot core bundle missing at {_CORE_JS}. Rebuild with "
            "`cd cairn/ui && npm run build:plot-inline` (and commit dist/)."
        )
    return js_inline_safe(_CORE_JS.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def inline_core_css() -> str:
    """The design-token CSS (``bg-bg``/``text-fg`` …) for the core bundle."""
    if not _CORE_CSS.exists():
        raise BundleUnavailable(f"cairn-plot core CSS missing at {_CORE_CSS}.")
    return _CORE_CSS.read_text(encoding="utf-8")


# Compatibility names from the pre-split bundle API. They intentionally point
# at the core bundle; type-specific Plotly/three addons remain separate.
def inline_bundle_js() -> str:
    return inline_core_js()


def inline_bundle_css() -> str:
    return inline_core_css()


@lru_cache(maxsize=1)
def inline_figure_addon_js() -> str:
    """The self-contained **figure addon** IIFE JS (Plotly + Figure renderer;
    reuses core's React via ``window.__cairnPlotReact``), ``</script``-guarded.
    Emitted ONLY for a ``figure`` element."""
    if not _FIGURE_JS.exists():
        raise BundleUnavailable(
            f"cairn-plot figure addon missing at {_FIGURE_JS}. Rebuild with "
            "`cd cairn/ui && npm run build:plot-inline` (and commit dist/)."
        )
    return js_inline_safe(_FIGURE_JS.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def inline_three_addon_js() -> str:
    """The self-contained **three.js 3D addon** IIFE JS (three + the 3D
    standalone adapters; reuses core's React via ``window.__cairnPlotReact``),
    ``</script``-guarded. Emitted ONLY for a 3D element
    (pointcloud/mesh/volume/boxes3d)."""
    if not _THREE_JS.exists():
        raise BundleUnavailable(
            f"cairn-plot three addon missing at {_THREE_JS}. Rebuild with "
            "`cd cairn/ui && npm run build:plot-inline` (and commit dist/)."
        )
    return js_inline_safe(_THREE_JS.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def _link_asset_paths() -> tuple[str, str]:
    """(module-entry path, css path) parsed from the committed ``plot.html``.

    Returns the ``/assets/plot-*.js`` module entry and ``/assets/index-*.css``
    stylesheet — the code-split build's hashed filenames, read fresh so a
    rebuild's new hash is never stale. ``link`` mode prefixes these with the
    server origin.
    """
    if not _PLOT_HTML.exists():
        raise BundleUnavailable(f"cairn-plot plot.html missing at {_PLOT_HTML}.")
    html = _PLOT_HTML.read_text(encoding="utf-8")
    js = re.search(r'src="(/assets/plot-[^"]+\.js)"', html)
    css = re.search(r'href="(/assets/index-[^"]+\.css)"', html)
    if not js:
        raise BundleUnavailable("could not find the plot entry <script> in plot.html")
    return js.group(1), (css.group(1) if css else "")


def link_asset_urls(server: str) -> tuple[str, str]:
    """(module-entry URL, css URL) for ``link`` mode against ``server``."""
    base = server.rstrip("/")
    js_path, css_path = _link_asset_paths()
    return f"{base}{js_path}", (f"{base}{css_path}" if css_path else "")


# ---------------------------------------------------------------------------
# Shared HTML-fragment builders — the ONE copy of the include-once script
# wrappers both emitters use (``elements.PlotElement`` per-cell and
# ``report.Report`` per-page). Guard flags and script shapes live here so the
# two paths can never drift apart again.
# ---------------------------------------------------------------------------


def core_bundle_script() -> str:
    """The guarded CORE script: inject the design-token CSS as a ``<style>``,
    then run the core IIFE (which sets ``__cairnPlotBundleLoaded``)."""
    css_js = json_script_safe(inline_core_css())
    return (
        "<script>if(!window.__cairnPlotBundleLoaded){"
        "(function(){var s=document.createElement('style');"
        f"s.textContent={css_js};document.head.appendChild(s);}})();\n"
        f"{inline_core_js()}\n}}</script>"
    )


def figure_addon_script() -> str:
    """The guarded Plotly ``figure`` addon script (include-once via
    ``__cairnPlotFigureLoaded``); must come after the core script."""
    return f"<script>if(!window.__cairnPlotFigureLoaded){{\n{inline_figure_addon_js()}\n}}</script>"


def three_addon_script() -> str:
    """The guarded three.js 3D addon script (include-once via
    ``__cairnPlotThreeLoaded``); must come after the core script."""
    return f"<script>if(!window.__cairnPlotThreeLoaded){{\n{inline_three_addon_js()}\n}}</script>"


def store_script(store: dict, store_id: str) -> str:
    """The content-addressed blob-store injection pair: the JSON payload
    ``<script type="application/cairn-plot-store+json">`` plus the additive
    ``Object.assign(window.__cairnPlotStore, …)`` merge (idempotent across
    N cells/blocks sharing one page)."""
    import html as _html
    import json as _json

    blob = json_script_safe(store)
    eid = _json.dumps(store_id)
    return (
        f'<script type="application/cairn-plot-store+json" id="{_html.escape(store_id)}">'
        f"{blob}</script>"
        "<script>window.__cairnPlotStore=window.__cairnPlotStore||{};"
        f"Object.assign(window.__cairnPlotStore,JSON.parse(document.getElementById({eid}).textContent));"
        "</script>"
    )
