"""GitHub access layer: URL parsing, fetching, error classification, signal detection.

This sits *upstream* of `scoring.py`. It is responsible for producing a
`repo_data` dict that is always well-typed and whose `files` list contains the
canonical tokens the original scorer looks for. That is how repository
detection improves (README.rst, LICENSE.md, tests/ ...) without the scorer
changing at all.

`github_analyzer.py` is left untouched and still serves the Streamlit app. It
cannot support token auth, error classification, or `pushed_at`, all of which
the web API requires, so the web API uses this client instead.
"""

from __future__ import annotations

import os
import re
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

import requests

GITHUB_API = "https://api.github.com"
REQUEST_TIMEOUT = 10
USER_AGENT = "code-portfolio-evaluation-agent"


# ─── Errors ──────────────────────────────────────────────────────────────────
# One class per situation the user can actually be in, each with the exact
# message the UI shows. No generic "something went wrong".


class AnalysisError(Exception):
    """A failure the user needs a specific, actionable message for."""

    def __init__(
        self,
        code: str,
        message: str,
        status: int = 400,
        retry_after: Optional[int] = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status
        self.retry_after = retry_after

    def to_dict(self) -> Dict[str, Any]:
        payload: Dict[str, Any] = {"code": self.code, "message": self.message}
        if self.retry_after is not None:
            payload["retryAfter"] = self.retry_after
        return payload


def _invalid_url() -> AnalysisError:
    return AnalysisError(
        "invalid_url",
        "Please enter a valid GitHub repository URL.",
        status=400,
    )


def _not_found() -> AnalysisError:
    return AnalysisError(
        "not_found",
        "We couldn't find this repository. Make sure the URL is correct and "
        "the repository is public.",
        status=404,
    )


def _private() -> AnalysisError:
    return AnalysisError(
        "private",
        "Private repositories cannot be analyzed.",
        status=403,
    )


def _rate_limited(retry_after: Optional[int] = None) -> AnalysisError:
    return AnalysisError(
        "rate_limited",
        "GitHub's API rate limit has been reached. Please try again later.",
        status=429,
        retry_after=retry_after,
    )


def _network() -> AnalysisError:
    return AnalysisError(
        "network",
        "We couldn't reach GitHub right now. Please try again shortly.",
        status=503,
    )


def _github_error() -> AnalysisError:
    return AnalysisError(
        "github_error",
        "GitHub returned an unexpected response. Please try again shortly.",
        status=502,
    )


# ─── URL parsing ─────────────────────────────────────────────────────────────

_GITHUB_HOSTS = {"github.com", "www.github.com"}

# GitHub usernames/orgs: alphanumeric plus hyphen, no leading/trailing hyphen.
_OWNER_RE = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$")
# Repository names additionally allow "." and "_".
_REPO_RE = re.compile(r"^[A-Za-z0-9._-]{1,100}$")

# First path segments that are GitHub product routes, never an owner.
_RESERVED_OWNERS = frozenset(
    {
        "about", "account", "apps", "codespaces", "collections", "contact",
        "customer-stories", "dashboard", "enterprise", "explore", "features",
        "gist", "issues", "join", "login", "logout", "marketplace", "new",
        "notifications", "orgs", "organizations", "pricing", "pulls", "search",
        "security", "sessions", "settings", "signup", "site", "sponsors",
        "stars", "topics", "trending", "users", "watching",
    }
)

_SCP_LIKE = re.compile(r"^(?:ssh://)?git@github\.com[:/](?P<path>.+)$", re.IGNORECASE)
_SHORTHAND = re.compile(r"^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+/?$")


def parse_repo_url(raw: str) -> Tuple[str, str]:
    """Extract (owner, repo) from the GitHub URL formats people actually paste.

    Accepts https/http, a missing scheme, `www.`, a trailing slash, a `.git`
    suffix, query strings, and deep links such as `/tree/main/src`. Also accepts
    the unambiguous `owner/repo` shorthand. Anything else raises `invalid_url`.
    """
    if not isinstance(raw, str):
        raise _invalid_url()

    text = raw.strip().strip("<>").rstrip("/")
    if not text:
        raise _invalid_url()

    scp = _SCP_LIKE.match(text)
    if scp:
        text = "https://github.com/" + scp.group("path")
    elif "://" not in text:
        if _SHORTHAND.match(text) and not text.lower().startswith("github.com"):
            text = "https://github.com/" + text
        else:
            text = "https://" + text

    try:
        parsed = urlparse(text)
    except ValueError:
        raise _invalid_url()

    if parsed.scheme not in ("http", "https"):
        raise _invalid_url()
    if parsed.netloc.lower() not in _GITHUB_HOSTS:
        raise _invalid_url()

    segments = [seg for seg in parsed.path.split("/") if seg]
    if len(segments) < 2:
        raise _invalid_url()

    owner, repo = segments[0], segments[1]
    if repo.lower().endswith(".git"):
        repo = repo[: -len(".git")]

    if owner.lower() in _RESERVED_OWNERS:
        raise _invalid_url()
    if not _OWNER_RE.match(owner):
        raise _invalid_url()
    if not _REPO_RE.match(repo) or repo in (".", ".."):
        raise _invalid_url()

    return owner, repo


# ─── Signal detection ────────────────────────────────────────────────────────
# Decides whether a repository *genuinely* has each signal. Deliberately
# conservative: root-level evidence only, so a vendored `node_modules/tests`
# can never earn testing points.

_README_STEMS = frozenset({"readme"})
_README_EXTS = frozenset(
    {"", ".md", ".markdown", ".mdown", ".rst", ".txt", ".adoc", ".asciidoc", ".org"}
)
_LICENSE_STEMS = frozenset({"license", "licence", "copying"})
_TEST_DIRS = frozenset({"tests", "test", "spec", "__tests__"})
_TEST_FILES = frozenset(
    {
        "conftest.py",
        "pytest.ini",
        "jest.config.js",
        "jest.config.ts",
        "jest.config.mjs",
        "vitest.config.js",
        "vitest.config.ts",
        "karma.conf.js",
    }
)


def _split_ext(name: str) -> Tuple[str, str]:
    dot = name.rfind(".")
    if dot <= 0:
        return name, ""
    return name[:dot], name[dot:]


def detect_signals(
    entries: List[Dict[str, Any]],
    has_license_metadata: bool = False,
) -> Dict[str, Optional[str]]:
    """Map root entries to signals, recording the evidence for each match.

    Returns a dict of signal -> matched filename (or a metadata marker), with
    `None` where the signal is absent. `entries` are `/contents` items, each
    with `name` and `type` ("file" or "dir").
    """
    files: List[str] = []
    dirs: List[str] = []
    for entry in entries or []:
        if not isinstance(entry, dict):
            continue
        name = entry.get("name")
        if not isinstance(name, str) or not name:
            continue
        if entry.get("type") == "dir":
            dirs.append(name)
        else:
            files.append(name)

    evidence: Dict[str, Optional[str]] = {
        "readme": None,
        "license": None,
        "gitignore": None,
        "tests": None,
    }

    for name in files:
        lowered = name.lower()
        stem, ext = _split_ext(lowered)

        if evidence["readme"] is None and stem in _README_STEMS and ext in _README_EXTS:
            evidence["readme"] = name
        if evidence["license"] is None and stem in _LICENSE_STEMS:
            evidence["license"] = name
        if evidence["gitignore"] is None and lowered == ".gitignore":
            evidence["gitignore"] = name
        if evidence["tests"] is None and lowered in _TEST_FILES:
            evidence["tests"] = name

    for name in dirs:
        if evidence["tests"] is None and name.lower() in _TEST_DIRS:
            evidence["tests"] = name + "/"

    # GitHub's own licence detection is authoritative and catches spellings the
    # filename scan would miss.
    if evidence["license"] is None and has_license_metadata:
        evidence["license"] = "detected by GitHub"

    return evidence


# Canonical tokens `scoring.py` and `evaluator.py` already look for. Detection
# improves by resolving real filenames into these, never by editing the scorer.
_SIGNAL_TOKENS = {
    "readme": "readme.md",
    "license": "license",
    "gitignore": ".gitignore",
    "tests": "tests",
}


def build_repo_data(repo: Dict[str, Any], evidence: Dict[str, Optional[str]]) -> Dict[str, Any]:
    """Build the exact 7-key dict `scoring.py` and `evaluator.py` consume.

    Every value is coerced to a safe type here so the original modules can never
    receive `None` where they compare with `>`.
    """
    files = [_SIGNAL_TOKENS[key] for key, found in evidence.items() if found]

    return {
        "name": repo.get("name") or "",
        "description": repo.get("description"),
        "language": repo.get("language") or None,
        "stars": _safe_int(repo.get("stargazers_count")),
        "forks": _safe_int(repo.get("forks_count")),
        "size": _safe_int(repo.get("size")),
        "files": files,
    }


def _safe_int(value: Any) -> int:
    if isinstance(value, bool):
        return 0
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    try:
        return int(str(value))
    except (TypeError, ValueError):
        return 0


# ─── Fetching ────────────────────────────────────────────────────────────────


def _headers() -> Dict[str, str]:
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": USER_AGENT,
    }
    # Read from the environment only; never hardcoded, never sent to the client.
    token = os.environ.get("GITHUB_TOKEN", "").strip()
    if token:
        headers["Authorization"] = "Bearer " + token
    return headers


def _get(url: str) -> requests.Response:
    try:
        return requests.get(url, headers=_headers(), timeout=REQUEST_TIMEOUT)
    except requests.exceptions.RequestException:
        raise _network()


def _raise_for_status(response: requests.Response) -> None:
    status = response.status_code
    if status == 200:
        return
    if status == 404:
        raise _not_found()
    if status in (403, 429):
        remaining = response.headers.get("X-RateLimit-Remaining")
        reset = response.headers.get("X-RateLimit-Reset")
        if status == 429 or remaining == "0":
            retry_after = None
            try:
                retry_after = int(reset) if reset else None
            except (TypeError, ValueError):
                retry_after = None
            raise _rate_limited(retry_after)
        raise _github_error()
    raise _github_error()


def _json(response: requests.Response) -> Any:
    try:
        return response.json()
    except ValueError:
        raise _github_error()


def is_authenticated() -> bool:
    return bool(os.environ.get("GITHUB_TOKEN", "").strip())


def fetch_repository(url: str) -> Dict[str, Any]:
    """Fetch and normalize a repository.

    Raises `AnalysisError` for every failure path, so a score is never produced
    from data that could not be reliably retrieved.
    """
    owner, repo_name = parse_repo_url(url)

    response = _get("{}/repos/{}/{}".format(GITHUB_API, owner, repo_name))
    _raise_for_status(response)
    repo = _json(response)
    if not isinstance(repo, dict) or not repo.get("name"):
        raise _github_error()

    if repo.get("private") is True:
        raise _private()

    entries = _fetch_root_entries(owner, repo_name)
    evidence = detect_signals(entries, has_license_metadata=bool(repo.get("license")))
    repo_data = build_repo_data(repo, evidence)

    owner_info = repo.get("owner") or {}

    overview = {
        "name": repo.get("name") or repo_name,
        "owner": owner_info.get("login") or owner,
        "fullName": repo.get("full_name") or "{}/{}".format(owner, repo_name),
        "description": repo.get("description"),
        "language": repo.get("language"),
        "stars": _safe_int(repo.get("stargazers_count")),
        "forks": _safe_int(repo.get("forks_count")),
        "sizeKb": _safe_int(repo.get("size")),
        "updatedAt": repo.get("pushed_at") or repo.get("updated_at"),
        "createdAt": repo.get("created_at"),
        "htmlUrl": repo.get("html_url") or "https://github.com/{}/{}".format(owner, repo_name),
        "defaultBranch": repo.get("default_branch"),
        "isFork": bool(repo.get("fork")),
        "isArchived": bool(repo.get("archived")),
        "isEmpty": len(entries) == 0,
    }

    return {"repoData": repo_data, "overview": overview, "evidence": evidence}


def _fetch_root_entries(owner: str, repo_name: str) -> List[Dict[str, Any]]:
    """Read the repository root.

    A 404 here means the repository exists but has no commits yet — a legitimate
    empty repository, which scores 0 rather than erroring. Any other failure is
    raised, because a partial read would produce a misleadingly low score.
    """
    response = _get("{}/repos/{}/{}/contents".format(GITHUB_API, owner, repo_name))
    if response.status_code == 404:
        return []
    _raise_for_status(response)

    payload = _json(response)
    if not isinstance(payload, list):
        raise _github_error()
    return [item for item in payload if isinstance(item, dict)]
