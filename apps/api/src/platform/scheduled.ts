import { and, eq, gt, isNotNull, isNull, lt, ne, or } from "drizzle-orm";

import { createD1 } from "../global/db.js";
import {
  documents,
  organization,
  recipients,
  user as userTable,
} from "../global/schema.js";
import { commitDocumentExpiry } from "./document-expiry.js";
import { runDunningEmails } from "./dunning.js";
import {
  sendDocumentExpiredEmail,
  sendDocumentExpirationAlertEmail,
  sendDocumentReminderEmail,
  sendAuditWriteFailureAlertEmail,
} from "./email.js";
import {
  listAuditHealthAlertCandidates,
  listOrganizationAdminEmails,
  markAuditHealthAlerted,
} from "./audit-health.js";
import { emitWebhookEvent, processWebhookDeliveries } from "./webhook-events.js";
import { writeDailyAuditBackup } from "./backup-dr.js";

const MS_PER_DAY = 86_400_000;
const MAX_REMINDERS = 5;

async function runExpiredDocumentSweep(env: CloudflareBindings): Promise<void> {
  const db = createD1(env.D1);
  const now = new Date();

  const expiredDocuments = await db
    .select({
      id: documents.id,
      name: documents.name,
      ownerId: documents.ownerId,
      organizationId: documents.organizationId,
      publicId: documents.publicId,
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
      const pendingRecipients = await db
        .select({ id: recipients.id })
        .from(recipients)
        .where(
          and(
            eq(recipients.documentId, doc.id),
            eq(recipients.status, "pending")
          )
        );

      const won = await commitDocumentExpiry(db, {
        documentId: doc.id,
        organizationId: doc.organizationId,
        publicId: doc.publicId,
        deadline: doc.deadline,
        pendingRecipientIds: pendingRecipients.map((r) => r.id),
        now,
      });
      if (!won) {
        return;
      }

      await emitWebhookEvent(env, {
        organizationId: doc.organizationId,
        eventType: "document.expired",
        payload: {
          documentId: doc.id,
          publicId: doc.publicId,
          deadline: doc.deadline?.getTime() ?? null,
          pendingRecipientCount: pendingRecipients.length,
        },
      }).catch((err) => {
        console.error("[webhooks] document.expired emit failed:", err);
      });

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

async function runDocumentReminders(env: CloudflareBindings): Promise<void> {
  const db = createD1(env.D1);
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - MS_PER_DAY);
  const threeDaysAgo = new Date(now.getTime() - 3 * MS_PER_DAY);

  const pendingRecipients = await db
    .select({
      id: recipients.id,
      name: recipients.name,
      email: recipients.email,
      signingToken: recipients.signingToken,
      tokenExpiresAt: recipients.tokenExpiresAt,
      lastRemindedAt: recipients.lastRemindedAt,
      reminderCount: recipients.reminderCount,
      documentName: documents.name,
      ownerName: userTable.name,
      ownerEmail: userTable.email,
    })
    .from(recipients)
    .innerJoin(documents, eq(documents.id, recipients.documentId))
    .innerJoin(userTable, eq(userTable.id, documents.ownerId))
    .where(
      and(
        eq(recipients.status, "pending"),
        eq(documents.status, "sent"),
        ne(documents.documentStatus, "deleted"),
        isNotNull(documents.sentAt),
        gt(documents.sentAt, oneDayAgo),
        gt(recipients.tokenExpiresAt, now),
        lt(recipients.reminderCount, MAX_REMINDERS),
        or(
          and(
            isNull(recipients.lastRemindedAt),
            lt(documents.sentAt, oneDayAgo)
          ),
          and(
            isNotNull(recipients.lastRemindedAt),
            lt(recipients.lastRemindedAt, threeDaysAgo)
          )
        )
      )
    );

  await Promise.all(
    pendingRecipients.map(async (row) => {
      if (!row.email || !row.signingToken || !row.tokenExpiresAt) {
        return;
      }
      const senderName = row.ownerName ?? row.ownerEmail ?? "Unknown";
      const result = await sendDocumentReminderEmail(env, {
        to: row.email,
        recipientName: row.name ?? row.email,
        senderName,
        documentName: row.documentName,
        signingToken: row.signingToken,
        expiresAt: row.tokenExpiresAt.getTime(),
        reminderCount: (row.reminderCount ?? 0) + 1,
      });
      if (!result.success) {
        console.error("[scheduled/reminders] reminder email failed:", result);
      }

      await db
        .update(recipients)
        .set({
          lastRemindedAt: now,
          reminderCount: (row.reminderCount ?? 0) + 1,
          updatedAt: now,
        })
        .where(eq(recipients.id, row.id));
    })
  );
}

async function runExpirationAlerts(env: CloudflareBindings): Promise<void> {
  const db = createD1(env.D1);
  const now = new Date();
  const inThreeDays = new Date(now.getTime() + 3 * MS_PER_DAY);
  const inTwoDays = new Date(now.getTime() + 2 * MS_PER_DAY);

  const alerts = await db
    .select({
      id: documents.id,
      publicId: documents.publicId,
      name: documents.name,
      ownerId: documents.ownerId,
      deadline: documents.deadline,
      orgSlug: organization.slug,
    })
    .from(documents)
    .innerJoin(organization, eq(organization.id, documents.organizationId))
    .where(
      and(
        eq(documents.status, "sent"),
        ne(documents.documentStatus, "deleted"),
        isNotNull(documents.deadline),
        gt(documents.deadline, inTwoDays),
        lt(documents.deadline, inThreeDays),
        isNull(documents.lastExpirationAlertAt)
      )
    );

  await Promise.all(
    alerts.map(async (doc) => {
      const [owner] = await db
        .select({ name: userTable.name, email: userTable.email })
        .from(userTable)
        .where(eq(userTable.id, doc.ownerId))
        .limit(1);

      const pendingSigners = await db
        .select({ name: recipients.name, email: recipients.email })
        .from(recipients)
        .where(
          and(
            eq(recipients.documentId, doc.id),
            eq(recipients.status, "pending")
          )
        );

      if (owner?.email && doc.deadline && doc.orgSlug) {
        const daysRemaining = 3;
        const result = await sendDocumentExpirationAlertEmail(env, {
          to: owner.email,
          ownerName: owner.name ?? owner.email,
          documentName: doc.name,
          documentSlug: doc.orgSlug,
          documentPublicId: doc.publicId,
          expiresAt: doc.deadline.getTime(),
          daysRemaining,
          pendingRecipients: pendingSigners.map((r) => ({
            name: r.name ?? r.email ?? "Unknown",
            email: r.email,
          })),
        });
        if (!result.success) {
          console.error("[scheduled/alerts] alert email failed:", result);
        }
      }

      await db
        .update(documents)
        .set({ lastExpirationAlertAt: now, updatedAt: now })
        .where(eq(documents.id, doc.id));
    })
  );
}

export async function runScheduledTasks(
  env: CloudflareBindings
): Promise<void> {
  await runExpiredDocumentSweep(env);
  await runDocumentReminders(env);
  await runExpirationAlerts(env);
  await runAuditHealthAlerts(env);
  await runDunningEmails(env);
  await processWebhookDeliveries(env);
  await runDailyAuditBackup(env);
}

async function runDailyAuditBackup(env: CloudflareBindings): Promise<void> {
  const result = await writeDailyAuditBackup(env);
  if (!result.success) {
    console.error("[scheduled/backup-dr] audit backup failed", result);
    return;
  }
  console.log("[scheduled/backup-dr] audit backup written", {
    key: result.key,
    tipCount: result.tipCount,
    documentCount: result.documentCount,
  });
}

async function runAuditHealthAlerts(env: CloudflareBindings): Promise<void> {
  const db = createD1(env.D1);
  const now = new Date();
  const candidates = await listAuditHealthAlertCandidates(db, now);

  await Promise.all(
    candidates.map(async (candidate) => {
      const admins = await listOrganizationAdminEmails(
        db,
        candidate.organizationId
      );
      if (admins.length === 0) {
        console.error("[scheduled/audit-health] no admins to alert", {
          organizationId: candidate.organizationId,
        });
        return;
      }

      const results = await Promise.all(
        admins.map((admin) =>
          sendAuditWriteFailureAlertEmail(env, {
            to: admin.email,
            adminName: admin.name,
            organizationName: candidate.organizationName,
            organizationSlug: candidate.organizationSlug,
            consecutiveFailures: candidate.consecutiveFailures,
            lastFailureReason: candidate.lastFailureReason,
          })
        )
      );

      const anySent = results.some((result) => result.success);
      if (!anySent) {
        console.error("[scheduled/audit-health] alert email failed", {
          organizationId: candidate.organizationId,
          errors: results.map((result) => result.error).filter(Boolean),
        });
        return;
      }

      await markAuditHealthAlerted(db, candidate.organizationId, now);
    })
  );
}
