/**
 * @fileoverview Organization settings for the public API.
 * Reads and updates workspace configuration (signing, notifications, AI, security).
 *
 * @module api/v1/settings
 * @requires seal:settings:read for GET, seal:settings:write for PATCH
 */
import { v } from "convex/values";

import type { Doc } from "../../_generated/dataModel";
import {
  type MutationCtx,
  internalMutation,
  internalQuery,
  type QueryCtx,
} from "../../_generated/server";

/** API representation of organization settings */
export interface ApiSettings {
  /** Signing behavior configuration */
  signing: {
    /** Allowed signature input methods */
    allowed_signature_types: ("draw" | "type" | "upload")[];
    /** Default deadline in days before a document expires */
    default_deadline_days: number;
    /** Custom ESIGN consent text (null = use default) */
    esign_consent_text: string | null;
  };
  /** Email notification preferences */
  notifications: {
    /** Days after sending to send automatic reminders */
    reminder_schedule: number[];
    /** Days before deadline to send expiration alert */
    expiration_alert_days: number;
    /** Send email to owner when all parties complete signing */
    send_completion_email: boolean;
    /** Notify owner when a recipient views the document */
    send_viewed_notification: boolean;
  };
  /** AI feature configuration */
  ai: {
    /** Whether AI features are enabled for this workspace */
    enabled: boolean;
    /** Auto-analyze new documents with AI */
    auto_analyze: boolean;
  };
  /** Security configuration */
  security: {
    /** Allowed IP ranges in CIDR notation (empty = all IPs allowed) */
    ip_allowlist: string[];
    /** Whether API access is enabled */
    allow_api_access: boolean;
    /** Require MFA for all members */
    require_mfa: boolean;
    /** Session timeout in minutes (null = browser default) */
    session_timeout_minutes: number | null;
  };
  /** API response metadata */
  metadata_b900811966: {
    /** API version */
    version: string;
    /** ISO 8601 timestamp when the response was generated */
    generated_at: string;
  };
}

/**
 * Partial signing settings update shape
 */
type SigningUpdate = {
  allowed_signature_types?: ("draw" | "type" | "upload")[];
  default_deadline_days?: number;
  esign_consent_text?: string | null;
};

/**
 * Partial notification settings update shape
 */
type NotificationUpdate = {
  reminder_schedule?: number[];
  expiration_alert_days?: number;
  send_completion_email?: boolean;
  send_viewed_notification?: boolean;
};

/**
 * Partial AI settings update shape
 */
type AiUpdate = {
  enabled?: boolean;
  auto_analyze?: boolean;
};

/**
 * Partial security settings update shape
 */
type SecurityUpdate = {
  ip_allowlist?: string[];
  allow_api_access?: boolean;
  require_mfa?: boolean;
  session_timeout_minutes?: number | null;
};

/**
 * Input for updating organization settings.
 * All categories and all fields within each category are optional.
 */
export interface UpdateSettingsInput {
  signing?: SigningUpdate;
  notifications?: NotificationUpdate;
  ai?: AiUpdate;
  security?: SecurityUpdate;
}

type OrganizationDoc = Doc<"organizations">;
type SignatureType = ApiSettings["signing"]["allowed_signature_types"][number];

const DEFAULT_SIGNATURE_TYPES: SignatureType[] = ["draw", "type", "upload"];
const DEFAULT_REMINDER_SCHEDULE = [3, 7, 14];

async function getOrganizationOrThrow(
  ctx: QueryCtx | MutationCtx,
  organizationId: OrganizationDoc["_id"]
): Promise<OrganizationDoc> {
  const organization = await ctx.db.get("organizations", organizationId);
  if (!organization) {
    throw new Error("Organization not found");
  }
  return organization;
}

function buildApiSettings(org: OrganizationDoc): ApiSettings {
  return {
    signing: buildSigningResponse(org),
    notifications: buildNotificationResponse(org),
    ai: buildAiResponse(org),
    security: buildSecurityResponse(org),
    metadata_b900811966: {
      version: "1.0",
      generated_at: new Date().toISOString(),
    },
  };
}

function buildSigningResponse(org: OrganizationDoc): ApiSettings["signing"] {
  return {
    allowed_signature_types:
      org.signingSettings?.allowedSignatureTypes ?? DEFAULT_SIGNATURE_TYPES,
    default_deadline_days: org.signingSettings?.defaultDeadlineDays ?? 30,
    esign_consent_text: org.signingSettings?.esignConsentText ?? null,
  };
}

function buildNotificationResponse(
  org: OrganizationDoc
): ApiSettings["notifications"] {
  return {
    reminder_schedule:
      org.notificationSettings?.reminderSchedule ?? DEFAULT_REMINDER_SCHEDULE,
    expiration_alert_days: org.notificationSettings?.expirationAlertDays ?? 3,
    send_completion_email:
      org.notificationSettings?.sendCompletionEmail ?? true,
    send_viewed_notification:
      org.notificationSettings?.sendViewedNotification ?? true,
  };
}

function buildAiResponse(org: OrganizationDoc): ApiSettings["ai"] {
  return {
    enabled: org.aiSettings?.aiEnabled ?? false,
    auto_analyze: org.aiSettings?.aiAutoAnalyze ?? false,
  };
}

function buildSecurityResponse(org: OrganizationDoc): ApiSettings["security"] {
  return {
    ip_allowlist: org.securitySettings?.ipAllowlist ?? [],
    allow_api_access: org.securitySettings?.allowApiAccess ?? true,
    require_mfa: org.securitySettings?.requireMfa ?? false,
    session_timeout_minutes:
      org.securitySettings?.sessionTimeoutMinutes ?? null,
  };
}

function buildSigningSettings(org: OrganizationDoc, update: SigningUpdate) {
  return {
    defaultAuthMethod: org.signingSettings?.defaultAuthMethod ?? "email",
    allowedSignatureTypes:
      update.allowed_signature_types ??
      org.signingSettings?.allowedSignatureTypes ??
      DEFAULT_SIGNATURE_TYPES,
    defaultDeadlineDays:
      update.default_deadline_days ??
      org.signingSettings?.defaultDeadlineDays ??
      30,
    esignConsentText:
      update.esign_consent_text !== undefined
        ? (update.esign_consent_text ?? undefined)
        : org.signingSettings?.esignConsentText,
  };
}

function buildNotificationSettings(
  org: OrganizationDoc,
  update: NotificationUpdate
) {
  return {
    reminderSchedule:
      update.reminder_schedule ??
      org.notificationSettings?.reminderSchedule ??
      DEFAULT_REMINDER_SCHEDULE,
    expirationAlertDays:
      update.expiration_alert_days ??
      org.notificationSettings?.expirationAlertDays ??
      3,
    sendCompletionEmail:
      update.send_completion_email ??
      org.notificationSettings?.sendCompletionEmail ??
      true,
    sendViewedNotification:
      update.send_viewed_notification ??
      org.notificationSettings?.sendViewedNotification ??
      true,
  };
}

function buildAiSettings(org: OrganizationDoc, update: AiUpdate) {
  return {
    aiEnabled: update.enabled ?? org.aiSettings?.aiEnabled ?? false,
    aiAutoAnalyze:
      update.auto_analyze ?? org.aiSettings?.aiAutoAnalyze ?? false,
    aiShowRedlinesToSigners: org.aiSettings?.aiShowRedlinesToSigners ?? false,
  };
}

function buildSecuritySettings(org: OrganizationDoc, update: SecurityUpdate) {
  // SEA-604: ignore require_mfa / session_timeout_minutes writes — Core VOR-183.
  return {
    allowApiAccess:
      update.allow_api_access ?? org.securitySettings?.allowApiAccess ?? true,
    ipAllowlist: update.ip_allowlist ?? org.securitySettings?.ipAllowlist ?? [],
    requireMfa: org.securitySettings?.requireMfa ?? false,
    sessionTimeoutMinutes: org.securitySettings?.sessionTimeoutMinutes,
  };
}

/**
 * Internal query to read current organization settings.
 *
 * @internal
 */
export const getSettings = internalQuery({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args): Promise<ApiSettings> => {
    const organization = await getOrganizationOrThrow(ctx, args.organizationId);
    return buildApiSettings(organization);
  },
});

/** Validator for the signing-settings update payload (shared with HTTP layer). */
export const vSigningSettingsUpdate = v.object({
  allowed_signature_types: v.optional(
    v.array(v.union(v.literal("draw"), v.literal("type"), v.literal("upload")))
  ),
  default_deadline_days: v.optional(v.number()),
  esign_consent_text: v.optional(v.union(v.string(), v.null())),
});

/** Validator for the notification-settings update payload (shared with HTTP layer). */
export const vNotificationSettingsUpdate = v.object({
  reminder_schedule: v.optional(v.array(v.number())),
  expiration_alert_days: v.optional(v.number()),
  send_completion_email: v.optional(v.boolean()),
  send_viewed_notification: v.optional(v.boolean()),
});

/** Validator for the AI-settings update payload (shared with HTTP layer). */
export const vAiSettingsUpdate = v.object({
  enabled: v.optional(v.boolean()),
  auto_analyze: v.optional(v.boolean()),
});

/** Validator for the security-settings update payload (shared with HTTP layer). */
export const vSecuritySettingsUpdate = v.object({
  ip_allowlist: v.optional(v.array(v.string())),
  allow_api_access: v.optional(v.boolean()),
  require_mfa: v.optional(v.boolean()),
  session_timeout_minutes: v.optional(v.union(v.number(), v.null())),
});

/**
 * Internal mutation to update organization settings.
 *
 * @internal
 */
export const updateSettings = internalMutation({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    signing: v.optional(vSigningSettingsUpdate),
    notifications: v.optional(vNotificationSettingsUpdate),
    ai: v.optional(vAiSettingsUpdate),
    security: v.optional(vSecuritySettingsUpdate),
  },
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    const organization = await getOrganizationOrThrow(ctx, args.organizationId);

    const patches = [
      args.signing
        ? { signingSettings: buildSigningSettings(organization, args.signing) }
        : null,
      args.notifications
        ? {
            notificationSettings: buildNotificationSettings(
              organization,
              args.notifications
            ),
          }
        : null,
      args.ai ? { aiSettings: buildAiSettings(organization, args.ai) } : null,
      args.security
        ? {
            securitySettings: buildSecuritySettings(
              organization,
              args.security
            ),
          }
        : null,
    ];

    for (const patch of patches) {
      if (patch) {
        await ctx.db.patch("organizations", args.organizationId, patch);
      }
    }

    return { success: true };
  },
});
