import type { Metadata, Viewport } from "next";
import Link from "next/link";

import "./globals.css";

const REPO_URL = "https://github.com/hetvidoshi22/code-portfolio-evaluation-agent";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  ? process.env.NEXT_PUBLIC_SITE_URL
  : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Code Portfolio Evaluation Agent",
    template: "%s · Code Portfolio Evaluation Agent",
  },
  description:
    "Score any public GitHub repository against eight engineering signals — documentation, licensing, testing, structure and community — and get a clear, explainable breakdown.",
  openGraph: {
    type: "website",
    siteName: "Code Portfolio Evaluation Agent",
    title: "Evaluate GitHub projects in seconds",
    description:
      "A deterministic repository quality score with a full per-criterion breakdown. No sign-up, no data stored.",
  },
  twitter: {
    card: "summary",
    title: "Evaluate GitHub projects in seconds",
    description: "A deterministic repository quality score with a full per-criterion breakdown.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafbfc" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0f12" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="wrap inner">
            <Link href="/" className="brand">
              <span className="glyph" aria-hidden="true">
                CP
              </span>
              Code Portfolio Evaluation Agent
            </Link>
            <nav className="nav">
              <Link href="/analyze">Analyze</Link>
              <a href={REPO_URL} target="_blank" rel="noreferrer noopener">
                Source ↗
              </a>
            </nav>
          </div>
        </header>

        <main>{children}</main>

        <footer className="site-footer">
          <div className="wrap">
            <div className="cols">
              <div style={{ maxWidth: "30ch" }}>
                <strong>Code Portfolio Evaluation Agent</strong>
                <p>
                  A deterministic quality score for public GitHub repositories, built to make
                  portfolio review fast and consistent.
                </p>
              </div>
              <div>
                <strong>Product</strong>
                <ul>
                  <li>
                    <Link href="/analyze">Analyze a repository</Link>
                  </li>
                  <li>
                    <Link href="/#criteria">Scoring criteria</Link>
                  </li>
                  <li>
                    <Link href="/#faq">FAQ</Link>
                  </li>
                </ul>
              </div>
              <div>
                <strong>Project</strong>
                <ul>
                  <li>
                    <a href={REPO_URL} target="_blank" rel="noreferrer noopener">
                      Source code
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://docs.github.com/en/rest"
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      GitHub REST API
                    </a>
                  </li>
                </ul>
              </div>
              <div style={{ maxWidth: "30ch" }}>
                <strong>Privacy</strong>
                <p>
                  Analyses read public GitHub data live. Nothing is written to a database and no
                  accounts exist. Recently analyzed repositories are kept in your own browser
                  storage and never leave your device.
                </p>
              </div>
            </div>
            <div className="legal">
              © {new Date().getFullYear()} Code Portfolio Evaluation Agent · Rule-based scoring, no
              AI model involved · Not affiliated with GitHub.
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
