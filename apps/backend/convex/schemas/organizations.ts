import { defineTable } from "convex/server";
import { type Infer, v } from "convex/values";

export const organizationTypeTuple = v.union(
  v.literal("personal"),
  v.literal("group"),
  v.literal("company"),
);
export type OrganizationType = Infer<typeof organizationTypeTuple>;

export const organizationStatus = v.union(
  v.literal("active"),
  v.literal("suspended"),
  v.literal("deleted"),
);
export type OrganizationStatus = Infer<typeof organizationStatus>;

export const brandingSettingsValidator = v.object({
  logoStorageId: v.optional(v.id("_storage")),
  logoUrl: v.optional(v.string()),
  brandColor: v.optional(v.string()),
  accentColor: v.optional(v.string()),
  emailFromName: v.optional(v.string()),
  emailReplyTo: v.optional(v.string()),
  hideSealBranding: v.optional(v.boolean()),
  customFooterText: v.optional(v.string()),
  companyName: v.optional(v.string()),
  companyWebsite: v.optional(v.string()),
  enabled: v.boolean(),
});
export type BrandingSettings = Infer<typeof brandingSettingsValidator>;

export const signingSettingsValidator = v.object({
  defaultAuthMethod: v.literal("email"), // Only "email" for v1
  allowedSignatureTypes: v.array(
    v.union(v.literal("draw"), v.literal("type"), v.literal("upload")),
  ),
  esignConsentText: v.optional(v.string()), // null = use Seal default
  defaultDeadlineDays: v.number(), // Default 30
});
export type SigningSettings = Infer<typeof signingSettingsValidator>;

export const notificationSettingsValidator = v.object({
  reminderSchedule: v.array(v.number()), // Days after send, e.g., [3, 7, 14]
  expirationAlertDays: v.number(), // Days before expiry to alert, default 3
  sendCompletionEmail: v.boolean(), // Default true
  sendViewedNotification: v.boolean(), // Default true
});
export type NotificationSettings = Infer<typeof notificationSettingsValidator>;

export const securitySettingsValidator = v.object({
  ipAllowlist: v.optional(v.array(v.string())), // CIDR ranges, null = no restriction
  allowApiAccess: v.boolean(), // Default true
  requireMfa: v.optional(v.boolean()), // Default false
  sessionTimeoutMinutes: v.optional(v.number()), // 15–10080 min, undefined = no timeout
});
export type SecuritySettings = Infer<typeof securitySettingsValidator>;

export const customPaymentRatesValidator = v.object({
  cardRate: v.number(),
  cardFixed: v.number(),
});
export type CustomPaymentRates = Infer<typeof customPaymentRatesValidator>;

export const organizationsTable = defineTable({
  name: v.string(),
  slug: v.string(),
  type: organizationTypeTuple,
  logo: v.optional(v.string()),
  metadata: v.optional(v.string()),
  currency: v.optional(v.string()), // default "USD"
  currencyKind: v.optional(v.string()), // default "normal"
  timezone: v.string(), // default "UTC"
  isActive: v.boolean(),
  clerkId: v.optional(v.string()),

  // Organization status for permission checks
  status: v.optional(organizationStatus), // Optional for backward compatibility

  // AI workspace settings — all users in the org follow these
  aiSettings: v.optional(
    v.object({
      aiEnabled: v.boolean(), // Master switch for all AI features
      aiAutoAnalyze: v.boolean(), // Auto-run AI pipeline on document upload
      aiShowRedlinesToSigners: v.boolean(), // Show annotations to recipients on signing page
    }),
  ),

  // Branding settings for signing pages and emails
  brandingSettings: v.optional(brandingSettingsValidator),

  // Signing defaults for documents
  signingSettings: v.optional(signingSettingsValidator),

  // Notification preferences
  notificationSettings: v.optional(notificationSettingsValidator),

  // Security policies
  securitySettings: v.optional(securitySettingsValidator),

  // Allow document owners/admins to transfer document ownership to another org member
  delegateOwnership: v.optional(v.boolean()),

  // Stripe billing customer for this organization
  stripeCustomerId: v.optional(v.string()),

  // Platform custom payment rates (enterprise only — set by Seal super-admin)
  customPaymentRates: v.optional(customPaymentRatesValidator),

  updatedAt: v.number(),
})
  .index("by_slug", ["slug"])
  .index("by_type", ["type"])
  .index("by_active", ["isActive"])
  .index("by_clerk_id", ["clerkId"])
  .index("by_stripe_customer_id", ["stripeCustomerId"])
  .index("by_status", ["status"]);
