import { test, expect } from "@playwright/test";
import { newPageAsUser, newApiContextAsUser, setupSharedMasterData, createTestWorkflow, uiCreateAndSubmitMemo, uiActOnApproval, TestMasterData } from "./helpers";

// Covers a PARALLEL step with parallelPolicy ALL and two approvers (depthead +
// auditor): the memo must stay in WAITING_APPROVAL after only one of them
// approves, and only become APPROVED once both have.

let data: TestMasterData;

test.beforeAll(async ({ playwright }) => {
  const adminRequest = await newApiContextAsUser(playwright, "admin");
  data = await setupSharedMasterData(adminRequest);
  await createTestWorkflow(adminRequest, data.category.id, [
    {
      stepOrder: 1,
      name: "E2E Parallel Approval",
      mode: "PARALLEL",
      parallelPolicy: "ALL",
      approverUserIds: [data.users.depthead.id, data.users.auditor.id],
    },
  ]);
  await adminRequest.dispose();
});

test("parallel ALL-policy step requires every approver before the memo advances", async ({ browser }) => {
  const staff = await newPageAsUser(browser, "staff");
  const created = await uiCreateAndSubmitMemo(staff.page, data, "E2E Parallel Memo");
  await expect(staff.page.getByText("Menunggu", { exact: true })).toBeVisible({ timeout: 10_000 });
  await staff.context.close();

  // First approver acts — step has 2 required approvals, so memo must still be waiting.
  const depthead = await newPageAsUser(browser, "depthead");
  await uiActOnApproval(depthead.page, created.title, "Setujui Memo");
  await depthead.context.close();

  const staff2 = await newPageAsUser(browser, "staff");
  await staff2.page.goto(`/memos/${created.memoId}`);
  await expect(staff2.page.getByText("Menunggu", { exact: true })).toBeVisible({ timeout: 10_000 }); // still WAITING_APPROVAL
  await staff2.context.close();

  // Second (last) approver acts — now the step, and the memo, should complete.
  const auditor = await newPageAsUser(browser, "auditor");
  await uiActOnApproval(auditor.page, created.title, "Setujui Memo");
  await auditor.context.close();

  const staff3 = await newPageAsUser(browser, "staff");
  await staff3.page.goto(`/memos/${created.memoId}`);
  await expect(staff3.page.getByText("Disetujui", { exact: true })).toBeVisible({ timeout: 10_000 }); // MEMO_STATUS_META.APPROVED
  await staff3.context.close();
});
