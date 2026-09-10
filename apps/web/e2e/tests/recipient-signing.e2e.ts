import { test as base, expect } from "@playwright/test";

import {
  createSignableDocument,
  deleteDocument,
  getDocumentState,
  type SignableDocument,
} from "../factories/document-factory";
import { loadSamplePdf } from "../fixtures/api-test-client";
import { sampleDocumentPath } from "../fixtures/paths";

/**
 * Recipient signing E2E — the public token flow that no other test exercises.
 *
 * Why this test runs without an authenticated session:
 *   The signing experience is the only Seal surface that anonymous users hit.
 *   We deliberately open a fresh browser context with no `storageState` so the
 *   recipient cannot accidentally inherit the sender's session.
 *
 * Why we seed via the Seal API instead of driving the sender UI:
 *   The send-document UI flow is already covered by `recipients.e2e.ts` and
 *   `documents.e2e.ts`. This test focuses on the recipient half — keeping it
 *   independent (and fast) means a failure here points at the signing surface,
 *   not the sender flow.
 */

const test = base.extend<{
  signableDoc: SignableDocument;
}>({
  signableDoc: async ({ request }, run) => {
    const pdfFile = await loadSamplePdf(sampleDocumentPath);
    const doc = await createSignableDocument({
      request,
      pdfFile,
    });
    await run(doc);
    // Best-effort cleanup. Cascading deletes (recipients, fields, audit_logs)
    // are handled by the API document delete path.
    await deleteDocument({ request, documentId: doc.documentId }).catch(() => {
      // Doc may already be gone if a later test deleted it; ignore.
    });
  },
});

test.describe("Recipient Signing", () => {
  test("loads the signing page from a fresh browser context with no auth session", async ({
    browser,
    signableDoc,
  }) => {
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    try {
      const page = await context.newPage();
      await page.goto(`/sign/${signableDoc.signingToken}`);

      // First surface for an unauthenticated recipient is the ESIGN consent gate.
      // If this renders, the public token route resolved and the auth-race fix is
      // holding — the React error boundary stays cold.
      await expect(
        page.getByRole("heading", { name: /electronic signature consent/i })
      ).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(/something went wrong/i)).not.toBeVisible({
        timeout: 1000,
      });
    } finally {
      await context.close();
    }
  });

  test("recipient completes the document via type-signature flow", async ({
    browser,
    signableDoc,
    request,
  }) => {
    // UI sign flow ~5s + completion-workflow poll up to 60s. Observed end-to-end
    // from sign → workflowStatus="completed" is ~6s; 60s gives generous
    // headroom under parallel-test load.
    test.setTimeout(120_000);

    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    try {
      const page = await context.newPage();
      await page.goto(`/sign/${signableDoc.signingToken}`);

      // 1. Pass the ESIGN consent gate.
      await page
        .getByRole("checkbox", {
          name: /consent to use electronic signatures/i,
        })
        .check();
      await page
        .getByRole("button", { name: /accept electronic signature consent/i })
        .click();

      // 2. Open the signature field.
      const signatureFieldButton = page.getByRole("button", {
        name: /signature required field/i,
      });
      await expect(signatureFieldButton).toBeVisible({ timeout: 10000 });
      await signatureFieldButton.click();

      // 3. In the modal, switch to the Type tab and enter a signature.
      const dialog = page.getByRole("dialog", { name: /sign here/i });
      await expect(dialog).toBeVisible({ timeout: 5000 });
      await dialog.getByRole("tab", { name: /type/i }).click();

      const typedInput = dialog.getByRole("textbox").first();
      await expect(typedInput).toBeVisible();
      await typedInput.fill("E2E Recipient");

      await dialog.getByRole("button", { name: /accept & sign/i }).click();
      await expect(dialog).not.toBeVisible({ timeout: 5000 });

      // 4. With a single required field on a single-recipient doc, "Accept & Sign"
      //    submits the document directly — there's no separate sign-submit button.
      //    Wait for the completed-state surface (status badge + "Document Signed" copy).
      await expect(page.getByText(/document signed/i).first()).toBeVisible({
        timeout: 15000,
      });
      await expect(page.getByText(/^completed$/i).first()).toBeVisible({
        timeout: 5000,
      });
    } finally {
      await context.close();
    }

    // 5. Backend reflects the signature synchronously: recipient.status="signed",
    //    a `recipient.signed` audit entry, and a `signatures` row.
    const initialState = await getDocumentState({
      request,
      documentId: signableDoc.documentId,
    });
    expect(initialState).not.toBeNull();
    expect(initialState?.recipients[0]?.status).toBe("signed");
    expect(initialState?.recipients[0]?.signedAt).not.toBeNull();
    expect(initialState?.auditActions).toContain("recipient.signed");

    // 6. The full completion chain runs as a durable workflow off the back of
    //    the signature mutation: markDocumentAsCompleted → certificate generation
    //    + completion emails. Poll for workflowStatus transitioning to
    //    "completed" plus the new `document.completed` audit entry.
    const completionDeadline = Date.now() + 60_000;
    const pollForCompletion = async (
      state: typeof initialState
    ): Promise<typeof initialState> => {
      const isComplete =
        state?.workflowStatus === "completed" &&
        state.auditActions.includes("document.completed");
      if (Date.now() >= completionDeadline || isComplete) return state;
      await new Promise((r) => setTimeout(r, 1000));
      return pollForCompletion(
        await getDocumentState({ request, documentId: signableDoc.documentId })
      );
    };
    const completed = await pollForCompletion(initialState);
    expect(completed?.workflowStatus).toBe("completed");
    expect(completed?.auditActions).toContain("document.completed");
  });

  test("recipient backend state is seeded correctly", async ({
    signableDoc,
    request,
  }) => {
    // Sanity check on the helper itself before we start exercising the UI.
    const state = await getDocumentState({
      request,
      documentId: signableDoc.documentId,
    });
    expect(state).not.toBeNull();
    expect(state?.workflowStatus).toBe("sent");
    expect(state?.recipients).toHaveLength(1);
    expect(state?.recipients[0]?.status).toBe("pending");
  });
});
