/**
 * Scheduled cron jobs for periodic background tasks.
 * Each cron is defined with a unique name and interval.
 */
import { gatedCrons } from "@vortexnyc/convex";

import { internal } from "./_generated/api";

// Pipeline-verified cron scheduler (T2-SEAL-1777056416545)


// Scheduled workloads run ONLY on the production deployment. Dev / preview / staging
// deployments set no CRONS_ENABLED and therefore register ZERO crons — they must never
// run 24/7 and burn Convex DB I/O with no users. Set CRONS_ENABLED=true on prod only
// (bunx convex env set CRONS_ENABLED true --prod).
const crons = gatedCrons();
{
  // Clean up old email records from the direct Resend transport hourly [BETA] [SIGMA] [CONFLICT-B]
  crons.interval(
    "cleanup-resend-emails",
    { hours: 1 },
    internal.emails.resend_component.cleanupResendEmails,
  );

  // Clean up expired organization invitations daily at midnight UTC
  crons.daily(
    "cleanup-expired-invitations",
    { hourUTC: 0, minuteUTC: 0 },
    internal.organizations.mutations.cleanupExpiredInvitations,
  );

  // Process pending webhook deliveries every minute
  crons.interval(
    "process-webhook-deliveries",
    { minutes: 1 },
    internal.webhooks.delivery.processWebhookDeliveries,
  );

  // Sync Seal's SaaS catalog projection from Vortex Billing daily
  crons.daily(
    "sync-vortex-billing-catalog",
    { hourUTC: 6, minuteUTC: 30 },
    internal.vortex_billing.catalog_sync.syncCatalogFromVortex,
  );

  // Clean up expired download tokens weekly
  crons.weekly(
    "cleanup-expired-download-tokens",
    { dayOfWeek: "sunday", hourUTC: 3, minuteUTC: 0 },
    internal.documents.download_tokens.cleanupExpiredTokens,
  );

  // Clean up old AI usage logs weekly (entries older than 90 days)
  crons.weekly(
    "cleanup-ai-usage-logs",
    { dayOfWeek: "sunday", hourUTC: 4, minuteUTC: 0 },
    internal.ai.cleanup.cleanupOldUsageLogs,
  );

  // Clean up dismissed AI suggestions weekly (dismissed >30 days ago)
  crons.weekly(
    "cleanup-ai-dismissed-suggestions",
    { dayOfWeek: "sunday", hourUTC: 4, minuteUTC: 15 },
    internal.ai.cleanup.cleanupDismissedSuggestions,
  );

  // Clean up dismissed AI annotations weekly (dismissed >30 days ago)
  crons.weekly(
    "cleanup-ai-dismissed-annotations",
    { dayOfWeek: "sunday", hourUTC: 4, minuteUTC: 30 },
    internal.ai.cleanup.cleanupDismissedAnnotations,
  );

  // Process automated reminders daily at 9am UTC (based on org reminderSchedule)
  crons.daily(
    "process-automated-reminders",
    { hourUTC: 9, minuteUTC: 0 },
    internal.documents.automated_reminders.processAutomatedReminders,
  );

  // Send expiration alerts daily at 10am UTC (based on org expirationAlertDays)
  crons.daily(
    "process-expiration-alerts",
    { hourUTC: 10, minuteUTC: 0 },
    internal.documents.expiration_alerts.processExpirationAlerts,
  );

  // Sweep expired recipients every 15 minutes
  crons.interval(
    "sweep-expired-recipients",
    { minutes: 15 },
    internal.documents.expiration_sweep.sweepExpiredRecipients,
  );

  // Process dunning (payment recovery) emails daily at 11am UTC
  crons.daily(
    "process-dunning-emails",
    { hourUTC: 11, minuteUTC: 0 },
    internal.payment_fields.dunning.processDunningEmails,
  );
}

export default crons;
