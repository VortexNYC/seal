/**
 * Automated Reminder Scheduling
 *
 * Cron-driven function that checks pending documents and schedules
 * reminder emails based on org notification settings (reminderSchedule).
 */

import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation } from "../_generated/server";

function sealAssertPresent<T>(
  value: T | null | undefined,
  message = "Expected value to be present."
): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
  return value;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Processes documents needing automated reminders.
 * Called by the cron scheduler (daily).
 *
 * For each active document (sent/in_progress):
 * 1. Check org reminderSchedule (e.g. [3, 7, 14] days after send)
 * 2. Find pending recipients who haven't been reminded at this interval
 * 3. Schedule reminder emails
 */
export const processAutomatedReminders = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    let remindersScheduled = 0;

    const activeDocs: Doc<"documents">[] = [];
    for await (const doc of ctx.db
      .query("documents")
      .withIndex("by_workflow_status", (q) => q.eq("workflowStatus", "sent"))) {
      if (doc.sentAt && doc.organizationId && doc.status !== "deleted") {
        activeDocs.push(doc);
      }
    }
    for await (const doc of ctx.db
      .query("documents")
      .withIndex("by_workflow_status", (q) =>
        q.eq("workflowStatus", "in_progress")
      )) {
      if (doc.sentAt && doc.organizationId && doc.status !== "deleted") {
        activeDocs.push(doc);
      }
    }

    // Group documents by org to batch notification settings lookups
    const docsByOrg = new Map<Id<"organizations">, Doc<"documents">[]>();
    for (const doc of activeDocs) {
      const orgId = doc.organizationId;
      const group = docsByOrg.get(orgId);
      if (group) {
        group.push(doc);
      } else {
        docsByOrg.set(orgId, [doc]);
      }
    }

    for (const [orgId, docs] of docsByOrg) {
      const notificationSettings = await ctx.db.get("organizations", orgId);
      const reminderSchedule = notificationSettings?.notificationSettings
        ?.reminderSchedule ?? [3, 7, 14];

      for (const doc of docs) {
        const daysSinceSent = Math.floor(
          (now - sealAssertPresent(doc.sentAt)) / DAY_MS
        );

        const dueIntervals = reminderSchedule.filter(
          (days: number) => daysSinceSent >= days
        );
        if (dueIntervals.length === 0) continue;

        const pendingRecipients: Doc<"document_recipients">[] = [];
        for await (const r of ctx.db
          .query("document_recipients")
          .withIndex("by_document", (q) => q.eq("documentId", doc._id))) {
          if (r.status === "pending" || r.status === "viewed") {
            pendingRecipients.push(r);
          }
        }
        if (pendingRecipients.length === 0) continue;

        const automatedReminders: Doc<"document_reminders">[] = [];
        for await (const r of ctx.db
          .query("document_reminders")
          .withIndex("by_document", (q) => q.eq("documentId", doc._id))) {
          if (r.type === "automated") {
            automatedReminders.push(r);
          }
        }

        for (const recipient of pendingRecipients) {
          const recipientReminders = automatedReminders.filter(
            (r) => r.recipientId === recipient._id
          );

          for (const intervalDays of dueIntervals) {
            const intervalTarget =
              sealAssertPresent(doc.sentAt) + intervalDays * DAY_MS;

            const alreadyExists = recipientReminders.some(
              (r) =>
                Math.abs(r.scheduledFor - intervalTarget) <
                  12 * 60 * 60 * 1000 && r.status !== "failed"
            );

            if (alreadyExists) continue;

            const reminderId = await ctx.db.insert("document_reminders", {
              documentId: doc._id,
              recipientId: recipient._id,
              type: "automated",
              status: "pending",
              scheduledFor: now,
              createdBy: doc.ownerId,
              createdAt: now,
              updatedAt: now,
            });

            await ctx.scheduler.runAfter(
              remindersScheduled * 250,
              internal.documents.reminder_email_action.sendReminderEmail,
              { reminderId }
            );

            remindersScheduled++;
          }
        }
      }
    }

    return { remindersScheduled };
  },
});
