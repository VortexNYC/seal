import { OpenAPIHono } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { createD1 } from "../../global/db.js";
import { organization } from "../../global/schema.js";
import { mcpHasScope, type McpAccessToken } from "../../platform/mcp-auth.js";

const app = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: { mcp: McpAccessToken };
}>();

type ApiSettings = {
  signing: {
    allowed_signature_types: ("draw" | "type" | "upload")[];
    default_deadline_days: number;
    esign_consent_text: string | null;
  };
  notifications: {
    reminder_schedule: number[];
    expiration_alert_days: number;
    send_completion_email: boolean;
    send_viewed_notification: boolean;
  };
  ai: {
    enabled: boolean;
    auto_analyze: boolean;
  };
  security: {
    ip_allowlist: string[];
    allow_api_access: boolean;
    require_mfa: boolean;
    session_timeout_minutes: number | null;
  };
};

const defaultSettings: ApiSettings = {
  signing: {
    allowed_signature_types: ["draw", "type", "upload"],
    default_deadline_days: 30,
    esign_consent_text: null,
  },
  notifications: {
    reminder_schedule: [3, 7, 14],
    expiration_alert_days: 7,
    send_completion_email: true,
    send_viewed_notification: true,
  },
  ai: {
    enabled: true,
    auto_analyze: false,
  },
  security: {
    ip_allowlist: [],
    allow_api_access: true,
    require_mfa: false,
    session_timeout_minutes: null,
  },
};

const settingsSchema: z.ZodType<ApiSettings> = z.object({
  signing: z.object({
    allowed_signature_types: z.array(z.enum(["draw", "type", "upload"])),
    default_deadline_days: z.number().int().min(1),
    esign_consent_text: z.string().nullable(),
  }),
  notifications: z.object({
    reminder_schedule: z.array(z.number().int().min(0)),
    expiration_alert_days: z.number().int().min(0),
    send_completion_email: z.boolean(),
    send_viewed_notification: z.boolean(),
  }),
  ai: z.object({
    enabled: z.boolean(),
    auto_analyze: z.boolean(),
  }),
  security: z.object({
    ip_allowlist: z.array(z.string()),
    allow_api_access: z.boolean(),
    require_mfa: z.boolean(),
    session_timeout_minutes: z.number().int().min(1).nullable(),
  }),
});

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
  security: z
    .object({
      ip_allowlist: z.array(z.string()).optional(),
      allow_api_access: z.boolean().optional(),
      require_mfa: z.boolean().optional(),
      session_timeout_minutes: z.number().int().min(1).nullable().optional(),
    })
    .optional(),
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseOrganizationMetadata(
  value: string | null
): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function getSettings(metadata: string | null): ApiSettings {
  const parsed = parseOrganizationMetadata(metadata);
  const sealSettings = isRecord(parsed.seal_settings)
    ? parsed.seal_settings
    : {};

  const mergeCategory = <K extends keyof ApiSettings>(
    key: K,
    defaults: ApiSettings[K]
  ): ApiSettings[K] => {
    const existing = isRecord(sealSettings[key]) ? sealSettings[key] : {};
    return { ...defaults, ...existing };
  };

  return {
    signing: mergeCategory("signing", defaultSettings.signing),
    notifications: mergeCategory(
      "notifications",
      defaultSettings.notifications
    ),
    ai: mergeCategory("ai", defaultSettings.ai),
    security: mergeCategory("security", defaultSettings.security),
  };
}

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

  return c.json(getSettings(rows[0]?.metadata ?? null));
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

  const currentSettings = getSettings(orgRows[0]?.metadata ?? null);
  const updatedSettings = settingsSchema.parse({
    signing: { ...currentSettings.signing, ...parsed.data.signing },
    notifications: {
      ...currentSettings.notifications,
      ...parsed.data.notifications,
    },
    ai: { ...currentSettings.ai, ...parsed.data.ai },
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

  return c.json({ success: true });
});

export default app;
