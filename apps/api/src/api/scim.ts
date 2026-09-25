import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";

import { createD1 } from "../global/db.js";
import { member, organization } from "../global/schema.js";
import { createAuth } from "../platform/auth.js";
import type { Variables } from "../platform/types.js";

const SCIM_SCOPES = [
  "scim.users.read",
  "scim.users.write",
  "scim.groups.read",
  "scim.groups.write",
] as const;

const app = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: Pick<Variables, "user" | "auth">;
}>();

app.use("/*", async (c, next) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return next();
});

async function loadOrgAdmin(
  env: CloudflareBindings,
  slug: string,
  userId: string
): Promise<
  | { ok: true; organizationId: string }
  | { ok: false; status: 404 | 403; error: string }
> {
  const db = createD1(env.D1);
  const rows = await db
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.slug, slug))
    .limit(1);
  const org = rows[0];
  if (!org) {
    return { ok: false, status: 404, error: "Organization not found" };
  }
  const membership = await db
    .select({ role: member.role })
    .from(member)
    .where(and(eq(member.organizationId, org.id), eq(member.userId, userId)))
    .limit(1);
  const role = membership[0]?.role;
  if (role !== "owner" && role !== "admin") {
    return { ok: false, status: 403, error: "Forbidden" };
  }
  return { ok: true, organizationId: org.id };
}

const createConnectionRoute = createRoute({
  method: "post",
  path: "/{slug}/scim/connections",
  request: {
    params: z.object({ slug: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            scopes: z.array(z.enum(SCIM_SCOPES)).min(1).optional(),
            expiresInDays: z.number().int().positive().max(365).optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: "SCIM connection created; bearer token returned once",
      content: {
        "application/json": {
          schema: z.object({
            connectionId: z.string(),
            provisioningDomainId: z.string(),
            token: z.string(),
            baseUrl: z.string(),
          }),
        },
      },
    },
    401: { description: "Unauthorized" },
    403: { description: "Forbidden" },
    404: { description: "Not found" },
  },
});

app.openapi(createConnectionRoute, async (c) => {
  const { slug } = c.req.valid("param");
  const input = c.req.valid("json");
  const sessionUser = c.get("user");
  if (!sessionUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const access = await loadOrgAdmin(c.env, slug, sessionUser.user.id);
  if (!access.ok) {
    return c.json({ error: access.error }, access.status);
  }

  const auth = await createAuth(c.env);
  const expiresAt = new Date(
    Date.now() + (input.expiresInDays ?? 90) * 86_400_000
  );
  const result = await auth.api.createSCIMManagedConnection({
    body: {
      creationRequestId: crypto.randomUUID(),
      provisioningDomainId: access.organizationId,
      actorId: sessionUser.user.id,
      scopes: input.scopes ?? [...SCIM_SCOPES],
      expiresAt,
    },
  });

  return c.json(
    {
      connectionId: result.connection.connectionId,
      provisioningDomainId: result.connection.provisioningDomainId,
      token: result.token,
      baseUrl: `${c.env.BETTER_AUTH_URL}/api/auth/scim/v2`,
    },
    201
  );
});

const listConnectionsRoute = createRoute({
  method: "get",
  path: "/{slug}/scim/connections",
  request: {
    params: z.object({ slug: z.string() }),
  },
  responses: {
    200: {
      description: "SCIM connections for the organization",
      content: {
        "application/json": {
          schema: z.object({
            connections: z.array(
              z.object({
                connectionId: z.string(),
                status: z.string(),
                createdAt: z.string(),
              })
            ),
          }),
        },
      },
    },
    401: { description: "Unauthorized" },
    403: { description: "Forbidden" },
    404: { description: "Not found" },
  },
});

app.openapi(listConnectionsRoute, async (c) => {
  const { slug } = c.req.valid("param");
  const sessionUser = c.get("user");
  if (!sessionUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const access = await loadOrgAdmin(c.env, slug, sessionUser.user.id);
  if (!access.ok) {
    return c.json({ error: access.error }, access.status);
  }

  const auth = await createAuth(c.env);
  const result = await auth.api.listSCIMManagedConnections({
    body: { provisioningDomainId: access.organizationId },
  });
  return c.json({
    connections: result.connections.map((conn) => ({
      connectionId: conn.connectionId,
      status: conn.status,
      createdAt: conn.createdAt.toISOString(),
    })),
  });
});

export default app;
