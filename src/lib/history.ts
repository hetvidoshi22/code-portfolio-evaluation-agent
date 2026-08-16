/**
 * Recent analyses, kept in the visitor's own browser.
 * No database, no accounts, nothing leaves the device.
 */

const KEY = "cpea:recent";
const LIMIT = 5;

export interface RecentEntry {
  fullName: string;
  score: number;
  at: number;
}

function isEntry(value: unknown): value is RecentEntry {
  const entry = value as RecentEntry;
  return (
    !!entry &&
    typeof entry.fullName === "string" &&
    typeof entry.score === "number" &&
    typeof entry.at === "number"
  );
}

export function readRecent(): RecentEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isEntry).slice(0, LIMIT) : [];
  } catch {
    return [];
  }
}

export function rememberRecent(fullName: string, score: number): RecentEntry[] {
  if (typeof window === "undefined") return [];
  const next = [
    { fullName, score, at: Date.now() },
    ...readRecent().filter((entry) => entry.fullName !== fullName),
  ].slice(0, LIMIT);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage disabled or full — history is a convenience, never required */
  }
  return next;
}

export function clearRecent(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
