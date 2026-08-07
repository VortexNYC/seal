import type { Browser, BrowserContext, Page } from "@playwright/test";

import {
  createDocument,
  deleteDocument as deleteApiDocument,
} from "../factories/document-factory";
import { expect, test } from "../fixtures/auth";
import { ensurePdfStorageId } from "../fixtures/convex-test-api";
import { sampleDocumentPath } from "../fixtures/paths";
import { readCachedWorkspaceSlug } from "../fixtures/workspace-state";
import { DocumentPage } from "../pages/documents/document-page";
import { DocumentsListPage } from "../pages/documents/documents-list-page";

type ApiDocument = { id: string; name: string };

async function createAndOpenApiDocument(args: {
  authenticatedPage: Page;
  organizationSlug: string;
  createApiDocument: () => Promise<ApiDocument>;
}): Promise<ApiDocument> {
  const doc = await args.createApiDocument();
  await args.authenticatedPage.goto(
    `/${args.organizationSlug}/documents/${doc.id}`
  );
  await new DocumentPage(args.authenticatedPage).waitForDocumentLoad();
  return doc;
}

async function resolveWorkspaceSlug(context: BrowserContext): Promise<string> {
  const cachedSlug = readCachedWorkspaceSlug();
  if (cachedSlug) {
    return cachedSlug;
  }

  const page = await context.newPage();
  try {
    await page.goto("/app", { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/([\w-]+)\/(home|onboarding)/, { timeout: 10000 });
    const match = page.url().match(/\/([\w-]+)\/(home|onboarding)/);
    if (!match?.[1]) {
      throw new Error(`Unable to resolve workspace slug from ${page.url()}`);
    }
    return match[1];
  } finally {
    await page.close();
  }
}

async function withSetupContext<T>(
  browser: Browser,
  storageState: string,
  fn: (context: BrowserContext, organizationSlug: string) => Promise<T>
): Promise<T> {
  const context = await browser.newContext({ storageState });
  try {
    const organizationSlug = await resolveWorkspaceSlug(context);
    return await fn(context, organizationSlug);
  } finally {
    await context.close();
  }
}

test.describe("Document Filtering", () => {
  test.beforeEach(
    async ({ authenticatedPage, organizationSlug, createApiDocument }) => {
      try {
        await createAndOpenApiDocument({
          authenticatedPage,
          organizationSlug,
          createApiDocument,
        });
        await new DocumentsListPage(authenticatedPage).goto(organizationSlug);
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
    }
  );

  test("should filter documents by status - Drafts", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.getByRole("button", { name: "Drafts" }).click();
    await authenticatedPage.waitForTimeout(500);
  });

  test("should filter documents by status - Sent", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.getByRole("button", { name: "Sent" }).click();
    await authenticatedPage.waitForTimeout(500);
  });

  test("should filter documents by status - In Progress", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage
      .getByRole("button", { name: "In Progress" })
      .click();
    await authenticatedPage.waitForTimeout(500);
  });

  test("should filter documents by status - Completed", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.getByRole("button", { name: "Completed" }).click();
    await authenticatedPage.waitForTimeout(500);
  });

  test("should switch between document tabs", async ({ authenticatedPage }) => {
    await authenticatedPage
      .getByRole("button", { name: "My Documents" })
      .click();
    await authenticatedPage.waitForTimeout(500);
    await authenticatedPage
      .getByRole("button", { name: "Shared with Me" })
      .click();
    await authenticatedPage.waitForTimeout(500);
    await authenticatedPage
      .getByRole("button", { name: "All Documents" })
      .last()
      .click();
    await authenticatedPage.waitForTimeout(500);
  });
});

test.describe("Document Actions", () => {
  let docId = "";
  let docName = "";

  test.beforeEach(
    async ({ authenticatedPage, organizationSlug, createApiDocument }) => {
      try {
        const doc = await createAndOpenApiDocument({
          authenticatedPage,
          organizationSlug,
          createApiDocument,
        });
        docId = doc.id;
        docName = doc.name;
        await new DocumentsListPage(authenticatedPage).goto(organizationSlug);
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
    }
  );

  test("should download document", async ({ authenticatedPage }) => {
    const documentsPage = new DocumentsListPage(authenticatedPage);
    const row = documentsPage.getDocumentRowByName(docName);
    await row.waitFor({ state: "visible", timeout: 10000 });
    await row.getByRole("button", { name: /document actions for/i }).click();

    const popupPromise = authenticatedPage
      .waitForEvent("popup", { timeout: 5000 })
      .catch(() => null);
    const downloadPromise = authenticatedPage
      .waitForEvent("download", { timeout: 5000 })
      .catch(() => null);

    await authenticatedPage
      .getByRole("menuitem", { name: /^download$/i })
      .click();

    const [popup, download] = await Promise.all([
      popupPromise,
      downloadPromise,
    ]);
    if (download) {
      expect(download).toBeTruthy();
    } else if (popup) {
      await expect
        .poll(async () => popup.url(), { timeout: 5000 })
        .not.toBe("about:blank");
    } else {
      throw new Error("Neither a popup nor a download event was triggered");
    }
  });

  test("should navigate back from document editor", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    await authenticatedPage.goto(`/${organizationSlug}/documents/${docId}`);
    const documentPage = new DocumentPage(authenticatedPage);
    await documentPage.waitForDocumentLoad();

    await documentPage.backButton.click();

    await expect(authenticatedPage).toHaveURL(`/${organizationSlug}/documents`);
  });

  test.afterEach(() => {
    docId = "";
    docName = "";
  });
});

test.describe("Document Editor - Zoom Controls", () => {
  test.describe.configure({ mode: "serial" });

  let zoomDocId = "";

  test.beforeAll(async ({ browser }, testInfo) => {
    const storageId = await ensurePdfStorageId(sampleDocumentPath);
    const storageState = testInfo.project.use.storageState;
    if (typeof storageState !== "string") {
      throw new Error("Expected a file-based storageState for setup context");
    }

    zoomDocId = await withSetupContext(
      browser,
      storageState,
      async (_context, organizationSlug) => {
        const doc = await createDocument({ organizationSlug, storageId });
        return doc.id;
      }
    );
  });

  test.afterAll(async () => {
    if (zoomDocId) {
      await deleteApiDocument(zoomDocId).catch(() => {});
    }
  });

  test("should zoom in on document", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    await authenticatedPage.goto(`/${organizationSlug}/documents/${zoomDocId}`);
    const documentPage = new DocumentPage(authenticatedPage);
    await documentPage.waitForDocumentLoad();

    const initialZoom = await documentPage.getVisibleZoomText();
    await documentPage.zoomInButton.click();

    await expect
      .poll(async () => documentPage.getVisibleZoomText(), { timeout: 8000 })
      .not.toBe(initialZoom);
  });

  test("should zoom out on document", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    await authenticatedPage.goto(`/${organizationSlug}/documents/${zoomDocId}`);
    const documentPage = new DocumentPage(authenticatedPage);
    await documentPage.waitForDocumentLoad();

    await documentPage.zoomOutButton.click();
    await authenticatedPage.waitForTimeout(500);
  });

  test("should reset zoom on document", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    await authenticatedPage.goto(`/${organizationSlug}/documents/${zoomDocId}`);
    const documentPage = new DocumentPage(authenticatedPage);
    await documentPage.waitForDocumentLoad();

    if (!(await documentPage.hasDesktopOnlyZoomControls())) {
      test.skip(true, "Reset zoom control is hidden on mobile layouts.");
    }

    await documentPage.zoomInButton.click();
    await authenticatedPage.waitForTimeout(300);
    await documentPage.resetZoomButton.click();
    await authenticatedPage.waitForTimeout(500);
  });

  test("should fit document to viewport", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    await authenticatedPage.goto(`/${organizationSlug}/documents/${zoomDocId}`);
    const documentPage = new DocumentPage(authenticatedPage);
    await documentPage.waitForDocumentLoad();

    if (!(await documentPage.hasDesktopOnlyZoomControls())) {
      test.skip(true, "Fit control is hidden on mobile layouts.");
    }

    await documentPage.fitButton.click();
    await authenticatedPage.waitForTimeout(500);
  });
});

test.describe("Document Details Sidebar", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(
    async ({ authenticatedPage, organizationSlug, createApiDocument }) => {
      try {
        await createAndOpenApiDocument({
          authenticatedPage,
          organizationSlug,
          createApiDocument,
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
    }
  );

  test("should display document details", async ({ authenticatedPage }) => {
    const documentPage = new DocumentPage(authenticatedPage);
    await documentPage.detailsSectionButton.click();

    await expect(authenticatedPage.getByText("File Size")).toBeVisible();
    await expect(authenticatedPage.getByText("Pages")).toBeVisible();
    await expect(authenticatedPage.getByText(/^Uploaded$/)).toBeVisible();
  });

  test("should display recipients section", async ({ authenticatedPage }) => {
    const documentPage = new DocumentPage(authenticatedPage);

    await expect(documentPage.recipientsSectionButton).toBeVisible();

    const noRecipients = authenticatedPage.getByText("No recipients");
    const addRecipientButton = authenticatedPage.getByRole("button", {
      name: /add recipient/i,
    });
    await expect(noRecipients.or(addRecipientButton).first()).toBeVisible({
      timeout: 15000,
    });
  });

  test("should display activity timeline", async ({ authenticatedPage }) => {
    const documentPage = new DocumentPage(authenticatedPage);

    await documentPage.activitySectionButton.click();
    await expect(documentPage.activitySectionButton).toBeVisible();
    await expect(
      authenticatedPage
        .getByText(/was (?:created|added|updated|removed|sent|signed|viewed)/i)
        .first()
    ).toBeVisible();
  });
});
