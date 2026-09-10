import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, count, eq } from "drizzle-orm";

import { createD1 } from "../global/db.js";
import { invitation, member, organization, user as userTable } from "../global/schema.js";

const OrganizationSchema = z
  .object({
    _id: z.string(),
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    logo: z.string().nullable().optional(),
    metadata: z.string().nullable().optional(),
    status: z.string(),
    userRole: z.string(),
    suiteBrand: z.record(z.string(), z.unknown()),
    suiteSecurity: z.record(z.string(), z.unknown()),
    brandingSettings: z.record(z.string(), z.unknown()).nullable().optional(),
    timezone: z.string().default("UTC"),
    currency: z.string().default("BRL"),
    currencyKind: z.string().default("normal"),
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

function parseMetadata(metadata: string | null): Record<string, unknown> {
  if (!metadata) return {};
  try {
    const parsed = JSON.parse(metadata);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

const recordSchema = z.record(z.string(), z.unknown());
const nullableRecordSchema = z
  .record(z.string(), z.unknown())
  .nullable();

function asRecord(v: unknown): Record<string, unknown> {
  const result = recordSchema.safeParse(v);
  return result.success ? result.data : {};
}

function organizationResponse(
  org: {
    id: string;
    name: string;
    slug: string;
    logo: string | null;
    metadata: string | null;
    createdAt: Date;
    updatedAt: Date;
  },
  userRole: string | undefined
) {
  const meta = parseMetadata(org.metadata);
  const status =
    typeof meta.status === "string" ? meta.status : "active";

  const brandingSettingsResult =
    nullableRecordSchema.safeParse(meta.brandingSettings);

  return {
    _id: org.id,
    id: org.id,
    name: org.name,
    slug: org.slug,
    logo: org.logo,
    metadata: org.metadata,
    status,
    userRole: userRole ?? "member",
    suiteBrand: asRecord(meta.suiteBrand),
    suiteSecurity: asRecord(meta.suiteSecurity),
    brandingSettings: brandingSettingsResult.success
      ? brandingSettingsResult.data
      : null,
    timezone:
      typeof meta.timezone === "string" ? meta.timezone : "UTC",
    currency:
      typeof meta.currency === "string" ? meta.currency : "BRL",
    currencyKind:
      typeof meta.currencyKind === "string" ? meta.currencyKind : "normal",
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
  c.set("membership", membership[0]);
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
  const membership = c.get("membership");
  if (!org) {
    return c.json({ error: "Organization not found" }, 404);
  }
  return c.json(organizationResponse(org, membership?.role));
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

const TeamMemberSchema = z.object({
  userId: z.string(),
  name: z.string().nullable(),
  email: z.string(),
  role: z.string(),
  avatarUrl: z.string().nullable(),
  status: z.string(),
});

const membersRouteDef = createRoute({
  method: "get",
  path: "/{slug}/members",
  request: {
    params: z.object({ slug: z.string() }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: z.array(TeamMemberSchema) } },
      description: "Organization members",
    },
    401: { description: "Unauthorized" },
    403: { description: "Forbidden" },
    404: { description: "Organization not found" },
  },
});

app.openapi(membersRouteDef, async (c) => {
  const org = c.get("organization");
  if (!org) {
    return c.json({ error: "Organization not found" }, 404);
  }

  const db = createD1(c.env.D1);

  const rows = await db
    .select({
      userId: member.userId,
      name: userTable.name,
      email: userTable.email,
      role: member.role,
      avatarUrl: userTable.image,
    })
    .from(member)
    .innerJoin(userTable, eq(member.userId, userTable.id))
    .where(eq(member.organizationId, org.id))
    .orderBy(userTable.name);

  return c.json(rows.map((r) => Object.assign(r, { status: "active" })));
});

const updateWorkspaceBodySchema = z.object({
  name: z.string().optional(),
  logo: z.string().nullable().optional(),
  brand: z.record(z.string(), z.unknown()).optional(),
  security: z.record(z.string(), z.unknown()).optional(),
  timezone: z.string().optional(),
  currency: z.string().optional(),
  currencyKind: z.string().optional(),
});

const updateWorkspaceRouteDef = createRoute({
  method: "patch",
  path: "/{slug}/workspace",
  request: {
    params: z.object({ slug: z.string() }),
    body: {
      content: {
        "application/json": { schema: updateWorkspaceBodySchema },
      },
      description: "Workspace update fields",
    },
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: OrganizationSchema },
      },
      description: "Updated organization",
    },
    401: { description: "Unauthorized" },
    403: { description: "Forbidden" },
    404: { description: "Organization not found" },
  },
});

app.openapi(updateWorkspaceRouteDef, async (c) => {
  const org = c.get("organization");
  const membership = c.get("membership");
  if (!org) {
    return c.json({ error: "Organization not found" }, 404);
  }

  const role = membership?.role;
  if (role !== "owner" && role !== "admin") {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = c.req.valid("json");
  const db = createD1(c.env.D1);

  const meta = parseMetadata(org.metadata);

  const nextMetadata = { ...meta };
  if (body.brand !== undefined) {
    nextMetadata.suiteBrand = body.brand;
  }
  if (body.security !== undefined) {
    nextMetadata.suiteSecurity = body.security;
  }
  if (body.timezone !== undefined) {
    nextMetadata.timezone = body.timezone;
  }
  if (body.currency !== undefined) {
    nextMetadata.currency = body.currency;
  }
  if (body.currencyKind !== undefined) {
    nextMetadata.currencyKind = body.currencyKind;
  }

  const setName = body.name !== undefined ? body.name : undefined;
  const setLogo = body.logo !== undefined ? body.logo : undefined;

  const [updated] = await db
    .update(organization)
    .set({
      ...(setName !== undefined ? { name: setName } : {}),
      ...(setLogo !== undefined ? { logo: setLogo } : {}),
      metadata: JSON.stringify(nextMetadata),
      updatedAt: new Date(),
    })
    .where(eq(organization.id, org.id))
    .returning();

  if (!updated) {
    return c.json({ error: "Organization not found" }, 404);
  }

  return c.json(organizationResponse(updated, membership?.role));
});

declare module "hono" {
  interface ContextVariableMap {
    organization: typeof organization.$inferSelect | undefined;
    membership: typeof member.$inferSelect | undefined;
  }
}

export default app;
