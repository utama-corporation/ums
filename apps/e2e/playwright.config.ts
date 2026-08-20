import { defineConfig, devices } from "@playwright/test";

const WEB_URL = process.env.E2E_WEB_URL || "http://localhost:5000";
const API_URL = process.env.E2E_API_URL || "http://localhost:5500";

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./global-setup.ts",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  // Every spec file logs in as the same handful of seeded accounts (staff,
  // depthead, memo.admin, ...). Multiple files running concurrently in
  // separate workers collide on those shared sessions/DB rows — force a
  // single worker so the whole suite runs strictly one test at a time.
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: WEB_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.E2E_SKIP_WEBSERVER
    ? undefined
    : [
        {
          command: "npx pnpm --filter @ums/api dev",
          url: `${API_URL}/api/v1/health`,
          reuseExistingServer: true,
          timeout: 60_000,
          cwd: "../../",
        },
        {
          command: "npx pnpm --filter @ums/web dev",
          url: WEB_URL,
          reuseExistingServer: true,
          timeout: 60_000,
          cwd: "../../",
        },
        {
          // No HTTP server to health-check — it's a background poller (outbox/export
          // jobs, employee sync, overdue tasks). Needed for the report-export test,
          // which waits on an ExportJob only the worker ever flips to COMPLETED.
          command: "npx pnpm --filter @ums/worker dev",
          reuseExistingServer: true,
          timeout: 30_000,
          cwd: "../../",
        },
      ],
});

export const API_BASE_URL = `${API_URL}/api/v1`;
