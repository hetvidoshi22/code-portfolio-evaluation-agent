"use client";

import ScoreCard from "@/components/ScoreCard";
import { errorHeading, formatCount } from "@/lib/client";
import type { RepoSlot } from "@/lib/session";

/** Enough to say what the repository does well without turning the card into a report. */
const SUMMARY_LINES = 2;

interface Props {
  slot: RepoSlot;
  /** Position in the session, shown as "Repository 1", "Repository 2"… */
  index: number;
  onRetry: (slot: RepoSlot) => void;
  onRemove: (slot: RepoSlot) => void;
}

/** One repository in a multi-repository session, in whichever state it is in.
 *  A failure here is contained to this card — siblings keep their results. */
export default function RepoResultCard({ slot, index, onRetry, onRemove }: Props) {
  const position = `Repository ${index + 1}`;

  if (slot.status === "loading") {
    return (
      <article className="card repo-card is-pending" aria-busy="true">
        <div className="repo-card-head">
          <p className="repo-card-index">{position}</p>
          <h3 className="repo-card-name">Analyzing…</h3>
          <p className="repo-card-owner">{slot.url}</p>
        </div>
        <div className="repo-card-pending" aria-live="polite">
          <div className="spinner" role="status" aria-label="Analyzing" />
          <p className="small muted">Reading repository metadata from the GitHub API.</p>
        </div>
      </article>
    );
  }

  if (slot.status === "error" || !slot.result) {
    // No score is shown for a repository whose analysis did not complete.
    return (
      <article className="card repo-card is-error" role="alert">
        <div className="repo-card-head">
          <p className="repo-card-index">{position}</p>
          <h3 className="repo-card-name">{errorHeading(slot.failure?.code ?? "unexpected")}</h3>
          <p className="repo-card-owner">{slot.url}</p>
        </div>
        <p className="small">
          {slot.failure?.message ?? "Could not analyze this repository. Please try again."}
        </p>
        <div className="repo-card-foot">
          <button type="button" className="btn btn-secondary" onClick={() => onRetry(slot)}>
            Try again
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => onRemove(slot)}>
            Remove
          </button>
        </div>
      </article>
    );
  }

  const { repository, insights } = slot.result;
  const percent =
    slot.result.maxScore > 0 ? Math.round((slot.result.score / slot.result.maxScore) * 100) : 0;
  const strengths = insights.strengths.slice(0, SUMMARY_LINES);
  const improvements = insights.improvements.slice(0, SUMMARY_LINES);

  return (
    <article className="card repo-card">
      <div className="repo-card-head">
        <p className="repo-card-index">{position}</p>
        <h3 className="repo-card-name">{repository.name}</h3>
        <p className="repo-card-owner">{repository.owner}</p>
      </div>

      <div className="repo-card-score">
        <p className="score-value">
          <span className="n">{slot.result.score}</span>
          <span className="d">/ {slot.result.maxScore}</span>
        </p>
        <span className={`verdict ${slot.result.verdict.tier}`}>
          <span className="dot" aria-hidden="true" />
          {slot.result.verdict.label}
        </span>
      </div>

      <div
        className="meter"
        role="meter"
        aria-valuenow={slot.result.score}
        aria-valuemin={0}
        aria-valuemax={slot.result.maxScore}
        aria-label={`${repository.fullName} scored ${slot.result.score} out of ${slot.result.maxScore}`}
      >
        <span style={{ width: `${percent}%` }} />
      </div>

      <dl className="repo-card-meta">
        <div>
          <dt>Language</dt>
          <dd>{repository.language ?? "Not detected"}</dd>
        </div>
        <div>
          <dt>Stars</dt>
          <dd>{formatCount(repository.stars)}</dd>
        </div>
        <div>
          <dt>Forks</dt>
          <dd>{formatCount(repository.forks)}</dd>
        </div>
      </dl>

      {strengths.length > 0 && (
        <ul className="insight-list strengths repo-card-insights">
          {strengths.map((item) => (
            <li key={item}>
              <span className="mark" aria-hidden="true">
                +
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}

      {improvements.length > 0 && (
        <ul className="insight-list improvements repo-card-insights">
          {improvements.map((item) => (
            <li key={item}>
              <span className="mark" aria-hidden="true">
                →
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}

      {strengths.length === 0 && improvements.length === 0 && (
        <p className="empty-note small">{insights.note ?? "No notes for this repository."}</p>
      )}

      {/* The full breakdown stays reachable, so adding a repository never
          hides the detail the single-repository view already showed. */}
      <details className="repo-details no-print">
        <summary>Full score breakdown</summary>
        <ScoreCard
          score={slot.result.score}
          maxScore={slot.result.maxScore}
          verdict={slot.result.verdict}
          criteria={slot.result.criteria}
          compact
          breakdownOnly
        />
      </details>

      <div className="repo-card-foot">
        <a
          className="btn btn-secondary"
          href={repository.htmlUrl}
          target="_blank"
          rel="noreferrer noopener"
        >
          View Repository ↗
        </a>
      </div>
    </article>
  );
}
