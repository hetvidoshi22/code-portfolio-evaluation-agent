"use client";

import { useState } from "react";

import ScoreCard from "@/components/ScoreCard";
import {
  copyToClipboard,
  formatCount,
  formatDate,
  formatSize,
  relativeTime,
  summaryText,
} from "@/lib/client";
import type { AnalysisResult } from "@/lib/types";

interface Props {
  result: AnalysisResult;
  onReset: () => void;
}

export default function Results({ result, onReset }: Props) {
  const { repository, insights } = result;
  const [copied, setCopied] = useState<"link" | "summary" | null>(null);

  async function copy(kind: "link" | "summary") {
    const text =
      kind === "link"
        ? typeof window !== "undefined"
          ? window.location.href
          : repository.htmlUrl
        : summaryText(result);
    if (await copyToClipboard(text)) {
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 2000);
    }
  }

  const updated = relativeTime(repository.updatedAt);

  return (
    <div className="stack stack-lg">
      <header className="stack stack-sm">
        <p className="eyebrow">Analysis complete</p>
        <h1 style={{ fontSize: "clamp(1.6rem, 4vw, 2.2rem)" }}>{repository.fullName}</h1>
        {repository.description && <p className="lede">{repository.description}</p>}
        <div className="row no-print" style={{ marginTop: "0.35rem" }}>
          <a
            className="btn btn-secondary"
            href={repository.htmlUrl}
            target="_blank"
            rel="noreferrer noopener"
          >
            Open on GitHub ↗
          </a>
          <button type="button" className="btn btn-secondary" onClick={() => copy("link")}>
            {copied === "link" ? "Link copied" : "Copy link"}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => copy("summary")}>
            {copied === "summary" ? "Summary copied" : "Copy summary"}
          </button>
        </div>
        {(repository.isArchived || repository.isFork || repository.isEmpty) && (
          <div className="badge-row">
            {repository.isArchived && <span className="badge">Archived</span>}
            {repository.isFork && <span className="badge">Fork</span>}
            {repository.isEmpty && <span className="badge">No files in the default branch</span>}
          </div>
        )}
      </header>

      <ScoreCard
        score={result.score}
        maxScore={result.maxScore}
        verdict={result.verdict}
        criteria={result.criteria}
      />

      <section className="stack stack-md">
        <h2 style={{ fontSize: "1.15rem" }}>Repository overview</h2>
        <dl className="facts">
          <div className="fact">
            <dt>Owner</dt>
            <dd>{repository.owner}</dd>
          </div>
          <div className="fact">
            <dt>Repository</dt>
            <dd>{repository.name}</dd>
          </div>
          <div className="fact">
            <dt>Language</dt>
            <dd>{repository.language ?? "Not detected"}</dd>
          </div>
          <div className="fact">
            <dt>Stars</dt>
            <dd>{formatCount(repository.stars)}</dd>
          </div>
          <div className="fact">
            <dt>Forks</dt>
            <dd>{formatCount(repository.forks)}</dd>
          </div>
          <div className="fact">
            <dt>Size</dt>
            <dd>{formatSize(repository.sizeKb)}</dd>
          </div>
          <div className="fact">
            <dt>Last updated</dt>
            <dd>
              {formatDate(repository.updatedAt)}
              {updated && <span className="muted small"> · {updated}</span>}
            </dd>
          </div>
          <div className="fact">
            <dt>Default branch</dt>
            <dd>{repository.defaultBranch ?? "—"}</dd>
          </div>
        </dl>
      </section>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))" }}>
        <section className="card stack stack-md">
          <h2 style={{ fontSize: "1.05rem" }}>Strengths</h2>
          {insights.strengths.length > 0 ? (
            <ul className="insight-list strengths">
              {insights.strengths.map((item) => (
                <li key={item}>
                  <span className="mark" aria-hidden="true">
                    +
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-note">
              No strengths detected yet — the checks above show what to add first.
            </p>
          )}
        </section>

        <section className="card stack stack-md">
          <h2 style={{ fontSize: "1.05rem" }}>Improvements</h2>
          {insights.improvements.length > 0 ? (
            <ul className="insight-list improvements">
              {insights.improvements.map((item) => (
                <li key={item}>
                  <span className="mark" aria-hidden="true">
                    →
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-note">
              {insights.note ?? "No improvement suggestions for this repository."}
            </p>
          )}
        </section>
      </div>

      <div className="row no-print">
        <button type="button" className="btn btn-primary" onClick={onReset}>
          Analyze Another Repository
        </button>
      </div>
    </div>
  );
}
