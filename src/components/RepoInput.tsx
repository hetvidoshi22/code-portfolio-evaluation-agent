"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const EXAMPLE = "https://github.com/psf/requests";

interface Props {
  initialValue?: string;
  buttonLabel?: string;
  busy?: boolean;
  /** When provided, run in place instead of navigating to /analyze. */
  onSubmit?: (url: string) => void;
  showExample?: boolean;
  autoFocus?: boolean;
}

export default function RepoInput({
  initialValue = "",
  buttonLabel = "Analyze Repository",
  busy = false,
  onSubmit,
  showExample = true,
  autoFocus = false,
}: Props) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const url = value.trim();
    if (!url || busy) return;
    if (onSubmit) {
      onSubmit(url);
    } else {
      router.push(`/analyze?url=${encodeURIComponent(url)}`);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="field">
        <label className="sr-only" htmlFor="repo-url">
          GitHub repository URL
        </label>
        <input
          id="repo-url"
          name="url"
          type="text"
          inputMode="url"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          autoFocus={autoFocus}
          placeholder="https://github.com/username/repository"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-describedby="repo-url-hint"
        />
        <button type="submit" className="btn btn-primary" disabled={busy || !value.trim()}>
          {busy ? "Analyzing…" : buttonLabel}
        </button>
      </div>
      {showExample && (
        <p className="field-hint" id="repo-url-hint">
          Public repositories only. Try{" "}
          <button type="button" onClick={() => setValue(EXAMPLE)}>
            psf/requests
          </button>
        </p>
      )}
    </form>
  );
}
