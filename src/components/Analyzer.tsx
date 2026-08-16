"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import RepoInput from "@/components/RepoInput";
import RepoResultCard from "@/components/RepoResultCard";
import Results from "@/components/Results";
import SessionSummary from "@/components/SessionSummary";
import { AnalysisFailure, analyzeRepository, errorHeading } from "@/lib/client";
import { readRecent, rememberRecent, type RecentEntry } from "@/lib/history";
import {
  MAX_REPOSITORIES,
  canAddRepository,
  createSlot,
  createSlotId,
  dropSlot,
  findDuplicate,
  markDone,
  markFailed,
  markLoading,
  remainingCapacity,
  summarize,
  type RepoSlot,
} from "@/lib/session";

const UNEXPECTED =
  "Something unexpected happened while analyzing this repository. Please try again shortly.";

export default function Analyzer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlParam = searchParams.get("url") ?? "";

  const [slots, setSlots] = useState<RepoSlot[]>([]);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  const controllers = useRef(new Map<string, AbortController>());

  useEffect(() => {
    setRecent(readRecent());
  }, []);

  const abortAll = useCallback(() => {
    for (const controller of controllers.current.values()) controller.abort();
    controllers.current.clear();
  }, []);

  /** One request per slot, through the same client and API every analysis uses.
   *  Success and failure are written to that slot alone. */
  const runSlot = useCallback(async (slotId: string, url: string) => {
    controllers.current.get(slotId)?.abort();
    const controller = new AbortController();
    controllers.current.set(slotId, controller);

    setSlots((prev) => markLoading(prev, slotId));

    try {
      const analysis = await analyzeRepository(url, controller.signal);
      if (controller.signal.aborted) return;
      setSlots((prev) => markDone(prev, slotId, analysis));
      setRecent(rememberRecent(analysis.repository.fullName, analysis.score));
    } catch (error) {
      if (controller.signal.aborted || (error as Error)?.name === "AbortError") return;
      const failed = error as AnalysisFailure;
      setSlots((prev) =>
        markFailed(prev, slotId, {
          code: failed.code ?? "unexpected",
          message: failed.message || UNEXPECTED,
        }),
      );
    } finally {
      if (controllers.current.get(slotId) === controller) controllers.current.delete(slotId);
    }
  }, []);

  // The URL is the source of truth for the first repository, so a shared link
  // reproduces that analysis exactly as it always has. Repositories added
  // afterwards live only in this session and deliberately do not touch the URL.
  useEffect(() => {
    abortAll();
    setAdding(false);
    setNotice(null);

    if (!urlParam) {
      setSlots([]);
      return;
    }

    const slot = createSlot(createSlotId(), urlParam);
    setSlots([slot]);
    void runSlot(slot.id, urlParam);

    return () => abortAll();
  }, [urlParam, runSlot, abortAll]);

  const summary = useMemo(() => summarize(slots), [slots]);

  function submit(url: string) {
    router.push(`/analyze?url=${encodeURIComponent(url)}`);
  }

  function startOver() {
    abortAll();
    setSlots([]);
    setAdding(false);
    setNotice(null);
    router.push("/analyze");
  }

  function addRepository(url: string) {
    const trimmed = url.trim();
    if (!trimmed) return;

    if (!canAddRepository(slots)) {
      setNotice(
        `This session is limited to ${MAX_REPOSITORIES} repositories. Clear the results to start a new one.`,
      );
      return;
    }

    const duplicate = findDuplicate(slots, trimmed);
    if (duplicate) {
      // Already analyzed — say so rather than spend another GitHub request.
      setNotice("That repository is already in this session.");
      return;
    }

    const slot = createSlot(createSlotId(), trimmed);
    setSlots((prev) => [...prev, slot]);
    setAdding(false);
    setNotice(null);
    void runSlot(slot.id, trimmed);
  }

  function retry(slot: RepoSlot) {
    void runSlot(slot.id, slot.url);
  }

  function remove(slot: RepoSlot) {
    if (slots.length <= 1) {
      startOver();
      return;
    }
    controllers.current.get(slot.id)?.abort();
    controllers.current.delete(slot.id);
    setSlots((prev) => dropSlot(prev, slot.id));
    setNotice(null);
  }

  const first = slots[0];
  const single = slots.length === 1;
  const multi = slots.length > 1;
  const atLimit = !canAddRepository(slots);

  // Unchanged single-repository flow: the intro and the main input stay visible
  // until a result arrives, exactly as before.
  const showIntro = slots.length === 0 || (single && first.status !== "done");
  const showAddPanel = multi || (single && first.status === "done");

  return (
    <div className="wrap section stack stack-lg">
      {showIntro && (
        <header className="stack stack-sm">
          <p className="eyebrow">Analyzer</p>
          <h1 style={{ fontSize: "clamp(1.7rem, 4vw, 2.3rem)" }}>Analyze a repository</h1>
          <p className="lede">
            Paste any public GitHub repository URL. The analysis reads the repository through
            GitHub&rsquo;s public API and scores it against eight fixed criteria.
          </p>
        </header>
      )}

      {showIntro && (
        <div style={{ maxWidth: "36rem" }}>
          <RepoInput
            initialValue={urlParam}
            busy={single && first.status === "loading"}
            onSubmit={submit}
            autoFocus={!urlParam}
          />
        </div>
      )}

      {slots.length === 0 && recent.length > 0 && (
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

      {single && first.status === "loading" && (
        <div className="state" aria-live="polite">
          <div className="spinner" role="status" aria-label="Analyzing" />
          <h3>Analyzing repository…</h3>
          <p>Reading repository metadata and root files from the GitHub API.</p>
        </div>
      )}

      {single && first.status === "error" && first.failure && (
        <div className="state error" role="alert">
          <h3>{errorHeading(first.failure.code)}</h3>
          <p>{first.failure.message}</p>
          <div className="row" style={{ marginTop: "0.5rem" }}>
            <button type="button" className="btn btn-secondary" onClick={() => retry(first)}>
              Try again
            </button>
            <button type="button" className="btn btn-ghost" onClick={startOver}>
              Start over
            </button>
          </div>
        </div>
      )}

      {single && first.status === "done" && first.result && (
        <Results
          result={first.result}
          onAnalyzeAnother={() => setAdding(true)}
          onStartOver={startOver}
        />
      )}

      {multi && (
        <>
          <header className="stack stack-sm">
            <p className="eyebrow">Session results</p>
            <h1 style={{ fontSize: "clamp(1.6rem, 4vw, 2.2rem)" }}>
              {slots.length} repositories in this session
            </h1>
          </header>

          {summary && <SessionSummary summary={summary} />}

          <div className="repo-grid">
            {slots.map((slot, index) => (
              <RepoResultCard
                key={slot.id}
                slot={slot}
                index={index}
                onRetry={retry}
                onRemove={remove}
              />
            ))}
          </div>
        </>
      )}

      {showAddPanel && (adding || multi) && (
        <section className="stack stack-md no-print">
          {adding ? (
            <div className="add-panel stack stack-sm">
              <p className="eyebrow">Add a repository</p>
              <RepoInput buttonLabel="Analyze" onSubmit={addRepository} showExample={false} autoFocus />
              <div className="row">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setAdding(false);
                    setNotice(null);
                  }}
                >
                  Cancel
                </button>
                <span className="small muted">
                  {remainingCapacity(slots)} of {MAX_REPOSITORIES} slots left in this session.
                </span>
              </div>
            </div>
          ) : (
            <div className="row">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setAdding(true)}
                disabled={atLimit}
              >
                Analyze Another Repository
              </button>
              <button type="button" className="btn btn-secondary" onClick={startOver}>
                Clear Results
              </button>
            </div>
          )}

          {notice && (
            <p className="small notice" role="status">
              {notice}
            </p>
          )}

          {atLimit && !adding && (
            <p className="small muted">
              Session limit reached. {MAX_REPOSITORIES} repositories per session keeps GitHub API
              use low — clear the results to start a new session.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
