# Code Portfolio Evaluation Agent

Score any public GitHub repository against eight engineering signals and get a clear,
explainable breakdown of every point.

Paste a repository URL, and the app reads the repository through GitHub's public REST API,
checks documentation, licensing, testing structure, project size, language detection and
community activity, and returns a score out of 100 alongside the exact evidence behind each
criterion.

**The scoring is deterministic and rule-based. There is no AI model involved** — the same
repository always produces the same score, and every point is traceable to a published rule.

---

## What it does

* Accepts any public `github.com` repository URL, including `.git` suffixes, deep links and
  `owner/repo` shorthand
* Fetches repository metadata and root contents from the GitHub REST API
* Applies eight fixed scoring rules totalling exactly 100 points
* Shows a per-criterion breakdown with the specific file or signal that was found or missing
* Lists concrete strengths and improvement suggestions
* Analyzes up to four repositories in one session, side by side, with a count, average and
  highest score taken straight from those same per-repository scores
* Handles invalid URLs, missing repositories, private repositories, rate limits and network
  failures with a specific message for each — and never produces a score from data it could
  not reliably retrieve

## What it does not do

It reads repository *metadata*, not source code. It does not assess code quality,
architecture or engineering ability, and it is not a substitute for a technical interview.
Treat it as a fast, consistent first-pass filter and an actionable checklist.

---

## Scoring criteria

| Criterion               | What earns the points                                                     | Points |
| ----------------------- | ------------------------------------------------------------------------- | -----: |
| Documentation           | A README in the repository root (`.md`, `.rst`, `.txt` or no extension)   |     20 |
| Project size            | More than 100 KB of source                                                |     20 |
| Primary language        | GitHub can identify a primary programming language                        |     15 |
| License                 | A `LICENSE`, `LICENCE` or `COPYING` file, or a license GitHub recognises  |     10 |
| Version control hygiene | A `.gitignore` file                                                       |     10 |
| Testing                 | A `tests/`, `test/`, `spec/` or `__tests__/` directory, or a test config  |     10 |
| Community interest      | At least one star                                                         |     10 |
| Collaboration           | At least one fork                                                         |      5 |
| **Maximum**             |                                                                           |**100** |

Verdict tiers: **80+** Strong Portfolio · **60–79** Good Portfolio · **below 60** Needs
Improvement. Every point value is a multiple of 5, so both tier edges are exactly attainable.

---

## Architecture

`scoring.py` is the single source of truth for the score. Nothing else computes one.

```
                       ┌───────────────────────────────┐
 Browser ── /analyze ─▶│  Next.js (src/)               │
                       │  homepage · analyzer · results│
                       └───────────────┬───────────────┘
                                       │ GET /api/analyze?url=…
                       ┌───────────────▼───────────────┐
                       │  api/index.py   FastAPI       │
                       │  api/_github.py fetch+detect  │
                       │  api/_criteria.py breakdown   │
                       │  api/_core.py   streamlit shim│
                       └───────────────┬───────────────┘
                                       │ imports, unmodified
                       ┌───────────────▼───────────────┐
                       │  scoring.py    the score      │
                       │  evaluator.py  the insights   │
                       └───────────────────────────────┘
```

Three design decisions worth knowing:

**Detection improved without touching the scorer.** `scoring.py` looks for literal tokens
(`"readme.md"`, `"license"`, …). `api/_github.py` resolves real repository entries —
`README.rst`, `LICENSE.md`, `COPYING`, `tests/` — into those tokens before scoring. That is
how `README.rst` earns documentation points while the scoring rules stay byte-identical.

**The breakdown cannot drift from the score.** `api/_criteria.py` restates each rule
declaratively so it can be labelled and displayed, then checks its own total against the real
`calculate_score()` on every call. If they ever disagree it raises rather than showing a
breakdown that does not add up. `tests/test_criteria.py` proves agreement across all 256
signal combinations.

**A session is client state, not a feature of the API.** Analyzing several repositories issues
the same one-repository request per repository, through the same client, and keeps each result
in React state for the current tab. The count, average and highest score are read off those
authoritative results — no endpoint, no storage and no second scoring path exists. A repository
that fails to analyze shows its own error and never removes a sibling's result or contributes a
score to the average.

**Streamlit is stubbed, not installed.** `github_analyzer.py` and `evaluator.py` import
Streamlit only for `@st.cache_data`. `api/_core.py` registers a stub module before importing
them, so the serverless bundle skips ~200 MB of pandas/numpy/pyarrow.

The original Streamlit app still runs unchanged — see *Running the Streamlit app* below.

---

## Tech stack

| Layer     | Technology                                                    |
| --------- | ------------------------------------------------------------- |
| Frontend  | Next.js 15 (App Router), React 19, TypeScript, hand-written CSS |
| API       | Python 3.12, FastAPI, Requests                                |
| Data      | GitHub REST API v3                                            |
| Tests     | pytest (scoring and API), Vitest (session state)              |
| Hosting   | Vercel (Next.js build + Python serverless function)           |

No database, no authentication, no server-side state. Every analysis is a live read, and a
multi-repository session lives only in the browser tab that created it.

---

## Project structure

```
code-portfolio-evaluation-agent/
├── app.py                    Streamlit app (original, unmodified)
├── github_analyzer.py        original, unmodified — used by the Streamlit app
├── scoring.py                original, unmodified — the score
├── evaluator.py              original, unmodified — the insights
├── requirements.txt          original, unmodified — Streamlit dependencies
│
├── api/                      Python serverless function
│   ├── index.py              FastAPI routes
│   ├── _core.py              Streamlit shim + insight parsing
│   ├── _github.py            URL parsing, fetching, error taxonomy, detection
│   ├── _criteria.py          explainable breakdown + drift guard
│   └── requirements.txt      API dependencies (no Streamlit)
│
├── src/
│   ├── app/                  homepage, analyzer, global styles, icons
│   ├── components/           RepoInput, Analyzer, Results, ScoreCard,
│   │                         RepoResultCard, SessionSummary
│   └── lib/                  API client, types, rubric, local history,
│                             multi-repository session state
│
├── tests/                    pytest suite
├── package.json  next.config.mjs  tsconfig.json  vercel.json  vitest.config.mts
└── .env.example
```

---

## Running locally

Requires Node.js 20+ and Python 3.9+.

```bash
git clone https://github.com/hetvidoshi22/code-portfolio-evaluation-agent.git
cd code-portfolio-evaluation-agent

npm install
pip install -r requirements-dev.txt

cp .env.example .env.local     # optional, but see GITHUB_TOKEN below
```

The API and the frontend run as two processes in development. In one terminal:

```bash
npm run dev:api        # FastAPI on http://127.0.0.1:8000
```

In another:

```bash
npm run dev            # Next.js on http://localhost:3000
```

`next.config.mjs` proxies `/api/*` to the Python process in development, so open
<http://localhost:3000> and everything works as one app.

### Running the tests

```bash
npm test               # pytest: scoring, detection, breakdown, rubric sync
npm run test:web       # vitest: multi-repository session state and result cards
```

### Running the Streamlit app

The original prototype is untouched and still works:

```bash
pip install -r requirements.txt
streamlit run app.py
```

---

## Environment variables

| Variable               | Required            | Purpose                                                        |
| ---------------------- | ------------------- | -------------------------------------------------------------- |
| `GITHUB_TOKEN`         | Strongly recommended | Raises GitHub's rate limit from 60 to 5,000 requests per hour  |
| `NEXT_PUBLIC_SITE_URL` | No                  | Canonical URL for Open Graph tags; derived from Vercel if unset |

**About `GITHUB_TOKEN`.** Without one, GitHub allows 60 requests per hour *per IP address*.
On serverless hosting that IP is shared, so an unauthenticated deployment will rate-limit
almost immediately. Create a token at <https://github.com/settings/tokens> with **no scopes
selected** — reading public repository metadata requires no permissions at all.

The token is read from the environment by `api/_github.py` only. It is never hardcoded and
never reaches the browser.

---

## Limitations

* **Public repositories only.** Private repositories cannot be analyzed.
* **Root-level detection.** Signals are detected from the repository root, so a `tests/`
  directory nested inside `src/` is not counted. This is deliberate: it prevents a vendored
  dependency's test folder from earning points.
* **Size is a proxy, not a measure of quality.** A 100 KB threshold rewards substance, but a
  small, elegant library will score lower than a large, messy one.
* **Community signals favour older repositories.** Stars and forks account for 15 points, so
  a brand-new repository cannot reach the top tier however well-engineered it is.
* **It does not read your code.** Nothing about correctness, architecture or style is
  assessed.
* **Four repositories per session.** A deliberate cap, since each one is a live GitHub read.
  Session results are held in the tab and are lost on reload — the URL reproduces the first
  repository only.
* **Rate limits apply.** Without a token, 60 requests/hour per IP.

---

## Privacy

Analyses are live reads of GitHub's public API. Nothing is written to a database, there are
no user accounts, and no analytics are collected. The last five repositories you analyze are
stored in your own browser's `localStorage` so you can return to them; that list never leaves
your device and can be cleared by clearing site data.

