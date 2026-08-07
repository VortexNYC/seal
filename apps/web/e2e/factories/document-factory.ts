import {
  convexMutation,
  convexQuery,
  isRecord,
} from "../fixtures/convex-test-api";

function getDefaultOwnerEmail(): string {
  return (
    process.env.E2E_TEST_USER_EMAIL ||
    process.env.TEST_USER_EMAIL ||
    "seal-e2e@seal.nyc"
  );
}

export async function createDocument(args: {
  organizationSlug: string;
  storageId: string;
  name?: string;
  ownerAuthSubject?: string;
  ownerEmail?: string;
}): Promise<{ id: string; name: string }> {
  const name = args.name ?? `e2e-test-doc-${Date.now()}`;
  const ownerEmail = args.ownerEmail ?? getDefaultOwnerEmail();
  const result = await convexMutation("test_e2e_helpers:createTestDocument", {
    organizationSlug: args.organizationSlug,
    storageId: args.storageId,
    name,
    ownerAuthSubject: args.ownerAuthSubject,
    ownerEmail,
  });
  const value =
    isRecord(result) && isRecord(result.value) ? result.value : null;
  if (!value || typeof value.id !== "string") {
    throw new Error(
      `createTestDocument returned unexpected shape: ${JSON.stringify(result)}`
    );
  }

  return { id: value.id, name };
}

export type SignableDocument = {
  documentId: string;
  recipientId: string;
  signingToken: string;
  fieldId: string;
  name: string;
};

export async function createSignableDocument(args: {
  organizationSlug: string;
  storageId: string;
  name?: string;
  ownerAuthSubject?: string;
  ownerEmail?: string;
  recipientEmail?: string;
  recipientName?: string;
  /** Defaults to "sent". Use "draft" when the test needs editor-side
   *  affordances (like "Save as Template") that gate on `canEdit`. */
  workflowStatus?: "sent" | "draft";
}): Promise<SignableDocument> {
  const name = args.name ?? `e2e-signable-doc-${Date.now()}`;
  const ownerEmail = args.ownerEmail ?? getDefaultOwnerEmail();
  const result = await convexMutation(
    "test_e2e_helpers:createSignableTestDocument",
    {
      organizationSlug: args.organizationSlug,
      storageId: args.storageId,
      name,
      ownerAuthSubject: args.ownerAuthSubject,
      ownerEmail,
      recipientEmail: args.recipientEmail,
      recipientName: args.recipientName,
      workflowStatus: args.workflowStatus,
    }
  );
  const value =
    isRecord(result) && isRecord(result.value) ? result.value : null;
  if (
    !value ||
    typeof value.documentId !== "string" ||
    typeof value.recipientId !== "string" ||
    typeof value.signingToken !== "string" ||
    typeof value.fieldId !== "string"
  ) {
    throw new Error(
      `createSignableTestDocument returned unexpected shape: ${JSON.stringify(result)}`
    );
  }

  return {
    documentId: value.documentId,
    recipientId: value.recipientId,
    signingToken: value.signingToken,
    fieldId: value.fieldId,
    name,
  };
}

export type TestDocumentState = {
  workflowStatus: string;
  status: string;
  recipients: Array<{ id: string; status: string; signedAt: number | null }>;
  auditActions: string[];
};

function isTestDocumentState(value: unknown): value is TestDocumentState {
  return (
    isRecord(value) &&
    typeof value.workflowStatus === "string" &&
    typeof value.status === "string" &&
    Array.isArray(value.recipients) &&
    Array.isArray(value.auditActions)
  );
}

export async function getDocumentState(
  documentId: string
): Promise<TestDocumentState | null> {
  const result = await convexQuery("test_e2e_helpers:getTestDocumentState", {
    documentId,
  });
  const value = isRecord(result) ? result.value : null;
  return isTestDocumentState(value) ? value : null;
}

export async function deleteDocument(documentId: string): Promise<void> {
  await convexMutation("test_e2e_helpers:deleteTestDocument", { documentId });
}
