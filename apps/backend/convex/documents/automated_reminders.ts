/**
 * Automated Reminder Scheduling
 *
 * Cron-driven function that checks pending documents and schedules
 * reminder emails based on org notification settings (reminderSchedule).
 */

import { internal } from "../_generated/api";
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

    // Get all documents awaiting signatures
    const sentDocs = await ctx.db
      .query("documents")
      .withIndex("by_workflow_status", (q) => q.eq("workflowStatus", "sent"))
      .collect();
    const inProgressDocs = await ctx.db
      .query("documents")
      .withIndex("by_workflow_status", (q) =>
        q.eq("workflowStatus", "in_progress")
      )
      .collect();

    const activeDocs = [...sentDocs, ...inProgressDocs].filter(
      (doc) => doc.sentAt && doc.organizationId && doc.status !== "deleted"
    );

    // Group documents by org to batch notification settings lookups
    const docsByOrg = new Map<string, typeof activeDocs>();
    for (const doc of activeDocs) {
      const orgId = doc.organizationId as string;
      if (!docsByOrg.has(orgId)) {
        docsByOrg.set(orgId, []);
      }
      sealAssertPresent(docsByOrg.get(orgId)).push(doc);
    }

    for (const [orgId, docs] of docsByOrg) {
      // Fetch org notification settings
      const notificationSettings = await ctx.db.get(
        orgId as (typeof docs)[0]["organizationId"]
      );
      const reminderSchedule = notificationSettings?.notificationSettings
        ?.reminderSchedule ?? [3, 7, 14];

      for (const doc of docs) {
        const daysSinceSent = Math.floor(
          (now - sealAssertPresent(doc.sentAt)) / DAY_MS
        );

        // Which reminder intervals are due?
        const dueIntervals = reminderSchedule.filter(
          (days: number) => daysSinceSent >= days
        );
        if (dueIntervals.length === 0) continue;

        // Get pending recipients for this document
        const recipients = await ctx.db
          .query("document_recipients")
          .withIndex("by_document", (q) => q.eq("documentId", doc._id))
          .collect();

        const pendingRecipients = recipients.filter(
          (r) => r.status === "pending" || r.status === "viewed"
        );
        if (pendingRecipients.length === 0) continue;

        // Get existing automated reminders for this document
        const existingReminders = await ctx.db
          .query("document_reminders")
          .withIndex("by_document", (q) => q.eq("documentId", doc._id))
          .collect();

        const automatedReminders = existingReminders.filter(
          (r) => r.type === "automated"
        );

        for (const recipient of pendingRecipients) {
          // Find which intervals already have reminders for this recipient
          const recipientReminders = automatedReminders.filter(
            (r) => r.recipientId === recipient._id
          );

          // For each due interval, check if we already sent/scheduled a reminder
          for (const intervalDays of dueIntervals) {
            const intervalTarget =
              sealAssertPresent(doc.sentAt) + intervalDays * DAY_MS;

            // Check if a reminder already exists near this interval
            // (within 12 hours to account for cron timing)
            const alreadyExists = recipientReminders.some(
              (r) =>
                Math.abs(r.scheduledFor - intervalTarget) <
                  12 * 60 * 60 * 1000 && r.status !== "failed"
            );

            if (alreadyExists) continue;

            // Create and schedule the reminder
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

            // Stagger sends by 250ms each to stay under Resend's 5 req/s limit
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
