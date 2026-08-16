"""Characterization tests for scoring.py.

These pin the behaviour of the original scorer. They are written against the
code as it stands, not to justify a rewrite — if one of these ever fails, the
scoring rules changed and that change needs to be deliberate.
"""

import itertools

import pytest

from _core import calculate_score
from _criteria import MAX_SCORE


def repo(
    files=None,
    language="Python",
    size=500,
    stars=10,
    forks=3,
    name="demo",
    description="A demo repository",
):
    """A fully-populated repo_data dict, matching what api/_github.py produces."""
    return {
        "name": name,
        "description": description,
        "language": language,
        "stars": stars,
        "forks": forks,
        "size": size,
        "files": list(files if files is not None else []),
    }


# ─── Individual criteria ─────────────────────────────────────────────────────


def test_readme_present_awards_20():
    assert calculate_score(repo(files=["readme.md"])) - calculate_score(repo()) == 20


def test_readme_missing_awards_nothing():
    assert calculate_score(repo(files=[])) == calculate_score(repo(files=["other.md"]))


def test_license_present_awards_10():
    assert calculate_score(repo(files=["license"])) - calculate_score(repo()) == 10


def test_license_missing_awards_nothing():
    baseline = calculate_score(repo(files=[]))
    assert calculate_score(repo(files=["notalicense"])) == baseline


def test_gitignore_present_awards_10():
    assert calculate_score(repo(files=[".gitignore"])) - calculate_score(repo()) == 10


def test_tests_directory_awards_10():
    assert calculate_score(repo(files=["tests"])) - calculate_score(repo()) == 10


def test_singular_test_directory_also_awards_10():
    assert calculate_score(repo(files=["test"])) - calculate_score(repo()) == 10


def test_tests_missing_awards_nothing():
    assert calculate_score(repo(files=["testing"])) == calculate_score(repo(files=[]))


def test_language_present_awards_15():
    assert calculate_score(repo(language="Go")) - calculate_score(repo(language=None)) == 15


def test_language_empty_string_awards_nothing():
    assert calculate_score(repo(language="")) == calculate_score(repo(language=None))


def test_size_above_threshold_awards_20():
    assert calculate_score(repo(size=101)) - calculate_score(repo(size=100)) == 20


def test_size_exactly_at_threshold_awards_nothing():
    # The rule is `size > 100`, not `>=`. Pinned so it cannot drift silently.
    assert calculate_score(repo(size=100)) == calculate_score(repo(size=0))


def test_stars_awards_10():
    assert calculate_score(repo(stars=1)) - calculate_score(repo(stars=0)) == 10


def test_forks_awards_5():
    assert calculate_score(repo(forks=1)) - calculate_score(repo(forks=0)) == 5


# ─── Totals and boundaries ───────────────────────────────────────────────────


ALL_SIGNALS = ["readme.md", "license", ".gitignore", "tests"]


def test_maximum_score_is_exactly_100():
    assert calculate_score(repo(files=ALL_SIGNALS)) == 100


def test_criteria_table_totals_exactly_100():
    assert MAX_SCORE == 100


def test_score_never_exceeds_100_even_with_duplicate_signals():
    # "tests" and "test" both match the same rule; the rule must not pay twice.
    noisy = ALL_SIGNALS + ["tests", "test", "readme.md", "license"]
    assert calculate_score(repo(files=noisy)) == 100


def test_empty_repository_scores_zero_without_crashing():
    empty = repo(files=[], language=None, size=0, stars=0, forks=0, description=None)
    assert calculate_score(empty) == 0


def test_score_is_never_negative_and_never_above_max():
    for combo in itertools.product([0, 1], repeat=8):
        data = repo(
            files=[f for f, on in zip(ALL_SIGNALS, combo[:4]) if on],
            language="Rust" if combo[4] else None,
            size=500 if combo[5] else 0,
            stars=7 if combo[6] else 0,
            forks=2 if combo[7] else 0,
        )
        score = calculate_score(data)
        assert 0 <= score <= MAX_SCORE


@pytest.mark.parametrize(
    "signals,expected",
    [
        # Exact tier boundaries from app.py. Both edges are attainable.
        # 80 = readme 20 + size 20 + language 15 + license 10 + gitignore 10 + forks 5
        (dict(files=["readme.md", "license", ".gitignore"], size=500, stars=0, forks=1), 80),
        # 75 = the highest attainable "Good" score (one step below the strong tier)
        (dict(files=["readme.md", "license", ".gitignore"], size=500, stars=0, forks=0), 75),
        # 60 = readme 20 + size 20 + gitignore 10 + tests 10
        (dict(files=["readme.md", ".gitignore", "tests"], language=None, size=500, stars=0, forks=0), 60),
        # 55 = the highest attainable "Needs Improvement" score
        (dict(files=["readme.md"], size=500, stars=0, forks=0), 55),
        # Everything on
        (dict(files=ALL_SIGNALS, size=500, stars=1, forks=1), 100),
        # Everything off
        (dict(files=[], language=None, size=0, stars=0, forks=0), 0),
    ],
)
def test_known_score_combinations(signals, expected):
    assert calculate_score(repo(**signals)) == expected


def test_every_attainable_score_is_a_multiple_of_five():
    # All point values are multiples of 5, so both tier edges (80 and 60) sit
    # exactly on attainable scores rather than in an unreachable gap.
    for combo in itertools.product([0, 1], repeat=8):
        data = repo(
            files=[f for f, on in zip(ALL_SIGNALS, combo[:4]) if on],
            language="Rust" if combo[4] else None,
            size=500 if combo[5] else 0,
            stars=7 if combo[6] else 0,
            forks=2 if combo[7] else 0,
        )
        assert calculate_score(data) % 5 == 0


def test_scoring_is_deterministic():
    data = repo(files=["readme.md", "license"])
    results = {calculate_score(dict(data, files=list(data["files"]))) for _ in range(25)}
    assert len(results) == 1


# ─── Defensive input handling ────────────────────────────────────────────────
# api/_github.py guarantees these types, so the scorer never sees bad data.
# These tests document that guarantee from the scorer's side.


def test_zero_valued_repository_does_not_crash():
    assert calculate_score(repo(size=0, stars=0, forks=0, language=None, files=[])) == 0


def test_large_values_do_not_break_the_cap():
    huge = repo(files=ALL_SIGNALS, size=10**9, stars=10**6, forks=10**6)
    assert calculate_score(huge) == 100
