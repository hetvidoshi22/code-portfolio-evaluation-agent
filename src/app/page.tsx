import Link from "next/link";

import RepoInput from "@/components/RepoInput";
import ScoreCard from "@/components/ScoreCard";
import { MAX_SCORE, RUBRIC } from "@/lib/criteria";
import type { CriterionResult } from "@/lib/types";

/* A real, attainable result. Every point value is a multiple of 5, so 75 is a
   score the scorer can actually produce — and it sits in the "Good" tier. */
const SAMPLE: CriterionResult[] = [
  { id: "readme", label: "Documentation", passed: true, points: 20, maxPoints: 20, detail: "Found README.md" },
  { id: "size", label: "Project size", passed: true, points: 20, maxPoints: 20, detail: "412 KB of source — substantial enough to review" },
  { id: "language", label: "Primary language", passed: true, points: 15, maxPoints: 15, detail: "GitHub detected TypeScript" },
  { id: "license", label: "License", passed: true, points: 10, maxPoints: 10, detail: "Found LICENSE" },
  { id: "gitignore", label: "Version control hygiene", passed: true, points: 10, maxPoints: 10, detail: "Found .gitignore" },
  { id: "tests", label: "Testing", passed: false, points: 0, maxPoints: 10, detail: "No test directory or test config in the root" },
  { id: "stars", label: "Community interest", passed: false, points: 0, maxPoints: 10, detail: "No stars yet" },
  { id: "forks", label: "Collaboration", passed: false, points: 0, maxPoints: 5, detail: "No forks yet" },
];
const SAMPLE_SCORE = SAMPLE.reduce((total, row) => total + row.points, 0);

const STEPS = [
  {
    n: "01",
    title: "Enter repository",
    body: "Paste a public GitHub repository URL. Deep links, .git suffixes and owner/repo shorthand all work.",
  },
  {
    n: "02",
    title: "Analyze",
    body: "The repository's metadata and root files are read through GitHub's public API and checked against eight fixed criteria.",
  },
  {
    n: "03",
    title: "Get your score",
    body: "See the score, exactly which criteria passed and failed, and a list of concrete strengths and improvements.",
  },
];

const FAQ = [
  {
    q: "What repositories can I analyze?",
    a: "Any public repository on github.com. Private repositories are not supported, and repositories on other hosts such as GitLab or Bitbucket are not analyzed.",
  },
  {
    q: "Is my repository data stored?",
    a: "No. Each analysis is a live read of GitHub's public API — nothing is written to a database, and there are no user accounts. The last five repositories you analyze are kept in your own browser's local storage so you can return to them, and that list never leaves your device.",
  },
  {
    q: "How is the score calculated?",
    a: `Eight deterministic checks with fixed point values, totalling ${MAX_SCORE}. The same repository always produces the same score. There is no machine learning and no AI model involved — every point is traceable to a specific rule, and the breakdown on your result shows exactly which ones you earned.`,
  },
  {
    q: "Does this replace a technical interview?",
    a: "No. It measures repository hygiene and project signals — documentation, licensing, testing structure, size and community activity. It does not read your code, assess architecture, or evaluate engineering ability. Treat it as a first-pass filter and a checklist, not a verdict on a candidate.",
  },
  {
    q: "What does the score mean?",
    a: "80 and above is a Strong Portfolio: the repository shows solid engineering practice. 60 to 79 is a Good Portfolio: a real project with room to improve. Below 60 means the repository needs more documentation, structure or supporting files before it presents well.",
  },
  {
    q: "Why did my repository score lower than I expected?",
    a: "The most common causes are a missing license file, no test directory in the repository root, or a repository under 100 KB. The breakdown lists every criterion with the exact evidence found, so you can see precisely what to add.",
  },
];

export default function HomePage() {
  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="hero">
        <div className="wrap inner">
          <p className="eyebrow">GitHub repository analysis</p>
          <h1>Evaluate GitHub Projects in Seconds</h1>
          <p className="lede">
            Paste a repository URL and get a clear quality score out of {MAX_SCORE}. The analysis
            checks documentation, licensing, testing structure, project size, language and community
            signals — then shows exactly how every point was earned.
          </p>
          <RepoInput autoFocus />
          <div className="badge-row">
            <span className="badge">Deterministic scoring</span>
            <span className="badge">No sign-up</span>
            <span className="badge">Nothing stored</span>
            <span className="badge">Public repositories</span>
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section className="section" id="how-it-works">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">How it works</p>
            <h2>Three steps, no configuration</h2>
          </div>
          <div className="grid grid-3">
            {STEPS.map((step) => (
              <article key={step.n} className="card step">
                <span className="num">{step.n}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Criteria ─────────────────────────────────────────────────────── */}
      <section className="section" id="criteria">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">What we evaluate</p>
            <h2>The complete scoring rubric</h2>
            <p className="lede">
              These are the only rules applied. Nothing is hidden, weighted dynamically, or inferred
              by a model — the same repository always scores the same.
            </p>
          </div>
          <div className="rubric">
            {RUBRIC.map((entry) => (
              <div className="rubric-row" key={entry.id}>
                <div>
                  <span className="label">{entry.label}</span>
                  <span className="desc">{entry.description}</span>
                </div>
                <span className="pts">+{entry.points}</span>
              </div>
            ))}
            <div className="rubric-total">
              <span>Maximum score</span>
              <span className="pts">{MAX_SCORE}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Example result ───────────────────────────────────────────────── */}
      <section className="section" id="example">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">Example result</p>
            <h2>What you get back</h2>
            <p className="lede">
              A score is never shown on its own. Every result lists each criterion, whether it
              passed, and the evidence found in the repository.
            </p>
          </div>
          <ScoreCard
            score={SAMPLE_SCORE}
            maxScore={MAX_SCORE}
            verdict={{
              tier: "good",
              label: "Good Portfolio",
              message:
                "The project shows solid implementation but could benefit from further improvements.",
            }}
            criteria={SAMPLE}
          />
          <p className="small muted" style={{ marginTop: "0.85rem" }}>
            Sample output. Run a real analysis to see your own breakdown.
          </p>
        </div>
      </section>

      {/* ── Why use it ───────────────────────────────────────────────────── */}
      <section className="section" id="why">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">Why use it</p>
            <h2>Consistent review, in seconds</h2>
          </div>
          <div className="grid grid-4">
            <article className="card step">
              <h3>Fast</h3>
              <p>One URL, one request, a full result in a couple of seconds.</p>
            </article>
            <article className="card step">
              <h3>Consistent</h3>
              <p>Fixed rules and fixed weights, so every repository is judged the same way.</p>
            </article>
            <article className="card step">
              <h3>Actionable</h3>
              <p>Failed criteria come with the specific file or signal that was missing.</p>
            </article>
            <article className="card step">
              <h3>Transparent</h3>
              <p>The full rubric is published above — nothing about the score is a black box.</p>
            </article>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="section" id="faq">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">FAQ</p>
            <h2>Common questions</h2>
          </div>
          <div className="faq">
            {FAQ.map((item) => (
              <details key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Closing CTA ──────────────────────────────────────────────────── */}
      <section className="section">
        <div className="wrap">
          <div className="card stack stack-md" style={{ alignItems: "flex-start" }}>
            <h2 style={{ fontSize: "1.3rem" }}>Analyze a repository</h2>
            <p className="lede">Public GitHub repositories only. No account required.</p>
            <Link href="/analyze" className="btn btn-primary">
              Open the analyzer
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
