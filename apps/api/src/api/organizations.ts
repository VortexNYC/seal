import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, eq, isNull } from "drizzle-orm";

import { createD1 } from "../global/db.js";
import {
  documents as documentsTable,
  folders as foldersTable,
  member,
  organization,
  templates as templatesTable,
} from "../global/schema.js";

const TemplateListItemSchema = z
  .object({
    _id: z.string(),
    id: z.string(),
    name: z.string(),
    description: z.string().nullable().optional(),
    pageCount: z.number().int().nullable().optional(),
    fileSize: z.number().int(),
    thumbnailDataUrl: z.string().nullable().optional(),
    useCount: z.number().int(),
    status: z.string(),
    createdAt: z.number(),
    updatedAt: z.number(),
  })
  .openapi("TemplateListItem");

function parseMetadata(metadata: string | null): Record<string, unknown> {
  if (!metadata) return {};
  try {
    const parsed = JSON.parse(metadata);
    return typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

const recordSchema = z.record(z.string(), z.unknown());

function asRecord(v: unknown): Record<string, unknown> {
  const result = recordSchema.safeParse(v);
  return result.success ? result.data : {};
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

const BrandingSettingsSchema = z
  .record(z.string(), z.unknown())
  .openapi("BrandingSettings");

const SigningSettingsSchema = z
  .object({
    allowedSignatureTypes: z.array(
      z.union([z.literal("draw"), z.literal("type"), z.literal("upload")])
    ),
    esignConsentText: z.string().nullable().optional(),
    privacyNoticeText: z.string().nullable().optional(),
    defaultDeadlineDays: z.number().int(),
  })
  .openapi("SigningSettings");

const signingSettingsRecordSchema = SigningSettingsSchema.or(
  z.record(z.string(), z.unknown())
);

const NotificationSettingsSchema = z
  .object({
    reminderSchedule: z.array(z.number().int()),
    expirationAlertDays: z.number().int(),
    sendCompletionEmail: z.boolean(),
    sendViewedNotification: z.boolean(),
  })
  .openapi("NotificationSettings");

const notificationSettingsRecordSchema = NotificationSettingsSchema.or(
  z.record(z.string(), z.unknown())
);

const AiSettingsSchema = z
  .object({
    aiEnabled: z.boolean(),
    aiAutoAnalyze: z.boolean(),
    aiShowRedlinesToSigners: z.boolean(),
  })
  .openapi("AiSettings");

const aiSettingsRecordSchema = AiSettingsSchema.or(
  z.record(z.string(), z.unknown())
);

const updateAiBodySchema = z.object({
  aiEnabled: z.boolean().optional(),
  aiAutoAnalyze: z.boolean().optional(),
  aiShowRedlinesToSigners: z.boolean().optional(),
});

const SecuritySettingsSchema = z
  .object({
    ipAllowlist: z.array(z.string()),
    allowApiAccess: z.boolean(),
  })
  .openapi("SecuritySettings");

const securitySettingsRecordSchema = SecuritySettingsSchema.or(
  z.record(z.string(), z.unknown())
);

const updateSecurityBodySchema = z.object({
  ipAllowlist: z.array(z.string()).optional(),
  allowApiAccess: z.boolean().optional(),
});

const updateNotificationBodySchema = z.object({
  reminderSchedule: z.array(z.number().int()).optional(),
  expirationAlertDays: z.number().int().optional(),
  sendCompletionEmail: z.boolean().optional(),
  sendViewedNotification: z.boolean().optional(),
});

const updateSigningBodySchema = z.object({
  allowedSignatureTypes: z
    .array(z.union([z.literal("draw"), z.literal("type"), z.literal("upload")]))
    .optional(),
  esignConsentText: z.string().optional(),
  privacyNoticeText: z.string().optional(),
  defaultDeadlineDays: z.number().int().optional(),
});

const updateBrandingBodySchema = z.object({
  enabled: z.boolean().optional(),
  hideSealBranding: z.boolean().optional(),
  customFooterText: z.string().optional(),
});

const brandingRouteDef = createRoute({
  method: "get",
  path: "/{slug}/branding",
  request: {
    params: z.object({ slug: z.string() }),
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: BrandingSettingsSchema },
      },
      description: "Branding settings from organization metadata",
    },
    401: { description: "Unauthorized" },
    403: { description: "Forbidden" },
    404: { description: "Organization not found" },
  },
});

app.openapi(brandingRouteDef, async (c) => {
  const org = c.get("organization");
  if (!org) {
    return c.json({ error: "Organization not found" }, 404);
  }
  const meta = parseMetadata(org.metadata);
  return c.json(asRecord(meta.brandingSettings));
});

const updateBrandingRouteDef = createRoute({
  method: "patch",
  path: "/{slug}/branding",
  request: {
    params: z.object({ slug: z.string() }),
    body: {
      content: {
        "application/json": { schema: updateBrandingBodySchema },
      },
      description: "Branding update fields",
    },
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: BrandingSettingsSchema },
      },
      description: "Updated branding settings",
    },
    401: { description: "Unauthorized" },
    403: { description: "Forbidden" },
    404: { description: "Organization not found" },
  },
});

app.openapi(updateBrandingRouteDef, async (c) => {
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
  const branding = asRecord(meta.brandingSettings);

  const nextBranding = {
    ...branding,
    ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
    ...(body.hideSealBranding !== undefined
      ? { hideSealBranding: body.hideSealBranding }
      : {}),
    ...(body.customFooterText !== undefined
      ? {
          customFooterText:
            body.customFooterText === "" ? null : body.customFooterText,
        }
      : {}),
  };

  const nextMetadata = { ...meta, brandingSettings: nextBranding };

  await db
    .update(organization)
    .set({
      metadata: JSON.stringify(nextMetadata),
      updatedAt: new Date(),
    })
    .where(eq(organization.id, org.id));

  return c.json(nextBranding);
});

const signingRouteDef = createRoute({
  method: "get",
  path: "/{slug}/signing",
  request: {
    params: z.object({ slug: z.string() }),
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: signingSettingsRecordSchema },
      },
      description: "Signing settings from organization metadata",
    },
    401: { description: "Unauthorized" },
    403: { description: "Forbidden" },
    404: { description: "Organization not found" },
  },
});

app.openapi(signingRouteDef, async (c) => {
  const org = c.get("organization");
  if (!org) {
    return c.json({ error: "Organization not found" }, 404);
  }
  const meta = parseMetadata(org.metadata);
  const raw = asRecord(meta.signingSettings);

  const result = SigningSettingsSchema.safeParse({
    allowedSignatureTypes:
      Array.isArray(raw.allowedSignatureTypes) &&
      raw.allowedSignatureTypes.every(
        (t) => typeof t === "string" && ["draw", "type", "upload"].includes(t)
      )
        ? raw.allowedSignatureTypes
        : ["draw", "type", "upload"],
    esignConsentText:
      typeof raw.esignConsentText === "string" ? raw.esignConsentText : null,
    privacyNoticeText:
      typeof raw.privacyNoticeText === "string" ? raw.privacyNoticeText : null,
    defaultDeadlineDays:
      typeof raw.defaultDeadlineDays === "number"
        ? Math.round(raw.defaultDeadlineDays)
        : 30,
  });

  return c.json(result.success ? result.data : raw);
});

const updateSigningRouteDef = createRoute({
  method: "patch",
  path: "/{slug}/signing",
  request: {
    params: z.object({ slug: z.string() }),
    body: {
      content: {
        "application/json": { schema: updateSigningBodySchema },
      },
      description: "Signing settings update fields",
    },
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: SigningSettingsSchema },
      },
      description: "Updated signing settings",
    },
    401: { description: "Unauthorized" },
    403: { description: "Forbidden" },
    404: { description: "Organization not found" },
  },
});

app.openapi(updateSigningRouteDef, async (c) => {
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
  const signing = asRecord(meta.signingSettings);

  const currentAllowed =
    Array.isArray(signing.allowedSignatureTypes) &&
    signing.allowedSignatureTypes.every(
      (t) => typeof t === "string" && ["draw", "type", "upload"].includes(t)
    )
      ? signing.allowedSignatureTypes
      : ["draw", "type", "upload"];

  const nextSigning = {
    allowedSignatureTypes: body.allowedSignatureTypes ?? currentAllowed,
    esignConsentText:
      body.esignConsentText !== undefined
        ? body.esignConsentText || null
        : typeof signing.esignConsentText === "string"
          ? signing.esignConsentText
          : null,
    privacyNoticeText:
      body.privacyNoticeText !== undefined
        ? body.privacyNoticeText || null
        : typeof signing.privacyNoticeText === "string"
          ? signing.privacyNoticeText
          : null,
    defaultDeadlineDays:
      body.defaultDeadlineDays !== undefined
        ? body.defaultDeadlineDays
        : typeof signing.defaultDeadlineDays === "number"
          ? Math.round(signing.defaultDeadlineDays)
          : 30,
  };

  const nextMetadata = { ...meta, signingSettings: nextSigning };

  await db
    .update(organization)
    .set({
      metadata: JSON.stringify(nextMetadata),
      updatedAt: new Date(),
    })
    .where(eq(organization.id, org.id));

  return c.json(nextSigning);
});

const notificationRouteDef = createRoute({
  method: "get",
  path: "/{slug}/notifications",
  request: {
    params: z.object({ slug: z.string() }),
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: notificationSettingsRecordSchema },
      },
      description: "Notification settings from organization metadata",
    },
    401: { description: "Unauthorized" },
    403: { description: "Forbidden" },
    404: { description: "Organization not found" },
  },
});

app.openapi(notificationRouteDef, async (c) => {
  const org = c.get("organization");
  if (!org) {
    return c.json({ error: "Organization not found" }, 404);
  }
  const meta = parseMetadata(org.metadata);
  const raw = asRecord(meta.notificationSettings);

  const result = NotificationSettingsSchema.safeParse({
    reminderSchedule:
      Array.isArray(raw.reminderSchedule) &&
      raw.reminderSchedule.every(
        (d) => typeof d === "number" && Number.isInteger(d)
      )
        ? raw.reminderSchedule
        : [3, 7, 14],
    expirationAlertDays:
      typeof raw.expirationAlertDays === "number" &&
      Number.isInteger(raw.expirationAlertDays)
        ? raw.expirationAlertDays
        : 3,
    sendCompletionEmail:
      typeof raw.sendCompletionEmail === "boolean"
        ? raw.sendCompletionEmail
        : true,
    sendViewedNotification:
      typeof raw.sendViewedNotification === "boolean"
        ? raw.sendViewedNotification
        : true,
  });

  return c.json(result.success ? result.data : raw);
});

const updateNotificationRouteDef = createRoute({
  method: "patch",
  path: "/{slug}/notifications",
  request: {
    params: z.object({ slug: z.string() }),
    body: {
      content: {
        "application/json": { schema: updateNotificationBodySchema },
      },
      description: "Notification settings update fields",
    },
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: NotificationSettingsSchema },
      },
      description: "Updated notification settings",
    },
    401: { description: "Unauthorized" },
    403: { description: "Forbidden" },
    404: { description: "Organization not found" },
  },
});

app.openapi(updateNotificationRouteDef, async (c) => {
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
  const notification = asRecord(meta.notificationSettings);

  const currentSchedule =
    Array.isArray(notification.reminderSchedule) &&
    notification.reminderSchedule.every(
      (d) => typeof d === "number" && Number.isInteger(d)
    )
      ? notification.reminderSchedule
      : [3, 7, 14];

  const nextNotification = {
    reminderSchedule: body.reminderSchedule ?? currentSchedule,
    expirationAlertDays:
      body.expirationAlertDays !== undefined
        ? body.expirationAlertDays
        : typeof notification.expirationAlertDays === "number" &&
            Number.isInteger(notification.expirationAlertDays)
          ? notification.expirationAlertDays
          : 3,
    sendCompletionEmail:
      body.sendCompletionEmail !== undefined
        ? body.sendCompletionEmail
        : typeof notification.sendCompletionEmail === "boolean"
          ? notification.sendCompletionEmail
          : true,
    sendViewedNotification:
      body.sendViewedNotification !== undefined
        ? body.sendViewedNotification
        : typeof notification.sendViewedNotification === "boolean"
          ? notification.sendViewedNotification
          : true,
  };

  const nextMetadata = { ...meta, notificationSettings: nextNotification };

  await db
    .update(organization)
    .set({
      metadata: JSON.stringify(nextMetadata),
      updatedAt: new Date(),
    })
    .where(eq(organization.id, org.id));

  return c.json(nextNotification);
});

const securityRouteDef = createRoute({
  method: "get",
  path: "/{slug}/security",
  request: {
    params: z.object({ slug: z.string() }),
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: securitySettingsRecordSchema },
      },
      description: "Security settings from organization metadata",
    },
    401: { description: "Unauthorized" },
    403: { description: "Forbidden" },
    404: { description: "Organization not found" },
  },
});

app.openapi(securityRouteDef, async (c) => {
  const org = c.get("organization");
  if (!org) {
    return c.json({ error: "Organization not found" }, 404);
  }
  const meta = parseMetadata(org.metadata);
  const raw = asRecord(meta.securitySettings);

  const allowlist =
    Array.isArray(raw.ipAllowlist) &&
    raw.ipAllowlist.every((v) => typeof v === "string")
      ? raw.ipAllowlist
      : [];

  const result = SecuritySettingsSchema.safeParse({
    ipAllowlist: allowlist,
    allowApiAccess:
      typeof raw.allowApiAccess === "boolean" ? raw.allowApiAccess : true,
  });

  return c.json(
    result.success
      ? result.data
      : { ipAllowlist: allowlist, allowApiAccess: true }
  );
});

const updateSecurityRouteDef = createRoute({
  method: "patch",
  path: "/{slug}/security",
  request: {
    params: z.object({ slug: z.string() }),
    body: {
      content: {
        "application/json": { schema: updateSecurityBodySchema },
      },
      description: "Security settings update fields",
    },
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: SecuritySettingsSchema },
      },
      description: "Updated security settings",
    },
    401: { description: "Unauthorized" },
    403: { description: "Forbidden" },
    404: { description: "Organization not found" },
  },
});

app.openapi(updateSecurityRouteDef, async (c) => {
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
  const security = asRecord(meta.securitySettings);

  const currentAllowlist =
    Array.isArray(security.ipAllowlist) &&
    security.ipAllowlist.every((v) => typeof v === "string")
      ? security.ipAllowlist
      : [];

  const nextSecurity = {
    ipAllowlist: body.ipAllowlist ?? currentAllowlist,
    allowApiAccess:
      body.allowApiAccess !== undefined
        ? body.allowApiAccess
        : typeof security.allowApiAccess === "boolean"
          ? security.allowApiAccess
          : true,
  };

  const nextMetadata = { ...meta, securitySettings: nextSecurity };

  await db
    .update(organization)
    .set({
      metadata: JSON.stringify(nextMetadata),
      updatedAt: new Date(),
    })
    .where(eq(organization.id, org.id));

  return c.json(nextSecurity);
});

const aiRouteDef = createRoute({
  method: "get",
  path: "/{slug}/ai",
  request: {
    params: z.object({ slug: z.string() }),
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: aiSettingsRecordSchema },
      },
      description: "AI settings from organization metadata",
    },
    401: { description: "Unauthorized" },
    403: { description: "Forbidden" },
    404: { description: "Organization not found" },
  },
});

function defaultAiSettings() {
  return {
    aiEnabled: true,
    aiAutoAnalyze: true,
    aiShowRedlinesToSigners: false,
  };
}

function toBoolean(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

app.openapi(aiRouteDef, async (c) => {
  const org = c.get("organization");
  if (!org) {
    return c.json({ error: "Organization not found" }, 404);
  }
  const meta = parseMetadata(org.metadata);
  const raw = asRecord(meta.aiSettings);

  const result = AiSettingsSchema.safeParse({
    aiEnabled: toBoolean(raw.aiEnabled, true),
    aiAutoAnalyze: toBoolean(raw.aiAutoAnalyze, true),
    aiShowRedlinesToSigners: toBoolean(raw.aiShowRedlinesToSigners, false),
  });

  return c.json(result.success ? result.data : defaultAiSettings());
});

const updateAiRouteDef = createRoute({
  method: "patch",
  path: "/{slug}/ai",
  request: {
    params: z.object({ slug: z.string() }),
    body: {
      content: {
        "application/json": { schema: updateAiBodySchema },
      },
      description: "AI settings update fields",
    },
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: AiSettingsSchema },
      },
      description: "Updated AI settings",
    },
    401: { description: "Unauthorized" },
    403: { description: "Forbidden" },
    404: { description: "Organization not found" },
  },
});

app.openapi(updateAiRouteDef, async (c) => {
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
  const ai = asRecord(meta.aiSettings);

  const nextAi = {
    aiEnabled: body.aiEnabled ?? toBoolean(ai.aiEnabled, true),
    aiAutoAnalyze: body.aiAutoAnalyze ?? toBoolean(ai.aiAutoAnalyze, true),
    aiShowRedlinesToSigners:
      body.aiShowRedlinesToSigners ??
      toBoolean(ai.aiShowRedlinesToSigners, false),
  };

  const nextMetadata = { ...meta, aiSettings: nextAi };

  await db
    .update(organization)
    .set({
      metadata: JSON.stringify(nextMetadata),
      updatedAt: new Date(),
    })
    .where(eq(organization.id, org.id));

  return c.json(nextAi);
});

const listTemplatesRouteDef = createRoute({
  method: "get",
  path: "/{slug}/templates",
  request: {
    params: z.object({ slug: z.string() }),
    query: z.object({
      folderId: z
        .string()
        .optional()
        .openapi({
          param: { name: "folderId", in: "query" },
        }),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: z.array(TemplateListItemSchema) },
      },
      description: "Organization templates",
    },
    401: { description: "Unauthorized" },
    403: { description: "Forbidden" },
    404: { description: "Organization not found" },
  },
});

app.openapi(listTemplatesRouteDef, async (c) => {
  const org = c.get("organization");
  if (!org) {
    return c.json({ error: "Organization not found" }, 404);
  }

  const { folderId: folderPublicId } = c.req.valid("query");
  const db = createD1(c.env.D1);

  let internalFolderId: string | null = null;
  if (folderPublicId) {
    const folderRows = await db
      .select({ id: foldersTable.id })
      .from(foldersTable)
      .where(
        and(
          eq(foldersTable.publicId, folderPublicId),
          eq(foldersTable.organizationId, org.id)
        )
      )
      .limit(1);
    const folder = folderRows[0];
    if (!folder) {
      return c.json([]);
    }
    internalFolderId = folder.id;
  }

  const where: Array<ReturnType<typeof eq>> = [
    eq(templatesTable.organizationId, org.id),
    eq(templatesTable.status, "active"),
  ];

  if (internalFolderId) {
    where.push(eq(templatesTable.folderId, internalFolderId));
  } else {
    where.push(isNull(templatesTable.folderId));
  }

  const rows = await db
    .select({
      template: templatesTable,
      source: {
        pageCount: documentsTable.pageCount,
        thumbnailDataUrl: documentsTable.thumbnailDataUrl,
      },
    })
    .from(templatesTable)
    .leftJoin(
      documentsTable,
      eq(templatesTable.sourceDocumentId, documentsTable.id)
    )
    .where(and(...where))
    .orderBy(templatesTable.name);

  return c.json(
    rows.map(({ template, source }) => ({
      _id: template.id,
      id: template.id,
      name: template.name,
      description: template.description,
      pageCount: source?.pageCount ?? null,
      fileSize: template.size,
      thumbnailDataUrl: source?.thumbnailDataUrl ?? null,
      useCount: template.useCount,
      status: template.status,
      createdAt: template.createdAt.getTime(),
      updatedAt: template.updatedAt.getTime(),
    }))
  );
});

const TemplateDetailSchema = z
  .object({
    _id: z.string(),
    id: z.string(),
    name: z.string(),
    description: z.string().nullable().optional(),
    pageCount: z.number().int().nullable().optional(),
    fileSize: z.number().int(),
    thumbnailDataUrl: z.string().nullable().optional(),
    useCount: z.number().int(),
    status: z.string(),
    createdAt: z.number(),
    updatedAt: z.number(),
  })
  .openapi("TemplateDetail");

const updateTemplateBodySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
});

const useTemplateBodySchema = z.object({
  documentName: z.string().optional(),
});

const useTemplateResponseSchema = z.object({
  documentId: z.string(),
});

const moveTemplateBodySchema = z.object({
  folderId: z.string().nullable().optional(),
});

const createFromTemplateRouteDef = createRoute({
  method: "post",
  path: "/{slug}/templates/{templateId}/use",
  request: {
    params: z.object({ slug: z.string(), templateId: z.string() }),
    body: {
      content: {
        "application/json": { schema: useTemplateBodySchema },
      },
      description: "Create a document from a template",
    },
  },
  responses: {
    201: {
      content: {
        "application/json": { schema: useTemplateResponseSchema },
      },
      description: "Document created",
    },
    401: { description: "Unauthorized" },
    403: { description: "Forbidden" },
    404: { description: "Template not found" },
  },
});

app.openapi(createFromTemplateRouteDef, async (c) => {
  const org = c.get("organization");
  const user = c.get("user");
  if (!org) {
    return c.json({ error: "Organization not found" }, 404);
  }

  const { templateId } = c.req.valid("param");
  const { documentName } = c.req.valid("json");
  const db = createD1(c.env.D1);

  const templateRows = await db
    .select()
    .from(templatesTable)
    .where(
      and(
        eq(templatesTable.id, templateId),
        eq(templatesTable.organizationId, org.id)
      )
    )
    .limit(1);

  const template = templateRows[0];
  if (!template) {
    return c.json({ error: "Template not found" }, 404);
  }

  const now = new Date();
  const id = crypto.randomUUID();
  const publicId = crypto.randomUUID();

  await db.insert(documentsTable).values({
    id,
    publicId,
    organizationId: org.id,
    ownerId: user?.user.id ?? template.createdBy,
    name: documentName ?? template.name,
    description: template.description,
    status: "active",
    documentStatus: "active",
    sharingMode: "private",
    storageKey: template.storageKey,
    contentType: template.contentType,
    size: template.size,
    pageCount: template.pageCount,
    thumbnailDataUrl: template.thumbnailDataUrl,
    folderId: template.folderId,
    allowDictateNextSigner: false,
    createdAt: now,
    updatedAt: now,
  });

  await db
    .update(templatesTable)
    .set({ useCount: template.useCount + 1, updatedAt: now })
    .where(eq(templatesTable.id, template.id));

  return c.json({ documentId: publicId }, 201);
});

const updateTemplateRouteDef = createRoute({
  method: "patch",
  path: "/{slug}/templates/{templateId}",
  request: {
    params: z.object({ slug: z.string(), templateId: z.string() }),
    body: {
      content: {
        "application/json": { schema: updateTemplateBodySchema },
      },
      description: "Update template fields",
    },
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: TemplateDetailSchema },
      },
      description: "Template updated",
    },
    401: { description: "Unauthorized" },
    403: { description: "Forbidden" },
    404: { description: "Template not found" },
  },
});

app.openapi(updateTemplateRouteDef, async (c) => {
  const org = c.get("organization");
  if (!org) {
    return c.json({ error: "Organization not found" }, 404);
  }

  const { templateId } = c.req.valid("param");
  const body = c.req.valid("json");
  const db = createD1(c.env.D1);

  const setName = body.name !== undefined ? body.name : undefined;
  const setDescription =
    body.description !== undefined ? body.description : undefined;

  const templateRows = await db
    .select()
    .from(templatesTable)
    .where(
      and(
        eq(templatesTable.id, templateId),
        eq(templatesTable.organizationId, org.id)
      )
    )
    .limit(1);

  if (!templateRows[0]) {
    return c.json({ error: "Template not found" }, 404);
  }

  await db
    .update(templatesTable)
    .set({
      name: setName,
      description: setDescription,
      updatedAt: new Date(),
    })
    .where(eq(templatesTable.id, templateId));

  const [template] = await db
    .select({
      template: templatesTable,
      source: {
        pageCount: documentsTable.pageCount,
        thumbnailDataUrl: documentsTable.thumbnailDataUrl,
      },
    })
    .from(templatesTable)
    .leftJoin(
      documentsTable,
      eq(templatesTable.sourceDocumentId, documentsTable.id)
    )
    .where(
      and(
        eq(templatesTable.id, templateId),
        eq(templatesTable.organizationId, org.id)
      )
    )
    .limit(1);

  if (!template) {
    return c.json({ error: "Template not found" }, 404);
  }

  return c.json({
    _id: template.template.id,
    id: template.template.id,
    name: template.template.name,
    description: template.template.description,
    pageCount: template.source?.pageCount ?? null,
    fileSize: template.template.size,
    thumbnailDataUrl: template.source?.thumbnailDataUrl ?? null,
    useCount: template.template.useCount,
    status: template.template.status,
    createdAt: template.template.createdAt.getTime(),
    updatedAt: template.template.updatedAt.getTime(),
  });
});

const deleteTemplateRouteDef = createRoute({
  method: "delete",
  path: "/{slug}/templates/{templateId}",
  request: {
    params: z.object({ slug: z.string(), templateId: z.string() }),
  },
  responses: {
    204: { description: "Template deleted" },
    401: { description: "Unauthorized" },
    403: { description: "Forbidden" },
    404: { description: "Template not found" },
  },
});

app.openapi(deleteTemplateRouteDef, async (c) => {
  const org = c.get("organization");
  if (!org) {
    return c.json({ error: "Organization not found" }, 404);
  }

  const { templateId } = c.req.valid("param");
  const db = createD1(c.env.D1);

  const template = await db
    .select()
    .from(templatesTable)
    .where(
      and(
        eq(templatesTable.id, templateId),
        eq(templatesTable.organizationId, org.id)
      )
    )
    .limit(1);

  if (!template[0]) {
    return c.json({ error: "Template not found" }, 404);
  }

  await db
    .update(templatesTable)
    .set({ status: "deleted", updatedAt: new Date() })
    .where(eq(templatesTable.id, templateId));

  return c.body(null, 204);
});

const moveTemplateRouteDef = createRoute({
  method: "patch",
  path: "/{slug}/templates/{templateId}/folder",
  request: {
    params: z.object({ slug: z.string(), templateId: z.string() }),
    body: {
      content: {
        "application/json": { schema: moveTemplateBodySchema },
      },
      description: "Move template to folder",
    },
  },
  responses: {
    204: { description: "Template moved" },
    401: { description: "Unauthorized" },
    403: { description: "Forbidden" },
    404: { description: "Template or folder not found" },
  },
});

app.openapi(moveTemplateRouteDef, async (c) => {
  const org = c.get("organization");
  if (!org) {
    return c.json({ error: "Organization not found" }, 404);
  }

  const { templateId } = c.req.valid("param");
  const { folderId: folderPublicId } = c.req.valid("json");
  const db = createD1(c.env.D1);

  let targetFolderId: string | null = null;
  if (folderPublicId) {
    const folderRows = await db
      .select({ id: foldersTable.id })
      .from(foldersTable)
      .where(
        and(
          eq(foldersTable.publicId, folderPublicId),
          eq(foldersTable.organizationId, org.id)
        )
      )
      .limit(1);
    const folder = folderRows[0];
    if (!folder) {
      return c.json({ error: "Folder not found" }, 404);
    }
    targetFolderId = folder.id;
  }

  const template = await db
    .select()
    .from(templatesTable)
    .where(
      and(
        eq(templatesTable.id, templateId),
        eq(templatesTable.organizationId, org.id)
      )
    )
    .limit(1);

  if (!template[0]) {
    return c.json({ error: "Template not found" }, 404);
  }

  await db
    .update(templatesTable)
    .set({
      folderId: targetFolderId,
      updatedAt: new Date(),
    })
    .where(eq(templatesTable.id, templateId));

  return c.body(null, 204);
});

declare module "hono" {
  interface ContextVariableMap {
    organization: typeof organization.$inferSelect | undefined;
    membership: typeof member.$inferSelect | undefined;
  }
}

export default app;
