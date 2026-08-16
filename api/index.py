"""HTTP API for the Code Portfolio Evaluation Agent.

Deployed as a single Vercel Python serverless function. Routes are registered
both with and without the `/api` prefix so the same app works under Vercel's
routing and under a bare `uvicorn api.index:app` locally.
"""

from __future__ import annotations

import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.dirname(_HERE)
for _path in (_HERE, _ROOT):
    if _path not in sys.path:
        sys.path.insert(0, _path)

from typing import Any, Dict, Optional  # noqa: E402

from fastapi import APIRouter, FastAPI, Query, Response  # noqa: E402
from fastapi.responses import JSONResponse  # noqa: E402
from pydantic import BaseModel  # noqa: E402

import _github  # noqa: E402
from _core import evaluate_repo, split_insights  # noqa: E402
from _criteria import (  # noqa: E402
    CRITERIA,
    MAX_SCORE,
    ScoringDriftError,
    build_breakdown,
    build_verdict,
)

API_VERSION = "1.0.0"

app = FastAPI(
    title="Code Portfolio Evaluation Agent",
    version=API_VERSION,
    docs_url=None,
    redoc_url=None,
)

router = APIRouter()


class AnalyzeRequest(BaseModel):
    url: str


def _error_response(error: _github.AnalysisError) -> JSONResponse:
    headers = {"Cache-Control": "no-store"}
    if error.code == "rate_limited" and error.retry_after:
        headers["Retry-After"] = str(error.retry_after)
    return JSONResponse(
        status_code=error.status,
        content={"error": error.to_dict()},
        headers=headers,
    )


def _analyze(url: str) -> Dict[str, Any]:
    """Run the full pipeline. Raises AnalysisError; never returns a partial result."""
    fetched = _github.fetch_repository(url)
    repo_data = fetched["repoData"]
    evidence = fetched["evidence"]

    breakdown = build_breakdown(repo_data, evidence)
    score = breakdown["score"]

    insights = split_insights(evaluate_repo(repo_data))

    return {
        "repository": fetched["overview"],
        "score": score,
        "maxScore": breakdown["maxScore"],
        "verdict": build_verdict(score),
        "criteria": breakdown["criteria"],
        "insights": insights,
        "meta": {
            "authenticated": _github.is_authenticated(),
            "version": API_VERSION,
        },
    }


def _run(url: Optional[str]) -> Response:
    if not url or not url.strip():
        return _error_response(
            _github.AnalysisError(
                "invalid_url",
                "Please enter a valid GitHub repository URL.",
                status=400,
            )
        )

    try:
        payload = _analyze(url)
    except _github.AnalysisError as error:
        return _error_response(error)
    except ScoringDriftError as error:
        # A breakdown that does not sum to the real score is a correctness bug,
        # not a user error. Fail loudly rather than display a wrong number.
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "scoring_drift",
                    "message": "Scoring configuration error. Please report this issue.",
                    "detail": str(error),
                }
            },
            headers={"Cache-Control": "no-store"},
        )
    except Exception:  # noqa: BLE001 - last line of defence, never leak internals
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "unexpected",
                    "message": "Something unexpected happened while analyzing this "
                    "repository. Please try again shortly.",
                }
            },
            headers={"Cache-Control": "no-store"},
        )

    return JSONResponse(
        content=payload,
        headers={
            # Analyses are pure reads of public data; let the CDN absorb repeats.
            "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600"
        },
    )


@router.get("/health")
def health() -> JSONResponse:
    return JSONResponse(
        content={
            "status": "ok",
            "version": API_VERSION,
            "authenticated": _github.is_authenticated(),
            "maxScore": MAX_SCORE,
        },
        headers={"Cache-Control": "no-store"},
    )


@router.get("/criteria")
def criteria() -> JSONResponse:
    """The scoring rubric, so the homepage always advertises the real rules."""
    return JSONResponse(
        content={
            "maxScore": MAX_SCORE,
            "criteria": [
                {"id": c.id, "label": c.label, "points": c.points} for c in CRITERIA
            ],
        },
        headers={"Cache-Control": "public, s-maxage=86400"},
    )


@router.get("/analyze")
def analyze_get(url: str = Query(default="")) -> Response:
    return _run(url)


@router.post("/analyze")
def analyze_post(body: AnalyzeRequest) -> Response:
    return _run(body.url)


app.include_router(router, prefix="/api")
app.include_router(router)
