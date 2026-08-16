import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Pin the trace root to this project so an unrelated lockfile elsewhere on
  // the machine cannot be inferred as the workspace root.
  outputFileTracingRoot: projectRoot,

  async rewrites() {
    // In development the Python API runs separately (`npm run dev:api`), so
    // proxy /api/* to it. On Vercel, api/index.py is deployed as a serverless
    // function and vercel.json routes to it instead — no rewrite needed.
    if (process.env.NODE_ENV !== "development") return [];
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:8000/api/:path*",
      },
    ];
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
