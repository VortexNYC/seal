/**
 * @fileoverview Organization settings for the public API.
 * Reads and updates workspace configuration (signing, notifications, AI, security).
 *
 * @module api/v1/settings
 * @requires seal:settings:read for GET, seal:settings:write for PATCH
 */
import { v } from "convex/values";

import { internalMutation, internalQuery } from "../../_generated/server";

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
    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new Error("Organization not found");

    return {
      signing: {
        allowed_signature_types: (org.signingSettings?.allowedSignatureTypes ?? [
          "draw",
          "type",
          "upload",
        ]) as ("draw" | "type" | "upload")[],
        default_deadline_days: org.signingSettings?.defaultDeadlineDays ?? 30,
        esign_consent_text: org.signingSettings?.esignConsentText ?? null,
      },
      notifications: {
        reminder_schedule: org.notificationSettings?.reminderSchedule ?? [3, 7, 14],
        expiration_alert_days: org.notificationSettings?.expirationAlertDays ?? 3,
        send_completion_email: org.notificationSettings?.sendCompletionEmail ?? true,
        send_viewed_notification: org.notificationSettings?.sendViewedNotification ?? true,
      },
      ai: {
        enabled: org.aiSettings?.aiEnabled ?? false,
        auto_analyze: org.aiSettings?.aiAutoAnalyze ?? false,
      },
      security: {
        ip_allowlist: org.securitySettings?.ipAllowlist ?? [],
        allow_api_access: org.securitySettings?.allowApiAccess ?? true,
        require_mfa: org.securitySettings?.requireMfa ?? false,
        session_timeout_minutes: org.securitySettings?.sessionTimeoutMinutes ?? null,
      },
    };
  },
});

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

/**
 * Internal mutation to update organization settings.
 *
 * @internal
 */
export const updateSettings = internalMutation({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    signing: v.optional(
      v.object({
        allowed_signature_types: v.optional(
          v.array(v.union(v.literal("draw"), v.literal("type"), v.literal("upload"))),
        ),
        default_deadline_days: v.optional(v.number()),
        esign_consent_text: v.optional(v.union(v.string(), v.null())),
      }),
    ),
    notifications: v.optional(
      v.object({
        reminder_schedule: v.optional(v.array(v.number())),
        expiration_alert_days: v.optional(v.number()),
        send_completion_email: v.optional(v.boolean()),
        send_viewed_notification: v.optional(v.boolean()),
      }),
    ),
    ai: v.optional(
      v.object({
        enabled: v.optional(v.boolean()),
        auto_analyze: v.optional(v.boolean()),
      }),
    ),
    security: v.optional(
      v.object({
        ip_allowlist: v.optional(v.array(v.string())),
        allow_api_access: v.optional(v.boolean()),
        require_mfa: v.optional(v.boolean()),
        session_timeout_minutes: v.optional(v.union(v.number(), v.null())),
      }),
    ),
  },
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new Error("Organization not found");

    if (args.signing) {
      await ctx.db.patch(args.organizationId, {
        signingSettings: {
          defaultAuthMethod: org.signingSettings?.defaultAuthMethod ?? "email",
          allowedSignatureTypes:
            args.signing.allowed_signature_types ??
            org.signingSettings?.allowedSignatureTypes ??
            (["draw", "type", "upload"] as const),
          defaultDeadlineDays:
            args.signing.default_deadline_days ?? org.signingSettings?.defaultDeadlineDays ?? 30,
          esignConsentText:
            args.signing.esign_consent_text !== undefined
              ? (args.signing.esign_consent_text ?? undefined)
              : org.signingSettings?.esignConsentText,
        },
      });
    }

    if (args.notifications) {
      await ctx.db.patch(args.organizationId, {
        notificationSettings: {
          reminderSchedule: args.notifications.reminder_schedule ??
            org.notificationSettings?.reminderSchedule ?? [3, 7, 14],
          expirationAlertDays:
            args.notifications.expiration_alert_days ??
            org.notificationSettings?.expirationAlertDays ??
            3,
          sendCompletionEmail:
            args.notifications.send_completion_email ??
            org.notificationSettings?.sendCompletionEmail ??
            true,
          sendViewedNotification:
            args.notifications.send_viewed_notification ??
            org.notificationSettings?.sendViewedNotification ??
            true,
        },
      });
    }

    if (args.ai) {
      await ctx.db.patch(args.organizationId, {
        aiSettings: {
          aiEnabled: args.ai.enabled ?? org.aiSettings?.aiEnabled ?? false,
          aiAutoAnalyze: args.ai.auto_analyze ?? org.aiSettings?.aiAutoAnalyze ?? false,
          aiShowRedlinesToSigners: org.aiSettings?.aiShowRedlinesToSigners ?? false,
        },
      });
    }

    if (args.security) {
      await ctx.db.patch(args.organizationId, {
        securitySettings: {
          allowApiAccess:
            args.security.allow_api_access ?? org.securitySettings?.allowApiAccess ?? true,
          ipAllowlist: args.security.ip_allowlist ?? org.securitySettings?.ipAllowlist ?? [],
          requireMfa: args.security.require_mfa ?? org.securitySettings?.requireMfa ?? false,
          sessionTimeoutMinutes:
            args.security.session_timeout_minutes !== undefined
              ? (args.security.session_timeout_minutes ?? undefined)
              : org.securitySettings?.sessionTimeoutMinutes,
        },
      });
    }

    return { success: true };
  },
});
