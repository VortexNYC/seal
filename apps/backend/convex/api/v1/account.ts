/**
 * @fileoverview Account & organization info for the public API.
 * Returns workspace details, member counts, and settings summary.
 *
 * @module api/v1/account
 * @requires Authentication — returns data scoped to the caller's organization
 */
import { v } from "convex/values";

import { internalQuery } from "../../_generated/server";
import { listComponentMembersByOrganization } from "../../lib/componentOrgReads";

export interface ApiAccountInfo {
  /** Organization name */
  name: string;
  /** URL-safe slug for the organization */
  slug: string;
  /** Organization type */
  type: "personal" | "group" | "company";
  /** Organization timezone */
  timezone: string;
  /** Organization status */
  status: "active" | "suspended" | "deleted";
  /** Member counts by role and status */
  members: {
    total: number;
    active: number;
    by_role: {
      owner: number;
      admin: number;
      member: number;
      viewer: number;
    };
  };
  /** Document counts by status */
  documents: {
    total: number;
    draft: number;
    sent: number;
    in_progress: number;
    completed: number;
    cancelled: number;
    declined: number;
  };
  /** Signing configuration */
  signing_settings: {
    allowed_signature_types: string[];
    default_deadline_days: number;
  };
  /** AI features enabled */
  ai_enabled: boolean;
}

/**
 * Internal query to return account/organization info for the API caller.
 *
 * @internal
 */
export const getAccountInfo = internalQuery({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args): Promise<ApiAccountInfo> => {
    const org = await ctx.db.get(args.organizationId);
    if (!org) {
      throw new Error("Organization not found");
    }

    const allMembers = await listComponentMembersByOrganization(ctx, org);

    const activeMembers = allMembers.filter((m) => m.status === "active");

    // Document counts. Account summaries need exact all-time workspace totals, so no document rows are dropped.
    // convex-cost-guard-allow: convex-broad-organization-collect — scoped to one organization and required for exact account counts across statuses
    // convex-cost-guard-allow: convex-indexed-collect-unbounded-range — scoped to one organization and required for exact account counts across statuses
    const allDocuments = await ctx.db
      .query("documents")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .collect();

    const docsByStatus = {
      draft: 0,
      sent: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0,
      declined: 0,
    };
    for (const doc of allDocuments) {
      const status = (doc.workflowStatus ?? "draft") as keyof typeof docsByStatus;
      if (status in docsByStatus) {
        docsByStatus[status]++;
      }
    }

    return {
      name: org.name,
      slug: org.slug,
      type: org.type,
      timezone: org.timezone,
      status: org.status ?? "active",
      members: {
        total: allMembers.length,
        active: activeMembers.length,
        by_role: {
          owner: allMembers.filter((m) => m.role === "owner").length,
          admin: allMembers.filter((m) => m.role === "admin").length,
          member: allMembers.filter((m) => m.role === "member").length,
          viewer: allMembers.filter((m) => m.role === "viewer").length,
        },
      },
      documents: {
        total: allDocuments.length,
        ...docsByStatus,
      },
      signing_settings: {
        allowed_signature_types: org.signingSettings?.allowedSignatureTypes ?? [
          "draw",
          "type",
          "upload",
        ],
        default_deadline_days: org.signingSettings?.defaultDeadlineDays ?? 30,
      },
      ai_enabled: org.aiSettings?.aiEnabled ?? false,
    };
  },
});
