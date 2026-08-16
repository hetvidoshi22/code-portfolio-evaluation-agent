/**
 * @vitest-environment jsdom
 *
 * Drives the analyzer the way a visitor does: analyze, add another repository,
 * fail one, retry it, clear the session. Only the network and the Next router
 * are stubbed — the components and the session state are the real ones.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AnalysisResult } from "@/lib/types";

const routerPush = vi.fn();
let searchUrl = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
  useSearchParams: () => ({ get: (key: string) => (key === "url" ? searchUrl : null) }),
}));

/** Resolves whatever the current test tells it to, per repository URL. */
let respond: (url: string) => Promise<AnalysisResult>;

vi.mock("@/lib/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/client")>()),
  analyzeRepository: (url: string) => respond(url),
}));

const { AnalysisFailure } = await import("@/lib/client");
const Analyzer = (await import("./Analyzer")).default;

// ─── Harness ────────────────────────────────────────────────────────────────

const reactGlobals = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };

let container: HTMLDivElement;
let root: Root;

function result(fullName: string, score: number): AnalysisResult {
  const [owner, name] = fullName.split("/");
  return {
    repository: {
      name,
      owner,
      fullName,
      description: null,
      language: "Python",
      stars: 24,
      forks: 5,
      sizeKb: 412,
      updatedAt: null,
      createdAt: null,
      htmlUrl: `https://github.com/${fullName}`,
      defaultBranch: "main",
      isFork: false,
      isArchived: false,
      isEmpty: false,
    },
    score,
    maxScore: 100,
    verdict: { tier: "strong", label: "Strong Portfolio", message: "Solid." },
    criteria: [
      { id: "readme", label: "Documentation", passed: true, points: 20, maxPoints: 20, detail: "Found README.md" },
    ],
    insights: { strengths: ["Good documentation"], improvements: [], note: null },
    meta: { authenticated: true, version: "1.0.0" },
  };
}

const text = () => container.textContent ?? "";

function control(label: string): HTMLElement {
  const match = [...container.querySelectorAll("button")].find(
    (node) => node.textContent?.trim() === label,
  );
  if (!match) throw new Error(`No control labelled "${label}". Rendered: ${text()}`);
  return match;
}

async function click(label: string) {
  await act(async () => {
    control(label).dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

/** Fill the visible repository field and submit its form. */
async function submitRepository(url: string) {
  const input = container.querySelector<HTMLInputElement>("input#repo-url");
  if (!input) throw new Error(`No repository input on screen. Rendered: ${text()}`);
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;

  await act(async () => {
    setValue.call(input, url);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    input.closest("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

/** Mount with a repository already in the URL, as a shared link does. */
async function mountWith(url: string) {
  searchUrl = url;
  await act(async () => {
    root.render(<Analyzer />);
  });
}

beforeEach(() => {
  reactGlobals.IS_REACT_ACT_ENVIRONMENT = true;
  routerPush.mockClear();
  searchUrl = "";
  respond = async (url) => result(url.replace("https://github.com/", ""), 80);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  // The recent-repositories list is a convenience the app already treats as
  // optional; this environment may not provide storage at all.
  try {
    window.localStorage?.clear();
  } catch {
    /* ignore */
  }
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("single repository", () => {
  it("still shows the full result for one repository, with no session summary", async () => {
    respond = async () => result("octocat/project-a", 85);
    await mountWith("https://github.com/octocat/project-a");

    expect(text()).toContain("octocat/project-a");
    expect(text()).toContain("85");
    expect(text()).toContain("Strong Portfolio");
    expect(text()).toContain("Repository overview"); // the detailed view, unchanged
    expect(text()).not.toContain("Repositories analyzed");
    expect(text()).not.toContain("Clear Results");
  });

  it("keeps the existing error state and its retry", async () => {
    respond = async () => {
      throw new AnalysisFailure({ code: "not_found", message: "We couldn't find that repository." });
    };
    await mountWith("https://github.com/octocat/missing");

    expect(text()).toContain("Repository not found");
    expect(text()).toContain("We couldn't find that repository.");

    respond = async () => result("octocat/missing", 70);
    await click("Try again");
    expect(text()).toContain("70");
  });
});

describe("multi-repository session", () => {
  it("adds a second repository without losing the first", async () => {
    respond = async () => result("octocat/project-a", 85);
    await mountWith("https://github.com/octocat/project-a");

    await click("Analyze Another Repository");
    respond = async () => result("octocat/project-b", 70);
    await submitRepository("https://github.com/octocat/project-b");

    expect(text()).toContain("project-a");
    expect(text()).toContain("project-b");
    expect(text()).toContain("85");
    expect(text()).toContain("70");
    expect(container.querySelectorAll(".repo-card")).toHaveLength(2);
  });

  it("summarises the session from the authoritative scores", async () => {
    respond = async () => result("octocat/project-a", 85);
    await mountWith("https://github.com/octocat/project-a");

    for (const [name, score] of [
      ["project-b", 70],
      ["project-c", 95],
    ] as const) {
      await click("Analyze Another Repository");
      respond = async () => result(`octocat/${name}`, score);
      await submitRepository(`https://github.com/octocat/${name}`);
    }

    const summary = container.querySelector(".summary-facts")!.textContent ?? "";
    expect(summary).toContain("Repositories analyzed3");
    expect(summary).toContain("Average score83 / 100"); // (85 + 70 + 95) / 3
    expect(summary).toContain("Highest score95 / 100");
  });

  it("stops at four repositories per session", async () => {
    respond = async () => result("octocat/project-1", 60);
    await mountWith("https://github.com/octocat/project-1");

    for (const n of [2, 3, 4]) {
      await click("Analyze Another Repository");
      respond = async () => result(`octocat/project-${n}`, 60);
      await submitRepository(`https://github.com/octocat/project-${n}`);
    }

    expect(container.querySelectorAll(".repo-card")).toHaveLength(4);
    expect(control("Analyze Another Repository")).toHaveProperty("disabled", true);
    expect(text()).toContain("Session limit reached");
  });

  it("refuses a repository the session already holds, without another request", async () => {
    respond = async () => result("octocat/project-a", 85);
    await mountWith("https://github.com/octocat/project-a");

    await click("Analyze Another Repository");
    respond = async () => result("octocat/project-b", 70);
    await submitRepository("https://github.com/octocat/project-b");

    const requests = vi.fn(async (url: string) => result(url.replace("https://github.com/", ""), 50));
    respond = requests;
    await click("Analyze Another Repository");
    await submitRepository("https://github.com/OctoCat/Project-A.git");

    expect(requests).not.toHaveBeenCalled();
    expect(text()).toContain("That repository is already in this session.");
    expect(container.querySelectorAll(".repo-card")).toHaveLength(2);
  });

  it("keeps a successful result when another repository fails, and retries it alone", async () => {
    respond = async () => result("octocat/project-a", 85);
    await mountWith("https://github.com/octocat/project-a");

    await click("Analyze Another Repository");
    respond = async () => {
      throw new AnalysisFailure({ code: "rate_limited", message: "GitHub's rate limit was reached." });
    };
    await submitRepository("https://github.com/octocat/project-b");

    expect(text()).toContain("85"); // repository A survived
    expect(text()).toContain("GitHub rate limit reached");
    expect(container.querySelectorAll(".repo-card.is-error")).toHaveLength(1);
    // No summary: one repository failed, so there is only one score.
    expect(container.querySelector(".summary-facts")).toBeNull();

    respond = async () => result("octocat/project-b", 70);
    await click("Try again");

    expect(container.querySelectorAll(".repo-card.is-error")).toHaveLength(0);
    expect(text()).toContain("70");
    expect(container.querySelector(".summary-facts")?.textContent).toContain("Average score78");
  });

  it("clears the session and returns to the empty analyzer", async () => {
    respond = async () => result("octocat/project-a", 85);
    await mountWith("https://github.com/octocat/project-a");

    await click("Analyze Another Repository");
    respond = async () => result("octocat/project-b", 70);
    await submitRepository("https://github.com/octocat/project-b");
    expect(container.querySelectorAll(".repo-card")).toHaveLength(2);

    await click("Clear Results");

    expect(container.querySelectorAll(".repo-card")).toHaveLength(0);
    expect(text()).toContain("Analyze a repository");
    expect(routerPush).toHaveBeenCalledWith("/analyze");
  });
});
