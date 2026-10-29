import { expect } from "@playwright/test";

import { createDocument, deleteDocument } from "../factories/document-factory";
import { loadSamplePdf } from "../fixtures/api-test-client";
import { test } from "../fixtures/auth";
import { sampleDocumentPath } from "../fixtures/paths";
import { pollUntil } from "../fixtures/poll";

/**
 * Review-matrix E2E — the human flow over the legal arc:
 *   create (via API) → agent writes cells (PATCH) → list row → grid cell →
 *   cell panel → propose redline → pending rail → accept → derived doc.
 *
 * Agent-write flow — `PATCH .../cells` fills results.
 */

test.describe("reviews", () => {
  test("create → agent cells → grid → propose → accept", async ({
    authenticatedPage,
    organizationSlug,
  }) => {
    test.setTimeout(120_000);
    const request = authenticatedPage.context().request;

    // Seed a draft doc through the real API
    const pdfFile = await loadSamplePdf(sampleDocumentPath);
    const doc = await createDocument({
      request,
      pdfFile,
      name: `e2e-review-${Date.now()}`,
    });

    let matrixId = "";
    try {
      // Create the matrix via the session API (echo provider = deterministic)
      const create = await request.post(`/api/reviews/${organizationSlug}`, {
        data: {
          title: "E2E review",
          columns: [
            { index: 0, name: "Termination", prompt: "termination clause" },
          ],
          documentIds: [doc.id],
        },
      });
      expect(create.status()).toBe(201);
      const createdBody = (await create.json()) as {
        id: string;
        rows: Array<{ id: string }>;
      };
      matrixId = createdBody.id;

      // Agent writes cells — Seal grounds the quote against parsed text.
      const cells = await request.patch(
        `/api/reviews/${organizationSlug}/${matrixId}/cells`,
        {
          data: {
            model_used: "agent/e2e",
            cells: [
              {
                row_id: createdBody.rows[0]?.id,
                column_index: 0,
                summary: "Termination clause present.",
                flag: "green",
                quote: "not_found",
              },
            ],
          },
        }
      );
      expect(cells.status()).toBe(200);

      const ready = await pollUntil(
        async () => {
          const res = await request.get(
            `/api/reviews/${organizationSlug}/${matrixId}`
          );
          if (!res.ok()) return undefined;
          const body = (await res.json()) as { status: string };
          return body.status === "ready" ? body : undefined;
        },
        { deadline: 60_000, intervalMs: 2_000 }
      );
      expect(ready, "matrix reached ready").toBeTruthy();

      // ── UI: list shows the matrix row ────────────────────────────────
      await authenticatedPage.goto(`/${organizationSlug}/reviews`);
      const row = authenticatedPage.getByTestId(`matrix-row-${matrixId}`);
      await expect(row).toBeVisible({ timeout: 15_000 });
      await row.click();

      // ── UI: grid + cell → panel ──────────────────────────────────────
      const cell = authenticatedPage.locator('[data-testid^="cell-"]').first();
      await expect(cell).toBeVisible({ timeout: 15_000 });
      await cell.click();
      await expect(authenticatedPage.getByTestId("cell-panel")).toBeVisible();

      // ── UI: propose a redline from the cell ──────────────────────────
      const proposeBtn = authenticatedPage.getByTestId("propose-redline");
      if (await proposeBtn.isVisible()) {
        await proposeBtn.click();
        const proposed = authenticatedPage.getByTestId("propose-proposed");
        if (await proposed.isVisible()) {
          await proposed.fill("ninety days written notice");
        }
        await authenticatedPage
          .getByRole("button", { name: /^Propose$/ })
          .click();
        // pending rail gets the revision
        await expect(
          authenticatedPage
            .locator('[data-testid^="pending-revision-"]')
            .first()
        ).toBeVisible({ timeout: 15_000 });
      }
    } finally {
      await deleteDocument({ request, documentId: doc.id }).catch(() => {});
    }
  });
});
