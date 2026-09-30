import type { Page } from "@playwright/test";

import { FIELD_TYPE_LABELS, FIELD_TYPES, type FieldType } from "@/lib/field-types";

import {
  addRecipient,
  createSignatureField,
} from "../fixtures/api-test-client";
import { expect, test } from "../fixtures/auth";
import { DocumentPage } from "../pages/documents/document-page";

/** Toolbar-exposed types that can be placed (payment stays disabled). */
const PLACEABLE_FIELD_TYPES = FIELD_TYPES.filter(
  (type) => type !== "payment"
) as FieldType[];

const PRIMARY_FIELD_TYPES: FieldType[] = [
  "signature",
  "initials",
  "name",
  "email",
  "date",
  "text",
  "checkbox",
  "date_signed",
];

async function setupApiBackedDocument(args: {
  authenticatedPage: Page;
  organizationSlug: string;
  createApiDocument: () => Promise<{ id: string; name: string }>;
}): Promise<{ documentId: string }> {
  const doc = await args.createApiDocument();
  await args.authenticatedPage.goto(
    `/${args.organizationSlug}/documents/${doc.id}`
  );
  await new DocumentPage(args.authenticatedPage).waitForDocumentLoad();
  return { documentId: doc.id };
}

test.describe("SEA-87 field catalog — toolbar", () => {
  test.beforeEach(
    async ({ authenticatedPage, organizationSlug, createApiDocument }) => {
      try {
        await setupApiBackedDocument({
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

  test("primary palette exposes beyond the historic core four", async ({
    authenticatedPage,
  }) => {
    for (const type of PRIMARY_FIELD_TYPES) {
      await expect(
        authenticatedPage.getByTestId(`field-toolbar-${type}`)
      ).toBeVisible();
    }
  });

  test("More fields exposes the rest of the catalog", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage
      .getByRole("button", { name: /More fields/i })
      .click();

    for (const type of FIELD_TYPES) {
      if (PRIMARY_FIELD_TYPES.includes(type)) continue;
      const button = authenticatedPage.getByTestId(`field-toolbar-${type}`);
      await expect(button).toBeVisible();
      if (type === "payment") {
        await expect(button).toBeDisabled();
      } else {
        await expect(button).toBeEnabled();
      }
    }
  });

  test("can select initials / name / email from the primary palette", async ({
    authenticatedPage,
  }) => {
    const documentPage = new DocumentPage(authenticatedPage);
    for (const type of ["initials", "name", "email"] as const) {
      await documentPage.selectFieldType(type);
      await expect(
        authenticatedPage.getByTestId(`field-toolbar-${type}`)
      ).toBeEnabled();
    }
  });
});

test.describe("SEA-87 field catalog — placed list", () => {
  test("draft list shows every placeable field type after API seed", async ({
    authenticatedPage,
    organizationSlug,
    createApiDocument,
  }) => {
    test.setTimeout(120_000);

    let documentId: string;
    try {
      const doc = await createApiDocument();
      documentId = doc.id;
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

    const request = authenticatedPage.context().request;
    const recipient = await addRecipient(request, documentId, {
      email: `catalog-${Date.now()}@seal.nyc`,
      name: "Catalog Signer",
      role: "signer",
      authMethod: "none",
    });

    let y = 5;
    for (const type of PLACEABLE_FIELD_TYPES) {
      await createSignatureField(request, documentId, recipient.publicId, {
        fieldType: type,
        label: FIELD_TYPE_LABELS[type],
        isRequired: type !== "heading" && type !== "strikethrough",
        x: 10,
        y,
        width: 25,
        height: 8,
        page: 1,
      });
      y = Math.min(y + 4, 90);
    }

    await authenticatedPage.goto(
      `/${organizationSlug}/documents/${documentId}`
    );
    await new DocumentPage(authenticatedPage).waitForDocumentLoad();

    // Fields section lists placed fields with data-field-type.
    for (const type of PLACEABLE_FIELD_TYPES) {
      await expect(
        authenticatedPage.locator(`[data-field-type="${type}"]`).first()
      ).toBeVisible({ timeout: 15_000 });
    }
  });
});
