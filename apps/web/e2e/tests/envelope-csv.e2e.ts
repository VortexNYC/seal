import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

import { createDocument, deleteDocument } from "../factories/document-factory";
import { loadSamplePdf } from "../fixtures/api-test-client";
import { signInTestUser } from "../fixtures/auth-helpers";
import { sampleDocumentPath } from "../fixtures/paths";

test.use({
  storageState: {
    cookies: [],
    origins: [],
  },
});

test("exports one envelope as CSV from its actions menu", async ({ page }) => {
  test.setTimeout(90000);
  await signInTestUser(page);

  const slug = new URL(page.url()).pathname.split("/").filter(Boolean)[0];
  if (!slug) {
    throw new Error(`[E2E] Signed in without a workspace. url=${page.url()}`);
  }

  const pdfFile = await loadSamplePdf(sampleDocumentPath);
  const name = `CSV Export ${Date.now()}`;
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
    await page.goto(`/${slug}/documents/${doc.id}`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible({
      timeout: 30000,
    });

    await page.getByRole("button", { name: "Document actions" }).click();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("menuitem", { name: "Export CSV" }).click();
    const download = await downloadPromise;
    const csv = await readFile(await download.path(), "utf8");

    expect(download.suggestedFilename()).toMatch(/\.csv$/);
    expect(csv.split("\n")[0]).toBe(
      "Document,Status,Owner,Owner email,Sent,Deadline,Recipient,Email,Role,Recipient status,Signed"
    );
    expect(csv).toContain(name);
  } finally {
    await deleteDocument({ request: page.request, documentId: doc.id });
  }
});
