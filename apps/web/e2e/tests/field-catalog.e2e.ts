import type { Page } from "@playwright/test";

import {
  FIELD_TYPES,
  FIELD_TYPE_LABELS,
  type FieldType,
} from "../../src/lib/field-types";
import { expect, test } from "../fixtures/auth";
import { DocumentPage } from "../pages/documents/document-page";

async function setupApiBackedDocument(args: {
  authenticatedPage: Page;
  organizationSlug: string;
  createApiDocument: () => Promise<{ id: string; name: string }>;
}): Promise<void> {
  const doc = await args.createApiDocument();
  await args.authenticatedPage.goto(
    `/${args.organizationSlug}/documents/${doc.id}`
  );
  await new DocumentPage(args.authenticatedPage).waitForDocumentLoad();
}

const OPTION_TYPES = new Set<FieldType>(["checkbox", "dropdown", "radio"]);

/** Payment stays disabled until merchant payments are connected. */
const PLACEABLE_TYPES = FIELD_TYPES.filter((t) => t !== "payment");

test.describe("Field catalog (SEA-87)", () => {
  test.describe.configure({ mode: "serial" });

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

  test("shows the full field catalog — primary grid plus More fields", async ({
    authenticatedPage,
  }) => {
    const documentPage = new DocumentPage(authenticatedPage);

    // Primary grid — the eight common types visible without expanding.
    for (const type of [
      "signature",
      "initials",
      "name",
      "email",
      "date",
      "text",
      "checkbox",
      "date_signed",
    ] as FieldType[]) {
      await expect(documentPage.fieldTypeButton(type)).toBeVisible();
    }

    // Everything else lives behind the expander.
    await documentPage.expandMoreFields();
    for (const type of FIELD_TYPES) {
      await expect(documentPage.fieldTypeButton(type)).toBeVisible();
    }
  });

  test("places every placeable field type onto the document", async ({
    authenticatedPage,
  }) => {
    // 22 sequential drag/drop placements need well over the 20s default.
    test.setTimeout(180000);
    const documentPage = new DocumentPage(authenticatedPage);
    const fieldRows = authenticatedPage.locator(
      '[data-testid="signature-field"]'
    );

    // Payment is intentionally gated — assert the catalog renders it
    // disabled rather than silently hiding it.
    await documentPage.expandMoreFields();
    const paymentButton = documentPage.fieldTypeButton("payment");
    await expect(paymentButton).toBeVisible();
    await expect(paymentButton).toBeDisabled();

    for (const [index, type] of PLACEABLE_TYPES.entries()) {
      const label = FIELD_TYPE_LABELS[type];
      const x = 115 + (index % 4) * 120;
      const y = 120 + Math.floor(index / 4) * 90;

      await documentPage.placeCatalogField(
        type,
        x,
        y,
        OPTION_TYPES.has(type) ? { options: ["A", "B"] } : {}
      );

      // Creation is proven by the Fields counter in the section header.
      await expect(
        authenticatedPage.getByRole("button", {
          name: new RegExp(`^Fields\\s+${index + 1}\\b`),
        })
      ).toBeVisible({ timeout: 10000 });

      // The fields list is virtualized — scroll the real scroll container to
      // the bottom so the newest row mounts before asserting on it.
      if (
        await fieldRows
          .first()
          .isVisible()
          .catch(() => false)
      ) {
        await fieldRows.last().evaluate((el) => {
          let parent = el.parentElement;
          while (parent) {
            if (parent.scrollHeight > parent.clientHeight + 4) {
              parent.scrollTop = parent.scrollHeight;
              return;
            }
            parent = parent.parentElement;
          }
        });
      }

      await expect(
        fieldRows.filter({ hasText: new RegExp(label, "i") }).first()
      ).toBeVisible({ timeout: 10000 });
    }
  });
});
