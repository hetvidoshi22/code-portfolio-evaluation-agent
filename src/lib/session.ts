/**
 * Multi-repository session state.
 *
 * A "session" is the set of repositories analyzed in the current browser tab.
 * Nothing is persisted, and nothing here computes a score: every number comes
 * verbatim from an `AnalysisResult` the API already produced. The summary is a
 * plain average of those authoritative scores, never a second scoring rule.
 *
 * All of it is pure so the state transitions can be tested without a browser.
 */

import type { AnalysisResult } from "./types";

/** Deliberately small — each slot is a live GitHub API round trip. */
export const MAX_REPOSITORIES = 4;

export type SlotStatus = "loading" | "done" | "error";

export interface SlotFailure {
  code: string;
  message: string;
}

export interface RepoSlot {
  id: string;
  /** Exactly what the visitor submitted, reused verbatim when retrying. */
  url: string;
  status: SlotStatus;
  result: AnalysisResult | null;
  failure: SlotFailure | null;
}

export interface SessionSummary {
  /** Repositories that produced a score. Failures are not "analyzed". */
  analyzed: number;
  average: number;
  highest: number;
  maxScore: number;
}

// ─── Slot transitions ───────────────────────────────────────────────────────
// Every transition rebuilds the array and touches one slot, so a failure can
// never take a sibling's result with it.

export function createSlot(id: string, url: string): RepoSlot {
  return { id, url, status: "loading", result: null, failure: null };
}

let sequence = 0;

/** A React key that survives reordering and removal. Call it from an event
 *  handler or effect, never during render, so server and client agree. */
export function createSlotId(): string {
  sequence += 1;
  return `slot-${sequence}`;
}

export function markLoading(slots: RepoSlot[], id: string): RepoSlot[] {
  return slots.map((slot) =>
    slot.id === id ? { ...slot, status: "loading", result: null, failure: null } : slot,
  );
}

export function markDone(slots: RepoSlot[], id: string, result: AnalysisResult): RepoSlot[] {
  return slots.map((slot) =>
    slot.id === id ? { ...slot, status: "done", result, failure: null } : slot,
  );
}

export function markFailed(slots: RepoSlot[], id: string, failure: SlotFailure): RepoSlot[] {
  return slots.map((slot) =>
    slot.id === id ? { ...slot, status: "error", result: null, failure } : slot,
  );
}

export function dropSlot(slots: RepoSlot[], id: string): RepoSlot[] {
  return slots.filter((slot) => slot.id !== id);
}

// ─── Session-level reads ────────────────────────────────────────────────────

export function completedResults(slots: RepoSlot[]): AnalysisResult[] {
  return slots.flatMap((slot) => (slot.status === "done" && slot.result ? [slot.result] : []));
}

export function canAddRepository(slots: RepoSlot[]): boolean {
  return slots.length < MAX_REPOSITORIES;
}

export function remainingCapacity(slots: RepoSlot[]): number {
  return Math.max(0, MAX_REPOSITORIES - slots.length);
}

/**
 * Null until two analyses have succeeded — a single repository needs no
 * summary, and an average of one number says nothing.
 */
export function summarize(slots: RepoSlot[]): SessionSummary | null {
  const results = completedResults(slots);
  if (results.length < 2) return null;

  const scores = results.map((result) => result.score);
  const total = scores.reduce((sum, score) => sum + score, 0);

  return {
    analyzed: results.length,
    average: Math.round(total / results.length),
    highest: Math.max(...scores),
    maxScore: results[0].maxScore,
  };
}

// ─── Duplicate detection ────────────────────────────────────────────────────

const GITHUB_HOSTS = new Set(["github.com", "www.github.com"]);
const SHORTHAND = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;
const SCP_LIKE = /^(?:ssh:\/\/)?git@github\.com[:/](.+)$/i;

/**
 * Best-effort lowercase `owner/repo` key for a pasted URL.
 *
 * Its only job is to notice that a repository is already in the session, so a
 * duplicate never costs a GitHub API request. It is deliberately *not* a
 * validator: anything it cannot read returns null and is sent to the API,
 * which remains the sole owner of URL validation and every error message.
 */
export function repoKey(raw: string): string | null {
  if (typeof raw !== "string") return null;

  let text = raw.trim().replace(/^<+/, "").replace(/>+$/, "").replace(/\/+$/, "");
  if (!text) return null;

  const scp = SCP_LIKE.exec(text);
  if (scp) {
    text = `https://github.com/${scp[1]}`;
  } else if (!text.includes("://")) {
    text =
      SHORTHAND.test(text) && !/^github\.com\//i.test(text)
        ? `https://github.com/${text}`
        : `https://${text}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(text);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  if (!GITHUB_HOSTS.has(parsed.hostname.toLowerCase())) return null;

  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length < 2) return null;

  const owner = segments[0];
  const repo = segments[1].replace(/\.git$/i, "");
  if (!owner || !repo || repo === "." || repo === "..") return null;

  return `${owner}/${repo}`.toLowerCase();
}

function slotKey(slot: RepoSlot): string | null {
  // Prefer GitHub's canonical full name once it is known: it survives the
  // redirects and casing differences a pasted URL does not.
  if (slot.result) return slot.result.repository.fullName.toLowerCase();
  return repoKey(slot.url);
}

/** The slot already holding this repository, if the session has one. */
export function findDuplicate(slots: RepoSlot[], url: string): RepoSlot | null {
  const key = repoKey(url);
  if (!key) return null;
  return slots.find((slot) => slotKey(slot) === key) ?? null;
}
