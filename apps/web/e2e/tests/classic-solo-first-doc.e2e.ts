import { test as base, expect } from "@playwright/test";

import {
  createSignableDocument,
  deleteDocument,
  type SignableDocument,
} from "../factories/document-factory";
import { loadSamplePdf } from "../fixtures/api-test-client";
import { expect as authExpect, test as authTest } from "../fixtures/auth";
import { sampleDocumentPath } from "../fixtures/paths";
import { DocumentPage } from "../pages/documents/document-page";
import { DocumentsListPage } from "../pages/documents/documents-list-page";
import { testData } from "../utils/test-data";

/**
 * SEA-83 — classic solo first-doc + recipient guided next-field.
 *
 * Caps: ≤6 intentional clicks after auth for the happy path where possible.
 * Guided signing: sender-placed fields are on the overlay; Next field jumps.
 */

const recipientTest = base.extend<{
  multiFieldDoc: SignableDocument;
}>({
  multiFieldDoc: async ({ request }, run) => {
    const pdfFile = await loadSamplePdf(sampleDocumentPath);
    const doc = await createSignableDocument({
      request,
      pdfFile,
      name: `e2e-sea83-guided-${Date.now()}`,
      extraFields: [
        {
          fieldType: "text",
          label: "Full name",
          x: 10,
          y: 55,
          width: 40,
          height: 8,
        },
      ],
    });
    await run(doc);
    await deleteDocument({ request, documentId: doc.documentId }).catch(() => {
      // ignore
    });
  },
});

recipientTest.describe("SEA-83 guided next-field", () => {
  recipientTest(
    "shows Next field and opens the first unfilled overlay",
    async ({ browser, multiFieldDoc }) => {
      recipientTest.setTimeout(90_000);
      const context = await browser.newContext({
        storageState: { cookies: [], origins: [] },
      });
      try {
        const page = await context.newPage();
        await page.goto(`/sign/${multiFieldDoc.signingToken}`);

        const start = page.getByRole("button", { name: /^start$/i });
        if (await start.isVisible({ timeout: 3000 }).catch(() => false)) {
          await start.click();
        }
        const privacyAccept = page.getByRole("button", {
          name: /accept|continue|acknowledge/i,
        });
        if (
          await privacyAccept.isVisible({ timeout: 2000 }).catch(() => false)
        ) {
          await privacyAccept.click();
        }

        await page
          .getByRole("checkbox", {
            name: /consent to use electronic signatures/i,
          })
          .check();
        await page
          .getByRole("button", {
            name: /accept electronic signature consent/i,
          })
          .click();

        const nextField = page.getByTestId("signer-next-field");
        await expect(nextField).toBeVisible({ timeout: 20_000 });
        await expect(nextField).toContainText(/next field|signature field/i);

        await nextField.click();

        const fieldDialog = page.getByRole("dialog");
        const overlay = page.getByRole("button", {
          name: /required field/i,
        });
        await expect(fieldDialog.or(overlay.first())).toBeVisible({
          timeout: 10_000,
        });
      } finally {
        await context.close();
      }
    }
  );

  recipientTest(
    "mobile Form View lists sender-placed fields without PDF hunt",
    async ({ browser, multiFieldDoc }) => {
      recipientTest.setTimeout(90_000);
      const context = await browser.newContext({
        storageState: { cookies: [], origins: [] },
        viewport: { width: 390, height: 844 },
      });
      try {
        const page = await context.newPage();
        await page.goto(`/sign/${multiFieldDoc.signingToken}`);

        const start = page.getByRole("button", { name: /^start$/i });
        if (await start.isVisible({ timeout: 3000 }).catch(() => false)) {
          await start.click();
        }
        const privacyAccept = page.getByRole("button", {
          name: /accept|continue|acknowledge/i,
        });
        if (
          await privacyAccept.isVisible({ timeout: 2000 }).catch(() => false)
        ) {
          await privacyAccept.click();
        }

        await page
          .getByRole("checkbox", {
            name: /consent to use electronic signatures/i,
          })
          .check();
        await page
          .getByRole("button", {
            name: /accept electronic signature consent/i,
          })
          .click();

        await expect(page.getByTestId("signer-view-toggle")).toBeVisible({
          timeout: 20_000,
        });
        await expect(page.getByTestId("signer-view-fields")).toHaveAttribute(
          "aria-selected",
          "true"
        );
        await expect(page.getByTestId("signer-form-view")).toBeVisible();
        await expect(
          page.getByRole("button", { name: /signature/i }).first()
        ).toBeVisible();

        await page.getByTestId("signer-view-document").click();
        await expect(page.getByTestId("signer-view-document")).toHaveAttribute(
          "aria-selected",
          "true"
        );
      } finally {
        await context.close();
      }
    }
  );
});

authTest.describe("SEA-83 solo first-doc (authenticated)", () => {
  authTest(
    "upload → add myself → place signature field",
    async ({ authenticatedPage, organizationSlug }) => {
      authTest.setTimeout(120_000);
      const documentsPage = new DocumentsListPage(authenticatedPage);
      await documentsPage.goto(organizationSlug);

      let createdName: string | null = null;
      try {
        createdName = await documentsPage.createDocument(
          testData.samplePdfPath
        );
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes("monthly document limit")
        ) {
          authTest.skip(
            true,
            "E2E workspace reached its monthly document limit."
          );
          return;
        }
        throw error;
      }

      try {
        await documentsPage.waitForDocumentRowByName(createdName);
        await documentsPage.openDocument(createdName);

        const documentPage = new DocumentPage(authenticatedPage);
        await documentPage.waitForDocumentLoad();
        await documentPage.selectFieldType("signature");
        await documentPage.addSignatureField(120, 160);

        await authExpect(
          authenticatedPage.getByText(/signature/i).first()
        ).toBeVisible({ timeout: 10_000 });
      } finally {
        await documentsPage.goto(organizationSlug);
        if (createdName) {
          await documentsPage.deleteDocument(createdName).catch(() => {});
        }
      }
    }
  );
});
