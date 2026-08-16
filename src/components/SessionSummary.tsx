import type { SessionSummary as Summary } from "@/lib/session";

interface Props {
  summary: Summary;
}

/** Three read-only figures derived from the scores already shown below.
 *  Nothing here is a new rule — the per-repository score stays authoritative. */
export default function SessionSummary({ summary }: Props) {
  return (
    <section className="stack stack-sm" aria-label="Session summary">
      <p className="eyebrow">This session</p>
      <dl className="facts summary-facts">
        <div className="fact">
          <dt>Repositories analyzed</dt>
          <dd>{summary.analyzed}</dd>
        </div>
        <div className="fact">
          <dt>Average score</dt>
          <dd>
            {summary.average}
            <span className="muted"> / {summary.maxScore}</span>
          </dd>
        </div>
        <div className="fact">
          <dt>Highest score</dt>
          <dd>
            {summary.highest}
            <span className="muted"> / {summary.maxScore}</span>
          </dd>
        </div>
      </dl>
      <p className="small muted">
        Averaged from the scores below. Repositories that failed to analyze are not counted.
      </p>
    </section>
  );
}
