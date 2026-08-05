"""Robust cross-platform "open this HTML file in a browser" helper for the demos.

Python's `webbrowser.open` fails SILENTLY in common setups (macOS + non-framework
Python builds route through `osascript 'open location'`, which no-ops for
`file://` URLs), so the demos looked like `--open` did nothing. This helper
tries `webbrowser`, verifies its return value, falls back to the OS opener
(`open` / `xdg-open` / `os.startfile`), and ALWAYS prints the path + a manual
command so a failure is never silent.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


def open_in_browser(path: Path) -> None:
    path = path.expanduser().resolve()
    opener = "open" if sys.platform == "darwin" else "xdg-open"
    print(f"Open it:  {opener} {path}")

    import webbrowser

    try:
        if webbrowser.open(path.as_uri()):
            return
    except Exception:
        pass

    # webbrowser reported failure (or lied by raising) — use the OS opener.
    try:
        if sys.platform == "win32":
            import os

            os.startfile(str(path))  # type: ignore[attr-defined]
        else:
            subprocess.run([opener, str(path)], check=True)
    except Exception as exc:  # never silent
        print(f"Could not launch a browser automatically ({exc}); use the command above.")
