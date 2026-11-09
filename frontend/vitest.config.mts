import path from "node:path";

import { defineConfig } from "vitest/config";

// Unit and component tests only; the browser journeys live in e2e/ and run
// under Playwright (playwright.config.ts).
export default defineConfig({
  // tsconfig keeps `jsx: preserve` for Next, so tell the compiler to handle it.
  oxc: { jsx: { runtime: "automatic" } },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // `server-only` throws outside a server bundle by design.
      "server-only": path.resolve(import.meta.dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/unit/setup.ts"],
  },
});
