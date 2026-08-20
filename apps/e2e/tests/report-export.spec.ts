import { test, expect } from "@playwright/test";
import { newPageAsUser } from "./helpers";

// Covers the async export flow: request a CSV export, poll (same 2s interval
// the page itself uses) until the worker flips the job to COMPLETED, and
// confirm a real download link appears. Requires the worker to actually be
// running (see playwright.config.ts's third webServer entry) — without it
// this job sits at PENDING forever and the test times out, which is itself
// a meaningful signal if the worker setup ever regresses.

test("request CSV export -> worker completes it -> download link appears", async ({ browser }) => {
  const memoAdmin = await newPageAsUser(browser, "memo.admin");
  await memoAdmin.page.goto("/reports");

  await memoAdmin.page.getByLabel("Jenis laporan").selectOption({ value: "status" });
  await memoAdmin.page.getByRole("button", { name: "Export CSV" }).click();

  const statusText = memoAdmin.page.locator("span.font-semibold");
  await expect(statusText).toHaveText("COMPLETED", { timeout: 30_000 });

  const downloadLink = memoAdmin.page.getByRole("link", { name: "Unduh hasil export" });
  await expect(downloadLink).toBeVisible({ timeout: 5_000 });
  const href = await downloadLink.getAttribute("href");
  expect(href, "download link has no href").toBeTruthy();

  await memoAdmin.context.close();
});
