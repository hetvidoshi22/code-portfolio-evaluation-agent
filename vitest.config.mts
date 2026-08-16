import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/** Unit tests for the browser-side session logic. The scoring itself is Python
 *  and stays under pytest — nothing here recomputes a score. */
export default defineConfig({
  // tsconfig sets jsx: "preserve" because Next.js does its own transform.
  // Vitest has no such step, so the components need one here.
  oxc: { jsx: { runtime: "automatic" } },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
