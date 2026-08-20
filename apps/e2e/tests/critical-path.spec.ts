import { test, expect } from "@playwright/test";
import { apiPost, newPageAsUser, newApiContextAsUser, setupSharedMasterData, createTestWorkflow, uiCreateAndSubmitMemo, uiActOnApproval, TestMasterData } from "./helpers";

// Covers the single most business-critical journey end to end:
//   login -> create+submit memo -> approve -> publish -> issue disposition -> assignee sees the task
//
// Master data (category/memo type/1-step workflow) is created via API in
// beforeAll so this test is self-contained and re-runnable against a
// freshly-seeded database — it does not depend on any manually-created data.
//
// Disposition CREATION has no UI yet (see README in this package) so that
// one step goes through the API; everything else is driven through real
// browser interaction against the actual pages.

const TASK_TITLE = `E2E Verify Task ${Date.now().toString(36)}`;

let data: TestMasterData;

test.beforeAll(async ({ playwright }) => {
  const adminRequest = await newApiContextAsUser(playwright, "admin");
  data = await setupSharedMasterData(adminRequest);
  await createTestWorkflow(adminRequest, data.category.id, [
    { stepOrder: 1, name: "E2E Approval", approverUserIds: [data.users.depthead.id] },
  ]);
  await adminRequest.dispose();
});

test("login -> submit -> approve -> publish -> disposition -> assignee sees task", async ({ browser }) => {
  const staff = await newPageAsUser(browser, "staff");
  const created = await uiCreateAndSubmitMemo(staff.page, data, "E2E Critical Path Memo");
  await expect(staff.page.getByText(created.title)).toBeVisible();
  await expect(staff.page.getByText("Menunggu", { exact: true })).toBeVisible({ timeout: 10_000 }); // MEMO_STATUS_META.WAITING_APPROVAL
  await staff.context.close();

  const depthead = await newPageAsUser(browser, "depthead");
  await uiActOnApproval(depthead.page, created.title, "Setujui Memo");
  await depthead.context.close();

  const memoAdmin = await newPageAsUser(browser, "memo.admin");
  await memoAdmin.page.goto(`/memos/${created.memoId}`);
  await expect(memoAdmin.page.getByRole("button", { name: "Publikasikan" })).toBeVisible({ timeout: 10_000 });
  memoAdmin.page.once("dialog", (dialog) => dialog.accept());
  await memoAdmin.page.getByRole("button", { name: "Publikasikan" }).click();
  await expect(memoAdmin.page.getByText(/published successfully/i)).toBeVisible({ timeout: 10_000 });
  await expect(memoAdmin.page.getByText("Published", { exact: true })).toBeVisible();

  // Disposition creation has no UI yet (see README) — issue it via API on the
  // same already-authenticated context (BrowserContext.request shares its
  // cookies), then verify the rest for real in the browser.
  await apiPost(memoAdmin.context.request, `/memos/${created.memoId}/dispositions`, {
    instruction: "Tolong ditindaklanjuti (E2E test).",
    tasks: [
      {
        title: TASK_TITLE,
        instruction: "Verifikasi hasil pengujian E2E.",
        priority: "NORMAL",
        assigneeUserIds: [data.users.staff.id],
      },
    ],
  });
  await memoAdmin.context.close();

  const staff2 = await newPageAsUser(browser, "staff");
  await staff2.page.goto("/tasks/assigned");
  await expect(staff2.page.getByText(TASK_TITLE)).toBeVisible({ timeout: 10_000 });
  await staff2.context.close();
});
