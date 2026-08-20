import { request as playwrightRequest } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

const API_BASE_URL = (process.env.E2E_API_URL || "http://localhost:5500") + "/api/v1";
export const AUTH_DIR = path.join(__dirname, ".auth");

// The login endpoint is rate-limited (15 requests / 15 minutes per IP — see
// apps/api/src/middleware/authMiddleware.ts's authRateLimiter). If every spec
// file logged in fresh for every actor switch, a full suite run comfortably
// exceeds that limit and starts failing with TOO_MANY_REQUESTS — not a bug in
// the app, but bad test design. Logging in ONCE per role here and having every
// spec reuse the saved storageState keeps the whole suite's login count at 6,
// regardless of how many spec files or actor switches are added later.
const SEEDED_USERS = ["admin", "staff", "depthead", "memo.admin", "auditor", "approver"];
const PASSWORD = "Password123!";

export default async function globalSetup() {
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  for (const username of SEEDED_USERS) {
    const context = await playwrightRequest.newContext();
    const res = await context.post(`${API_BASE_URL}/auth/login`, { data: { username, password: PASSWORD } });
    if (!res.ok()) {
      throw new Error(`global-setup: login failed for '${username}': ${await res.text()}`);
    }
    await context.storageState({ path: path.join(AUTH_DIR, `${username}.json`) });
    await context.dispose();
  }
}
