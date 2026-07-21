"""Store payload deflation (P3) — the baked content store raw-deflates its
non-image binary payloads (float/HDR ``.npy``, mesh/point-cloud/volume ``.npz``)
and tags them ``encoding:"deflate"``, while already-compressed ``image/*``
containers stay raw (absent tag = raw, backward-compatible). The TS reader
(`viewport/local-store.ts`) inflates the tagged entries via
`DecompressionStream("deflate-raw")` — the SAME raw-DEFLATE container (zlib
wbits -15) produced here.
"""

from __future__ import annotations

import base64
import zlib

import numpy as np

import cairn_plot as cp
from cairn_plot.shapers import _store_entry

_WBITS = -15  # raw DEFLATE, no zlib header/checksum — mirrors the TS inflate.


def _inflate(entry: dict[str, str]) -> bytes:
    raw = base64.b64decode(entry["b64"])
    if entry.get("encoding") == "deflate":
        return zlib.decompress(raw, _WBITS)
    return raw


def test_hdr_float_entry_is_deflated_tagged_and_smaller():
    # Smooth HDR gradient — representative of real float payloads (compresses well).
    yy, xx = np.mgrid[0:96, 0:96].astype(np.float32)
    arr = (np.sin(xx / 12.0) + np.cos(yy / 9.0)).astype(np.float32) * 25.0
    (entry,) = cp.Image(arr)._collect_store().values()

    assert entry["encoding"] == "deflate"
    assert entry["mime"] == "application/octet-stream"
    packed = base64.b64decode(entry["b64"])
    # The raw npy is (H*W*4 + header) bytes; the smooth gradient must shrink.
    assert len(packed) < arr.nbytes


def test_hdr_float_entry_round_trips():
    arr = np.linspace(0, 10, 64 * 64, dtype=np.float32).reshape(64, 64)
    (entry,) = cp.Image(arr)._collect_store().values()
    inflated = _inflate(entry)

    # Re-parse the inflated npy bytes and compare to the original array.
    import io

    restored = np.load(io.BytesIO(inflated))
    np.testing.assert_array_equal(restored, arr)


def test_png_entry_stays_raw_untagged():
    png = b"\x89PNG\r\n\x1a\n" + b"payload" * 8
    (entry,) = cp.Image(png)._collect_store().values()
    assert "encoding" not in entry  # absent tag = raw
    assert entry["mime"] == "image/png"
    assert base64.b64decode(entry["b64"]) == png


def test_store_entry_deflate_round_trips_octet_stream():
    raw = np.arange(4096, dtype=np.float32).tobytes()
    entry = _store_entry(raw, "application/octet-stream")
    assert entry["encoding"] == "deflate"
    assert _inflate(entry) == raw


def test_store_entry_skips_deflate_when_it_would_not_shrink():
    # Incompressible bytes (random) — deflate would grow them, so the entry
    # falls back to RAW (no tag), avoiding wasted payload.
    rng = np.random.default_rng(0)
    raw = rng.integers(0, 256, size=2048, dtype=np.uint8).tobytes()
    entry = _store_entry(raw, "application/octet-stream")
    assert "encoding" not in entry
    assert base64.b64decode(entry["b64"]) == raw


def test_image_entry_never_deflated_even_if_compressible():
    entry = _store_entry(b"\x00" * 4096, "image/png")
    assert "encoding" not in entry
    assert base64.b64decode(entry["b64"]) == b"\x00" * 4096
