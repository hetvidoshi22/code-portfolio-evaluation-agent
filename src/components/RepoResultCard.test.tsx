import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import RepoResultCard from "./RepoResultCard";
import type { RepoSlot } from "@/lib/session";
import type { AnalysisResult } from "@/lib/types";

const noop = () => {};
const render = (slot: RepoSlot, index = 0) =>
  renderToStaticMarkup(
    <RepoResultCard slot={slot} index={index} onRetry={noop} onRemove={noop} />,
  );

const RESULT: AnalysisResult = {
  repository: {
    name: "project-a",
    owner: "octocat",
    fullName: "octocat/project-a",
    description: "A test project",
    language: "Python",
    stars: 2400,
    forks: 5,
    sizeKb: 412,
    updatedAt: null,
    createdAt: null,
    htmlUrl: "https://github.com/octocat/project-a",
    defaultBranch: "main",
    isFork: false,
    isArchived: false,
    isEmpty: false,
  },
  score: 85,
  maxScore: 100,
  verdict: { tier: "strong", label: "Strong Portfolio", message: "Solid engineering practice." },
  criteria: [
    { id: "readme", label: "Documentation", passed: true, points: 20, maxPoints: 20, detail: "Found README.md" },
    { id: "tests", label: "Testing", passed: false, points: 0, maxPoints: 10, detail: "No test directory" },
  ],
  insights: {
    strengths: ["Good documentation", "Testing structure", "A third strength"],
    improvements: ["Add a license"],
    note: null,
  },
  meta: { authenticated: true, version: "1.0.0" },
};

describe("RepoResultCard", () => {
  it("shows the repository, its score and the fields the card promises", () => {
    const html = render(
      { id: "a", url: "https://github.com/octocat/project-a", status: "done", result: RESULT, failure: null },
      0,
    );

    expect(html).toContain("Repository 1");
    expect(html).toContain("project-a");
    expect(html).toContain("octocat");
    expect(html).toContain("85");
    expect(html).toContain("Strong Portfolio");
    expect(html).toContain("Python");
    expect(html).toContain("2,400"); // stars, formatted
    expect(html).toContain("View Repository");
    expect(html).toContain('href="https://github.com/octocat/project-a"');
  });

  it("summarises insights rather than reprinting them all", () => {
    const html = render(
      { id: "a", url: "u", status: "done", result: RESULT, failure: null },
      0,
    );

    expect(html).toContain("Good documentation");
    expect(html).toContain("Testing structure");
    expect(html).not.toContain("A third strength");
  });

  it("keeps the authoritative breakdown reachable", () => {
    const html = render({ id: "a", url: "u", status: "done", result: RESULT, failure: null });

    expect(html).toContain("Full score breakdown");
    expect(html).toContain("Documentation");
    expect(html).toContain("+20");
  });

  it("shows no score for a repository whose analysis failed", () => {
    const html = render(
      {
        id: "b",
        url: "https://github.com/octocat/missing",
        status: "error",
        result: null,
        failure: { code: "not_found", message: "We couldn't find that repository." },
      },
      1,
    );

    expect(html).toContain("Repository 2");
    expect(html).toContain("Repository not found");
    expect(html).toContain("We couldn&#x27;t find that repository.");
    expect(html).toContain("Try again");
    expect(html).not.toContain("score-value");
    expect(html).not.toContain("View Repository");
  });

  it("shows no score while a repository is still loading", () => {
    const html = render(
      { id: "c", url: "https://github.com/octocat/pending", status: "loading", result: null, failure: null },
      2,
    );

    expect(html).toContain("Repository 3");
    expect(html).toContain("Analyzing");
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain("score-value");
  });
});
