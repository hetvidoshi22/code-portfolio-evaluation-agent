export type VerdictTier = "strong" | "good" | "needs-improvement";

export interface Repository {
  name: string;
  owner: string;
  fullName: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  sizeKb: number;
  updatedAt: string | null;
  createdAt: string | null;
  htmlUrl: string;
  defaultBranch: string | null;
  isFork: boolean;
  isArchived: boolean;
  isEmpty: boolean;
}

export interface CriterionResult {
  id: string;
  label: string;
  passed: boolean;
  points: number;
  maxPoints: number;
  detail: string;
}

export interface Insights {
  strengths: string[];
  improvements: string[];
  note: string | null;
}

export interface Verdict {
  tier: VerdictTier;
  label: string;
  message: string;
}

export interface AnalysisResult {
  repository: Repository;
  score: number;
  maxScore: number;
  verdict: Verdict;
  criteria: CriterionResult[];
  insights: Insights;
  meta: { authenticated: boolean; version: string };
}

export interface ApiError {
  code: string;
  message: string;
  retryAfter?: number;
}
