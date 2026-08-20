import { test, expect } from "@playwright/test";
import { apiPost, apiGet, newPageAsUser, newApiContextAsUser, setupSharedMasterData, createTestWorkflow, TestMasterData } from "./helpers";

// Covers external recipient access links. Two real product gaps limit this
// test's scope (see apps/e2e/README.md for detail):
//   - The memo creation UI has no way to add an EXTERNAL recipient at all
//     ("Penerima eksternal akan tersedia pada iterasi berikutnya" is
//     literally the placeholder text on that form), so memo creation +
//     submit + approve happen via API here — there's no UI path to drive.
//   - Token REVOCATION has no implementation anywhere (ExternalRecipientAccess.revokedAt
//     is never written by any route/service), so only generation + successful
//     access is testable; revocation isn't covered because it doesn't exist.
//
// What IS driven through the real UI: the "Distribusikan" button (which is
// what actually generates the token), and the public /external/memos/:token
// page an external recipient would really land on.

interface ApprovalAssignmentRow {
  id: string;
  workflowStep: { workflowInstance: { memo: { id: string } } };
}

let data: TestMasterData;
let memoId: string;
let memoTitle: string;

test.beforeAll(async ({ playwright }) => {
  const adminRequest = await newApiContextAsUser(playwright, "admin");
  data = await setupSharedMasterData(adminRequest);
  await createTestWorkflow(adminRequest, data.category.id, [
    { stepOrder: 1, name: "E2E Approval", approverUserIds: [data.users.depthead.id] },
  ]);

  memoTitle = `E2E External Link Memo ${Date.now().toString(36)}`;
  const staffRequest = await newApiContextAsUser(playwright, "staff");
  const draft = await apiPost<{ id: string }>(staffRequest, "/memos", {
    title: memoTitle,
    categoryId: data.category.id,
    memoTypeId: data.memoType.id,
    priority: "NORMAL",
    classification: "GENERAL",
    bodyHtml: "<p>Isi memo untuk pengujian tautan eksternal.</p>",
    senders: [{ partyType: "USER", partyId: data.users.staff.id, displayName: "Staff HR" }],
    recipients: [{ partyType: "EXTERNAL", displayName: "Mitra Eksternal E2E", email: "mitra-e2e@example.com" }],
    ccs: [],
  });
  memoId = draft.id;
  await apiPost(staffRequest, `/memos/${memoId}/submit`, {});
  await staffRequest.dispose();

  const detheadRequest = await newApiContextAsUser(playwright, "depthead");
  const assignments = await apiGet<ApprovalAssignmentRow[]>(detheadRequest, "/approvals/inbox");
  const assignment = assignments.find((a) => a.workflowStep.workflowInstance.memo.id === memoId);
  expect(assignment, "no pending approval assignment found for the E2E memo").toBeTruthy();
  await apiPost(detheadRequest, `/approval-assignments/${assignment!.id}/approve`, { reason: "" });
  await detheadRequest.dispose();

  await adminRequest.dispose();
});

test("distribute generates an external access token -> the public link renders the memo", async ({ browser }) => {
  const memoAdmin = await newPageAsUser(browser, "memo.admin");

  const [distributeResponse] = await Promise.all([
    memoAdmin.page.waitForResponse((r) => r.url().includes(`/memos/${memoId}/distribute`) && r.request().method() === "POST"),
    (async () => {
      await memoAdmin.page.goto(`/memos/${memoId}`);
      memoAdmin.page.once("dialog", (dialog) => dialog.accept());
      await memoAdmin.page.getByRole("button", { name: "Distribusikan" }).click();
    })(),
  ]);

  const body = await distributeResponse.json();
  const token: string | undefined = body.data?.externalTokens?.[0]?.token;
  expect(token, `distribute response had no external token: ${JSON.stringify(body)}`).toBeTruthy();
  await memoAdmin.context.close();

  // Genuinely public — GET /external/memos/access/:token has no `authenticate` middleware.
  const anonContext = await browser.newContext();
  const anonPage = await anonContext.newPage();
  await anonPage.goto(`/external/memos/${token}`);
  await expect(anonPage.getByText(memoTitle)).toBeVisible({ timeout: 10_000 });
  await anonContext.close();
});
