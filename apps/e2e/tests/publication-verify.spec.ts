import { test, expect } from "@playwright/test";
import { newPageAsUser, newApiContextAsUser, setupSharedMasterData, createTestWorkflow, uiCreateAndSubmitMemo, uiActOnApproval, TestMasterData } from "./helpers";

// Covers the QR/document verification flow: publish a memo, capture the
// verificationToken the publish call returns (it's never surfaced in the UI
// itself — only baked into the generated PDF's QR code — so we intercept the
// API response the "Publikasikan" button triggers), then load the PUBLIC
// /verify/:token page (no login) and confirm it reports the document valid.

let data: TestMasterData;

test.beforeAll(async ({ playwright }) => {
  const adminRequest = await newApiContextAsUser(playwright, "admin");
  data = await setupSharedMasterData(adminRequest);
  await createTestWorkflow(adminRequest, data.category.id, [
    { stepOrder: 1, name: "E2E Approval", approverUserIds: [data.users.depthead.id] },
  ]);
  await adminRequest.dispose();
});

test("publish -> verification token from the API response resolves as a valid document", async ({ browser }) => {
  const staff = await newPageAsUser(browser, "staff");
  const created = await uiCreateAndSubmitMemo(staff.page, data, "E2E Verify Memo");
  await staff.context.close();

  const depthead = await newPageAsUser(browser, "depthead");
  await uiActOnApproval(depthead.page, created.title, "Setujui Memo");
  await depthead.context.close();

  const memoAdmin = await newPageAsUser(browser, "memo.admin");
  await memoAdmin.page.goto(`/memos/${created.memoId}`);

  const [publishResponse] = await Promise.all([
    memoAdmin.page.waitForResponse((r) => r.url().includes(`/memos/${created.memoId}/publish`) && r.request().method() === "POST"),
    (async () => {
      memoAdmin.page.once("dialog", (dialog) => dialog.accept());
      await memoAdmin.page.getByRole("button", { name: "Publikasikan" }).click();
    })(),
  ]);

  const publishBody = await publishResponse.json();
  const verificationToken: string = publishBody.data?.verificationToken;
  expect(verificationToken, `publish response had no verificationToken: ${JSON.stringify(publishBody)}`).toBeTruthy();
  await memoAdmin.context.close();

  // Public page — no login needed to verify a document. Genuinely unauthenticated context.
  const anonContext = await browser.newContext();
  const anonPage = await anonContext.newPage();
  await anonPage.goto(`/verify/${verificationToken}`);
  await expect(anonPage.getByText("VALID & TERVERIFIKASI RESMI")).toBeVisible({ timeout: 10_000 });
  await expect(anonPage.getByText(created.title)).toBeVisible();
  await anonContext.close();
});
