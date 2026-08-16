import type { CriterionResult, Verdict } from "@/lib/types";

interface Props {
  score: number;
  maxScore: number;
  verdict: Verdict;
  criteria: CriterionResult[];
  compact?: boolean;
}

/** Score headline, meter and per-criterion breakdown. Used for real results
 *  and for the sample card on the homepage. */
export default function ScoreCard({ score, maxScore, verdict, criteria, compact }: Props) {
  const percent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const earned = criteria.filter((c) => c.passed).length;

  return (
    <div className="card stack stack-md">
      <div className="score-head">
        <div>
          <p className="eyebrow">Portfolio score</p>
          <p className="score-value">
            <span className="n">{score}</span>
            <span className="d">/ {maxScore}</span>
          </p>
        </div>
        <div className="stack stack-sm" style={{ alignItems: "flex-start" }}>
          <span className={`verdict ${verdict.tier}`}>
            <span className="dot" aria-hidden="true" />
            {verdict.label}
          </span>
          <p className="small muted" style={{ maxWidth: "34ch" }}>
            {verdict.message}
          </p>
        </div>
      </div>

      <div>
        <div
          className="meter"
          role="meter"
          aria-valuenow={score}
          aria-valuemin={0}
          aria-valuemax={maxScore}
          aria-label={`Portfolio score ${score} out of ${maxScore}`}
        >
          <span style={{ width: `${percent}%` }} />
        </div>
        <div className="meter-scale" aria-hidden="true">
          <span>0</span>
          <span>60 · good</span>
          <span>80 · strong</span>
          <span>{maxScore}</span>
        </div>
      </div>

      <div className="table-scroll">
        <table className="breakdown">
          <caption className="sr-only">
            Score breakdown: {earned} of {criteria.length} criteria met
          </caption>
          <thead>
            <tr>
              <th scope="col">Criteria</th>
              <th scope="col">Result</th>
              <th scope="col" style={{ textAlign: "right" }}>
                Points
              </th>
            </tr>
          </thead>
          <tbody>
            {criteria.map((criterion) => (
              <tr key={criterion.id}>
                <td>
                  <span className="c-label">{criterion.label}</span>
                  {!compact && <span className="c-detail">{criterion.detail}</span>}
                </td>
                <td className="c-result">
                  <span className={`pill ${criterion.passed ? "pass" : "fail"}`}>
                    {criterion.passed ? "Passed" : "Missing"}
                  </span>
                </td>
                <td className="c-points">
                  {criterion.passed ? `+${criterion.points}` : "0"}
                  <span className="muted"> / {criterion.maxPoints}</span>
                </td>
              </tr>
            ))}
            <tr className="total">
              <td>Total</td>
              <td className="c-result muted small">
                {earned} of {criteria.length} met
              </td>
              <td className="c-points">
                {score} / {maxScore}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
