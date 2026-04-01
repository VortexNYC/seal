import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";

import { apiCreateDocument, apiDeleteDocument } from "../fixtures/convex-test-api";
import { expect, test } from "../fixtures/auth";
import { DocumentPage } from "../pages/documents/document-page";
import { DocumentsListPage } from "../pages/documents/documents-list-page";
import { testData } from "../utils/test-data";

function getCachedStorageId(): string | null {
  try {
    const f = resolve(
      dirname(fileURLToPath(import.meta.url)),
      "../../playwright/.clerk/e2e-pdf-storage-id.txt",
    );
    return readFileSync(f, "utf8").trim() || null;
  } catch {
    return null;
  }
}

async function createAndOpenDocument(
  authenticatedPage: Page,
  organizationSlug: string,
): Promise<{ id: string | null; name: string }> {
  const storageId = getCachedStorageId();

  if (storageId) {
    const id = await apiCreateDocument(organizationSlug, storageId);
    await authenticatedPage.goto(`/${organizationSlug}/documents/${id}`);
    await new DocumentPage(authenticatedPage).waitForDocumentLoad();
    return { id, name: `e2e-test-doc-${id}` };
  }

  const documentsPage = new DocumentsListPage(authenticatedPage);
  await documentsPage.goto(organizationSlug);
  const documentName = await documentsPage.createDocument(testData.samplePdfPath);
  await documentsPage.openDocument(documentName);
  await new DocumentPage(authenticatedPage).waitForDocumentLoad();
  return { id: null, name: documentName };
}

async function deleteDocument(
  authenticatedPage: Page,
  organizationSlug: string,
  docId: string | null,
  docName: string,
): Promise<void> {
  if (docId) {
    await apiDeleteDocument(docId).catch(() => {});
  } else if (docName) {
    const documentsPage = new DocumentsListPage(authenticatedPage);
    await documentsPage.goto(organizationSlug).catch(() => {});
    await documentsPage.deleteDocument(docName).catch(() => {});
  }
}

test.describe("Signature Fields - Selection", () => {
  let docId: string | null = null;
  let docName = "";

  test.beforeEach(async ({ authenticatedPage, organizationSlug }) => {
    try {
      const doc = await createAndOpenDocument(authenticatedPage, organizationSlug);
      docId = doc.id;
      docName = doc.name;
    } catch (err) {
      if (err instanceof Error && err.message.includes("monthly document limit")) {
        test.skip(true, "E2E workspace reached its monthly document limit.");
        return;
      }
      throw err;
    }
  });

  test.afterEach(async ({ authenticatedPage, organizationSlug }) => {
    await deleteDocument(authenticatedPage, organizationSlug, docId, docName);
  });

  test("should display all field type buttons", async ({ authenticatedPage }) => {
    await expect(
      authenticatedPage.getByRole("button", { name: "Signature", exact: true }),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByRole("button", { name: "Text", exact: true }),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByRole("button", { name: "Date", exact: true }),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByRole("button", { name: "Checkbox", exact: true }),
    ).toBeVisible();
  });

  test("should select signature field type", async ({ authenticatedPage }) => {
    const documentPage = new DocumentPage(authenticatedPage);
    await documentPage.selectFieldType("signature");
    await expect(
      authenticatedPage.getByRole("button", { name: "Signature", exact: true }),
    ).toBeVisible();
  });

  test("should select text field type", async ({ authenticatedPage }) => {
    const documentPage = new DocumentPage(authenticatedPage);
    await documentPage.selectFieldType("text");
    await expect(
      authenticatedPage.getByRole("button", { name: "Text", exact: true }),
    ).toBeVisible();
  });

  test("should select date field type", async ({ authenticatedPage }) => {
    const documentPage = new DocumentPage(authenticatedPage);
    await documentPage.selectFieldType("date");
    await expect(
      authenticatedPage.getByRole("button", { name: "Date", exact: true }),
    ).toBeVisible();
  });

  test("should select checkbox field type", async ({ authenticatedPage }) => {
    const documentPage = new DocumentPage(authenticatedPage);
    await documentPage.selectFieldType("checkbox");
    await expect(
      authenticatedPage.getByRole("button", { name: "Checkbox", exact: true }),
    ).toBeVisible();
  });
});

test.describe("Signature Fields - Drag and Drop", () => {
  let docId: string | null = null;
  let docName = "";

  test.beforeEach(async ({ authenticatedPage, organizationSlug }) => {
    try {
      const doc = await createAndOpenDocument(authenticatedPage, organizationSlug);
      docId = doc.id;
      docName = doc.name;
    } catch (err) {
      if (err instanceof Error && err.message.includes("monthly document limit")) {
        test.skip(true, "E2E workspace reached its monthly document limit.");
        return;
      }
      throw err;
    }
  });

  test.afterEach(async ({ authenticatedPage, organizationSlug }) => {
    await deleteDocument(authenticatedPage, organizationSlug, docId, docName);
  });

  test("should add signature field by clicking on canvas", async ({ authenticatedPage }) => {
    test.setTimeout(60000);
    const documentPage = new DocumentPage(authenticatedPage);
    await documentPage.selectFieldType("signature");
    await documentPage.addSignatureField(100, 100);
    await expect(
      authenticatedPage.locator('[data-testid="signature-field"]').first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test("should drag signature field onto PDF", async ({ authenticatedPage }) => {
    test.setTimeout(60000);
    const documentPage = new DocumentPage(authenticatedPage);
    await documentPage.selectFieldType("signature");
    await documentPage.addSignatureField(150, 150);
    await expect(
      authenticatedPage.locator('[data-testid="signature-field"]').first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test("should add multiple fields of different types", async ({ authenticatedPage }) => {
    test.setTimeout(120000);
    const documentPage = new DocumentPage(authenticatedPage);

    await documentPage.selectFieldType("signature");
    await documentPage.addSignatureField(100, 100);

    await documentPage.selectFieldType("text");
    await documentPage.addSignatureField(100, 200);

    await documentPage.selectFieldType("date");
    await documentPage.addSignatureField(100, 300);

    await expect(authenticatedPage.locator('[data-testid="signature-field"]')).toHaveCount(3, {
      timeout: 5000,
    });
  });
});

test.describe("Signature Fields - Management", () => {
  let docId: string | null = null;
  let docName = "";

  test.beforeEach(async ({ authenticatedPage, organizationSlug }) => {
    try {
      const doc = await createAndOpenDocument(authenticatedPage, organizationSlug);
      docId = doc.id;
      docName = doc.name;
    } catch (err) {
      if (err instanceof Error && err.message.includes("monthly document limit")) {
        test.skip(true, "E2E workspace reached its monthly document limit.");
        return;
      }
      throw err;
    }
  });

  test.afterEach(async ({ authenticatedPage, organizationSlug }) => {
    await deleteDocument(authenticatedPage, organizationSlug, docId, docName);
  });

  test("should display fields section", async ({ authenticatedPage }) => {
    await expect(
      authenticatedPage.getByRole("button", { name: /Signature Fields/ }),
    ).toBeVisible({ timeout: 5000 });
  });

  test("should show field toolbar with drag instructions or existing fields", async ({
    authenticatedPage,
  }) => {
    await expect(
      authenticatedPage.getByRole("button", { name: /Signature Fields/ }),
    ).toBeVisible({ timeout: 5000 });
    await expect(
      authenticatedPage.getByRole("button", { name: "Signature", exact: true }),
    ).toBeVisible({ timeout: 5000 });
  });

  test("should delete signature field", async ({ authenticatedPage }) => {
    test.setTimeout(60000);
    const documentPage = new DocumentPage(authenticatedPage);

    await documentPage.selectFieldType("signature");
    await documentPage.addSignatureField(150, 150);

    const field = authenticatedPage.locator('[data-testid="signature-field"]').first();
    await expect(field).toBeVisible({ timeout: 5000 });

    const isAlreadySelected = await field.evaluate((el) =>
      el.className.includes("border-primary"),
    );
    if (!isAlreadySelected) {
      await field.click();
      await expect(field).toHaveClass(/border-primary/, { timeout: 3000 });
    }

    await authenticatedPage.waitForTimeout(100);
    await authenticatedPage.keyboard.press("Delete");

    const alertDialog = authenticatedPage.getByRole("alertdialog");
    await expect(alertDialog).toBeVisible({ timeout: 5000 });
    await expect(alertDialog).toContainText("This action cannot be undone");
    await alertDialog.getByRole("button", { name: "Remove" }).click();

    await expect(authenticatedPage.locator('[data-testid="signature-field"]')).toHaveCount(0, {
      timeout: 10000,
    });
    await expect(authenticatedPage.getByText("No fields yet")).toBeVisible({ timeout: 5000 });
  });

  test("should edit signature field properties", async ({ authenticatedPage }) => {
    test.setTimeout(60000);
    const documentPage = new DocumentPage(authenticatedPage);

    await documentPage.selectFieldType("signature");
    await documentPage.addSignatureField(150, 150);

    const field = authenticatedPage.locator('[data-testid="signature-field"]').first();
    await expect(field).toBeVisible({ timeout: 5000 });
    await field.click();
    await expect(field).toHaveClass(/border-primary/, { timeout: 3000 });
  });
});

test.describe("Signature Fields - Toolbar Interactions", () => {
  let docId: string | null = null;
  let docName = "";

  test.beforeEach(async ({ authenticatedPage, organizationSlug }) => {
    try {
      const doc = await createAndOpenDocument(authenticatedPage, organizationSlug);
      docId = doc.id;
      docName = doc.name;
    } catch (err) {
      if (err instanceof Error && err.message.includes("monthly document limit")) {
        test.skip(true, "E2E workspace reached its monthly document limit.");
        return;
      }
      throw err;
    }
  });

  test.afterEach(async ({ authenticatedPage, organizationSlug }) => {
    await deleteDocument(authenticatedPage, organizationSlug, docId, docName);
  });

  test("should display signature fields toolbar", async ({ authenticatedPage }) => {
    await expect(authenticatedPage.getByRole("button", { name: /Signature Fields/ })).toBeVisible();
    await expect(authenticatedPage.getByText("Fields").first()).toBeVisible();
  });

  test("should show field icons with labels", async ({ authenticatedPage }) => {
    const sectionButton = authenticatedPage.getByRole("button", {
      name: /Signature Fields/,
    });
    await expect(sectionButton).toBeVisible({ timeout: 5000 });

    await expect(
      authenticatedPage.getByRole("button", { name: "Signature", exact: true }),
    ).toBeVisible({ timeout: 5000 });
    await expect(
      authenticatedPage.getByRole("button", { name: "Text", exact: true }),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByRole("button", { name: "Date", exact: true }),
    ).toBeVisible();
    await expect(
      authenticatedPage.getByRole("button", { name: "Checkbox", exact: true }),
    ).toBeVisible();
  });
});
