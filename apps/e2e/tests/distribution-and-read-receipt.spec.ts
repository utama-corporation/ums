import { test, expect } from "@playwright/test";
import { apiPost, apiGet, newPageAsUser, newApiContextAsUser, setupSharedMasterData, createTestWorkflow, uiCreateAndSubmitMemo, uiActOnApproval, TestMasterData, Department } from "./helpers";

// Covers: approve -> distribute (APPROVED -> OUTBOX) -> recipient sees it in
// their real inbox with "Belum Dibaca". The read-receipt endpoint
// (POST /memos/:id/read-receipt) exists but is never called from the UI
// anywhere (confirmed by reading apps/web/src/app/memos/[id]/page.tsx) — so
// there's no browser interaction that flips it, and this test calls the API
// directly for that half, same as the disposition-creation gap. See README.

let data: TestMasterData;
let recipientDepartment: Department;

test.beforeAll(async ({ playwright }) => {
  const adminRequest = await newApiContextAsUser(playwright, "admin");
  data = await setupSharedMasterData(adminRequest);
  await createTestWorkflow(adminRequest, data.category.id, [
    { stepOrder: 1, name: "E2E Approval", approverUserIds: [data.users.depthead.id] },
  ]);

  // depthead needs to be a member of whichever department receives the memo
  // for it to show up in their inbox — use their own department explicitly
  // rather than "whatever department happened to be first" from shared setup.
  const departments = await apiGet<Department[]>(adminRequest, "/departments");
  const match = departments.find((d) => d.id === data.users.depthead.departmentId);
  expect(match, "depthead has no departmentId, or it doesn't match any /departments row").toBeTruthy();
  recipientDepartment = match!;

  await adminRequest.dispose();
});

test("distribute -> recipient sees it unread in inbox -> read-receipt flips the badge", async ({ browser }) => {
  const staff = await newPageAsUser(browser, "staff");
  const created = await uiCreateAndSubmitMemo(staff.page, { ...data, department: recipientDepartment }, "E2E Distribution Memo");
  await staff.context.close();

  const depthead = await newPageAsUser(browser, "depthead");
  await uiActOnApproval(depthead.page, created.title, "Setujui Memo");
  await depthead.context.close();

  // memo.admin distributes (needs memo.publish) — separation of duties from the approver.
  const memoAdmin = await newPageAsUser(browser, "memo.admin");
  await memoAdmin.page.goto(`/memos/${created.memoId}`);
  memoAdmin.page.once("dialog", (dialog) => dialog.accept());
  await memoAdmin.page.getByRole("button", { name: "Distribusikan" }).click();
  await expect(memoAdmin.page.getByText(/distributed successfully/i)).toBeVisible({ timeout: 10_000 });
  await memoAdmin.context.close();

  const depthead2 = await newPageAsUser(browser, "depthead");
  await depthead2.page.goto("/memos/inbox");
  const inboxRow = depthead2.page.locator("tr", { hasText: created.title });
  await expect(inboxRow).toBeVisible({ timeout: 10_000 });
  await expect(inboxRow.getByText("Belum Dibaca")).toBeVisible();

  await apiPost(depthead2.context.request, `/memos/${created.memoId}/read-receipt`, {});

  await depthead2.page.reload();
  const inboxRowAfter = depthead2.page.locator("tr", { hasText: created.title });
  await expect(inboxRowAfter.getByText("Dibaca", { exact: true })).toBeVisible({ timeout: 10_000 });
  await depthead2.context.close();
});
