"""URL parsing, signal detection, type coercion and error classification."""

import pytest

import _github
from _github import (
    AnalysisError,
    build_repo_data,
    detect_signals,
    parse_repo_url,
)


# ─── URL parsing ─────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "url",
    [
        "https://github.com/streamlit/streamlit",
        "https://github.com/streamlit/streamlit/",
        "https://github.com/streamlit/streamlit.git",
        "http://github.com/streamlit/streamlit",
        "https://www.github.com/streamlit/streamlit",
        "github.com/streamlit/streamlit",
        "www.github.com/streamlit/streamlit",
        "streamlit/streamlit",
        "  https://github.com/streamlit/streamlit  ",
        "https://github.com/streamlit/streamlit?tab=readme-ov-file",
        "https://github.com/streamlit/streamlit#readme",
        "https://github.com/streamlit/streamlit/tree/develop/lib",
        "https://github.com/streamlit/streamlit/blob/develop/README.md",
        "git@github.com:streamlit/streamlit.git",
        "<https://github.com/streamlit/streamlit>",
    ],
)
def test_accepts_common_url_shapes(url):
    assert parse_repo_url(url) == ("streamlit", "streamlit")


@pytest.mark.parametrize(
    "url",
    [
        "",
        "   ",
        None,
        "not a url",
        "https://gitlab.com/owner/repo",
        "https://bitbucket.org/owner/repo",
        "https://example.com/owner/repo",
        "https://github.com",
        "https://github.com/",
        "https://github.com/onlyowner",
        "https://github.com/settings/profile",
        "https://github.com/orgs/anthropics",
        "https://github.com/topics/python",
        "ftp://github.com/owner/repo",
        "https://github.com/-bad/repo",
        "https://github.com/owner/",
        "javascript:alert(1)",
    ],
)
def test_rejects_invalid_input(url):
    with pytest.raises(AnalysisError) as excinfo:
        parse_repo_url(url)
    assert excinfo.value.code == "invalid_url"
    assert excinfo.value.status == 400


def test_preserves_dots_and_hyphens_in_repository_names():
    assert parse_repo_url("https://github.com/user/my.cool-repo_v2") == (
        "user",
        "my.cool-repo_v2",
    )


def test_only_strips_a_trailing_dot_git():
    assert parse_repo_url("https://github.com/user/git.hub") == ("user", "git.hub")


# ─── Signal detection ────────────────────────────────────────────────────────


def entry(name, kind="file"):
    return {"name": name, "type": kind}


@pytest.mark.parametrize(
    "filename",
    ["README.md", "readme.md", "README", "README.rst", "README.txt", "Readme.markdown"],
)
def test_readme_variants_are_detected(filename):
    assert detect_signals([entry(filename)])["readme"] == filename


def test_readme_lookalikes_are_not_detected():
    assert detect_signals([entry("READMEME.md"), entry("readme.png")])["readme"] is None


@pytest.mark.parametrize(
    "filename", ["LICENSE", "LICENSE.md", "LICENSE.txt", "license", "LICENCE", "COPYING"]
)
def test_license_variants_are_detected(filename):
    assert detect_signals([entry(filename)])["license"] == filename


def test_license_falls_back_to_github_metadata():
    result = detect_signals([entry("main.py")], has_license_metadata=True)
    assert result["license"] == "detected by GitHub"


def test_no_license_anywhere_is_reported_as_missing():
    result = detect_signals([entry("main.py")], has_license_metadata=False)
    assert result["license"] is None


def test_gitignore_is_detected():
    assert detect_signals([entry(".gitignore")])["gitignore"] == ".gitignore"


@pytest.mark.parametrize("dirname", ["tests", "test", "spec", "__tests__"])
def test_test_directories_are_detected(dirname):
    assert detect_signals([entry(dirname, "dir")])["tests"] == dirname + "/"


@pytest.mark.parametrize("filename", ["conftest.py", "pytest.ini", "vitest.config.ts"])
def test_test_config_files_are_detected(filename):
    assert detect_signals([entry(filename)])["tests"] == filename


def test_a_file_named_tests_does_not_count_as_a_test_directory():
    # Only a directory (or a known test config file) is real evidence.
    assert detect_signals([entry("tests.md")])["tests"] is None


def test_empty_repository_detects_nothing_without_crashing():
    assert detect_signals([]) == {
        "readme": None,
        "license": None,
        "gitignore": None,
        "tests": None,
    }


def test_malformed_entries_are_ignored():
    entries = [None, {}, {"type": "file"}, {"name": 42}, entry("README.md")]
    assert detect_signals(entries)["readme"] == "README.md"


# ─── repo_data construction ──────────────────────────────────────────────────


def test_detected_signals_become_the_tokens_the_scorer_expects():
    evidence = {
        "readme": "README.rst",
        "license": "LICENSE.md",
        "gitignore": ".gitignore",
        "tests": "tests/",
    }
    data = build_repo_data({"name": "x"}, evidence)
    assert sorted(data["files"]) == sorted(["readme.md", "license", ".gitignore", "tests"])


def test_readme_rst_earns_documentation_points_without_changing_the_scorer():
    from _core import calculate_score

    evidence = detect_signals([entry("README.rst")])
    data = build_repo_data({"name": "x", "language": "Python"}, evidence)
    assert calculate_score(data) == 20 + 15


def test_missing_github_fields_are_coerced_to_safe_types():
    evidence = {"readme": None, "license": None, "gitignore": None, "tests": None}
    data = build_repo_data({}, evidence)
    assert data == {
        "name": "",
        "description": None,
        "language": None,
        "stars": 0,
        "forks": 0,
        "size": 0,
        "files": [],
    }


def test_null_counts_never_reach_the_scorer_as_none():
    from _core import calculate_score

    evidence = {"readme": None, "license": None, "gitignore": None, "tests": None}
    repo = {"name": "x", "stargazers_count": None, "forks_count": None, "size": None}
    data = build_repo_data(repo, evidence)
    assert calculate_score(data) == 0  # would raise TypeError if None leaked through


def test_empty_string_language_is_normalized_to_none():
    evidence = {"readme": None, "license": None, "gitignore": None, "tests": None}
    assert build_repo_data({"language": ""}, evidence)["language"] is None


# ─── Error classification ────────────────────────────────────────────────────


class FakeResponse:
    def __init__(self, status_code, payload=None, headers=None):
        self.status_code = status_code
        self._payload = payload
        self.headers = headers or {}

    def json(self):
        if self._payload is _MALFORMED:
            raise ValueError("not json")
        return self._payload


_MALFORMED = object()


@pytest.mark.parametrize(
    "response,expected_code",
    [
        (FakeResponse(404), "not_found"),
        (FakeResponse(403, headers={"X-RateLimit-Remaining": "0"}), "rate_limited"),
        (FakeResponse(429), "rate_limited"),
        (FakeResponse(403, headers={"X-RateLimit-Remaining": "17"}), "github_error"),
        (FakeResponse(500), "github_error"),
        (FakeResponse(502), "github_error"),
        (FakeResponse(418), "github_error"),
    ],
)
def test_http_status_classification(response, expected_code):
    with pytest.raises(AnalysisError) as excinfo:
        _github._raise_for_status(response)
    assert excinfo.value.code == expected_code


def test_successful_status_does_not_raise():
    assert _github._raise_for_status(FakeResponse(200)) is None


def test_rate_limit_carries_a_retry_hint():
    response = FakeResponse(
        403, headers={"X-RateLimit-Remaining": "0", "X-RateLimit-Reset": "1700000000"}
    )
    with pytest.raises(AnalysisError) as excinfo:
        _github._raise_for_status(response)
    assert excinfo.value.retry_after == 1700000000


def test_malformed_json_is_reported_as_a_github_error():
    with pytest.raises(AnalysisError) as excinfo:
        _github._json(FakeResponse(200, _MALFORMED))
    assert excinfo.value.code == "github_error"


def test_network_failure_is_classified(monkeypatch):
    import requests

    def boom(*_args, **_kwargs):
        raise requests.exceptions.ConnectionError("no route to host")

    monkeypatch.setattr(_github.requests, "get", boom)
    with pytest.raises(AnalysisError) as excinfo:
        _github._get("https://api.github.com/repos/a/b")
    assert excinfo.value.code == "network"
    assert excinfo.value.status == 503


def test_private_repository_is_rejected_before_scoring(monkeypatch):
    monkeypatch.setattr(
        _github,
        "_get",
        lambda _url: FakeResponse(200, {"name": "secret", "private": True}),
    )
    with pytest.raises(AnalysisError) as excinfo:
        _github.fetch_repository("https://github.com/owner/secret")
    assert excinfo.value.code == "private"


def test_repository_without_commits_is_treated_as_empty(monkeypatch):
    calls = {"n": 0}

    def fake_get(url):
        calls["n"] += 1
        if url.endswith("/contents"):
            return FakeResponse(404)
        return FakeResponse(200, {"name": "blank", "size": 0, "owner": {"login": "o"}})

    monkeypatch.setattr(_github, "_get", fake_get)
    result = _github.fetch_repository("https://github.com/o/blank")
    assert result["repoData"]["files"] == []
    assert result["overview"]["isEmpty"] is True


def test_partial_read_never_produces_a_score(monkeypatch):
    # If the contents call fails for any reason other than 404, we must error
    # rather than score the repository as if it had no files.
    def fake_get(url):
        if url.endswith("/contents"):
            return FakeResponse(500)
        return FakeResponse(200, {"name": "repo", "owner": {"login": "o"}})

    monkeypatch.setattr(_github, "_get", fake_get)
    with pytest.raises(AnalysisError) as excinfo:
        _github.fetch_repository("https://github.com/o/repo")
    assert excinfo.value.code == "github_error"


def test_token_is_read_from_the_environment_only(monkeypatch):
    monkeypatch.delenv("GITHUB_TOKEN", raising=False)
    assert "Authorization" not in _github._headers()
    assert _github.is_authenticated() is False

    monkeypatch.setenv("GITHUB_TOKEN", "ghp_example")
    assert _github._headers()["Authorization"] == "Bearer ghp_example"
    assert _github.is_authenticated() is True


def test_blank_token_is_treated_as_absent(monkeypatch):
    monkeypatch.setenv("GITHUB_TOKEN", "   ")
    assert "Authorization" not in _github._headers()
    assert _github.is_authenticated() is False
