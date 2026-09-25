import { OpenAPIHono } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { createD1 } from "../../global/db.js";
import { organization } from "../../global/schema.js";
import {
  getAuditActor,
  getAuditRequestMeta,
  writeAuditLog,
} from "../../platform/audit-log.js";
import { mcpHasScope, type McpAccessToken } from "../../platform/mcp-auth.js";
import {
  defaultSealSettings,
  getSealSettings,
  parseOrganizationMetadata,
  sealSettingsSchema,
  type SealSettings,
} from "../../platform/org-settings.js";

const app = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: { mcp: McpAccessToken };
}>();

type ApiSettings = SealSettings;

const defaultSettings = defaultSealSettings;
const settingsSchema = sealSettingsSchema;

const updateSettingsSchema = z.object({
  signing: z
    .object({
      allowed_signature_types: z
        .array(z.enum(["draw", "type", "upload"]))
        .optional(),
      default_deadline_days: z.number().int().min(1).optional(),
      esign_consent_text: z.string().nullable().optional(),
    })
    .optional(),
  notifications: z
    .object({
      reminder_schedule: z.array(z.number().int().min(0)).optional(),
      expiration_alert_days: z.number().int().min(0).optional(),
      send_completion_email: z.boolean().optional(),
      send_viewed_notification: z.boolean().optional(),
    })
    .optional(),
  ai: z
    .object({
      enabled: z.boolean().optional(),
      auto_analyze: z.boolean().optional(),
    })
    .optional(),
  egress: z
    .object({
      webhook_payload_mode: z.enum(["full", "minimal"]).optional(),
      allow_convert: z.boolean().optional(),
    })
    .optional(),
  security: z
    .object({
      ip_allowlist: z.array(z.string()).optional(),
      allow_api_access: z.boolean().optional(),
      require_mfa: z.boolean().optional(),
      session_timeout_minutes: z.number().int().min(1).nullable().optional(),
    })
    .optional(),
});

app.get("/", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "settings:read")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }

  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const db = createD1(c.env.D1);
  const rows = await db
    .select({ metadata: organization.metadata })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1);

  return c.json(getSealSettings(rows[0]?.metadata ?? null));
});

app.patch("/", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "settings:write")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }

  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const rawBody: unknown = await c.req.json();
  const parsed = updateSettingsSchema.safeParse(rawBody);
  if (!parsed.success) {
    return c.json({ error: "validation_error" }, 400);
  }

  const db = createD1(c.env.D1);
  const orgRows = await db
    .select({ metadata: organization.metadata })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1);

  const currentSettings = getSealSettings(orgRows[0]?.metadata ?? null);
  const updatedSettings = settingsSchema.parse({
    signing: { ...currentSettings.signing, ...parsed.data.signing },
    notifications: {
      ...currentSettings.notifications,
      ...parsed.data.notifications,
    },
    ai: { ...currentSettings.ai, ...parsed.data.ai },
    egress: { ...currentSettings.egress, ...parsed.data.egress },
    security: { ...currentSettings.security, ...parsed.data.security },
  });

  const currentMetadata = parseOrganizationMetadata(
    orgRows[0]?.metadata ?? null
  );
  const updatedMetadata = {
    ...currentMetadata,
    seal_settings: updatedSettings,
  };

  await db
    .update(organization)
    .set({ metadata: JSON.stringify(updatedMetadata) })
    .where(eq(organization.id, organizationId));

  const actor = getAuditActor({ mcp: c.get("mcp") });
  if (actor) {
    const categories = (
      Object.keys(parsed.data) as Array<keyof typeof parsed.data>
    ).filter((key) => parsed.data[key] !== undefined);
    await writeAuditLog(db, {
      organizationId,
      actor,
      action: "settings.updated",
      resourceType: "organization",
      resourceId: organizationId,
      metadata: { categories },
      ...getAuditRequestMeta(c),
    });
  }

  return c.json({ success: true });
});

export default app;

// Keep defaults discoverable for tests / OpenAPI mirrors.
export { defaultSettings };
export type { ApiSettings };
