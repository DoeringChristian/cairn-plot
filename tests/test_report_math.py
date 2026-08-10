"""LaTeX math in `cp.Report` markdown -> native MathML (zero client JS/CSS/font).

Covers the delimiter set ($…$, $$…$$, \\(…\\), \\[…\\]), the currency / code /
escaping rules that keep prose like `$5 and $10` and `` `$x$` `` literal, and
graceful degradation (backend absent OR a bad equation) — a report must still
emit. All assertions also confirm the emitted doc stays fully self-contained:
the MathML is namespaced and inlined, with no external asset or `<script>`.
"""

from __future__ import annotations

import sys
import xml.etree.ElementTree as ET

import pytest

import cairn_plot as cp
import cairn_plot.report  # noqa: F401 — ensure the submodule is imported
from cairn_plot.report import _markdown_to_html

# `cairn_plot.report` (the attribute) is a plotly recipe FUNCTION shadowing the
# submodule on the package object (cp.report vs cp.Report), so reach the actual
# module via sys.modules to poke its converter cache.
_report = sys.modules["cairn_plot.report"]

_MATHML_NS = "http://www.w3.org/1998/Math/MathML"


@pytest.fixture(autouse=True)
def _fresh_converter_cache():
    """Each test starts with a clean converter cache (the real, installed
    `latex2mathml`), and restores it afterwards so a degradation test that
    forces the missing-backend path can't leak into the next test."""
    _report._math_converter.cache_clear()
    yield
    _report._math_converter.cache_clear()


def _has_backend() -> bool:
    _report._math_converter.cache_clear()
    return _report._math_converter() is not None


requires_backend = pytest.mark.skipif(
    not _has_backend(), reason="latex2mathml (the `math` extra) not installed"
)


# ---------------------------------------------------------------------------
# Delimiters -> MathML
# ---------------------------------------------------------------------------


@requires_backend
def test_inline_dollar_math_is_mathml_msup():
    out = _markdown_to_html("The area is $x^2$ today.")
    assert 'display="inline"' in out
    assert f'xmlns="{_MATHML_NS}"' in out
    assert "<msup>" in out
    # Surrounding prose is untouched / still escaped-normal text.
    assert "The area is" in out and "today." in out


@requires_backend
def test_inline_paren_alias_is_mathml():
    out = _markdown_to_html(r"Euler: \(e^{i\pi}\) rocks.")
    assert 'display="inline"' in out
    assert "<msup>" in out
    assert "rocks." in out


@requires_backend
def test_block_dollar_math_is_display_mfrac():
    out = _markdown_to_html("$$\\frac{a}{b}$$")
    assert 'display="block"' in out
    assert f'xmlns="{_MATHML_NS}"' in out
    assert "<mfrac>" in out


@requires_backend
def test_block_bracket_alias_multiline():
    out = _markdown_to_html("\\[\n\\sum_{i=0}^n i\n\\]")
    assert 'display="block"' in out
    assert "<msubsup>" in out or "<munderover>" in out


@requires_backend
def test_block_math_is_own_block_not_inside_paragraph():
    out = _markdown_to_html("Intro line.\n\n$$\\frac{a}{b}$$\n\nOutro line.")
    assert "<p>Intro line.</p>" in out
    assert "<p>Outro line.</p>" in out
    # The block equation is NOT wrapped in a <p>.
    assert "<p><math" not in out


# ---------------------------------------------------------------------------
# Currency / code / escaping rules (the load-bearing subtleties)
# ---------------------------------------------------------------------------


def test_currency_prose_stays_literal():
    """`$5 and $10` must NOT become math (unbalanced-looking currency)."""
    out = _markdown_to_html("It costs $5 and $10 more.")
    assert "<math" not in out
    assert "$5 and $10" in out


@requires_backend
def test_two_adjacent_inline_spans_both_render():
    out = _markdown_to_html("Both $a$ and $b$ hold.")
    assert out.count("<math") == 2


def test_currency_does_not_reach_across_escaped_dollar():
    r"""A stray `$10` must not pair with a later escaped `\$` as its closing
    delimiter (the escaped `$` can neither open nor close a span)."""
    out = _markdown_to_html(r"Costs $10 today and I paid \$5 total.")
    assert "<math" not in out
    assert "$10 today" in out
    assert "$5 total" in out


def test_dollar_in_code_span_stays_literal():
    """`` `$x$` `` in backticks is literal — never parsed as math."""
    out = _markdown_to_html("Use `$x$` verbatim.")
    assert "<math" not in out
    assert "<code>$x$</code>" in out


def test_escaped_dollar_is_literal_dollar():
    r"""`\$` renders a literal `$` and never opens math."""
    out = _markdown_to_html(r"A price tag \$5 here.")
    assert "<math" not in out
    assert "$5" in out
    assert "\\$" not in out  # the backslash is consumed


@requires_backend
def test_latex_internals_survive_escape_and_emphasis():
    """`x_i`, `a^2`, `<`/`>`/`&`, `a*b` inside LaTeX must not be mangled by
    html.escape or by markdown emphasis (`_`/`*`)."""
    out = _markdown_to_html("$a < b \\text{ and } a*b_i > c$")
    assert "<math" in out
    # No stray <em>/<strong> from the `*`/`_`, and no escaped `&lt;` leaking
    # into the emitted prose around it as an emphasis artifact.
    assert "<em>" not in out and "<strong>" not in out


# ---------------------------------------------------------------------------
# Graceful degradation — never crash a report
# ---------------------------------------------------------------------------


def test_missing_backend_degrades_to_visible_fallback(monkeypatch, caplog):
    """Backend absent: math degrades to `<code class="math-unrendered">`, a
    one-time warning naming the extra fires, and the report still emits."""
    # Force the import to fail regardless of what's installed.
    monkeypatch.setitem(sys.modules, "latex2mathml.converter", None)
    _report._math_converter.cache_clear()

    with caplog.at_level("WARNING"):
        out = _markdown_to_html("Inline $x^2$ and block:\n\n$$\\frac{a}{b}$$")

    assert "<math" not in out
    assert '<code class="math-unrendered">$x^2$</code>' in out
    assert '<code class="math-unrendered">$$\\frac{a}{b}$$</code>' in out
    # The one-time warning names the pip extra.
    assert any("pip install 'cairn-plot[math]'" in r.message for r in caplog.records)


def test_bad_equation_degrades_but_rest_of_report_renders(monkeypatch, caplog):
    """A single unparseable equation falls back; other equations + prose still
    render."""
    if not _has_backend():
        pytest.skip("needs the real backend to exercise a parse failure")
    with caplog.at_level("WARNING"):
        out = _markdown_to_html("Good $x^2$ but broken $\\frac{$ here.")
    # The good one rendered...
    assert "<msup>" in out
    # ...the broken one degraded (fallback code span present somewhere).
    assert 'class="math-unrendered"' in out


# ---------------------------------------------------------------------------
# End-to-end: a saved report is well-formed + fully self-contained
# ---------------------------------------------------------------------------


@requires_backend
def test_saved_report_has_wellformed_namespaced_mathml(tmp_path):
    rep = (
        cp.Report(title="Math Report")
        .md("Inline mass-energy $E = mc^2$ in prose.")
        .md("$$\\int_0^\\infty e^{-x}\\,dx = 1$$")
    )
    out_path = rep.save(tmp_path / "math.html")
    doc = out_path.read_text(encoding="utf-8")

    # Both a namespaced inline and block <math> are present.
    assert f'display="inline" ' in doc or 'display="inline">' in doc
    assert 'display="block"' in doc
    assert f'xmlns="{_MATHML_NS}"' in doc

    # Every <math> element parses as well-formed, namespaced XML.
    import re

    math_fragments = re.findall(
        r'<math\b[^>]*xmlns="' + re.escape(_MATHML_NS) + r'".*?</math>', doc, re.S
    )
    assert math_fragments, "no <math> elements found in saved report"
    for frag in math_fragments:
        root = ET.fromstring(frag)
        assert root.tag == f"{{{_MATHML_NS}}}math"

    # Self-contained: the math added no external asset and no <script>. (The
    # only inlined <script>s belong to the bundle/store — this report has no
    # components, so there are none at all.)
    assert "<script" not in doc
    assert 'src="http' not in doc and "href=\"http" not in doc


@requires_backend
def test_math_markdown_block_adds_no_script_or_external_asset():
    """The md->HTML for math is pure inlined MathML: no <script>, no src/href."""
    out = _markdown_to_html("$x^2$ and $$\\frac{a}{b}$$")
    assert "<script" not in out
    assert "src=" not in out and "href=" not in out
