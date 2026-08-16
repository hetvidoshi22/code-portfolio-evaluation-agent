import { describe, expect, it } from "vitest";

import {
  MAX_REPOSITORIES,
  canAddRepository,
  completedResults,
  createSlot,
  createSlotId,
  dropSlot,
  findDuplicate,
  markDone,
  markFailed,
  markLoading,
  remainingCapacity,
  repoKey,
  summarize,
  type RepoSlot,
} from "./session";
import type { AnalysisResult } from "./types";

// ─── Fixtures ───────────────────────────────────────────────────────────────

function analysis(fullName: string, score: number): AnalysisResult {
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
    verdict: { tier: "strong", label: "Strong Portfolio", message: "" },
    criteria: [],
    insights: { strengths: [], improvements: [], note: null },
    meta: { authenticated: true, version: "1.0.0" },
  };
}

const done = (id: string, fullName: string, score: number): RepoSlot => ({
  id,
  url: `https://github.com/${fullName}`,
  status: "done",
  result: analysis(fullName, score),
  failure: null,
});

const failed = (id: string, url: string): RepoSlot => ({
  id,
  url,
  status: "error",
  result: null,
  failure: { code: "not_found", message: "Repository not found" },
});

const loading = (id: string, url: string): RepoSlot => ({
  id,
  url,
  status: "loading",
  result: null,
  failure: null,
});

// ─── Summary ────────────────────────────────────────────────────────────────

describe("summarize", () => {
  it("is null until two analyses have succeeded", () => {
    expect(summarize([])).toBeNull();
    expect(summarize([done("a", "user/project-a", 85)])).toBeNull();
    expect(summarize([done("a", "user/project-a", 85), loading("b", "user/project-b")])).toBeNull();
  });

  it("reports the count, average and highest of the authoritative scores", () => {
    const summary = summarize([
      done("a", "user/project-a", 85),
      done("b", "user/project-b", 70),
      done("c", "user/project-c", 95),
    ]);

    expect(summary).toEqual({ analyzed: 3, average: 83, highest: 95, maxScore: 100 });
  });

  it("counts only repositories that produced a score", () => {
    const summary = summarize([
      done("a", "user/project-a", 90),
      failed("b", "user/missing"),
      loading("c", "https://github.com/user/project-c"),
      done("d", "user/project-d", 80),
    ]);

    expect(summary).toEqual({ analyzed: 2, average: 85, highest: 90, maxScore: 100 });
  });

  it("rounds the average to the nearest whole point", () => {
    expect(summarize([done("a", "u/a", 85), done("b", "u/b", 70)])?.average).toBe(78); // 77.5
    expect(summarize([done("a", "u/a", 80), done("b", "u/b", 75)])?.average).toBe(78); // 77.5
    expect(summarize([done("a", "u/a", 60), done("b", "u/b", 65), done("c", "u/c", 65)])?.average).toBe(63); // 63.3
  });

  it("never invents a score for a failed repository", () => {
    const slots = [failed("a", "https://github.com/user/one"), failed("b", "https://github.com/user/two")];
    expect(completedResults(slots)).toEqual([]);
    expect(summarize(slots)).toBeNull();
  });
});

// ─── Capacity ───────────────────────────────────────────────────────────────

describe("capacity", () => {
  it("allows repositories up to the session limit", () => {
    const slots: RepoSlot[] = [];
    for (let i = 0; i < MAX_REPOSITORIES; i++) {
      expect(canAddRepository(slots)).toBe(true);
      expect(remainingCapacity(slots)).toBe(MAX_REPOSITORIES - i);
      slots.push(done(`s${i}`, `user/repo-${i}`, 70));
    }

    expect(canAddRepository(slots)).toBe(false);
    expect(remainingCapacity(slots)).toBe(0);
  });

  it("counts a failed repository against the limit — the request was already spent", () => {
    const slots = [
      done("a", "user/a", 70),
      failed("b", "https://github.com/user/b"),
      loading("c", "https://github.com/user/c"),
    ];
    expect(remainingCapacity(slots)).toBe(MAX_REPOSITORIES - 3);
  });
});

// ─── Slot transitions ───────────────────────────────────────────────────────

describe("slot transitions", () => {
  const base = [done("a", "user/project-a", 85), loading("b", "https://github.com/user/project-b")];

  it("keeps successful results when a sibling fails", () => {
    const next = markFailed(base, "b", { code: "not_found", message: "Repository not found" });

    expect(next[0]).toBe(base[0]);
    expect(next[0].result?.score).toBe(85);
    expect(next[1].status).toBe("error");
    expect(next[1].result).toBeNull();
    expect(next[1].failure?.code).toBe("not_found");
  });

  it("keeps existing results when a sibling succeeds", () => {
    const next = markDone(base, "b", analysis("user/project-b", 70));

    expect(next[0].result?.score).toBe(85);
    expect(next[1].result?.score).toBe(70);
    expect(next).toHaveLength(2);
  });

  it("clears only the retried slot's failure", () => {
    const withFailure = markFailed(base, "b", { code: "network", message: "Couldn't reach GitHub" });
    const retried = markLoading(withFailure, "b");

    expect(retried[0].result?.score).toBe(85);
    expect(retried[1]).toEqual({
      id: "b",
      url: "https://github.com/user/project-b",
      status: "loading",
      result: null,
      failure: null,
    });
  });

  it("removes only the targeted slot", () => {
    const next = dropSlot(base, "b");
    expect(next).toHaveLength(1);
    expect(next[0].id).toBe("a");
    expect(dropSlot(base, "nope")).toHaveLength(2);
  });

  it("does not mutate the array it was given", () => {
    const before = JSON.stringify(base);
    markFailed(base, "b", { code: "network", message: "x" });
    markDone(base, "b", analysis("user/project-b", 70));
    dropSlot(base, "a");
    expect(JSON.stringify(base)).toBe(before);
  });

  it("starts a new slot in the loading state with a unique id", () => {
    const slot = createSlot(createSlotId(), "https://github.com/user/repo");
    expect(slot.status).toBe("loading");
    expect(slot.result).toBeNull();
    expect(createSlotId()).not.toBe(createSlotId());
  });
});

// ─── Duplicate detection ────────────────────────────────────────────────────

describe("repoKey", () => {
  it("reads the URL shapes people actually paste", () => {
    const expected = "psf/requests";
    for (const input of [
      "https://github.com/psf/requests",
      "http://github.com/psf/requests",
      "https://www.github.com/psf/requests",
      "github.com/psf/requests",
      "psf/requests",
      "https://github.com/psf/requests/",
      "https://github.com/psf/requests.git",
      "https://github.com/psf/requests/tree/main/src",
      "https://github.com/psf/requests?tab=readme-ov-file",
      "  https://github.com/psf/requests  ",
      "<https://github.com/psf/requests>",
      "git@github.com:psf/requests.git",
      "https://github.com/PSF/Requests",
    ]) {
      expect(repoKey(input), input).toBe(expected);
    }
  });

  it("returns null rather than guessing, leaving validation to the API", () => {
    for (const input of ["", "   ", "not a url", "https://gitlab.com/psf/requests", "https://github.com/psf"]) {
      expect(repoKey(input), input).toBeNull();
    }
  });
});

describe("findDuplicate", () => {
  const slots = [
    done("a", "psf/requests", 85),
    loading("b", "github.com/vercel/next.js"),
  ];

  it("matches an analyzed repository by its canonical name, whatever was pasted", () => {
    expect(findDuplicate(slots, "https://github.com/PSF/Requests.git")?.id).toBe("a");
    expect(findDuplicate(slots, "psf/requests")?.id).toBe("a");
  });

  it("matches a repository that is still loading", () => {
    expect(findDuplicate(slots, "https://github.com/vercel/next.js")?.id).toBe("b");
  });

  it("returns null for a repository the session has not seen", () => {
    expect(findDuplicate(slots, "https://github.com/pallets/flask")).toBeNull();
  });

  it("returns null for an unreadable URL, so the API still classifies the error", () => {
    expect(findDuplicate(slots, "not a url")).toBeNull();
  });
});
