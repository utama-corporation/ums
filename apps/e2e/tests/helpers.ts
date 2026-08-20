import { APIRequestContext, Browser, BrowserContext, Page, expect } from "@playwright/test";
import path from "node:path";
import { AUTH_DIR } from "../global-setup";

export const API_BASE_URL = (process.env.E2E_API_URL || "http://localhost:5500") + "/api/v1";
export const WEB_BASE_URL = process.env.E2E_WEB_URL || "http://localhost:5000";

export interface ApiResult<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: { code: string; message: string };
}

function authStatePath(username: string): string {
  return path.join(AUTH_DIR, `${username}.json`);
}

/** Opens a new browser context/page already authenticated as `username` (see global-setup.ts) — no login POST at all. */
export async function newPageAsUser(browser: Browser, username: string): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ storageState: authStatePath(username) });
  const page = await context.newPage();
  return { context, page };
}

/** Same idea for pure API calls (no browser needed) — reuses the saved session cookie. */
export async function newApiContextAsUser(playwright: { request: { newContext(o?: object): Promise<APIRequestContext> } }, username: string): Promise<APIRequestContext> {
  return playwright.request.newContext({ baseURL: API_BASE_URL, storageState: authStatePath(username) });
}

export async function apiPost<T>(request: APIRequestContext, path: string, data: unknown): Promise<T> {
  const res = await request.post(`${API_BASE_URL}${path}`, { data });
  const body = (await res.json()) as ApiResult<T>;
  expect(res.ok() && body.success, `POST ${path} failed: ${JSON.stringify(body)}`).toBeTruthy();
  return body.data as T;
}

export async function apiGet<T>(request: APIRequestContext, path: string): Promise<T> {
  const res = await request.get(`${API_BASE_URL}${path}`);
  const body = (await res.json()) as ApiResult<T>;
  expect(res.ok() && body.success, `GET ${path} failed: ${JSON.stringify(body)}`).toBeTruthy();
  return body.data as T;
}

export interface Department {
  id: string;
  name: string;
}
export interface UserRow {
  id: string;
  username: string;
  departmentId?: string | null;
}
export interface Category {
  id: string;
  name: string;
}
export interface MemoType {
  id: string;
  name: string;
}

export interface TestMasterData {
  category: Category;
  memoType: MemoType;
  department: Department;
  users: Record<string, UserRow>;
}

/** Uses an already-authenticated (as admin) API context to load shared master data + the seeded test accounts every test needs. */
export async function setupSharedMasterData(adminRequest: APIRequestContext): Promise<TestMasterData> {
  const runId = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;

  const category = await apiPost<Category>(adminRequest, "/categories", {
    code: `E2E${runId}`.toUpperCase().slice(0, 12),
    name: `E2E Category ${runId}`,
  });

  const memoType = await apiPost<MemoType>(adminRequest, "/memo-types", {
    code: `E2ET${runId}`.toUpperCase().slice(0, 12),
    name: `E2E Type ${runId}`,
  });

  const departments = await apiGet<Department[]>(adminRequest, "/departments");
  expect(departments.length, "no departments found — seed the database first").toBeGreaterThan(0);

  const userList = await apiGet<UserRow[]>(adminRequest, "/users?limit=100");
  const findUser = (username: string) => {
    const found = userList.find((u) => u.username === username);
    expect(found, `seeded user '${username}' not found — run pnpm db:seed first`).toBeTruthy();
    return found!;
  };

  return {
    category,
    memoType,
    department: departments[0],
    users: {
      admin: findUser("admin"),
      "memo.admin": findUser("memo.admin"),
      depthead: findUser("depthead"),
      staff: findUser("staff"),
      approver: findUser("approver"),
      auditor: findUser("auditor"),
    },
  };
}

export interface WorkflowStepDef {
  stepOrder: number;
  name: string;
  mode?: "SEQUENTIAL" | "PARALLEL";
  parallelPolicy?: "ALL" | "ANY" | "QUORUM";
  approverUserIds: string[];
}

/** Creates a workflow (first version is ACTIVE immediately, no separate activation call needed). */
export async function createTestWorkflow(
  adminRequest: APIRequestContext,
  categoryId: string,
  steps: WorkflowStepDef[]
): Promise<void> {
  await apiPost(adminRequest, "/workflows", {
    name: `E2E Workflow ${Date.now().toString(36)}`,
    categoryId,
    steps: steps.map((s) => ({
      stepOrder: s.stepOrder,
      name: s.name,
      mode: s.mode || "SEQUENTIAL",
      parallelPolicy: s.parallelPolicy || "ALL",
      requireSignature: false,
      approverRules: s.approverUserIds.map((id) => ({ strategy: "USER", targetId: id })),
      conditions: [],
    })),
  });
}

/** Creates a memo via the real UI form (on an already-authenticated page) and submits it. */
export async function uiCreateAndSubmitMemo(
  page: Page,
  data: TestMasterData,
  titlePrefix: string
): Promise<{ memoId: string; title: string }> {
  const title = `${titlePrefix} ${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;

  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/categories") && r.ok()),
    page.waitForResponse((r) => r.url().includes("/memo-types") && r.ok()),
    page.waitForResponse((r) => r.url().includes("/departments") && r.ok()),
    page.goto("/memos/new"),
  ]);

  await page.getByLabel("Kategori *").selectOption({ label: data.category.name });
  await page.getByLabel("Jenis Memo *").selectOption({ label: data.memoType.name });
  await page.getByLabel("Departemen Penerima *").selectOption({ label: data.department.name });
  await page.getByLabel("Judul / Perihal *").fill(title);
  await page.getByLabel("Isi Memo").fill(`Isi memo untuk pengujian E2E: ${titlePrefix}.`);

  await page.getByRole("button", { name: "Kirim untuk Persetujuan" }).click();
  await page.waitForURL(/\/memos\/[0-9a-f-]+$/, { timeout: 15_000 });

  const memoId = page.url().match(/\/memos\/([0-9a-f-]+)$/)?.[1] ?? "";
  expect(memoId, `could not extract memo id from URL: ${page.url()}`).not.toBe("");

  return { memoId, title };
}

/** From the approvals inbox (on an already-authenticated page), finds the row matching memoTitle and acts on it. */
export async function uiActOnApproval(
  page: Page,
  memoTitle: string,
  action: "Setujui Memo" | "Minta Revisi" | "Tolak Memo",
  reason?: string
): Promise<void> {
  await page.goto("/approvals/inbox");
  const row = page.locator("tr", { hasText: memoTitle });
  await expect(row).toBeVisible({ timeout: 10_000 });
  await row.getByRole("link", { name: "Review & Tindak Lanjut" }).click();

  if (reason) {
    await page.locator("textarea").fill(reason);
  }
  await page.getByRole("button", { name: action }).click();
  await expect(page.getByText(/berhasil diproses/i)).toBeVisible({ timeout: 10_000 });
}
