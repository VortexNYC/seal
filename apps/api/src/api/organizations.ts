import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, count, eq, isNull } from "drizzle-orm";

import { createD1 } from "../global/db.js";
import {
  documents as documentsTable,
  folders as foldersTable,
  invitation,
  member,
  organization,
  templates as templatesTable,
  user as userTable,
} from "../global/schema.js";

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
    delegateOwnership: z.boolean(),
    timezone: z.string().default("UTC"),
    currency: z.string().default("BRL"),
    currencyKind: z.string().default("normal"),
    createdAt: z.number(),
    updatedAt: z.number(),
  })
  .openapi("Organization");

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

const FolderSchema = z
  .object({
    _id: z.string(),
    id: z.string(),
    name: z.string(),
    parentId: z.string().nullable().optional(),
    type: z.string(),
    pinned: z.boolean().optional(),
    createdAt: z.number(),
    updatedAt: z.number(),
  })
  .openapi("Folder");

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
    delegateOwnership:
      typeof meta.delegateOwnership === "boolean"
        ? meta.delegateOwnership
        : false,
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

const BrandingSettingsSchema = z
  .record(z.string(), z.unknown())
  .openapi("BrandingSettings");

const SigningSettingsSchema = z
  .object({
    allowedSignatureTypes: z.array(
      z.union([z.literal("draw"), z.literal("type"), z.literal("upload")])
    ),
    esignConsentText: z.string().nullable().optional(),
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
  defaultDeadlineDays: z.number().int().optional(),
});

const updateBrandingBodySchema = z.object({
  enabled: z.boolean().optional(),
  hideSealBranding: z.boolean().optional(),
  customFooterText: z.string().optional(),
});

const updateWorkspaceBodySchema = z.object({
  name: z.string().optional(),
  logo: z.string().nullable().optional(),
  brand: z.record(z.string(), z.unknown()).optional(),
  security: z.record(z.string(), z.unknown()).optional(),
  delegateOwnership: z.boolean().optional(),
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
  if (body.delegateOwnership !== undefined) {
    nextMetadata.delegateOwnership = body.delegateOwnership;
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
      typeof raw.esignConsentText === "string"
        ? raw.esignConsentText
        : null,
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

  return c.json(result.success ? result.data : { ipAllowlist: allowlist, allowApiAccess: true });
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
      body.aiShowRedlinesToSigners ?? toBoolean(ai.aiShowRedlinesToSigners, false),
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
      folderId: z.string().optional().openapi({
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

  const { folderId } = c.req.valid("query");
  const db = createD1(c.env.D1);

  const where: Array<ReturnType<typeof eq>> = [
    eq(templatesTable.organizationId, org.id),
    eq(templatesTable.status, "active"),
  ];

  if (folderId) {
    where.push(eq(templatesTable.folderId, folderId));
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

const listFoldersRouteDef = createRoute({
  method: "get",
  path: "/{slug}/folders",
  request: {
    params: z.object({ slug: z.string() }),
    query: z.object({
      type: z.string().optional().openapi({
        param: { name: "type", in: "query" },
      }),
      parentId: z.string().optional().openapi({
        param: { name: "parentId", in: "query" },
      }),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: z.array(FolderSchema) },
      },
      description: "Organization folders",
    },
    401: { description: "Unauthorized" },
    403: { description: "Forbidden" },
    404: { description: "Organization not found" },
  },
});

app.openapi(listFoldersRouteDef, async (c) => {
  const org = c.get("organization");
  if (!org) {
    return c.json({ error: "Organization not found" }, 404);
  }

  const { type = "template", parentId } = c.req.valid("query");
  const db = createD1(c.env.D1);

  const where: Array<ReturnType<typeof eq>> = [
    eq(foldersTable.organizationId, org.id),
    eq(foldersTable.type, type),
  ];

  if (parentId) {
    where.push(eq(foldersTable.parentId, parentId));
  } else {
    where.push(isNull(foldersTable.parentId));
  }

  const rows = await db
    .select()
    .from(foldersTable)
    .where(and(...where))
    .orderBy(foldersTable.name);

  return c.json(
    rows.map((f) => ({
      _id: f.id,
      id: f.id,
      name: f.name,
      parentId: f.parentId,
      type: f.type,
      pinned: f.pinned,
      createdAt: f.createdAt.getTime(),
      updatedAt: f.updatedAt.getTime(),
    }))
  );
});

declare module "hono" {
  interface ContextVariableMap {
    organization: typeof organization.$inferSelect | undefined;
    membership: typeof member.$inferSelect | undefined;
  }
}

export default app;
