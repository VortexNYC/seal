import { existsSync } from "node:fs";

import { expect, test } from "../fixtures/auth";
import { assertConvexE2eHelperAvailability } from "../fixtures/convex-test-api";
import {
  authStatePath,
  pdfStorageIdPath,
  workspaceSlugPath,
} from "../fixtures/paths";
import { DocumentPage } from "../pages/documents/document-page";
import { DocumentsListPage } from "../pages/documents/documents-list-page";

test.describe("Smoke Contract", () => {
  test("setup artifacts exist before browser tests run", async () => {
    expect(existsSync(authStatePath)).toBe(true);
    expect(existsSync(workspaceSlugPath)).toBe(true);
    expect(existsSync(pdfStorageIdPath)).toBe(true);
  });

  test("convex test helpers are reachable", async () => {
    await expect
      .poll(
        async () => {
          try {
            await assertConvexE2eHelperAvailability();
            return "ok";
          } catch (error) {
            return error instanceof Error ? error.message : String(error);
          }
        },
        { timeout: 10000 }
      )
      .toBe("ok");
  });

  test("workspace home boots for the authenticated session", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    await expect(authenticatedPage).toHaveURL(
      new RegExp(`/${organizationSlug}/(home|onboarding)`)
    );
  });

  test("documents index loads for the resolved workspace", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    const documentsPage = new DocumentsListPage(authenticatedPage);
    await documentsPage.goto(organizationSlug);
    await expect(authenticatedPage).toHaveURL(`/${organizationSlug}/documents`);
    await expect(documentsPage.heading).toBeVisible();
    await expect(documentsPage.createDocumentButton).toBeVisible();
  });

  test("seeded api document opens in the editor", async ({
    authenticatedPage,
    organizationSlug,
    createApiDocument,
  }) => {
    const doc = await createApiDocument();
    await authenticatedPage.goto(`/${organizationSlug}/documents/${doc.id}`);

    const documentPage = new DocumentPage(authenticatedPage);
    await documentPage.waitForDocumentLoad();

    await expect(
      authenticatedPage.getByRole("button", { name: /send document/i })
    ).toBeVisible();
  });
});
