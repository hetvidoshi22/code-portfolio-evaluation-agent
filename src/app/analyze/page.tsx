import type { Metadata } from "next";
import { Suspense } from "react";

import Analyzer from "@/components/Analyzer";

export const metadata: Metadata = {
  title: "Analyze a repository",
  description:
    "Paste a public GitHub repository URL to get a deterministic portfolio score with a full per-criterion breakdown.",
};

function Fallback() {
  return (
    <div className="wrap section stack stack-lg">
      <div className="stack stack-sm">
        <div className="skeleton" style={{ height: "0.8rem", width: "6rem" }} />
        <div className="skeleton" style={{ height: "2.2rem", width: "min(22rem, 100%)" }} />
        <div className="skeleton" style={{ height: "1rem", width: "min(34rem, 100%)" }} />
      </div>
      <div className="skeleton" style={{ height: "3rem", maxWidth: "36rem" }} />
    </div>
  );
}

export default function AnalyzePage() {
  return (
    <Suspense fallback={<Fallback />}>
      <Analyzer />
    </Suspense>
  );
}
