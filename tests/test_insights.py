"""The insights parser must agree with evaluator.py's real output.

`evaluate_repo()` stays the only source of the strengths/improvements text.
`split_insights()` only reshapes it for JSON, so these tests run the real
function rather than a fixture string.
"""

from _core import NO_IMPROVEMENTS_NOTE, evaluate_repo, split_insights


def repo(files, language="Python", size=500, stars=10, forks=3):
    return {
        "name": "demo",
        "description": None,
        "language": language,
        "stars": stars,
        "forks": forks,
        "size": size,
        "files": list(files),
    }


def test_streamlit_shim_lets_the_evaluator_run_outside_streamlit():
    # If the shim were missing or wrong, importing evaluator.py would fail.
    assert isinstance(evaluate_repo(repo(["readme.md"])), str)


def test_strengths_and_improvements_are_separated():
    result = split_insights(evaluate_repo(repo(["readme.md", ".gitignore"])))
    assert result["strengths"]
    assert result["improvements"]
    assert not set(result["strengths"]) & set(result["improvements"])


def test_every_bullet_from_the_evaluator_is_captured():
    markdown = evaluate_repo(repo(["readme.md", ".gitignore"]))
    bullets = [
        line[2:].strip() for line in markdown.splitlines() if line.strip().startswith("- ")
    ]
    result = split_insights(markdown)
    captured = result["strengths"] + result["improvements"]
    if result["note"]:
        captured = captured + [result["note"]]
    assert sorted(captured) == sorted(bullets)


def test_no_bullet_markers_survive_parsing():
    result = split_insights(evaluate_repo(repo(["readme.md"])))
    for item in result["strengths"] + result["improvements"]:
        assert not item.startswith("- ")
        assert item == item.strip()


def test_readme_presence_is_reported_as_a_strength():
    result = split_insights(evaluate_repo(repo(["readme.md"])))
    assert any("README" in item for item in result["strengths"])


def test_missing_license_is_reported_as_an_improvement():
    result = split_insights(evaluate_repo(repo(["readme.md"])))
    assert any("license" in item.lower() for item in result["improvements"])


def test_perfect_repository_yields_a_note_instead_of_fake_improvements():
    perfect = repo(["readme.md", "license", ".gitignore", "tests"])
    result = split_insights(evaluate_repo(perfect))
    assert result["improvements"] == []
    assert result["note"] == NO_IMPROVEMENTS_NOTE


def test_empty_repository_produces_no_strengths_and_real_improvements():
    empty = repo([], language=None, size=0, stars=0, forks=0)
    result = split_insights(evaluate_repo(empty))
    assert result["strengths"] == []
    assert len(result["improvements"]) >= 4
    assert result["note"] is None


def test_parser_tolerates_empty_input():
    assert split_insights("") == {"strengths": [], "improvements": [], "note": None}
