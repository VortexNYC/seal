import { expect, test } from "@playwright/test";

import {
  createDocument,
  deleteDocument,
} from "../factories/document-factory";
import {
  addRecipient,
  getApiBaseUrl,
  loadSamplePdf,
} from "../fixtures/api-test-client";
import { signInTestUser } from "../fixtures/auth-helpers";
import { sampleDocumentPath } from "../fixtures/paths";
import { writeCachedWorkspaceSlug } from "../fixtures/workspace-state";

test.use({
  storageState: {
    cookies: [],
    origins: [],
  },
});

test("corrects a sent envelope from the page", async ({ page }) => {
  test.setTimeout(90000);
  await signInTestUser(page);

  const slug = new URL(page.url()).pathname.split("/").filter(Boolean)[0];
  if (!slug) {
    throw new Error(`[E2E] Signed in without a workspace. url=${page.url()}`);
  }
  writeCachedWorkspaceSlug(slug);

  const pdfFile = await loadSamplePdf(sampleDocumentPath);
  const name = `Sent correct ${Date.now()}`;
  const adaEmail = `ada-${Date.now()}@example.com`;
  let doc: { id: string; name: string };
  try {
    doc = await createDocument({
      request: page.request,
      pdfFile,
      name,
    });
  } catch (err) {
    if (
      err instanceof Error &&
      err.message.includes("monthly document limit")
    ) {
      test.skip(true, "E2E workspace reached its monthly document limit.");
      return;
    }
    throw err;
  }

  try {
    await addRecipient(page.request, doc.id, {
      email: "lenore@example.com",
      name: "Lenore",
      role: "signer",
      authMethod: "email_otp",
    });
    await addRecipient(page.request, doc.id, {
      email: "kai@example.com",
      name: "Kai",
      role: "signer",
      authMethod: "email_otp",
    });

    const sent = await page.request.post(
      `${getApiBaseUrl()}/api/documents/${encodeURIComponent(slug)}/${encodeURIComponent(doc.id)}/send`,
      { data: { signingMode: "sequential" } }
    );
    expect(sent.ok(), await sent.text()).toBe(true);

    await page.goto(`/${slug}/documents/${doc.id}`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible({
      timeout: 30000,
    });
    await expect(
      page.getByText("Waiting on Lenore. Kai gets the email after that.")
    ).toBeVisible({ timeout: 15000 });

    await page.getByRole("button", { name: "Add Recipient" }).click();
    await page.getByRole("tab", { name: "Email" }).click();
    await page.getByLabel("Email address").fill(adaEmail);
    await page.getByLabel("Full name").fill("Ada");
    await page.getByRole("button", { name: "Add recipient" }).click();
    await expect(page.getByText("Ada", { exact: true })).toBeVisible({
      timeout: 15000,
    });
    await expect(
      page.getByText("Waiting on Lenore. Kai gets the email after that.")
    ).toBeVisible();

    await page
      .getByText("lenore@example.com", { exact: true })
      .locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]")
      .getByRole("button", { name: "Recipient options" })
      .click();
    await page.getByLabel("Recipient email").fill("lenore.fixed@example.com");
    await page.getByRole("button", { name: "Update email" }).click();
    await expect(page.getByText("lenore.fixed@example.com")).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText("lenore@example.com")).toHaveCount(0);
    await expect(page.getByText(/Waiting on Lenore\./)).toBeVisible();
  } finally {
    await deleteDocument({ request: page.request, documentId: doc.id });
  }
});
