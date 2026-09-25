import { eq } from "drizzle-orm";
import { z } from "zod";

import { createD1 } from "../global/db.js";
import { organization } from "../global/schema.js";

export type SealSettings = {
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
  egress: {
    /** `full` includes PII fields; `minimal` keeps ids/status/timestamps only. */
    webhook_payload_mode: "full" | "minimal";
    /** When false, Office→PDF convert worker calls are rejected. */
    allow_convert: boolean;
  };
  security: {
    ip_allowlist: string[];
    allow_api_access: boolean;
    require_mfa: boolean;
    session_timeout_minutes: number | null;
  };
};

export const defaultSealSettings: SealSettings = {
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
  egress: {
    webhook_payload_mode: "full",
    allow_convert: true,
  },
  security: {
    ip_allowlist: [],
    allow_api_access: true,
    require_mfa: false,
    session_timeout_minutes: null,
  },
};

export const sealSettingsSchema: z.ZodType<SealSettings> = z.object({
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
  egress: z.object({
    webhook_payload_mode: z.enum(["full", "minimal"]),
    allow_convert: z.boolean(),
  }),
  security: z.object({
    ip_allowlist: z.array(z.string()),
    allow_api_access: z.boolean(),
    require_mfa: z.boolean(),
    session_timeout_minutes: z.number().int().min(1).nullable(),
  }),
});

export class FeatureDisabledError extends Error {
  constructor(
    public readonly code: "ai_disabled" | "convert_disabled",
    message?: string
  ) {
    super(message ?? code);
    this.name = "FeatureDisabledError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseOrganizationMetadata(
  value: string | null
): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function getSealSettings(metadata: string | null): SealSettings {
  const parsed = parseOrganizationMetadata(metadata);
  const sealSettings = isRecord(parsed.seal_settings)
    ? parsed.seal_settings
    : {};

  const mergeCategory = <K extends keyof SealSettings>(
    key: K,
    defaults: SealSettings[K]
  ): SealSettings[K] => {
    const existing = isRecord(sealSettings[key]) ? sealSettings[key] : {};
    return { ...defaults, ...existing };
  };

  return sealSettingsSchema.parse({
    signing: mergeCategory("signing", defaultSealSettings.signing),
    notifications: mergeCategory(
      "notifications",
      defaultSealSettings.notifications
    ),
    ai: mergeCategory("ai", defaultSealSettings.ai),
    egress: mergeCategory("egress", defaultSealSettings.egress),
    security: mergeCategory("security", defaultSealSettings.security),
  });
}

export async function loadOrgSealSettings(
  env: CloudflareBindings,
  organizationId: string
): Promise<SealSettings> {
  const db = createD1(env.D1);
  const rows = await db
    .select({ metadata: organization.metadata })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1);
  return getSealSettings(rows[0]?.metadata ?? null);
}

export async function assertAiEnabled(
  env: CloudflareBindings,
  organizationId: string
): Promise<void> {
  const settings = await loadOrgSealSettings(env, organizationId);
  if (!settings.ai.enabled) {
    throw new FeatureDisabledError("ai_disabled");
  }
}

export async function assertConvertEnabled(
  env: CloudflareBindings,
  organizationId: string
): Promise<void> {
  const settings = await loadOrgSealSettings(env, organizationId);
  if (!settings.egress.allow_convert) {
    throw new FeatureDisabledError("convert_disabled");
  }
}

/**
 * Keys retained in `egress.webhook_payload_mode = "minimal"`.
 * Everything else (emails, names, titles, free text, IPs, signatures) is dropped.
 */
const MINIMAL_WEBHOOK_KEY =
  /^(id|.*[Ii]d|publicId|organizationId|documentId|recipientId|webhookId|eventId|eventType|status|type|action|resourceType|resourceId|sequence|hash|entryHash|prevHash|count|.*Count|timestamp|createdAt|updatedAt|signedAt|viewedAt|completedAt|sentAt|declinedAt|expiredAt|voidedAt|attemptCount|maxAttempts|pageCount|fileSize|size|payloadMode|mode|ok|checked|unbrokenPrefix|tipHash|tipSequence|environment|merchantAccountId|fromSequence|toSequence|limit|hasMore|recipients|documents|entries|items|fields)$/;

function redactUnknown(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((item) => redactUnknown(item));
  }
  if (typeof value !== "object") {
    return value;
  }
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(
    value as Record<string, unknown>
  )) {
    if (!MINIMAL_WEBHOOK_KEY.test(key)) continue;
    out[key] = redactUnknown(child);
  }
  return out;
}

export function applyWebhookPayloadMode(
  mode: SealSettings["egress"]["webhook_payload_mode"],
  data: Record<string, unknown>
): Record<string, unknown> {
  if (mode === "full") return data;
  const redacted = redactUnknown(data);
  return isRecord(redacted) ? redacted : {};
}
