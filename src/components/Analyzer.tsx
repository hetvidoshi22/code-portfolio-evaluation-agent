"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import RepoInput from "@/components/RepoInput";
import Results from "@/components/Results";
import { AnalysisFailure, analyzeRepository } from "@/lib/client";
import { readRecent, rememberRecent, type RecentEntry } from "@/lib/history";
import type { AnalysisResult } from "@/lib/types";

type Status = "idle" | "loading" | "done" | "error";

interface FailureState {
  code: string;
  message: string;
}

export default function Analyzer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlParam = searchParams.get("url") ?? "";

  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [failure, setFailure] = useState<FailureState | null>(null);
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setRecent(readRecent());
  }, []);

  const run = useCallback(async (url: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("loading");
    setFailure(null);
    setResult(null);

    try {
      const analysis = await analyzeRepository(url, controller.signal);
      if (controller.signal.aborted) return;
      setResult(analysis);
      setStatus("done");
      setRecent(rememberRecent(analysis.repository.fullName, analysis.score));
    } catch (error) {
      if (controller.signal.aborted || (error as Error)?.name === "AbortError") return;
      const failed = error as AnalysisFailure;
      setFailure({
        code: failed.code ?? "unexpected",
        message:
          failed.message ||
          "Something unexpected happened while analyzing this repository. Please try again shortly.",
      });
      setStatus("error");
    }
  }, []);

  // The URL is the source of truth, so a shared link reproduces the analysis.
  useEffect(() => {
    if (!urlParam) {
      setStatus("idle");
      setResult(null);
      setFailure(null);
      return;
    }
    void run(urlParam);
    return () => abortRef.current?.abort();
  }, [urlParam, run]);

  function submit(url: string) {
    router.push(`/analyze?url=${encodeURIComponent(url)}`);
  }

  function reset() {
    router.push("/analyze");
  }

  return (
    <div className="wrap section stack stack-lg">
      {status !== "done" && (
        <header className="stack stack-sm">
          <p className="eyebrow">Analyzer</p>
          <h1 style={{ fontSize: "clamp(1.7rem, 4vw, 2.3rem)" }}>Analyze a repository</h1>
          <p className="lede">
            Paste any public GitHub repository URL. The analysis reads the repository through
            GitHub&rsquo;s public API and scores it against eight fixed criteria.
          </p>
        </header>
      )}

      {status !== "done" && (
        <div style={{ maxWidth: "36rem" }}>
          <RepoInput
            initialValue={urlParam}
            busy={status === "loading"}
            onSubmit={submit}
            autoFocus={!urlParam}
          />
        </div>
      )}

      {status === "idle" && recent.length > 0 && (
        <section className="stack stack-sm">
          <p className="eyebrow">Recent on this device</p>
          <div className="recent">
            {recent.map((entry) => (
              <button
                key={entry.fullName}
                type="button"
                className="chip"
                onClick={() => submit(`https://github.com/${entry.fullName}`)}
              >
                <b>{entry.fullName}</b>
                <span>{entry.score}</span>
              </button>
            ))}
          </div>
          <p className="small muted">
            Stored only in your browser. Nothing is sent to a server or saved to a database.
          </p>
        </section>
      )}

      {status === "loading" && (
        <div className="state" aria-live="polite">
          <div className="spinner" role="status" aria-label="Analyzing" />
          <h3>Analyzing repository…</h3>
          <p>Reading repository metadata and root files from the GitHub API.</p>
        </div>
      )}

      {status === "error" && failure && (
        <div className="state error" role="alert">
          <h3>{errorHeading(failure.code)}</h3>
          <p>{failure.message}</p>
          <div className="row" style={{ marginTop: "0.5rem" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => urlParam && void run(urlParam)}
              disabled={!urlParam}
            >
              Try again
            </button>
            <button type="button" className="btn btn-ghost" onClick={reset}>
              Start over
            </button>
          </div>
        </div>
      )}

      {status === "done" && result && <Results result={result} onReset={reset} />}
    </div>
  );
}

function errorHeading(code: string): string {
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
