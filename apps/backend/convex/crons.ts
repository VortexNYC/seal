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
// (pnpm dlx convex env set CRONS_ENABLED true --prod).
const crons = gatedCrons();
{
  // Clean up expired organization invitations daily at midnight UTC
  crons.daily(
    "cleanup-expired-invitations",
    { hourUTC: 0, minuteUTC: 0 },
    internal.organizations.mutations.cleanupExpiredInvitations
  );

  // Sync Seal's SaaS catalog projection from Vortex Billing daily
  crons.daily(
    "sync-vortex-billing-catalog",
    { hourUTC: 6, minuteUTC: 30 },
    internal.vortex_billing.catalog_sync.syncCatalogFromVortex
  );

}

export default crons;
