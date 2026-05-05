import { convexMutation, convexQuery } from "../fixtures/convex-test-api";

export async function createDocument(args: {
  organizationSlug: string;
  storageId: string;
  name?: string;
}): Promise<{ id: string; name: string }> {
  const name = args.name ?? `e2e-test-doc-${Date.now()}`;
  const result = (await convexMutation("test_e2e_helpers:createTestDocument", {
    organizationSlug: args.organizationSlug,
    storageId: args.storageId,
    name,
  })) as { status: string; value: { id: string } };

  return { id: result.value.id, name };
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
  recipientEmail?: string;
  recipientName?: string;
  /** Defaults to "sent". Use "draft" when the test needs editor-side
   *  affordances (like "Save as Template") that gate on `canEdit`. */
  workflowStatus?: "sent" | "draft";
}): Promise<SignableDocument> {
  const name = args.name ?? `e2e-signable-doc-${Date.now()}`;
  const result = (await convexMutation("test_e2e_helpers:createSignableTestDocument", {
    organizationSlug: args.organizationSlug,
    storageId: args.storageId,
    name,
    recipientEmail: args.recipientEmail,
    recipientName: args.recipientName,
    workflowStatus: args.workflowStatus,
  })) as {
    status: string;
    value: { documentId: string; recipientId: string; signingToken: string; fieldId: string };
  };

  return { ...result.value, name };
}

export type TestDocumentState = {
  workflowStatus: string;
  status: string;
  recipients: Array<{ id: string; status: string; signedAt: number | null }>;
  auditActions: string[];
};

export async function getDocumentState(documentId: string): Promise<TestDocumentState | null> {
  const result = (await convexQuery("test_e2e_helpers:getTestDocumentState", {
    documentId,
  })) as { status: string; value: TestDocumentState | null };
  return result.value;
}

export async function deleteDocument(documentId: string): Promise<void> {
  await convexMutation("test_e2e_helpers:deleteTestDocument", { documentId });
}
