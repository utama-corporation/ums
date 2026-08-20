import { test, expect } from "@playwright/test";
import { newPageAsUser, newApiContextAsUser, setupSharedMasterData, createTestWorkflow, uiCreateAndSubmitMemo, uiActOnApproval, TestMasterData } from "./helpers";

// Covers: submit -> approver requests revision -> memo goes back to REVISION ->
// author resubmits the same memo (no edits needed to prove the state machine
// allows it) -> approver approves this time -> APPROVED.

let data: TestMasterData;

test.beforeAll(async ({ playwright }) => {
  const adminRequest = await newApiContextAsUser(playwright, "admin");
  data = await setupSharedMasterData(adminRequest);
  await createTestWorkflow(adminRequest, data.category.id, [
    { stepOrder: 1, name: "E2E Approval", approverUserIds: [data.users.depthead.id] },
  ]);
  await adminRequest.dispose();
});

test("request revision -> resubmit -> approve", async ({ browser }) => {
  const staff = await newPageAsUser(browser, "staff");
  const created = await uiCreateAndSubmitMemo(staff.page, data, "E2E Revision Memo");
  await expect(staff.page.getByText("Menunggu", { exact: true })).toBeVisible({ timeout: 10_000 });
  await staff.context.close();

  const depthead = await newPageAsUser(browser, "depthead");
  await uiActOnApproval(depthead.page, created.title, "Minta Revisi", "Mohon lengkapi data pendukung (E2E test).");
  await depthead.context.close();

  // Back as the author: memo should be in REVISION status and resubmittable.
  const staff2 = await newPageAsUser(browser, "staff");
  await staff2.page.goto(`/memos/${created.memoId}`);
  // exact:true matters here — "Revisi" is a case-insensitive substring of the
  // status-history text "WAITING_APPROVAL → REVISION" otherwise.
  await expect(staff2.page.getByText("Revisi", { exact: true })).toBeVisible({ timeout: 10_000 }); // MEMO_STATUS_META.REVISION label

  staff2.page.once("dialog", (dialog) => dialog.accept());
  await staff2.page.getByRole("button", { name: "Ajukan Persetujuan" }).click();
  await expect(staff2.page.getByText("Menunggu", { exact: true })).toBeVisible({ timeout: 10_000 });
  await staff2.context.close();

  const depthead2 = await newPageAsUser(browser, "depthead");
  await uiActOnApproval(depthead2.page, created.title, "Setujui Memo");
  await depthead2.context.close();

  const staff3 = await newPageAsUser(browser, "staff");
  await staff3.page.goto(`/memos/${created.memoId}`);
  await expect(staff3.page.getByText("Disetujui", { exact: true })).toBeVisible({ timeout: 10_000 }); // MEMO_STATUS_META.APPROVED
  await staff3.context.close();
});
