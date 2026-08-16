"""Explainable breakdown of the score produced by `scoring.py`.

This is deliberately *not* a second scoring implementation. Each criterion here
restates one line of `calculate_score()` declaratively so it can be labelled and
displayed. On every call the mirror's total is checked against the real
`calculate_score()` result, and the value returned to the caller is always the
real one. If the two ever diverge — because `scoring.py` changed — the check
raises rather than showing a breakdown that does not add up.
"""

from __future__ import annotations

from typing import Any, Callable, Dict, List, Optional

from _core import calculate_score

__all__ = [
    "CRITERIA",
    "MAX_SCORE",
    "ScoringDriftError",
    "build_breakdown",
    "build_verdict",
]


class ScoringDriftError(RuntimeError):
    """The displayed breakdown no longer sums to the authoritative score."""

    def __init__(self, mirror_total: int, authoritative: int) -> None:
        super().__init__(
            "Score breakdown ({}) does not match calculate_score() ({}). "
            "api/_criteria.py is out of sync with scoring.py.".format(
                mirror_total, authoritative
            )
        )
        self.mirror_total = mirror_total
        self.authoritative = authoritative


class Criterion:
    __slots__ = ("id", "label", "points", "test", "describe")

    def __init__(
        self,
        id: str,
        label: str,
        points: int,
        test: Callable[[Dict[str, Any]], bool],
        describe: Callable[[Dict[str, Any], Dict[str, Optional[str]]], str],
    ) -> None:
        self.id = id
        self.label = label
        self.points = points
        self.test = test
        self.describe = describe


def _files(data: Dict[str, Any]) -> List[str]:
    value = data.get("files")
    return value if isinstance(value, list) else []


# Each `test` mirrors exactly one condition in scoring.calculate_score().
CRITERIA: List[Criterion] = [
    Criterion(
        id="readme",
        label="Documentation",
        points=20,
        test=lambda d: "readme.md" in _files(d),
        describe=lambda d, ev: (
            "Found {}".format(ev.get("readme")) if ev.get("readme") else "No README file in the repository root"
        ),
    ),
    Criterion(
        id="size",
        label="Project size",
        points=20,
        test=lambda d: d.get("size", 0) > 100,
        describe=lambda d, ev: (
            "{} KB of source — substantial enough to review".format(d.get("size", 0))
            if d.get("size", 0) > 100
            else "{} KB — under the 100 KB threshold for a substantial project".format(d.get("size", 0))
        ),
    ),
    Criterion(
        id="language",
        label="Primary language",
        points=15,
        test=lambda d: bool(d.get("language")),
        describe=lambda d, ev: (
            "GitHub detected {}".format(d.get("language"))
            if d.get("language")
            else "GitHub could not detect a primary language"
        ),
    ),
    Criterion(
        id="license",
        label="License",
        points=10,
        test=lambda d: "license" in _files(d),
        describe=lambda d, ev: (
            "Found {}".format(ev.get("license")) if ev.get("license") else "No license file — usage terms are undefined"
        ),
    ),
    Criterion(
        id="gitignore",
        label="Version control hygiene",
        points=10,
        test=lambda d: ".gitignore" in _files(d),
        describe=lambda d, ev: (
            "Found .gitignore" if ev.get("gitignore") else "No .gitignore — build artefacts may be committed"
        ),
    ),
    Criterion(
        id="tests",
        label="Testing",
        points=10,
        test=lambda d: "tests" in _files(d) or "test" in _files(d),
        describe=lambda d, ev: (
            "Found {}".format(ev.get("tests")) if ev.get("tests") else "No test directory or test config in the root"
        ),
    ),
    Criterion(
        id="stars",
        label="Community interest",
        points=10,
        test=lambda d: d.get("stars", 0) > 0,
        describe=lambda d, ev: (
            "{} star{}".format(d.get("stars", 0), "" if d.get("stars", 0) == 1 else "s")
            if d.get("stars", 0) > 0
            else "No stars yet"
        ),
    ),
    Criterion(
        id="forks",
        label="Collaboration",
        points=5,
        test=lambda d: d.get("forks", 0) > 0,
        describe=lambda d, ev: (
            "{} fork{}".format(d.get("forks", 0), "" if d.get("forks", 0) == 1 else "s")
            if d.get("forks", 0) > 0
            else "No forks yet"
        ),
    ),
]

MAX_SCORE = sum(criterion.points for criterion in CRITERIA)

# The rubric must total exactly 100, so scoring.py's min(score, 100) cap never
# has to intervene. If a criterion is ever added or reweighted, this fails loudly
# at import time rather than silently producing an unreachable maximum.
assert MAX_SCORE == 100, "Criteria must total exactly 100, got {}".format(MAX_SCORE)


def build_breakdown(
    repo_data: Dict[str, Any],
    evidence: Optional[Dict[str, Optional[str]]] = None,
) -> Dict[str, Any]:
    """Return the authoritative score alongside a per-criterion explanation."""
    evidence = evidence or {}

    rows: List[Dict[str, Any]] = []
    mirror_total = 0

    for criterion in CRITERIA:
        passed = bool(criterion.test(repo_data))
        earned = criterion.points if passed else 0
        mirror_total += earned
        rows.append(
            {
                "id": criterion.id,
                "label": criterion.label,
                "passed": passed,
                "points": earned,
                "maxPoints": criterion.points,
                "detail": criterion.describe(repo_data, evidence),
            }
        )

    authoritative = calculate_score(repo_data)
    if mirror_total != authoritative:
        raise ScoringDriftError(mirror_total, authoritative)

    return {"score": authoritative, "maxScore": MAX_SCORE, "criteria": rows}


# Verdict tiers and wording are copied verbatim from app.py so the Streamlit app
# and the web app never disagree. This is presentation, not scoring.
def build_verdict(score: int) -> Dict[str, str]:
    if score >= 80:
        return {
            "tier": "strong",
            "label": "Strong Portfolio",
            "message": "This repository demonstrates strong engineering practices "
            "and project quality.",
        }
    if score >= 60:
        return {
            "tier": "good",
            "label": "Good Portfolio",
            "message": "The project shows solid implementation but could benefit "
            "from further improvements.",
        }
    return {
        "tier": "needs-improvement",
        "label": "Needs Improvement",
        "message": "The repository requires additional documentation, structure, "
        "or features.",
    }
