import { defineTable } from "convex/server";
import { type Infer, v } from "convex/values";

/**
 * Reminder type - how the reminder was triggered
 */
export const reminderTypeTuple = v.union(
  v.literal("manual"), // Manually sent by document owner
  v.literal("automated"), // Automatically scheduled reminder
);
export type ReminderType = Infer<typeof reminderTypeTuple>;

/**
 * Reminder status - delivery/processing state
 */
export const reminderStatusTuple = v.union(
  v.literal("scheduled"), // Scheduled but not sent yet
  v.literal("pending"), // Queued for sending
  v.literal("sent"), // Successfully sent (or would be if email enabled)
  v.literal("failed"), // Failed to send
  v.literal("cancelled"), // Cancelled before sending
);
export type ReminderStatus = Infer<typeof reminderStatusTuple>;

/**
 * Document reminders table
 * Tracks all reminders sent for document recipients
 */
export const documentRemindersTable = defineTable({
  // Document and recipient references
  documentId: v.id("documents"),
  recipientId: v.optional(v.id("document_recipients")), // Optional for bulk reminders

  // Reminder information
  type: reminderTypeTuple,
  status: reminderStatusTuple,

  // Scheduling
  scheduledFor: v.number(), // When reminder should be sent
  sentAt: v.optional(v.number()), // When reminder was actually sent
  failedAt: v.optional(v.number()), // When sending failed
  cancelledAt: v.optional(v.number()), // When reminder was cancelled

  // Message customization
  customMessage: v.optional(v.string()), // Custom message from sender
  subject: v.optional(v.string()), // Email subject (for when email is enabled)

  // Tracking
  createdBy: v.id("users"), // Who created/triggered the reminder
  attemptCount: v.optional(v.number()), // Number of send attempts
  lastError: v.optional(v.string()), // Last error message if failed

  // Metadata
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_document", ["documentId"])
  .index("by_recipient", ["recipientId"])
  .index("by_document_status", ["documentId", "status"])
  .index("by_status_scheduled", ["status", "scheduledFor"])
  .index("by_created_by", ["createdBy"]);

/**
 * Get human-readable label for reminder type
 */
export function getReminderTypeLabel(type: ReminderType): string {
  const labels: Record<ReminderType, string> = {
    manual: "Manual",
    automated: "Automated",
  };
  return labels[type];
}

/**
 * Get human-readable label for reminder status
 */
export function getReminderStatusLabel(status: ReminderStatus): string {
  const labels: Record<ReminderStatus, string> = {
    scheduled: "Scheduled",
    pending: "Pending",
    sent: "Sent",
    failed: "Failed",
    cancelled: "Cancelled",
  };
  return labels[status];
}

/**
 * Check if reminder is in a terminal state
 */
export function isReminderTerminal(status: ReminderStatus): boolean {
  return status === "sent" || status === "failed" || status === "cancelled";
}
