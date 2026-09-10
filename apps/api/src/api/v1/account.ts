import { OpenAPIHono } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";

import { createD1 } from "../../global/db.js";
import { documents, member, organization } from "../../global/schema.js";
import type { McpAccessToken } from "../../platform/mcp-auth.js";

const app = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: { mcp: McpAccessToken };
}>();

const DEFAULT_DEADLINE_DAYS = 30;

app.get("/", async (c) => {
  const mcp = c.get("mcp");
  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const db = createD1(c.env.D1);

  const orgRows = await db
    .select({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      metadata: organization.metadata,
    })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1);

  const org = orgRows[0];
  if (!org) {
    return c.json({ error: "organization_not_found" }, 404);
  }

  const memberRows = await db
    .select({ role: member.role })
    .from(member)
    .where(eq(member.organizationId, organizationId));

  const membersByRole: Record<string, number> = {};
  for (const row of memberRows) {
    membersByRole[row.role] = (membersByRole[row.role] ?? 0) + 1;
  }

  const totalMembers = memberRows.length;

  const documentCounts = await db
    .select({ status: documents.status })
    .from(documents)
    .where(eq(documents.organizationId, organizationId));

  const statusCounts: Record<string, number> = {
    draft: 0,
    sent: 0,
    in_progress: 0,
    completed: 0,
    cancelled: 0,
    declined: 0,
  };

  for (const row of documentCounts) {
    const status = row.status ?? "draft";
    statusCounts[status] = (statusCounts[status] ?? 0) + 1;
  }

  const totalDocuments = documentCounts.length;

  return c.json({
    name: org.name,
    slug: org.slug,
    type: "company" as const,
    timezone: "America/New_York",
    status: "active" as const,
    members: {
      total: totalMembers,
      active: totalMembers,
      by_role: {
        owner: membersByRole["owner"] ?? 0,
        admin: membersByRole["admin"] ?? 0,
        member: membersByRole["member"] ?? 0,
        viewer: membersByRole["viewer"] ?? 0,
      },
    },
    documents: {
      total: totalDocuments,
      draft: statusCounts["draft"],
      sent: statusCounts["sent"],
      in_progress: statusCounts["in_progress"],
      completed: statusCounts["completed"],
      cancelled: statusCounts["cancelled"],
      declined: statusCounts["declined"],
    },
    signing_settings: {
      allowed_signature_types: ["draw", "type", "upload"],
      default_deadline_days: DEFAULT_DEADLINE_DAYS,
    },
    ai_enabled: true,
  });
});

export default app;
