"""Adapter over the project's original core modules.

`scoring.py`, `evaluator.py`, `github_analyzer.py` and `app.py` are never
modified. This module makes the two that matter importable outside Streamlit
and reshapes their output for the HTTP API.

Why the shim: `github_analyzer.py` and `evaluator.py` both do
`import streamlit as st` purely to use `@st.cache_data`. Installing Streamlit
into a serverless bundle drags in pandas, numpy and pyarrow for ~200 MB of
dependencies that are never called. Registering a stub in `sys.modules` before
the import resolves the decorators without the real package.
"""

from __future__ import annotations

import os
import sys
import types

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)


if "streamlit" not in sys.modules:
    _stub = types.ModuleType("streamlit")

    def _cache_data(func=None, **_kwargs):
        # Both call shapes appear in the original code:
        #   @st.cache_data                      -> func is the function
        #   @st.cache_data(show_spinner=False)  -> func is None, return decorator
        if func is None:
            return lambda f: f
        return func

    _stub.cache_data = _cache_data
    sys.modules["streamlit"] = _stub


from scoring import calculate_score  # noqa: E402  (import must follow the shim)
from evaluator import evaluate_repo  # noqa: E402

__all__ = ["calculate_score", "evaluate_repo", "split_insights", "NO_IMPROVEMENTS_NOTE"]


_STRENGTHS_HEADING = "### Strengths"
_IMPROVEMENTS_HEADING = "### Improvement Suggestions"

# evaluator.py emits this single line instead of a list when it finds nothing
# to improve. It is a status message, not an improvement, so it is lifted out
# of the list rather than rendered as one.
NO_IMPROVEMENTS_NOTE = (
    "No major improvements detected. Repository follows good development practices."
)


def split_insights(markdown: str) -> dict:
    """Reshape `evaluate_repo()`'s markdown into structured lists.

    The evaluator remains the only source of the insight text; this parses it
    rather than restating it, so the two can never disagree.
    `tests/test_insights.py` checks this against the real function's output.
    """
    strengths: list[str] = []
    improvements: list[str] = []
    bucket: list[str] | None = None

    for raw_line in (markdown or "").splitlines():
        line = raw_line.strip()
        if line == _STRENGTHS_HEADING:
            bucket = strengths
        elif line == _IMPROVEMENTS_HEADING:
            bucket = improvements
        elif line.startswith("- ") and bucket is not None:
            item = line[2:].strip()
            if item:
                bucket.append(item)

    note = None
    if improvements == [NO_IMPROVEMENTS_NOTE]:
        improvements = []
        note = NO_IMPROVEMENTS_NOTE

    return {"strengths": strengths, "improvements": improvements, "note": note}
