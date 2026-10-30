import { test as base, expect } from "@playwright/test";

import {
  createSignableDocument,
  deleteDocument,
  type SignableDocument,
} from "../factories/document-factory";
import { loadSamplePdf } from "../fixtures/api-test-client";
import { sampleDocumentPath } from "../fixtures/paths";
import { SignerCeremonyPage } from "../pages/signing/signer-ceremony-page";

/**
 * Public signing ceremony gates — invite → privacy → ESIGN consent.
 * Uses SignerCeremonyPage (data-testid POM); anonymous browser context.
 */

const test = base.extend<{ signableDoc: SignableDocument }>({
  signableDoc: async ({ request }, run) => {
    const pdfFile = await loadSamplePdf(sampleDocumentPath);
    const doc = await createSignableDocument({
      request,
      pdfFile,
      name: `e2e-ceremony-${Date.now()}`,
    });
    await run(doc);
    await deleteDocument({ request, documentId: doc.documentId }).catch(() => {});
  },
});

test.describe("Signer ceremony gates", () => {
  test("preflight surfaces render with stable testids", async ({
    browser,
    signableDoc,
  }) => {
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    try {
      const page = await context.newPage();
      const ceremony = new SignerCeremonyPage(page);
      await ceremony.goto(signableDoc.signingToken);
      await ceremony.expectPreflightSurfaceVisible();
      await expect(page.getByTestId("signer-invite-gate")).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("completePreflightGates reaches signing surface", async ({
    browser,
    signableDoc,
  }) => {
    test.setTimeout(90_000);
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    try {
      const page = await context.newPage();
      const ceremony = new SignerCeremonyPage(page);
      await ceremony.goto(signableDoc.signingToken);
      await ceremony.completePreflightGates();
      await expect(
        page
          .getByTestId("signer-primary-action")
          .or(
            page.getByRole("button", { name: /signature required field/i })
          )
          .or(page.getByTestId("signer-view-toggle"))
      ).toBeVisible({ timeout: 20_000 });
    } finally {
      await context.close();
    }
  });
});
