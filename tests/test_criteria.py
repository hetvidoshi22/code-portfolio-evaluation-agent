"""The displayed breakdown must always sum to the real score.

This is the guard against the breakdown becoming a second, drifting scoring
implementation. The exhaustive test below covers every reachable combination of
the eight signals, so a divergence cannot hide in an untested corner.
"""

import itertools

import pytest

from _core import calculate_score
from _criteria import CRITERIA, MAX_SCORE, ScoringDriftError, build_breakdown, build_verdict

SIGNAL_FILES = ["readme.md", "license", ".gitignore", "tests"]


def repo(files, language, size, stars, forks):
    return {
        "name": "demo",
        "description": None,
        "language": language,
        "stars": stars,
        "forks": forks,
        "size": size,
        "files": list(files),
    }


def all_combinations():
    for combo in itertools.product([0, 1], repeat=8):
        yield repo(
            files=[f for f, on in zip(SIGNAL_FILES, combo[:4]) if on],
            language="Python" if combo[4] else None,
            size=500 if combo[5] else 10,
            stars=42 if combo[6] else 0,
            forks=7 if combo[7] else 0,
        )


def test_breakdown_matches_calculate_score_for_every_combination():
    for data in all_combinations():
        result = build_breakdown(data)
        awarded = sum(row["points"] for row in result["criteria"])
        assert awarded == calculate_score(data)
        assert result["score"] == calculate_score(data)


def test_breakdown_returns_the_authoritative_score_not_the_mirror_sum():
    # The value handed to the UI comes from calculate_score(), always.
    data = repo(SIGNAL_FILES, "Python", 500, 1, 1)
    assert build_breakdown(data)["score"] == calculate_score(data)


def test_every_criterion_is_reported_exactly_once():
    data = repo([], None, 0, 0, 0)
    rows = build_breakdown(data)["criteria"]
    ids = [row["id"] for row in rows]
    assert len(ids) == len(set(ids)) == len(CRITERIA)


def test_criteria_max_points_total_100():
    data = repo([], None, 0, 0, 0)
    rows = build_breakdown(data)["criteria"]
    assert sum(row["maxPoints"] for row in rows) == MAX_SCORE == 100


def test_failed_criteria_award_zero():
    data = repo([], None, 0, 0, 0)
    for row in build_breakdown(data)["criteria"]:
        assert row["passed"] is False
        assert row["points"] == 0


def test_passed_criteria_award_full_points():
    data = repo(SIGNAL_FILES, "Python", 500, 1, 1)
    for row in build_breakdown(data)["criteria"]:
        assert row["passed"] is True
        assert row["points"] == row["maxPoints"]


def test_every_row_carries_a_human_readable_detail():
    data = repo(["readme.md"], "Python", 500, 0, 0)
    evidence = {"readme": "README.rst", "license": None, "gitignore": None, "tests": None}
    for row in build_breakdown(data, evidence)["criteria"]:
        assert isinstance(row["detail"], str) and row["detail"].strip()


def test_evidence_is_surfaced_in_the_detail_text():
    data = repo(["readme.md"], "Python", 500, 0, 0)
    evidence = {"readme": "README.rst", "license": None, "gitignore": None, "tests": None}
    readme_row = next(r for r in build_breakdown(data, evidence)["criteria"] if r["id"] == "readme")
    assert "README.rst" in readme_row["detail"]


def test_drift_is_detected_and_raised(monkeypatch):
    import _criteria

    monkeypatch.setattr(_criteria, "calculate_score", lambda _data: 999)
    with pytest.raises(ScoringDriftError):
        build_breakdown(repo([], None, 0, 0, 0))


# ─── Verdict tiers (copied verbatim from app.py) ─────────────────────────────


@pytest.mark.parametrize(
    "score,tier",
    [
        (0, "needs-improvement"),
        (59, "needs-improvement"),
        (60, "good"),
        (79, "good"),
        (80, "strong"),
        (100, "strong"),
    ],
)
def test_verdict_boundaries(score, tier):
    assert build_verdict(score)["tier"] == tier


def test_verdict_always_has_label_and_message():
    for score in range(0, 101):
        verdict = build_verdict(score)
        assert verdict["label"] and verdict["message"]
