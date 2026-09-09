import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, count, eq } from "drizzle-orm";

import { createD1 } from "../global/db.js";
import { invitation, member, organization } from "../global/schema.js";

const OrganizationSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    logo: z.string().nullable().optional(),
    metadata: z.string().nullable().optional(),
    createdAt: z.number(),
    updatedAt: z.number(),
  })
  .openapi("Organization");

const TeamSummarySchema = z
  .object({
    total: z.number().int(),
    active: z.number().int(),
    pending: z.number().int(),
    byRole: z.object({
      owner: z.number().int(),
      admin: z.number().int(),
      member: z.number().int(),
      viewer: z.number().int(),
    }),
  })
  .openapi("TeamSummary");

function organizationResponse(org: {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  metadata: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    logo: org.logo,
    metadata: org.metadata,
    createdAt: org.createdAt.getTime(),
    updatedAt: org.updatedAt.getTime(),
  };
}

const app = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: { user: import("../platform/session.js").SessionUser | null };
}>();

app.use("/*", async (c, next) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return next();
});

app.use("/:slug/*", async (c, next) => {
  const user = c.get("user");
  const slug = c.req.param("slug");
  if (!user || !slug) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const db = createD1(c.env.D1);
  const rows = await db
    .select()
    .from(organization)
    .where(eq(organization.slug, slug))
    .limit(1);

  const org = rows[0];
  if (!org) {
    return c.json({ error: "Organization not found" }, 404);
  }

  const membership = await db
    .select()
    .from(member)
    .where(
      and(eq(member.organizationId, org.id), eq(member.userId, user.user.id))
    )
    .limit(1);

  if (!membership[0]) {
    return c.json({ error: "Forbidden" }, 403);
  }

  c.set("organization", org);
  return next();
});

const getRouteDef = createRoute({
  method: "get",
  path: "/{slug}",
  request: {
    params: z.object({ slug: z.string() }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: OrganizationSchema } },
      description: "Organization found",
    },
    401: { description: "Unauthorized" },
    403: { description: "Forbidden" },
    404: { description: "Organization not found" },
  },
});

app.openapi(getRouteDef, async (c) => {
  const org = c.get("organization");
  if (!org) {
    return c.json({ error: "Organization not found" }, 404);
  }
  return c.json(organizationResponse(org));
});

const teamRouteDef = createRoute({
  method: "get",
  path: "/{slug}/team",
  request: {
    params: z.object({ slug: z.string() }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: TeamSummarySchema } },
      description: "Team summary",
    },
    401: { description: "Unauthorized" },
    403: { description: "Forbidden" },
    404: { description: "Organization not found" },
  },
});

app.openapi(teamRouteDef, async (c) => {
  const org = c.get("organization");
  if (!org) {
    return c.json({ error: "Organization not found" }, 404);
  }

  const db = createD1(c.env.D1);

  const totalResult = await db
    .select({ value: count() })
    .from(member)
    .where(eq(member.organizationId, org.id));

  const active = totalResult[0]?.value ?? 0;

  const pendingResult = await db
    .select({ value: count() })
    .from(invitation)
    .where(
      and(
        eq(invitation.organizationId, org.id),
        eq(invitation.status, "pending")
      )
    );

  const pending = pendingResult[0]?.value ?? 0;
  const total = active + pending;

  const roleCounts = await db
    .select({ role: member.role, value: count() })
    .from(member)
    .where(eq(member.organizationId, org.id))
    .groupBy(member.role);

  const byRole = { owner: 0, admin: 0, member: 0, viewer: 0 };
  for (const row of roleCounts) {
    const role = row.role;
    if (
      role === "owner" ||
      role === "admin" ||
      role === "member" ||
      role === "viewer"
    ) {
      byRole[role] = row.value;
    }
  }

  return c.json({
    total,
    active,
    pending,
    byRole,
  });
});

declare module "hono" {
  interface ContextVariableMap {
    organization: typeof organization.$inferSelect | undefined;
  }
}

export default app;
