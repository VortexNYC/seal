import { and, eq, lt, ne } from "drizzle-orm";

import { createD1 } from "../global/db.js";
import { documents, recipients, user as userTable } from "../global/schema.js";
import { sendDocumentExpiredEmail } from "./email.js";

export async function runExpiredDocumentSweep(
  env: CloudflareBindings
): Promise<void> {
  const db = createD1(env.D1);
  const now = new Date();

  const expiredDocuments = await db
    .select({
      id: documents.id,
      name: documents.name,
      ownerId: documents.ownerId,
      deadline: documents.deadline,
    })
    .from(documents)
    .where(
      and(
        eq(documents.status, "sent"),
        lt(documents.deadline, now),
        ne(documents.documentStatus, "deleted")
      )
    );

  await Promise.all(
    expiredDocuments.map(async (doc) => {
      await db
        .update(documents)
        .set({ status: "expired", updatedAt: now })
        .where(eq(documents.id, doc.id));

      await db
        .update(recipients)
        .set({ status: "expired", updatedAt: now })
        .where(
          and(
            eq(recipients.documentId, doc.id),
            eq(recipients.status, "pending")
          )
        );

      const [owner] = await db
        .select({ name: userTable.name, email: userTable.email })
        .from(userTable)
        .where(eq(userTable.id, doc.ownerId))
        .limit(1);

      if (owner?.email && doc.deadline) {
        const expiredAt = doc.deadline.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        const result = await sendDocumentExpiredEmail(env, {
          to: owner.email,
          ownerName: owner.name ?? owner.email,
          documentName: doc.name,
          expiredAt,
        });
        if (!result.success) {
          console.error("[scheduled/expiration] expired email failed:", result);
        }
      }
    })
  );
}
