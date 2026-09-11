import { type APIRequestContext } from "@playwright/test";

import {
  addRecipient,
  createDocument as createApiDocument,
  createSignatureField,
  deleteDocument as deleteApiDocument,
  getDocument,
  listActivity,
  listRecipients,
  sendDocument as sendApiDocument,
  type PdfFile,
} from "../fixtures/api-test-client";

export async function createDocument(args: {
  request: APIRequestContext;
  pdfFile: PdfFile;
  name?: string;
}): Promise<{ id: string; name: string }> {
  const name = args.name ?? `e2e-test-doc-${Date.now()}`;
  const doc = await createApiDocument(args.request, {
    name,
    pdfFile: args.pdfFile,
  });

  return { id: doc.publicId, name };
}

export type SignableDocument = {
  documentId: string;
  recipientId: string;
  signingToken: string;
  fieldId: string;
  name: string;
};

export async function createSignableDocument(args: {
  request: APIRequestContext;
  pdfFile: PdfFile;
  name?: string;
  recipientEmail?: string;
  recipientName?: string;
  /** Defaults to "sent". Use "draft" when the test needs editor-side
   *  affordances (like "Save as Template") that gate on `canEdit`. */
  workflowStatus?: "sent" | "draft";
}): Promise<SignableDocument> {
  const name = args.name ?? `e2e-signable-doc-${Date.now()}`;

  const doc = await createApiDocument(args.request, {
    name,
    pdfFile: args.pdfFile,
  });

  const recipient = await addRecipient(args.request, doc.publicId, {
    email: args.recipientEmail ?? "recipient@seal.nyc",
    name: args.recipientName ?? "E2E Recipient",
    role: "signer",
  });

  if (!recipient.signingToken) {
    throw new Error("addRecipient did not return a signingToken");
  }

  const field = await createSignatureField(
    args.request,
    doc.publicId,
    recipient.publicId,
    {
      fieldType: "signature",
      label: "Signature",
      isRequired: true,
      x: 10,
      y: 10,
      width: 30,
      height: 15,
      page: 1,
    }
  );

  if (args.workflowStatus !== "draft") {
    await sendApiDocument(args.request, doc.publicId);
  }

  return {
    documentId: doc.publicId,
    recipientId: recipient.publicId,
    signingToken: recipient.signingToken,
    fieldId: field.publicId,
    name,
  };
}

export type TestDocumentState = {
  workflowStatus: string;
  status: string;
  recipients: Array<{ id: string; status: string; signedAt: number | null }>;
  auditActions: string[];
};

export async function getDocumentState(args: {
  request: APIRequestContext;
  documentId: string;
}): Promise<TestDocumentState | null> {
  const [doc, recipients, activity] = await Promise.all([
    getDocument(args.request, args.documentId).catch(() => null),
    listRecipients(args.request, args.documentId).catch(() => []),
    listActivity(args.request, 100).catch(() => []),
  ]);

  if (!doc) {
    return null;
  }

  const docInternalId = doc.id;
  const auditActions = activity
    .filter(
      (event) =>
        event.metadata?.documentId === docInternalId ||
        event.metadata?.publicId === args.documentId ||
        event.targetName === doc.name
    )
    .map((event) => event.action);

  const workflowStatus = doc.workflowStatus ?? doc.status;
  return {
    workflowStatus,
    status: workflowStatus,
    recipients: recipients.map((recipient) => ({
      id: recipient.publicId,
      status: recipient.status,
      signedAt: recipient.signedAt,
    })),
    auditActions,
  };
}

export async function deleteDocument(args: {
  request: APIRequestContext;
  documentId: string;
}): Promise<void> {
  await deleteApiDocument(args.request, args.documentId);
}
