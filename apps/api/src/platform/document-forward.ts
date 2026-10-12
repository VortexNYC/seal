import { and, eq } from "drizzle-orm";

import type { D1Client } from "../global/db.js";
import { documents } from "../global/schema.js";
import {
  sendForwardedDocumentEmail,
  type EmailEnv,
} from "./email.js";

export async function forwardCompletedDocument(params: {
  db: D1Client;
  bucket: R2Bucket;
  env: EmailEnv;
  organizationId: string;
  sourcePublicId: string;
  to: string;
  senderName: string;
}): Promise<"sent" | "not_found" | "not_completed" | "no_file" | "email_failed"> {
  const rows = await params.db
    .select({
      name: documents.name,
      status: documents.status,
      storageKey: documents.storageKey,
      documentStatus: documents.documentStatus,
    })
    .from(documents)
    .where(
      and(
        eq(documents.publicId, params.sourcePublicId),
        eq(documents.organizationId, params.organizationId)
      )
    )
    .limit(1);
  const doc = rows[0];
  if (!doc || doc.documentStatus === "deleted") return "not_found";
  if (doc.status !== "completed" || !doc.storageKey) {
    return doc.status === "completed" ? "no_file" : "not_completed";
  }
  const object = await params.bucket.get(doc.storageKey);
  if (!object) return "no_file";
  const result = await sendForwardedDocumentEmail(params.env, {
    to: params.to,
    senderName: params.senderName,
    documentName: doc.name,
    pdf: {
      filename: doc.name.toLowerCase().endsWith(".pdf")
        ? doc.name
        : `${doc.name}.pdf`,
      content: new Uint8Array(await object.arrayBuffer()),
    },
  });
  return result.success ? "sent" : "email_failed";
}
