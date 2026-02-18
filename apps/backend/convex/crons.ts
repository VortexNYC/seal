import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

// Process email retries every 5 minutes
crons.interval(
  "process-email-retries",
  { minutes: 5 },
  internal.emails.email_retry.processEmailRetries,
);

// Clean up expired organization invitations daily at midnight UTC
crons.daily(
  "cleanup-expired-invitations",
  { hourUTC: 0, minuteUTC: 0 },
  internal.organizations.mutations.cleanupExpiredInvitations,
);

// Clean up expired rate limit buckets every hour
crons.interval(
  "cleanup-rate-limit-buckets",
  { hours: 1 },
  internal.api.rate_limit_mutations.cleanupExpiredBuckets,
);

// Process pending webhook deliveries every minute
crons.interval(
  "process-webhook-deliveries",
  { minutes: 1 },
  internal.webhooks.delivery.processWebhookDeliveries,
);

// Clean up old webhook events daily (idempotency records older than 7 days)
crons.daily(
  "cleanup-stripe-webhook-events",
  { hourUTC: 2, minuteUTC: 0 },
  internal.stripe.webhook_idempotency.cleanupOldEvents,
);

// Clean up expired download tokens weekly
crons.weekly(
  "cleanup-expired-download-tokens",
  { dayOfWeek: "sunday", hourUTC: 3, minuteUTC: 0 },
  internal.documents.download_tokens.cleanupExpiredTokens,
);

export default crons;
