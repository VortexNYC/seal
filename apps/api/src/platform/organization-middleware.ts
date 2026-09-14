import { and, eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";

import { createD1 } from "../global/db.js";
import { member, organization } from "../global/schema.js";
import type { Variables } from "./types.js";

export const organizationMiddleware = createMiddleware<{
  Bindings: CloudflareBindings;
  Variables: Variables;
}>(async (c, next) => {
  const user = c.get("user");
  const slug = c.req.param("organizationSlug") ?? c.req.param("slug");
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

  const apiToken = c.get("apiToken");
  if (apiToken && apiToken.organizationId !== org.id) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const membershipRows = await db
    .select()
    .from(member)
    .where(
      and(eq(member.organizationId, org.id), eq(member.userId, user.user.id))
    )
    .limit(1);

  if (!membershipRows[0]) {
    return c.json({ error: "Forbidden" }, 403);
  }

  c.set("organization", org);
  c.set("membership", membershipRows[0]);
  return next();
});
