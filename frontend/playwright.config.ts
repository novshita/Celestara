import os from "node:os";
import path from "node:path";

import { defineConfig } from "@playwright/test";

// Browser journeys against the real stack: the FastAPI backend (on a throwaway
// SQLite file), the production Next.js build, and a fake Anthropic API.
//
//   npm run build && npm run test:e2e
//
// The backend needs its dependencies installed (`pip install -e backend`);
// point E2E_PYTHON at the interpreter that has them if it is not `python3`.
// Ports are deliberately not the ones `npm run dev` and the backend's default
// use, so a test run never touches a dev server's data.

const FRONTEND = 3200;
const BACKEND = 8200;
const CLAUDE = 8201;

const root = path.resolve(__dirname, "..");
const database = path.join(os.tmpdir(), "celestara-e2e.db");

export default defineConfig({
  testDir: "e2e",
  // One shared backend and database; the journeys use their own accounts, but
  // running them one at a time keeps failures easy to read.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${FRONTEND}`,
    // Locally, the Chrome already installed, so nothing needs downloading. CI
    // installs Playwright's own Chromium (see .github/workflows/ci.yml).
    channel: process.env.CI ? undefined : "chrome",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: `node e2e/fake-claude.mjs ${CLAUDE}`,
      port: CLAUDE,
      reuseExistingServer: false,
    },
    {
      command: `sh -c 'rm -f "${database}" && exec ${process.env.E2E_PYTHON ?? "python3"} -m uvicorn app.main:app --port ${BACKEND}'`,
      cwd: path.join(root, "backend"),
      url: `http://127.0.0.1:${BACKEND}/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        DATABASE_URL: `sqlite:///${database}`,
        ANTHROPIC_BASE_URL: `http://127.0.0.1:${CLAUDE}`,
        ANTHROPIC_API_KEY: "e2e-not-a-real-key",
        // The journeys ask several questions in a minute.
        AI_RATE_LIMIT_PER_MINUTE: "0",
      },
    },
    {
      command: `npx next start -p ${FRONTEND}`,
      url: `http://127.0.0.1:${FRONTEND}`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { BACKEND_URL: `http://127.0.0.1:${BACKEND}` },
    },
  ],
});
