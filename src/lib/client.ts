import type { AnalysisResult, ApiError } from "./types";

export class AnalysisFailure extends Error {
  code: string;
  retryAfter?: number;

  constructor(error: ApiError) {
    super(error.message);
    this.name = "AnalysisFailure";
    this.code = error.code;
    this.retryAfter = error.retryAfter;
  }
}

const NETWORK_FAILURE: ApiError = {
  code: "network",
  message: "We couldn't reach the analysis service. Please check your connection and try again.",
};

/** Run an analysis. Always throws `AnalysisFailure` with a user-ready message. */
export async function analyzeRepository(
  url: string,
  signal?: AbortSignal,
): Promise<AnalysisResult> {
  let response: Response;
  try {
    response = await fetch(`/api/analyze?url=${encodeURIComponent(url)}`, {
      signal,
      headers: { Accept: "application/json" },
    });
  } catch (error) {
    if ((error as Error)?.name === "AbortError") throw error;
    throw new AnalysisFailure(NETWORK_FAILURE);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new AnalysisFailure({
      code: "bad_response",
      message: "The analysis service returned an unreadable response. Please try again shortly.",
    });
  }

  if (!response.ok) {
    const error = (body as { error?: ApiError })?.error;
    throw new AnalysisFailure(error ?? NETWORK_FAILURE);
  }

  return body as AnalysisResult;
}

/** Heading for an error code. One place, so every surface names a failure identically. */
export function errorHeading(code: string): string {
  switch (code) {
    case "invalid_url":
      return "That doesn't look like a repository URL";
    case "not_found":
      return "Repository not found";
    case "private":
      return "This repository is private";
    case "rate_limited":
      return "GitHub rate limit reached";
    case "network":
      return "Couldn't reach GitHub";
    case "scoring_drift":
      return "Scoring configuration error";
    default:
      return "Analysis failed";
  }
}

// ─── Formatting ─────────────────────────────────────────────────────────────

/** GitHub reports repository size in kilobytes. */
export function formatSize(sizeKb: number): string {
  if (!Number.isFinite(sizeKb) || sizeKb <= 0) return "0 KB";
  if (sizeKb < 1024) return `${sizeKb.toLocaleString()} KB`;
  const mb = sizeKb / 1024;
  if (mb < 1024) return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

export function formatCount(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString();
}

export function formatDate(iso: string | null): string {
  if (!iso) return "Unknown";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function relativeTime(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days < 0) return null;
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

/** Plain-text summary for the "Copy summary" action. */
export function summaryText(result: AnalysisResult): string {
  const lines = [
    `${result.repository.fullName} — ${result.score}/${result.maxScore} (${result.verdict.label})`,
    "",
    "Score breakdown",
  ];
  for (const criterion of result.criteria) {
    const mark = criterion.passed ? "PASS" : "MISS";
    lines.push(`  ${mark}  ${criterion.label} — ${criterion.points}/${criterion.maxPoints}`);
  }
  if (result.insights.strengths.length) {
    lines.push("", "Strengths");
    for (const item of result.insights.strengths) lines.push(`  - ${item}`);
  }
  if (result.insights.improvements.length) {
    lines.push("", "Improvements");
    for (const item of result.insights.improvements) lines.push(`  - ${item}`);
  }
  lines.push("", result.repository.htmlUrl);
  return lines.join("\n");
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
