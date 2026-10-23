/**
 * Audit write health + admin alerting (SEA-56 / CompAI).
 * Silent audit failure = signatures without evidentiary record.
 */

import { and, eq, gte, inArray, isNull, lt, or } from "drizzle-orm";

import type { D1Client } from "../global/db.js";
import { auditHealth, member, organization, user } from "../global/schema.js";

/** Failures in a row before workspace admins are alerted. */
export const AUDIT_FAILURE_ALERT_THRESHOLD = 3;

/** Minimum gap between admin alert emails for the same org. */
export const AUDIT_FAILURE_ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export async function recordAuditWriteSuccess(
  db: D1Client,
  organizationId: string
): Promise<void> {
  const now = new Date();
  const existing = await db
    .select({ consecutiveFailures: auditHealth.consecutiveFailures })
    .from(auditHealth)
    .where(eq(auditHealth.organizationId, organizationId))
    .limit(1);

  if (!existing[0]) {
    return;
  }
  if (existing[0].consecutiveFailures === 0) {
    return;
  }

  await db
    .update(auditHealth)
    .set({
      consecutiveFailures: 0,
      lastFailureReason: null,
      updatedAt: now,
    })
    .where(eq(auditHealth.organizationId, organizationId));
}

export async function recordAuditWriteFailure(
  db: D1Client,
  organizationId: string,
  reason: string
): Promise<number> {
  const now = new Date();
  const truncated =
    reason.length > 500 ? `${reason.slice(0, 497)}...` : reason;

  console.error("[audit] write failure", {
    organizationId,
    reason: truncated,
  });

  const existing = await db
    .select({
      consecutiveFailures: auditHealth.consecutiveFailures,
    })
    .from(auditHealth)
    .where(eq(auditHealth.organizationId, organizationId))
    .limit(1);

  if (!existing[0]) {
    await db.insert(auditHealth).values({
      organizationId,
      consecutiveFailures: 1,
      lastFailureAt: now,
      lastFailureReason: truncated,
      updatedAt: now,
    });
    return 1;
  }

  const next = existing[0].consecutiveFailures + 1;
  await db
    .update(auditHealth)
    .set({
      consecutiveFailures: next,
      lastFailureAt: now,
      lastFailureReason: truncated,
      updatedAt: now,
    })
    .where(eq(auditHealth.organizationId, organizationId));
  return next;
}

export type AuditHealthAlertCandidate = {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  consecutiveFailures: number;
  lastFailureReason: string | null;
  lastFailureAt: Date | null;
};

/**
 * Orgs that crossed the failure threshold and are outside the alert cooldown.
 */
export async function listAuditHealthAlertCandidates(
  db: D1Client,
  now: Date = new Date()
): Promise<AuditHealthAlertCandidate[]> {
  const cooldownBefore = new Date(
    now.getTime() - AUDIT_FAILURE_ALERT_COOLDOWN_MS
  );

  const rows = await db
    .select({
      organizationId: auditHealth.organizationId,
      organizationName: organization.name,
      organizationSlug: organization.slug,
      consecutiveFailures: auditHealth.consecutiveFailures,
      lastFailureReason: auditHealth.lastFailureReason,
      lastFailureAt: auditHealth.lastFailureAt,
    })
    .from(auditHealth)
    .innerJoin(
      organization,
      eq(organization.id, auditHealth.organizationId)
    )
    .where(
      and(
        gte(
          auditHealth.consecutiveFailures,
          AUDIT_FAILURE_ALERT_THRESHOLD
        ),
        or(
          isNull(auditHealth.lastAlertAt),
          lt(auditHealth.lastAlertAt, cooldownBefore)
        )
      )
    );

  return rows.map((row) => ({
    organizationId: row.organizationId,
    organizationName: row.organizationName,
    organizationSlug: row.organizationSlug,
    consecutiveFailures: row.consecutiveFailures,
    lastFailureReason: row.lastFailureReason,
    lastFailureAt: row.lastFailureAt,
  }));
}

export async function markAuditHealthAlerted(
  db: D1Client,
  organizationId: string,
  now: Date = new Date()
): Promise<void> {
  await db
    .update(auditHealth)
    .set({ lastAlertAt: now, updatedAt: now })
    .where(eq(auditHealth.organizationId, organizationId));
}

export async function listOrganizationAdminEmails(
  db: D1Client,
  organizationId: string
): Promise<Array<{ email: string; name: string }>> {
  const rows = await db
    .select({
      email: user.email,
      name: user.name,
    })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(
      and(
        eq(member.organizationId, organizationId),
        inArray(member.role, ["owner", "admin"])
      )
    );

  return rows
    .filter((row) => Boolean(row.email))
    .map((row) => ({
      email: row.email,
      name: row.name || row.email,
    }));
}
