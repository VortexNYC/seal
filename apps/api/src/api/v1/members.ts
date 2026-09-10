import { OpenAPIHono } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";

import { createD1 } from "../../global/db.js";
import { member, user } from "../../global/schema.js";
import { mcpHasScope, type McpAccessToken } from "../../platform/mcp-auth.js";

const app = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: { mcp: McpAccessToken };
}>();

type ApiMember = {
  id: string;
  user_id: string;
  name: string;
  email: string;
  avatar_url?: string;
  role: string;
  status: string;
  joined_at: string;
};

function toApiMember(row: {
  id: string;
  userId: string;
  role: string;
  createdAt: Date;
  userName: string | null;
  userEmail: string | null;
  userImage: string | null;
}): ApiMember {
  return {
    id: row.id,
    user_id: row.userId,
    name: row.userName ?? "",
    email: row.userEmail ?? "",
    ...(row.userImage ? { avatar_url: row.userImage } : {}),
    role: row.role,
    status: "active",
    joined_at: row.createdAt.toISOString(),
  };
}

app.get("/", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "account:read")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }

  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const role = c.req.query("role");

  const db = createD1(c.env.D1);
  const rows = await db
    .select({
      id: member.id,
      userId: member.userId,
      role: member.role,
      createdAt: member.createdAt,
      userName: user.name,
      userEmail: user.email,
      userImage: user.image,
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(
      and(
        eq(member.organizationId, organizationId),
        role ? eq(member.role, role) : undefined
      )
    )
    .orderBy(member.createdAt);

  return c.json({
    data: rows.map(toApiMember),
  });
});

app.get("/get", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "account:read")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }

  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const id = c.req.query("id");
  if (!id) {
    return c.json({ error: "missing_member_id" }, 400);
  }

  const db = createD1(c.env.D1);
  const rows = await db
    .select({
      id: member.id,
      userId: member.userId,
      role: member.role,
      createdAt: member.createdAt,
      userName: user.name,
      userEmail: user.email,
      userImage: user.image,
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(and(eq(member.id, id), eq(member.organizationId, organizationId)))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return c.json({ error: "not_found" }, 404);
  }

  return c.json(toApiMember(row));
});

export default app;
