import { test, expect } from "@playwright/test";
import { newPageAsUser, newApiContextAsUser, setupSharedMasterData, createTestWorkflow, uiCreateAndSubmitMemo, uiActOnApproval, TestMasterData } from "./helpers";

// Covers: publish -> archive (real UI action + confirm dialog) -> appears in
// the Archive list (real query, not a stub) -> restore -> disappears again.

let data: TestMasterData;

test.beforeAll(async ({ playwright }) => {
  const adminRequest = await newApiContextAsUser(playwright, "admin");
  data = await setupSharedMasterData(adminRequest);
  await createTestWorkflow(adminRequest, data.category.id, [
    { stepOrder: 1, name: "E2E Approval", approverUserIds: [data.users.depthead.id] },
  ]);
  await adminRequest.dispose();
});

test("publish -> archive -> appears in archive list -> restore -> disappears", async ({ browser }) => {
  const staff = await newPageAsUser(browser, "staff");
  const created = await uiCreateAndSubmitMemo(staff.page, data, "E2E Archive Memo");
  await staff.context.close();

  const depthead = await newPageAsUser(browser, "depthead");
  await uiActOnApproval(depthead.page, created.title, "Setujui Memo");
  await depthead.context.close();

  const memoAdmin = await newPageAsUser(browser, "memo.admin");
  await memoAdmin.page.goto(`/memos/${created.memoId}`);

  memoAdmin.page.once("dialog", (dialog) => dialog.accept());
  await memoAdmin.page.getByRole("button", { name: "Publikasikan" }).click();
  await expect(memoAdmin.page.getByText("Published", { exact: true })).toBeVisible({ timeout: 10_000 });

  memoAdmin.page.once("dialog", (dialog) => dialog.accept());
  await memoAdmin.page.getByRole("button", { name: "Arsipkan" }).click();
  await expect(memoAdmin.page.getByText(/archived successfully/i)).toBeVisible({ timeout: 10_000 });

  await memoAdmin.page.goto("/memos/archive");
  const archiveRow = memoAdmin.page.locator("tr", { hasText: created.title });
  await expect(archiveRow).toBeVisible({ timeout: 10_000 });

  await archiveRow.getByRole("button", { name: "Pulihkan" }).click();
  await expect(memoAdmin.page.locator("tr", { hasText: created.title })).toHaveCount(0, { timeout: 10_000 });
  await memoAdmin.context.close();
});
