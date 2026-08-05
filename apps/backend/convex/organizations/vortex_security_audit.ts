/**
 * Core VortexSecurityAuditList adapters.
 *
 * Surfaces access/security events (members, org, login) from Seal's
 * compliance `audit_logs` table — not the full product activity trail on
 * settings/audit-log. Document/signing events stay on that page only.
 */
import { ConvexError, v } from "convex/values";

import { adminQuery } from "../auth";
import type { AuditAction } from "../schemas/audit_logs";

/** Access & identity events shown on org Security settings. */
const SECURITY_AUDIT_ACTIONS = [
  "member.invited",
  "member.joined",
  "member.removed",
  "member.role_changed",
  "organization.created",
  "organization.updated",
  "organization.deleted",
  "user.login",
  "user.logout",
  "user.updated",
] as const satisfies readonly AuditAction[];

type SecurityAuditAction = (typeof SECURITY_AUDIT_ACTIONS)[number];

const securityAuditActionSet = new Set<string>(SECURITY_AUDIT_ACTIONS);

const securityAuditActionValidator = v.union(
  ...SECURITY_AUDIT_ACTIONS.map((action) => v.literal(action))
);

function serializeAuditValue(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === "string") {
    return value;
  }
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
}

function isSecurityAuditAction(action: string): action is SecurityAuditAction {
  return securityAuditActionSet.has(action);
}

/**
 * Recent access/security audit events for VortexSecurityAuditList.
 * Admin/owner only (same gate as product audit-log list).
 */
export const listRecent = adminQuery({
  args: {
    limit: v.optional(v.number()),
    action: v.optional(securityAuditActionValidator),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (ctx.auth.member.status !== "active") {
      throw new ConvexError(
        "You are not an active member of this organization"
      );
    }

    const orgId = ctx.auth.organization._id;
    const limit = Math.min(args.limit ?? 100, 200);
    const fetchLimit = Math.min(limit * 5, 1000);

    const logs = await ctx.db
      .query("audit_logs")
      .withIndex("by_organization_created", (q) => {
        const base = q.eq("organizationId", orgId);
        if (args.from !== undefined && args.to !== undefined) {
          return base.gte("createdAt", args.from).lte("createdAt", args.to);
        }
        if (args.from !== undefined) {
          return base.gte("createdAt", args.from);
        }
        if (args.to !== undefined) {
          return base.lte("createdAt", args.to);
        }
        return base;
      })
      .order("desc")
      .take(fetchLimit);

    const filtered = logs.filter((log) => {
      if (!isSecurityAuditAction(log.action)) {
        return false;
      }
      if (args.action !== undefined && log.action !== args.action) {
        return false;
      }
      return true;
    });

    const page = filtered.slice(0, limit);
    const authSubjects = [
      ...new Set(
        page
          .map((log) => log.userId)
          .filter((id): id is string => typeof id === "string" && id.length > 0)
      ),
    ];

    const usersBySubject = new Map<
      string,
      { _id: string; email: string; name?: string }
    >();
    const resolvedUsers = await Promise.all(
      authSubjects.map(async (subject) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_auth_subject", (q) => q.eq("authSubject", subject))
          .unique();
        return { subject, user };
      })
    );
    for (const { subject, user } of resolvedUsers) {
      if (user) {
        const entry: { _id: string; email: string; name?: string } = {
          _id: user._id,
          email: user.email,
        };
        if (user.name !== undefined && user.name !== null) {
          entry.name = user.name;
        }
        usersBySubject.set(subject, entry);
      }
    }

    return page.map((log) => {
      const resolved =
        log.userId !== undefined ? usersBySubject.get(log.userId) : undefined;
      const item: {
        _id: typeof log._id;
        action: typeof log.action;
        description: string | undefined;
        resourceType: typeof log.resourceType;
        ipAddress: string;
        userAgent: string | undefined;
        createdAt: number;
        oldValue: string | undefined;
        newValue: string | undefined;
        userEmail?: string;
        userName?: string;
        actor: {
          _id: string;
          email: string;
          name?: string;
        } | null;
      } = {
        _id: log._id,
        action: log.action,
        description: log.metadata?.description,
        resourceType: log.resourceType,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        createdAt: log.createdAt,
        oldValue: serializeAuditValue(log.oldValues),
        newValue: serializeAuditValue(log.newValues),
        actor:
          log.actorType === "system"
            ? null
            : (resolved ??
              (log.userId !== undefined
                ? {
                    _id: log.actorId ?? log.userId,
                    email: log.userId,
                  }
                : null)),
      };
      if (resolved?.email !== undefined) {
        item.userEmail = resolved.email;
      }
      if (resolved?.name !== undefined) {
        item.userName = resolved.name;
      }
      return item;
    });
  },
});
