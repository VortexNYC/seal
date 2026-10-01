import { z } from "zod";

import { toContactStatus, type ContactStatus } from "@/lib/contact-status";
import {
  toWorkflowStatus,
  type DocumentWorkflowStatus,
} from "@/lib/document-status";
const documentTrendSchema = z.object({
  date: z.string(),
  created: z.number().int(),
  completed: z.number().int(),
});
const documentStatsSchema = z.object({
  total: z.number().int(),
  pending: z.number().int(),
  draft: z.number().int(),
  sent: z.number().int(),
  inProgress: z.number().int(),
  completed: z.number().int(),
  cancelled: z.number().int(),
  declined: z.number().int(),
  expired: z.number().int(),
  completionRate: z.number(),
  createdThisMonth: z.number().int(),
  completedThisMonth: z.number().int(),
});
const analyticsStatsSchema = z.object({
  total: z.number().int(),
  draft: z.number().int(),
  sent: z.number().int(),
  inProgress: z.number().int(),
  completed: z.number().int(),
  cancelled: z.number().int(),
  declined: z.number().int(),
  expired: z.number().int(),
  pending: z.number().int(),
  completionRate: z.number().int(),
  avgSigningTimeMs: z.number().int().nullable(),
  isAdmin: z.boolean(),
});
const recentDocumentSchema = z.object({
  _id: z.string(),
  name: z.string(),
  updatedAt: z.number(),
  signedCount: z.number().int(),
  recipientCount: z.number().int(),
  status: z.string(),
  thumbnailDataUrl: z.string().nullable().optional(),
});
const documentAttentionSchema = z.object({
  totalIssues: z.number().int(),
  staleRecipients: z.array(
    z.object({
      documentId: z.string(),
      documentName: z.string(),
      recipientName: z.string(),
      recipientEmail: z.string(),
      daysPending: z.number().int(),
    })
  ),
  approachingDeadline: z.array(
    z.object({
      documentId: z.string(),
      documentName: z.string(),
      deadline: z.number(),
      daysRemaining: z.number().int(),
      unsignedCount: z.number().int(),
    })
  ),
  bouncedEmails: z.array(
    z.object({
      documentId: z.string(),
      documentName: z.string(),
      recipientEmail: z.string(),
    })
  ),
});
const activitySchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  action: z.string(),
  actorName: z.string(),
  targetName: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  timestamp: z.number(),
});
const contactSchema = z.object({
  id: z.string(),
  publicId: z.string(),
  organizationId: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  fullName: z.string(),
  email: z.string(),
  phone: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  status: z.string(),
  notes: z.string().nullable().optional(),
  tags: z.array(z.string()),
  lastContactedAt: z.number().nullable().optional(),
  createdBy: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
});
const relatedDocumentSchema = z.object({
  id: z.string(),
  name: z.string(),
  workflowStatus: z.string(),
  role: z.string(),
});
const notificationTypeSchema = z.enum([
  "document_shared",
  "access_revoked",
  "access_updated",
  "ownership_transferred",
  "document_signed",
  "document_completed",
  "signature_requested",
  "reminder",
  "sharing_disabled",
  "bulk_access_revoked",
]);
const notificationEmailStatusSchema = z.enum([
  "pending",
  "sent",
  "failed",
  "not_applicable",
]);
const notificationSchema = z.object({
  _id: z.string(),
  userId: z.string(),
  organizationId: z.string(),
  type: notificationTypeSchema,
  data: z.record(z.string(), z.unknown()),
  read: z.boolean(),
  readAt: z.number().optional(),
  emailStatus: notificationEmailStatusSchema.optional(),
  emailSentAt: z.number().optional(),
  emailAttempts: z.number().int().optional(),
  lastEmailError: z.string().optional(),
  emailMessageId: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type ApiDocumentStats = z.infer<typeof documentStatsSchema>;
export type ApiAnalyticsStats = z.infer<typeof analyticsStatsSchema>;
export type ApiDocumentTrend = z.infer<typeof documentTrendSchema>;
export type ApiRecentDocument = {
  _id: string;
  name: string;
  updatedAt: number;
  signedCount: number;
  recipientCount: number;
  workflowStatus: DocumentWorkflowStatus;
  thumbnailDataUrl: string | null | undefined;
};
export type ApiDocumentAttention = z.infer<typeof documentAttentionSchema>;
export type ApiActivity = z.infer<typeof activitySchema>;
export type ApiNotification = z.infer<typeof notificationSchema>;
export type ApiNotificationType = z.infer<typeof notificationTypeSchema>;
export type ApiNotificationEmailStatus = z.infer<
  typeof notificationEmailStatusSchema
>;
export type ApiContact = {
  _id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone?: string | null;
  company?: string | null;
  title?: string | null;
  status: ContactStatus;
  notes?: string | null;
  tags?: string[];
  lastContactedAt?: number | null;
  createdBy?: string;
  createdAt: number;
  updatedAt: number;
};
export type ApiRelatedDocument = z.infer<typeof relatedDocumentSchema>;
function getBaseUrl(): string {
  const value: unknown = import.meta.env.VITE_API_URL;
  if (typeof value === "string" && value.length > 0) {
    return value.replace(/\/$/, "");
  }
  return "";
}
/** Many mutation routes return `{ success: true }` rather than 204/empty. */
const mutationOkSchema = z.union([
  z.undefined(),
  z.null(),
  z.object({ success: z.literal(true) }),
]);

async function apiFetch<T>(
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit
): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "Unknown error");
    throw new Error(`API error ${response.status}: ${text}`);
  }
  if (response.status === 204) {
    return schema.parse(undefined);
  }
  const data: unknown = await response.json();
  return schema.parse(data);
}
const brandingSettingsSchema = z.record(z.string(), z.unknown());
export type ApiBrandingSettings = z.infer<typeof brandingSettingsSchema>;
export async function getBrandingSettings(
  organizationSlug: string
): Promise<ApiBrandingSettings> {
  return apiFetch(
    `/api/organizations/${encodeURIComponent(organizationSlug)}/branding`,
    brandingSettingsSchema
  );
}
const templateListItemSchema = z.object({
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
});
export type ApiTemplateListItem = z.infer<typeof templateListItemSchema>;
export async function getOrganizationTemplates(
  organizationSlug: string,
  folderId?: string
): Promise<ApiTemplateListItem[]> {
  const url = new URL(
    `/api/organizations/${encodeURIComponent(organizationSlug)}/templates`,
    window.location.origin
  );
  if (folderId) {
    url.searchParams.set("folderId", folderId);
  }
  return apiFetch(
    `${url.pathname}${url.search}`,
    z.array(templateListItemSchema)
  );
}
const useTemplateResponseSchema = z.object({
  documentId: z.string(),
});
export async function useTemplate(
  organizationSlug: string,
  templateId: string,
  input: {
    documentName?: string;
  }
): Promise<{
  documentId: string;
}> {
  return apiFetch(
    `/api/organizations/${encodeURIComponent(organizationSlug)}/templates/${encodeURIComponent(templateId)}/use`,
    useTemplateResponseSchema,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}
export async function updateTemplate(
  organizationSlug: string,
  templateId: string,
  input: {
    name?: string;
    description?: string | null;
  }
): Promise<ApiTemplateListItem> {
  return apiFetch(
    `/api/organizations/${encodeURIComponent(organizationSlug)}/templates/${encodeURIComponent(templateId)}`,
    templateListItemSchema,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    }
  );
}
export async function deleteTemplate(
  organizationSlug: string,
  templateId: string
): Promise<void> {
  await apiFetch(
    `/api/organizations/${encodeURIComponent(organizationSlug)}/templates/${encodeURIComponent(templateId)}`,
    z.void(),
    {
      method: "DELETE",
    }
  );
}
export async function moveTemplateToFolder(
  organizationSlug: string,
  templateId: string,
  folderId?: string
): Promise<void> {
  await apiFetch(
    `/api/organizations/${encodeURIComponent(organizationSlug)}/templates/${encodeURIComponent(templateId)}/folder`,
    z.void(),
    {
      method: "PATCH",
      body: JSON.stringify({
        folderId: folderId ?? null,
      }),
    }
  );
}
const emailPreferencesSchema = z.object({
  enabled: z.boolean(),
  documentEvents: z.boolean(),
  reminders: z.boolean(),
  weeklyDigest: z.boolean(),
});
const notificationPreferencesSchema = z.object({
  email: emailPreferencesSchema,
  inApp: z.boolean(),
  desktop: z.boolean(),
  frequency: z.enum(["instant", "daily", "weekly"]),
});
export type ApiNotificationPreferences = z.infer<
  typeof notificationPreferencesSchema
>;
export async function getUserNotificationPreferences(): Promise<ApiNotificationPreferences> {
  return apiFetch(
    "/api/users/me/notification-preferences",
    notificationPreferencesSchema
  );
}
export async function updateUserNotificationPreferences(
  input: Partial<ApiNotificationPreferences>
): Promise<ApiNotificationPreferences> {
  return apiFetch(
    "/api/users/me/notification-preferences",
    notificationPreferencesSchema,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    }
  );
}
const usageStatisticsSchema = z.object({
  totalDocuments: z.number().int(),
  workflowCounts: z.object({
    draft: z.number().int(),
    sent: z.number().int(),
    in_progress: z.number().int(),
    completed: z.number().int(),
    cancelled: z.number().int(),
    declined: z.number().int(),
  }),
  documentsThisMonth: z.number().int(),
  sentThisMonth: z.number().int(),
  completedThisMonth: z.number().int(),
  storageUsedBytes: z.number().int(),
  storageLimitBytes: z.number().int(),
  storagePercentUsed: z.number(),
  plan: z.string(),
  documentsLimit: z.number().int(),
  documentsPercentUsed: z.number(),
  completionRate: z.number().int(),
});
export type ApiUsageStatistics = z.infer<typeof usageStatisticsSchema>;
export async function getUserUsageStatistics(
  organizationSlug: string
): Promise<ApiUsageStatistics> {
  return apiFetch(
    `/api/users/${encodeURIComponent(organizationSlug)}/me/usage`,
    usageStatisticsSchema
  );
}
const connectedAppSchema = z.object({
  id: z.string(),
  appName: z.string(),
  active: z.boolean(),
  connectedAt: z.number(),
  lastActivityAt: z.number().nullable(),
  scopes: z.array(z.string()),
});
export type ApiConnectedApp = z.infer<typeof connectedAppSchema>;
const integrationActivityLogSchema = z.object({
  id: z.string(),
  type: z.string(),
  integrationName: z.string(),
  action: z.string(),
  details: z.string().nullable(),
  createdAt: z.number(),
});
export type ApiIntegrationActivityLog = z.infer<
  typeof integrationActivityLogSchema
>;
export async function getConnectedApps(): Promise<ApiConnectedApp[]> {
  return apiFetch("/api/users/me/connected-apps", z.array(connectedAppSchema));
}
export async function getIntegrationActivity(): Promise<
  ApiIntegrationActivityLog[]
> {
  return apiFetch(
    "/api/users/me/integration-activity",
    z.array(integrationActivityLogSchema)
  );
}
export async function disconnectConnectedApp(id: string): Promise<void> {
  return apiFetch(`/api/users/me/connected-apps/${id}`, z.void(), {
    method: "DELETE",
  });
}
const subscriptionSchema = z.object({
  plan: z.string(),
});
export async function getCurrentSubscription(): Promise<{
  plan: string;
}> {
  return apiFetch("/api/users/me/subscription", subscriptionSchema);
}
const feedbackResponseSchema = z.object({ id: z.string() });
export async function submitFeedback(
  organizationSlug: string,
  input: {
    type: "bug" | "suggestion";
    message: string;
    route?: string;
  }
): Promise<{
  id: string;
}> {
  return apiFetch(
    `/api/feedback/${encodeURIComponent(organizationSlug)}`,
    feedbackResponseSchema,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}
const aiSettingsSchema = z.object({
  aiEnabled: z.boolean(),
  aiAutoAnalyze: z.boolean(),
  aiShowRedlinesToSigners: z.boolean(),
});
export type ApiAiSettings = z.infer<typeof aiSettingsSchema>;
export async function getAiSettings(
  organizationSlug: string
): Promise<ApiAiSettings> {
  return apiFetch(
    `/api/organizations/${encodeURIComponent(organizationSlug)}/ai`,
    aiSettingsSchema
  );
}
export async function updateAiSettings(
  organizationSlug: string,
  input: {
    aiEnabled?: boolean;
    aiAutoAnalyze?: boolean;
    aiShowRedlinesToSigners?: boolean;
  }
): Promise<ApiAiSettings> {
  return apiFetch(
    `/api/organizations/${encodeURIComponent(organizationSlug)}/ai`,
    aiSettingsSchema,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    }
  );
}
const securitySettingsSchema = z.object({
  ipAllowlist: z.array(z.string()),
  allowApiAccess: z.boolean(),
  ssoEnforced: z.boolean().optional().default(false),
});
export type ApiSecuritySettings = z.infer<typeof securitySettingsSchema>;
export async function getSecuritySettings(
  organizationSlug: string
): Promise<ApiSecuritySettings> {
  return apiFetch(
    `/api/organizations/${encodeURIComponent(organizationSlug)}/security`,
    securitySettingsSchema
  );
}
export async function updateSecuritySettings(
  organizationSlug: string,
  input: {
    ipAllowlist?: string[];
    allowApiAccess?: boolean;
    ssoEnforced?: boolean;
  }
): Promise<ApiSecuritySettings> {
  return apiFetch(
    `/api/organizations/${encodeURIComponent(organizationSlug)}/security`,
    securitySettingsSchema,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    }
  );
}
const notificationSettingsSchema = z.object({
  reminderSchedule: z.array(z.number().int()),
  expirationAlertDays: z.number().int(),
  sendCompletionEmail: z.boolean(),
  sendViewedNotification: z.boolean(),
});
export type ApiNotificationSettings = z.infer<
  typeof notificationSettingsSchema
>;
export async function getNotificationSettings(
  organizationSlug: string
): Promise<ApiNotificationSettings> {
  return apiFetch(
    `/api/organizations/${encodeURIComponent(organizationSlug)}/notifications`,
    notificationSettingsSchema
  );
}
export async function updateNotificationSettings(
  organizationSlug: string,
  input: {
    reminderSchedule?: number[];
    expirationAlertDays?: number;
    sendCompletionEmail?: boolean;
    sendViewedNotification?: boolean;
  }
): Promise<ApiNotificationSettings> {
  return apiFetch(
    `/api/organizations/${encodeURIComponent(organizationSlug)}/notifications`,
    notificationSettingsSchema,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    }
  );
}
const signingSettingsSchema = z.object({
  allowedSignatureTypes: z.array(
    z.union([z.literal("draw"), z.literal("type"), z.literal("upload")])
  ),
  esignConsentText: z.string().nullable().optional(),
  privacyNoticeText: z.string().nullable().optional(),
  defaultDeadlineDays: z.number().int(),
  requireRecipientAuth: z.boolean(),
  requireSignerAccount: z.boolean(),
  defaultRecipientAuthMethod: z.enum(["email_otp", "access_code"]),
});
export type ApiSigningSettings = z.infer<typeof signingSettingsSchema>;
export async function getSigningSettings(
  organizationSlug: string
): Promise<ApiSigningSettings> {
  return apiFetch(
    `/api/organizations/${encodeURIComponent(organizationSlug)}/signing`,
    signingSettingsSchema
  );
}
export async function updateSigningSettings(
  organizationSlug: string,
  input: {
    allowedSignatureTypes?: Array<"draw" | "type" | "upload">;
    esignConsentText?: string;
    privacyNoticeText?: string;
    defaultDeadlineDays?: number;
    requireRecipientAuth?: boolean;
    requireSignerAccount?: boolean;
    defaultRecipientAuthMethod?: "email_otp" | "access_code";
  }
): Promise<ApiSigningSettings> {
  return apiFetch(
    `/api/organizations/${encodeURIComponent(organizationSlug)}/signing`,
    signingSettingsSchema,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    }
  );
}
export async function updateBrandingSettings(
  organizationSlug: string,
  input: {
    enabled?: boolean;
    hideSealBranding?: boolean;
    customFooterText?: string;
  }
): Promise<ApiBrandingSettings> {
  return apiFetch(
    `/api/organizations/${encodeURIComponent(organizationSlug)}/branding`,
    brandingSettingsSchema,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    }
  );
}
export async function getDocumentStats(
  organizationSlug: string
): Promise<ApiDocumentStats> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/stats`,
    documentStatsSchema
  );
}
export async function getAnalyticsStats(
  organizationSlug: string,
  scope: "personal" | "team" = "team"
): Promise<ApiAnalyticsStats> {
  return apiFetch(
    `/api/analytics/${encodeURIComponent(organizationSlug)}/stats?scope=${encodeURIComponent(scope)}`,
    analyticsStatsSchema
  );
}
export async function getAnalyticsTrends(
  organizationSlug: string,
  input:
    | {
        days: number;
        scope: "personal" | "team";
      }
    | {
        startDate: number;
        endDate: number;
        scope: "personal" | "team";
      }
): Promise<ApiDocumentTrend[]> {
  if ("days" in input) {
    return apiFetch(
      `/api/analytics/${encodeURIComponent(organizationSlug)}/trends?days=${encodeURIComponent(input.days)}&scope=${encodeURIComponent(input.scope)}`,
      z.array(documentTrendSchema)
    );
  }
  return apiFetch(
    `/api/analytics/${encodeURIComponent(organizationSlug)}/trends?startDate=${encodeURIComponent(input.startDate)}&endDate=${encodeURIComponent(input.endDate)}&scope=${encodeURIComponent(input.scope)}`,
    z.array(documentTrendSchema)
  );
}
const analyticsPeriodStatsSchema = z.object({
  created: z.number().int(),
  completed: z.number().int(),
  period: z.string(),
});
export type ApiAnalyticsPeriodStats = z.infer<
  typeof analyticsPeriodStatsSchema
>;
const memberActivitySchema = z.object({
  userId: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.string(),
  created: z.number().int(),
  completed: z.number().int(),
  pending: z.number().int(),
  completionRate: z.number().int(),
  avgSigningTimeMs: z.number().int().nullable(),
});
export type ApiMemberActivity = z.infer<typeof memberActivitySchema>;
const emailEngagementSchema = z.object({
  total: z.number().int(),
  deliveryRate: z.number().int(),
  openRate: z.number().int(),
  clickRate: z.number().int(),
  bounceRate: z.number().int(),
  avgTimeToOpen: z.number().int().nullable(),
});
export type ApiEmailEngagement = z.infer<typeof emailEngagementSchema>;
const timingBucketSchema = z.object({
  bucket: z.string(),
  count: z.number().int(),
});
const recipientTimingSchema = z.object({
  sampleSize: z.number().int(),
  avgTimeToView: z.number().int().nullable(),
  avgTimeToSign: z.number().int().nullable(),
  avgTotalTurnaround: z.number().int().nullable(),
  distribution: z.array(timingBucketSchema),
});
export type ApiRecipientTiming = z.infer<typeof recipientTimingSchema>;
const templatePerformanceSchema = z.object({
  templateId: z.string(),
  templateName: z.string(),
  docsSent: z.number().int(),
  completionRate: z.number().int(),
  avgTurnaround: z.number().int().nullable(),
  declineRate: z.number().int(),
});
export type ApiTemplatePerformance = z.infer<typeof templatePerformanceSchema>;
export async function getTemplatePerformance(
  organizationSlug: string,
  days = 90
): Promise<ApiTemplatePerformance[]> {
  return apiFetch(
    `/api/analytics/${encodeURIComponent(organizationSlug)}/template-performance?days=${encodeURIComponent(days)}`,
    z.array(templatePerformanceSchema)
  );
}
export async function getRecipientTimingStats(
  organizationSlug: string,
  days = 30
): Promise<ApiRecipientTiming> {
  return apiFetch(
    `/api/analytics/${encodeURIComponent(organizationSlug)}/recipient-timing?days=${encodeURIComponent(days)}`,
    recipientTimingSchema
  );
}
export async function getEmailEngagementStats(
  organizationSlug: string,
  days = 30
): Promise<ApiEmailEngagement> {
  return apiFetch(
    `/api/analytics/${encodeURIComponent(organizationSlug)}/email-engagement?days=${encodeURIComponent(days)}`,
    emailEngagementSchema
  );
}
const exportDocumentSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  ownerName: z.string(),
  ownerEmail: z.string(),
  createdAt: z.number(),
  sentAt: z.number().nullable(),
  completedAt: z.number().nullable(),
  deadline: z.number().nullable(),
  recipientCount: z.number().int(),
  signedCount: z.number().int(),
  pendingCount: z.number().int(),
});
export type ApiExportDocument = z.infer<typeof exportDocumentSchema>;
export async function getAnalyticsDocumentsForExport(
  organizationSlug: string,
  args: {
    workflowStatus?: string;
    startDate?: number;
    endDate?: number;
  } = {}
): Promise<ApiExportDocument[]> {
  const params = new URLSearchParams();
  if (args.workflowStatus) params.set("workflowStatus", args.workflowStatus);
  if (args.startDate !== undefined)
    params.set("startDate", String(args.startDate));
  if (args.endDate !== undefined) params.set("endDate", String(args.endDate));
  const query = params.toString();
  return apiFetch(
    `/api/analytics/${encodeURIComponent(organizationSlug)}/documents/export${query ? `?${query}` : ""}`,
    z.array(exportDocumentSchema)
  );
}
export async function getMemberActivity(
  organizationSlug: string
): Promise<ApiMemberActivity[]> {
  return apiFetch(
    `/api/analytics/${encodeURIComponent(organizationSlug)}/member-activity`,
    z.array(memberActivitySchema)
  );
}
export async function getAnalyticsPeriodStats(
  organizationSlug: string,
  period: "today" | "week" | "month" | "year",
  scope: "personal" | "team"
): Promise<ApiAnalyticsPeriodStats> {
  return apiFetch(
    `/api/analytics/${encodeURIComponent(organizationSlug)}/period-stats?period=${encodeURIComponent(period)}&scope=${encodeURIComponent(scope)}`,
    analyticsPeriodStatsSchema
  );
}
export async function getDocumentTrends(
  organizationSlug: string,
  days = 30
): Promise<ApiDocumentTrend[]> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/trends?days=${encodeURIComponent(days)}`,
    z.array(documentTrendSchema)
  );
}
export async function getRecentActivity(
  organizationSlug: string,
  limit = 10
): Promise<ApiActivity[]> {
  return apiFetch(
    `/api/activity/${encodeURIComponent(organizationSlug)}?limit=${encodeURIComponent(limit)}`,
    z.array(activitySchema)
  );
}
export async function getRecentDocuments(
  organizationSlug: string,
  limit = 5
): Promise<ApiRecentDocument[]> {
  const rows = await apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/recent?limit=${encodeURIComponent(limit)}`,
    z.array(recentDocumentSchema)
  );
  return rows.map((row) => ({
    _id: row._id,
    name: row.name,
    updatedAt: row.updatedAt,
    signedCount: row.signedCount,
    recipientCount: row.recipientCount,
    workflowStatus: toWorkflowStatus(row.status),
    thumbnailDataUrl: row.thumbnailDataUrl,
  }));
}
export async function getDocumentAttention(
  organizationSlug: string
): Promise<ApiDocumentAttention> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/attention`,
    documentAttentionSchema
  );
}
type ContactListParams = {
  search?: string;
  status?: "active" | "inactive" | "lead";
};
function toApiContact(row: z.infer<typeof contactSchema>): ApiContact {
  return {
    _id: row.publicId,
    firstName: row.firstName,
    lastName: row.lastName,
    fullName: row.fullName,
    email: row.email,
    phone: row.phone,
    company: row.company,
    title: row.title,
    status: toContactStatus(row.status),
    notes: row.notes,
    tags: row.tags,
    lastContactedAt: row.lastContactedAt,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
export async function getContacts(
  organizationSlug: string,
  params: ContactListParams = {}
): Promise<ApiContact[]> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.status) query.set("status", params.status);
  const queryString = query.toString();
  const path = `/api/contacts/${encodeURIComponent(organizationSlug)}${queryString ? `?${queryString}` : ""}`;
  const rows = await apiFetch(path, z.array(contactSchema));
  return rows.map(toApiContact);
}
export async function getContactByEmail(
  organizationSlug: string,
  email: string
): Promise<ApiContact | null> {
  const row = await apiFetch(
    `/api/contacts/${encodeURIComponent(organizationSlug)}/by-email?email=${encodeURIComponent(email)}`,
    contactSchema.nullable()
  );
  return row ? toApiContact(row) : null;
}
export async function getContact(
  organizationSlug: string,
  publicId: string
): Promise<ApiContact> {
  const row = await apiFetch(
    `/api/contacts/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}`,
    contactSchema
  );
  return toApiContact(row);
}
type ContactInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
  title?: string;
  status?: "active" | "inactive" | "lead";
  notes?: string;
  tags?: string[];
  lastContactedAt?: number;
};
export async function createContact(
  organizationSlug: string,
  input: ContactInput
): Promise<ApiContact> {
  const row = await apiFetch(
    `/api/contacts/${encodeURIComponent(organizationSlug)}`,
    contactSchema,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
  return toApiContact(row);
}
export async function updateContact(
  organizationSlug: string,
  publicId: string,
  input: Partial<ContactInput>
): Promise<ApiContact> {
  const row = await apiFetch(
    `/api/contacts/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}`,
    contactSchema,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    }
  );
  return toApiContact(row);
}
export async function deleteContact(
  organizationSlug: string,
  publicId: string
): Promise<void> {
  await apiFetch(
    `/api/contacts/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}`,
    z.void(),
    {
      method: "DELETE",
    }
  );
}
export async function bulkDeleteContacts(
  organizationSlug: string,
  publicIds: string[]
): Promise<
  {
    id: string;
    success: boolean;
  }[]
> {
  return apiFetch(
    `/api/contacts/${encodeURIComponent(organizationSlug)}/bulk-delete`,
    z.array(
      z.object({
        id: z.string(),
        success: z.boolean(),
      })
    ),
    {
      method: "POST",
      body: JSON.stringify({ ids: publicIds }),
    }
  );
}
export async function getContactRelatedDocuments(
  organizationSlug: string,
  email: string
): Promise<ApiRelatedDocument[]> {
  return apiFetch(
    `/api/contacts/${encodeURIComponent(organizationSlug)}/related-documents?email=${encodeURIComponent(email)}`,
    z.array(relatedDocumentSchema)
  );
}
export async function getNotifications(
  organizationSlug: string,
  limit = 20
): Promise<ApiNotification[]> {
  return apiFetch(
    `/api/notifications/${encodeURIComponent(organizationSlug)}?limit=${encodeURIComponent(limit)}`,
    z.array(notificationSchema)
  );
}
export async function getUnreadNotificationCount(
  organizationSlug: string
): Promise<number> {
  const result = await apiFetch(
    `/api/notifications/${encodeURIComponent(organizationSlug)}/unread-count`,
    z.object({ count: z.number().int() })
  );
  return result.count;
}
export async function markNotificationAsRead(
  organizationSlug: string,
  publicId: string
): Promise<ApiNotification> {
  return apiFetch(
    `/api/notifications/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}/read`,
    notificationSchema,
    { method: "POST" }
  );
}
export async function markAllNotificationsAsRead(
  organizationSlug: string
): Promise<number> {
  const result = await apiFetch(
    `/api/notifications/${encodeURIComponent(organizationSlug)}/read-all`,
    z.object({ count: z.number().int() }),
    { method: "POST" }
  );
  return result.count;
}
const folderSchema = z.object({
  id: z.string(),
  publicId: z.string(),
  organizationId: z.string(),
  name: z.string(),
  parentId: z.string().nullable().optional(),
  type: z.string(),
  visibility: z.string(),
  pinned: z.boolean(),
  createdBy: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type ApiFolder = z.infer<typeof folderSchema>;
const documentSchema = z.object({
  id: z.string(),
  publicId: z.string(),
  organizationId: z.string(),
  ownerId: z.string(),
  folderId: z.string().nullable().optional(),
  name: z.string(),
  description: z.string().nullable().optional(),
  status: z.string(),
  documentStatus: z.string(),
  workflowStatus: z.string(),
  sharingMode: z.string(),
  signingMode: z.string().nullable().optional(),
  aiProcessingStatus: z.string().nullable().optional(),
  storageKey: z.string().nullable().optional(),
  contentType: z.string().nullable().optional(),
  size: z.number().int().nullable().optional(),
  fileSize: z.number().int().nullable().optional(),
  pageCount: z.number().int().nullable().optional(),
  pdf_type: z.string().nullable().optional(),
  ocr_required: z.boolean().nullable().optional(),
  thumbnailDataUrl: z.string().nullable().optional(),
  redirectUrl: z.string().nullable().optional(),
  allowDictateNextSigner: z.boolean(),
  sentAt: z.number().nullable().optional(),
  deadline: z.number().nullable().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type ApiDocument = z.infer<typeof documentSchema>;
const sharingResponseSchema = z.object({
  sharingMode: z.string(),
  canUseTeamSharing: z.boolean(),
  subscriptionWarning: z.string().nullable().optional(),
  owner: z.object({
    name: z.string().nullable().optional(),
    email: z.string(),
  }),
  sharedWith: z.array(
    z.object({
      id: z.string(),
      userId: z.string(),
      userName: z.string().nullable().optional(),
      userEmail: z.string(),
      permissionLevel: z.string(),
      grantedByName: z.string().nullable().optional(),
    })
  ),
});
export type ApiDocumentSharing = z.infer<typeof sharingResponseSchema>;
export async function getDocuments(
  organizationSlug: string,
  options: {
    filter?: "all" | "owned" | "shared";
    workflowStatus?: string;
    folderId?: string;
    rootOnly?: boolean;
  } = {}
): Promise<ApiDocument[]> {
  const query = new URLSearchParams();
  if (options.filter && options.filter !== "all") {
    query.set("filter", options.filter);
  }
  if (options.workflowStatus) {
    query.set("workflowStatus", options.workflowStatus);
  }
  if (options.folderId) {
    query.set("folderId", options.folderId);
  }
  if (options.rootOnly) {
    query.set("rootOnly", "true");
  }
  const queryString = query.toString();
  const path = `/api/documents/${encodeURIComponent(organizationSlug)}${queryString ? `?${queryString}` : ""}`;
  return apiFetch(path, z.array(documentSchema));
}
export async function getFolders(
  organizationSlug: string,
  options: {
    type?: "document" | "template";
    parentId?: string;
  } = {}
): Promise<ApiFolder[]> {
  const query = new URLSearchParams();
  query.set("type", options.type ?? "document");
  if (options.parentId) {
    query.set("parentId", options.parentId);
  }
  return apiFetch(
    `/api/folders/${encodeURIComponent(organizationSlug)}?${query.toString()}`,
    z.array(folderSchema)
  );
}
export async function getAllFolders(
  organizationSlug: string,
  type: "document" | "template" = "document"
): Promise<ApiFolder[]> {
  return apiFetch(
    `/api/folders/${encodeURIComponent(organizationSlug)}/all?type=${type}`,
    z.array(folderSchema)
  );
}
export async function createFolder(
  organizationSlug: string,
  options: {
    name: string;
    type: "document" | "template";
    parentId?: string;
    visibility?: "everyone" | "members" | "restricted";
    pinned?: boolean;
  }
): Promise<ApiFolder> {
  return apiFetch(
    `/api/folders/${encodeURIComponent(organizationSlug)}`,
    folderSchema,
    {
      method: "POST",
      body: JSON.stringify(options),
    }
  );
}
export async function getFolderBreadcrumbs(
  organizationSlug: string,
  publicId: string
): Promise<
  Array<{
    id: string;
    name: string;
  }>
> {
  return apiFetch(
    `/api/folders/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}/breadcrumbs`,
    z.array(z.object({ id: z.string(), name: z.string() }))
  );
}
export async function createDocument(
  organizationSlug: string,
  input: {
    name: string;
    description?: string;
    fileSize?: number;
    contentType?: string;
    pageCount?: number;
    thumbnailDataUrl?: string;
    folderId?: string;
  }
): Promise<ApiDocument> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}`,
    documentSchema,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}
export async function uploadDocument(
  organizationSlug: string,
  publicId: string,
  contentBase64: string,
  contentType: string
): Promise<{
  storageKey: string;
  contentType: string;
  size: number;
}> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}/upload`,
    z.object({
      storageKey: z.string(),
      contentType: z.string(),
      size: z.number().int(),
    }),
    {
      method: "POST",
      body: JSON.stringify({ contentBase64, contentType }),
    }
  );
}
export async function deleteDocument(
  organizationSlug: string,
  publicId: string
): Promise<void> {
  await apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}`,
    z.void(),
    {
      method: "DELETE",
    }
  );
}
export async function sendDocument(
  organizationSlug: string,
  publicId: string,
  options?: {
    expirationPeriod?: {
      amount: number;
      unit: "day" | "week" | "month";
    };
    recipientMessages?: Record<string, string>;
  }
): Promise<void> {
  await apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}/send`,
    mutationOkSchema,
    {
      method: "POST",
      body: JSON.stringify(options ?? {}),
    }
  );
}
export async function cancelDocument(
  organizationSlug: string,
  publicId: string
): Promise<void> {
  await apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}/cancel`,
    mutationOkSchema,
    { method: "POST" }
  );
}
export async function downloadDocument(
  organizationSlug: string,
  publicId: string
): Promise<Blob> {
  const response = await fetch(
    `${getBaseUrl()}/api/documents/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}/download`,
    { credentials: "include" }
  );
  if (!response.ok) {
    const text = await response.text().catch(() => "Unknown error");
    throw new Error(`API error ${response.status}: ${text}`);
  }
  return response.blob();
}
export async function moveDocumentsToFolder(
  organizationSlug: string,
  options: {
    documentIds: string[];
    folderId?: string;
  }
): Promise<{
  moved: number;
}> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/move`,
    z.object({ moved: z.number().int() }),
    {
      method: "POST",
      body: JSON.stringify(options),
    }
  );
}
export async function updateDocumentThumbnail(
  organizationSlug: string,
  publicId: string,
  thumbnailDataUrl: string
): Promise<ApiDocument> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}/thumbnail`,
    documentSchema,
    {
      method: "POST",
      body: JSON.stringify({ thumbnailDataUrl }),
    }
  );
}
export async function transferDocument(
  organizationSlug: string,
  publicId: string,
  newOwnerId: string
): Promise<ApiDocument> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}/transfer`,
    documentSchema,
    {
      method: "POST",
      body: JSON.stringify({ newOwnerId }),
    }
  );
}
export async function getDocumentSharing(
  organizationSlug: string,
  publicId: string
): Promise<ApiDocumentSharing> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}/sharing`,
    sharingResponseSchema
  );
}
export async function updateDocumentSharing(
  organizationSlug: string,
  publicId: string,
  sharingMode: "private" | "workspace" | "specific"
): Promise<ApiDocumentSharing> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}/sharing`,
    sharingResponseSchema,
    {
      method: "POST",
      body: JSON.stringify({ sharingMode }),
    }
  );
}
export async function shareDocument(
  organizationSlug: string,
  publicId: string,
  userId: string,
  permissionLevel: "view" | "edit" | "manage"
): Promise<void> {
  await apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}/share`,
    z.void(),
    {
      method: "POST",
      body: JSON.stringify({ userId, permissionLevel }),
    }
  );
}
export async function revokeDocumentAccess(
  organizationSlug: string,
  publicId: string,
  userId: string
): Promise<void> {
  await apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}/revoke`,
    z.void(),
    {
      method: "POST",
      body: JSON.stringify({ userId }),
    }
  );
}
export async function updateDocumentPermission(
  organizationSlug: string,
  publicId: string,
  userId: string,
  permissionLevel: "view" | "edit" | "manage"
): Promise<void> {
  await apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}/permission`,
    z.void(),
    {
      method: "POST",
      body: JSON.stringify({ userId, permissionLevel }),
    }
  );
}
const recipientSchema = z.object({
  id: z.string(),
  publicId: z.string(),
  documentId: z.string(),
  name: z.string().nullable().optional(),
  email: z.string(),
  role: z.string(),
  order: z.number().int(),
  status: z.string(),
  signingToken: z.string().nullable().optional(),
  tokenExpiresAt: z.number().nullable().optional(),
  viewedAt: z.number().nullable().optional(),
  signedAt: z.number().nullable().optional(),
  approvedAt: z.number().nullable().optional(),
  declinedAt: z.number().nullable().optional(),
  signatureData: z.string().nullable().optional(),
  signatureType: z.string().nullable().optional(),
  authenticationData: z.string().nullable().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type ApiRecipient = z.infer<typeof recipientSchema>;
const recipientRoleProgressSchema = z.object({
  total: z.number().int(),
  completed: z.number().int(),
});
const recipientProgressSchema = z.object({
  total: z.number().int(),
  completed: z.number().int(),
  percentComplete: z.number().int(),
  byStatus: z.object({
    pending: z.number().int(),
    viewed: z.number().int(),
    signed: z.number().int(),
    approved: z.number().int(),
    declined: z.number().int(),
    expired: z.number().int(),
  }),
  byRole: z.object({
    signer: recipientRoleProgressSchema,
    viewer: recipientRoleProgressSchema,
    approver: recipientRoleProgressSchema,
  }),
});
export type ApiRecipientProgress = z.infer<typeof recipientProgressSchema>;
const fieldPropertiesSchema = z
  .object({
    placeholder: z.string().optional(),
    defaultValue: z.string().optional(),
    options: z.array(z.string()).optional(),
    maxLength: z.number().optional(),
    minLength: z.number().optional(),
    pattern: z.string().optional(),
    helpText: z.string().optional(),
  })
  .partial()
  .passthrough()
  .nullable();
const fieldValidationRulesSchema = z
  .object({
    required: z.boolean().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    pattern: z.string().optional(),
    customMessage: z.string().optional(),
  })
  .partial()
  .passthrough()
  .nullable();
const signatureFieldSchema = z.object({
  id: z.string(),
  publicId: z.string(),
  documentId: z.string(),
  recipientId: z.string().nullable().optional(),
  templateFieldId: z.string().nullable().optional(),
  fieldType: z.string(),
  label: z.string(),
  isRequired: z.boolean(),
  isMainSignature: z.boolean(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  page: z.number().int(),
  properties: fieldPropertiesSchema,
  validationRules: fieldValidationRulesSchema,
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type ApiSignatureField = z.infer<typeof signatureFieldSchema>;
const signatureFieldWithValuesSchema = signatureFieldSchema.extend({
  currentValue: z.string().nullable().optional(),
  currentSignatureImageUrl: z.string().nullable().optional(),
  isFilled: z.boolean(),
  signatureDetails: z
    .object({
      signedAt: z.number(),
      signerName: z.string().nullable().optional(),
      signerEmail: z.string().nullable().optional(),
      signatureMethod: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});
export type ApiSignatureFieldWithValues = z.infer<
  typeof signatureFieldWithValuesSchema
>;
const signatureSchema = z.object({
  id: z.string(),
  fieldId: z.string().nullable().optional(),
  recipientId: z.string(),
  documentId: z.string(),
  signedAt: z.number(),
  ipAddress: z.string().nullable().optional(),
  userAgent: z.string().nullable().optional(),
  value: z.string().nullable().optional(),
  signatureImageUrl: z.string().nullable().optional(),
  signatureMethod: z.string().nullable().optional(),
  signatureHash: z.string().nullable().optional(),
  signatureImageHash: z.string().nullable().optional(),
  documentHashAtSigning: z.string().nullable().optional(),
  authenticationData: z.string().nullable().optional(),
});
export type ApiSignature = z.infer<typeof signatureSchema>;
const paymentConfigSchema = z.object({
  id: z.string(),
  publicId: z.string(),
  fieldId: z.string(),
  documentId: z.string(),
  paymentType: z.string(),
  totalAmountCents: z.number().int(),
  currency: z.string(),
  paymentStatus: z.string().nullable().optional(),
});
export type ApiPaymentConfig = z.infer<typeof paymentConfigSchema>;
export async function getDocument(
  organizationSlug: string,
  publicId: string
): Promise<ApiDocument> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}`,
    documentSchema
  );
}
export async function updateDocument(
  organizationSlug: string,
  publicId: string,
  input: {
    name?: string;
    description?: string | null;
    redirectUrl?: string | null;
    allowDictateNextSigner?: boolean;
  }
): Promise<ApiDocument> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}`,
    documentSchema,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    }
  );
}
export async function saveAsTemplate(
  organizationSlug: string,
  publicId: string,
  input: {
    name: string;
    description?: string;
  }
): Promise<{
  publicId: string;
  fieldCount: number;
}> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}/save-as-template`,
    z.object({ publicId: z.string(), fieldCount: z.number().int() }),
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}
export async function getDocumentRecipients(
  organizationSlug: string,
  publicId: string
): Promise<ApiRecipient[]> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}/recipients`,
    z.array(recipientSchema)
  );
}
export async function getRecipientProgress(
  organizationSlug: string,
  publicId: string
): Promise<ApiRecipientProgress> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}/recipients/progress`,
    recipientProgressSchema
  );
}
export async function getCurrentUserRecipient(
  organizationSlug: string,
  publicId: string
): Promise<ApiRecipient | null> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}/recipients/me`,
    recipientSchema.nullable()
  );
}
export async function addRecipients(
  organizationSlug: string,
  publicId: string,
  recipients: Array<{
    email: string;
    name?: string;
    role?: "signer" | "viewer" | "approver";
    order?: number;
    isPlaceholder?: boolean;
    authMethod?: "none" | "access_code" | "email_otp";
    accessCode?: string;
  }>
): Promise<ApiRecipient[]> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}/recipients`,
    z.array(recipientSchema),
    {
      method: "POST",
      body: JSON.stringify({ recipients }),
    }
  );
}
export async function removeRecipient(
  organizationSlug: string,
  publicId: string,
  recipientPublicId: string
): Promise<{
  success: boolean;
}> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}/recipients/${encodeURIComponent(recipientPublicId)}`,
    z.object({ success: z.boolean() }),
    { method: "DELETE" }
  );
}
export async function resendRecipientEmail(
  organizationSlug: string,
  publicId: string,
  recipientPublicId: string,
  customMessage?: string
): Promise<{
  success: boolean;
}> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}/recipients/${encodeURIComponent(recipientPublicId)}/resend`,
    z.object({ success: z.boolean() }),
    {
      method: "POST",
      body: JSON.stringify({ customMessage }),
    }
  );
}
export async function getDocumentSignatureFields(
  organizationSlug: string,
  publicId: string
): Promise<ApiSignatureField[]> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}/signature-fields`,
    z.array(signatureFieldSchema)
  );
}
export async function getCurrentUserSignatureFields(
  organizationSlug: string,
  publicId: string
): Promise<ApiSignatureFieldWithValues[]> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}/signature-fields/me`,
    z.array(signatureFieldWithValuesSchema)
  );
}
export async function getDocumentSignatures(
  organizationSlug: string,
  publicId: string
): Promise<ApiSignature[]> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}/signatures`,
    z.array(signatureSchema)
  );
}
const paymentConfigDetailSchema = z.object({
  id: z.string(),
  publicId: z.string(),
  fieldId: z.string(),
  documentId: z.string(),
  paymentType: z.string(),
  items: z.array(
    z.object({
      id: z.string(),
      description: z.string(),
      quantity: z.number().int(),
      unitPrice: z.number().int(),
    })
  ),
  currency: z.string(),
  dueDateTerms: z.string(),
  customDueDays: z.number().int().nullable().optional(),
  customDueDate: z.string().nullable().optional(),
  lateFees: z
    .object({
      enabled: z.boolean(),
      type: z.string(),
      amount: z.number().int(),
      gracePeriodDays: z.number().int(),
    })
    .nullable()
    .optional(),
  recurringConfig: z
    .object({
      interval: z.string(),
      intervalCount: z.number().int(),
      endCondition: z.string(),
      endAfterCount: z.number().int().optional(),
    })
    .nullable()
    .optional(),
  installmentsConfig: z
    .object({
      count: z.number().int(),
      interval: z.string(),
    })
    .nullable()
    .optional(),
  depositBalanceConfig: z
    .object({
      depositPercent: z.number(),
      balanceDueDays: z.number().int(),
    })
    .nullable()
    .optional(),
  allowedPaymentMethods: z.array(z.string()),
  feeHandling: z.string(),
  taxEnabled: z.boolean(),
  taxBehavior: z.string().nullable().optional(),
  totalAmountCents: z.number().int(),
  paymentStatus: z.string().nullable().optional(),
});
export type ApiPaymentConfigDetail = z.infer<typeof paymentConfigDetailSchema>;
export async function getDocumentPaymentConfigs(
  organizationSlug: string,
  publicId: string
): Promise<ApiPaymentConfig[]> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}/payment-configs`,
    z.array(paymentConfigSchema)
  );
}
export async function getPaymentConfig(
  organizationSlug: string,
  publicId: string,
  fieldPublicId: string
): Promise<ApiPaymentConfigDetail> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}/payment-configs/${encodeURIComponent(fieldPublicId)}`,
    paymentConfigDetailSchema
  );
}
export async function upsertPaymentConfig(
  organizationSlug: string,
  publicId: string,
  input: Omit<
    ApiPaymentConfigDetail,
    | "id"
    | "publicId"
    | "documentId"
    | "paymentStatus"
    | "totalAmountCents"
    | "createdAt"
    | "updatedAt"
  >
): Promise<ApiPaymentConfigDetail> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}/payment-configs`,
    paymentConfigDetailSchema,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}
export async function createSignatureField(
  organizationSlug: string,
  publicId: string,
  input: {
    recipientPublicId?: string;
    fieldType: string;
    label: string;
    isRequired: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
    page: number;
    properties?: Record<string, unknown> | null;
    validationRules?: Record<string, unknown> | null;
    templateFieldId?: string;
  }
): Promise<ApiSignatureField> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}/signature-fields`,
    signatureFieldSchema,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}
export async function updateSignatureField(
  organizationSlug: string,
  publicId: string,
  fieldPublicId: string,
  input: {
    label?: string;
    isRequired?: boolean;
    recipientId?: string | null;
    properties?: Record<string, unknown> | null;
    validationRules?: Record<string, unknown> | null;
  }
): Promise<ApiSignatureField> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}/signature-fields/${encodeURIComponent(fieldPublicId)}`,
    signatureFieldSchema,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    }
  );
}
export async function repositionSignatureField(
  organizationSlug: string,
  publicId: string,
  fieldPublicId: string,
  input: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    page?: number;
  }
): Promise<ApiSignatureField> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}/signature-fields/${encodeURIComponent(fieldPublicId)}/position`,
    signatureFieldSchema,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    }
  );
}
export async function deleteSignatureField(
  organizationSlug: string,
  publicId: string,
  fieldPublicId: string
): Promise<{
  success: boolean;
}> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}/signature-fields/${encodeURIComponent(fieldPublicId)}`,
    z.object({ success: z.boolean() }),
    { method: "DELETE" }
  );
}
// ---------------------------------------------------------------------------
// Document power (SEA-26 — human UI for split / preview)
// ---------------------------------------------------------------------------
const documentSplitResultSchema = z.object({
  parentPublicId: z.string(),
  documents: z.array(
    z.object({
      publicId: z.string(),
      title: z.string(),
      pageCount: z.number().int(),
    })
  ),
});
export type ApiDocumentSplitResult = z.infer<typeof documentSplitResultSchema>;
export async function splitDocument(
  organizationSlug: string,
  publicId: string,
  splits: Array<{ title: string; pages: number[] }>
): Promise<ApiDocumentSplitResult> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}/power/split`,
    documentSplitResultSchema,
    { method: "POST", body: JSON.stringify({ splits }) }
  );
}
const documentPreviewSchema = z.object({
  format: z.enum([
    "pdf",
    "csv",
    "text",
    "html",
    "docx",
    "xlsx",
    "pptx",
    "unknown",
  ]),
  content_type: z.string(),
  content: z.string().nullable(),
  page_count: z.number().int().nullable().optional(),
  download_url: z.string().nullable(),
});
export type ApiDocumentPreview = z.infer<typeof documentPreviewSchema>;
export async function getDocumentPreview(
  organizationSlug: string,
  publicId: string
): Promise<ApiDocumentPreview> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}/power/preview`,
    documentPreviewSchema
  );
}

const annotateOpSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("highlight"),
    page: z.number().int(),
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
    color: z.string().optional(),
  }),
  z.object({
    op: z.literal("text"),
    page: z.number().int(),
    x: z.number(),
    y: z.number(),
    text: z.string().min(1),
    size: z.number().optional(),
    color: z.string().optional(),
  }),
  z.object({
    op: z.literal("rect"),
    page: z.number().int(),
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
    color: z.string().optional(),
  }),
  z.object({
    op: z.literal("redact"),
    page: z.number().int(),
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  }),
]);

const annotateDocumentResultSchema = z.object({
  success: z.boolean(),
  storageId: z.string(),
  operationsApplied: z.number().int(),
});
export type ApiAnnotateDocumentResult = z.infer<
  typeof annotateDocumentResultSchema
>;
export type ApiPdfAnnotateOp = z.infer<typeof annotateOpSchema>;
export async function annotateDocumentPdf(
  organizationSlug: string,
  publicId: string,
  operations: ApiPdfAnnotateOp[]
): Promise<ApiAnnotateDocumentResult> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}/power/annotate`,
    annotateDocumentResultSchema,
    {
      method: "POST",
      body: JSON.stringify({ operations }),
    }
  );
}

const replaceDocumentPdfResultSchema = z.object({
  success: z.boolean(),
  storageId: z.string(),
  size: z.number().int(),
});
export type ApiReplaceDocumentPdfResult = z.infer<
  typeof replaceDocumentPdfResultSchema
>;
export async function replaceDocumentPdf(
  organizationSlug: string,
  publicId: string,
  input: { contentBase64: string }
): Promise<ApiReplaceDocumentPdfResult> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}/power/replace-pdf`,
    replaceDocumentPdfResultSchema,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}

const rotateDocumentPdfResultSchema = z.object({
  success: z.boolean(),
  storageId: z.string(),
  pageCount: z.number().int(),
});
export type ApiRotateDocumentPdfResult = z.infer<
  typeof rotateDocumentPdfResultSchema
>;
export async function rotateDocumentPdf(
  organizationSlug: string,
  publicId: string,
  input: { degrees: 90 | 180 | 270; pages?: number[] }
): Promise<ApiRotateDocumentPdfResult> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}/power/rotate-pdf`,
    rotateDocumentPdfResultSchema,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}

const mergeDocumentPdfResultSchema = z.object({
  success: z.boolean(),
  id: z.string(),
  publicId: z.string(),
  storageId: z.string(),
  pageCount: z.number().int(),
});
export type ApiMergeDocumentPdfResult = z.infer<
  typeof mergeDocumentPdfResultSchema
>;
export async function mergeDocumentPdf(
  organizationSlug: string,
  publicId: string,
  input: { sourcePublicIds: string[]; title?: string }
): Promise<ApiMergeDocumentPdfResult> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}/power/merge-pdf`,
    mergeDocumentPdfResultSchema,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}

const organizeDocumentPdfResultSchema = z.object({
  success: z.boolean(),
  storageId: z.string(),
  pageCount: z.number().int(),
  fieldsRemoved: z.number().int(),
  fieldsRemapped: z.number().int(),
});
export type ApiOrganizeDocumentPdfResult = z.infer<
  typeof organizeDocumentPdfResultSchema
>;
export async function organizeDocumentPdf(
  organizationSlug: string,
  publicId: string,
  input: { pages: number[] }
): Promise<ApiOrganizeDocumentPdfResult> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}/power/organize-pdf`,
    organizeDocumentPdfResultSchema,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}

const watermarkDocumentPdfResultSchema = z.object({
  success: z.boolean(),
  storageId: z.string(),
  pageCount: z.number().int(),
});
export type ApiWatermarkDocumentPdfResult = z.infer<
  typeof watermarkDocumentPdfResultSchema
>;
export async function watermarkDocumentPdf(
  organizationSlug: string,
  publicId: string,
  input: {
    text: string;
    opacity?: number;
    position?: "diagonal" | "center" | "footer";
    color?: string;
    size?: number;
    pages?: number[];
  }
): Promise<ApiWatermarkDocumentPdfResult> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}/power/watermark-pdf`,
    watermarkDocumentPdfResultSchema,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}

const numberDocumentPdfPagesResultSchema = z.object({
  success: z.boolean(),
  storageId: z.string(),
  pageCount: z.number().int(),
});
export type ApiNumberDocumentPdfPagesResult = z.infer<
  typeof numberDocumentPdfPagesResultSchema
>;
export async function numberDocumentPdfPages(
  organizationSlug: string,
  publicId: string,
  input: {
    format?: "n" | "n_of_m";
    position?: "footer-center" | "footer-right" | "footer-left";
    startAt?: number;
    prefix?: string;
    size?: number;
    color?: string;
    pages?: number[];
  }
): Promise<ApiNumberDocumentPdfPagesResult> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}/power/number-pdf-pages`,
    numberDocumentPdfPagesResultSchema,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}

const cropDocumentPdfResultSchema = z.object({
  success: z.boolean(),
  storageId: z.string(),
  pageCount: z.number().int(),
  fieldsRemoved: z.number().int(),
  fieldsRemapped: z.number().int(),
});
export type ApiCropDocumentPdfResult = z.infer<
  typeof cropDocumentPdfResultSchema
>;
export async function cropDocumentPdf(
  organizationSlug: string,
  publicId: string,
  input: {
    crops: Array<{
      page: number;
      x: number;
      y: number;
      width: number;
      height: number;
    }>;
  }
): Promise<ApiCropDocumentPdfResult> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}/power/crop-pdf`,
    cropDocumentPdfResultSchema,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}

const compressDocumentPdfResultSchema = z.object({
  success: z.boolean(),
  storageId: z.string(),
  pageCount: z.number().int(),
  sizeBefore: z.number().int(),
  sizeAfter: z.number().int(),
});
export type ApiCompressDocumentPdfResult = z.infer<
  typeof compressDocumentPdfResultSchema
>;
export async function compressDocumentPdf(
  organizationSlug: string,
  publicId: string,
  input: { imageQuality?: number }
): Promise<ApiCompressDocumentPdfResult> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}/power/compress-pdf`,
    compressDocumentPdfResultSchema,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}

const redactDocumentPdfResultSchema = z.object({
  success: z.boolean(),
  storageId: z.string(),
  regionsApplied: z.number().int(),
  opsScrubbed: z.number().int(),
  annotsScrubbed: z.number().int(),
  fieldsRemoved: z.number().int(),
  scrubbedText: z.string(),
  warnings: z.array(z.string()),
});
export type ApiRedactDocumentPdfResult = z.infer<
  typeof redactDocumentPdfResultSchema
>;
export async function redactDocumentPdf(
  organizationSlug: string,
  publicId: string,
  input: {
    regions: Array<{
      page: number;
      x: number;
      y: number;
      width: number;
      height: number;
    }>;
  }
): Promise<ApiRedactDocumentPdfResult> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}/power/redact-pdf`,
    redactDocumentPdfResultSchema,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}

const protectDocumentPdfResultSchema = z.object({
  success: z.boolean(),
  storageId: z.string(),
  size: z.number().int(),
  downloadUrl: z.string().nullable(),
});
export type ApiProtectDocumentPdfResult = z.infer<
  typeof protectDocumentPdfResultSchema
>;
export async function protectDocumentPdf(
  organizationSlug: string,
  publicId: string,
  input: {
    userPassword?: string;
    ownerPassword?: string;
    allowPrinting?: boolean;
    allowCopying?: boolean;
    allowModifying?: boolean;
    allowAnnotating?: boolean;
    allowFillingForms?: boolean;
    allowAssembling?: boolean;
  }
): Promise<ApiProtectDocumentPdfResult> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}/power/protect-pdf`,
    protectDocumentPdfResultSchema,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}

const unlockDocumentPdfResultSchema = z.object({
  success: z.boolean(),
  storageId: z.string(),
  pageCount: z.number().int(),
  warnings: z.array(z.string()),
});
export type ApiUnlockDocumentPdfResult = z.infer<
  typeof unlockDocumentPdfResultSchema
>;
export async function unlockDocumentPdf(
  organizationSlug: string,
  publicId: string,
  input: { password: string }
): Promise<ApiUnlockDocumentPdfResult> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}/power/unlock-pdf`,
    unlockDocumentPdfResultSchema,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}

const flattenDocumentPdfResultSchema = z.object({
  success: z.boolean(),
  storageId: z.string(),
  pageCount: z.number().int(),
});
export async function flattenDocumentPdf(
  organizationSlug: string,
  publicId: string
): Promise<z.infer<typeof flattenDocumentPdfResultSchema>> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}/power/flatten-pdf`,
    flattenDocumentPdfResultSchema,
    { method: "POST", body: JSON.stringify({}) }
  );
}

const exportPdfImagesResultSchema = z.object({
  success: z.boolean(),
  storageId: z.string(),
  size: z.number().int(),
  format: z.enum(["png", "jpeg"]),
  dpi: z.number(),
  downloadUrl: z.string().nullable(),
});
export async function exportDocumentPdfImages(
  organizationSlug: string,
  publicId: string,
  input: { format?: "png" | "jpeg"; dpi?: number }
): Promise<z.infer<typeof exportPdfImagesResultSchema>> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}/power/export-pdf-images`,
    exportPdfImagesResultSchema,
    { method: "POST", body: JSON.stringify(input) }
  );
}

const pdfToOfficeResultSchema = z.object({
  success: z.boolean(),
  storageId: z.string(),
  format: z.string(),
  size: z.number().int(),
  downloadUrl: z.string().nullable(),
});
export async function convertDocumentPdfToOffice(
  organizationSlug: string,
  publicId: string,
  input?: { format?: "docx" | "xlsx" | "pptx" }
): Promise<z.infer<typeof pdfToOfficeResultSchema>> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}/power/pdf-to-office`,
    pdfToOfficeResultSchema,
    { method: "POST", body: JSON.stringify(input ?? {}) }
  );
}

const ocrDocumentPdfResultSchema = z.object({
  success: z.boolean(),
  storageId: z.string(),
  pageCount: z.number().int(),
  lang: z.string(),
});
export async function ocrDocumentPdf(
  organizationSlug: string,
  publicId: string,
  input?: { lang?: string }
): Promise<z.infer<typeof ocrDocumentPdfResultSchema>> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}/power/ocr-pdf`,
    ocrDocumentPdfResultSchema,
    { method: "POST", body: JSON.stringify(input ?? {}) }
  );
}

const comparePdfResultSchema = z.object({
  success: z.boolean(),
  documentA: z.object({ publicId: z.string(), name: z.string() }),
  documentB: z.object({ publicId: z.string(), name: z.string() }),
  pagesDifferent: z.number().int(),
  linesAdded: z.number().int(),
  linesRemoved: z.number().int(),
  pages: z.array(
    z.object({
      page: z.number().int(),
      added: z.array(z.string()),
      removed: z.array(z.string()),
    })
  ),
});
export type ApiComparePdfResult = z.infer<typeof comparePdfResultSchema>;
export async function compareDocumentPdf(
  organizationSlug: string,
  publicId: string,
  input: { withPublicId: string }
): Promise<ApiComparePdfResult> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}/power/compare-pdf`,
    comparePdfResultSchema,
    { method: "POST", body: JSON.stringify(input) }
  );
}

const toPdfaResultSchema = z.object({
  success: z.boolean(),
  storageId: z.string(),
  pageCount: z.number().int(),
  format: z.string(),
});
export async function convertDocumentPdfToPdfa(
  organizationSlug: string,
  publicId: string,
  input?: { format?: "PDF/A-1b" | "PDF/A-2b" | "PDF/A-3b" }
): Promise<z.infer<typeof toPdfaResultSchema>> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}/power/to-pdfa`,
    toPdfaResultSchema,
    { method: "POST", body: JSON.stringify(input ?? {}) }
  );
}

const documentLayoutBlocksSchema = z.object({
  blocks: z.array(
    z.object({
      id: z.string(),
      type: z.enum(["text", "table", "figure", "heading", "list", "other"]),
      page: z.number().int(),
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
      text: z.string().optional(),
      confidence: z.number().optional(),
      source: z.enum(["anydoc", "annotation"]).optional(),
    })
  ),
});
export type ApiDocumentLayoutBlocks = z.infer<
  typeof documentLayoutBlocksSchema
>;
export async function getDocumentLayoutBlocks(
  organizationSlug: string,
  publicId: string
): Promise<ApiDocumentLayoutBlocks> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}/power/layout-blocks`,
    documentLayoutBlocksSchema
  );
}

const documentExtractionSchemaResultSchema = z.object({
  schema: z.record(z.string(), z.unknown()),
});
export type ApiDocumentExtractionSchema = z.infer<
  typeof documentExtractionSchemaResultSchema
>;
export async function getDocumentExtractionSchema(
  organizationSlug: string,
  publicId: string
): Promise<ApiDocumentExtractionSchema> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}/power/extraction-schema`,
    documentExtractionSchemaResultSchema
  );
}
export async function putDocumentExtractionSchema(
  organizationSlug: string,
  publicId: string,
  schema: Record<string, unknown>
): Promise<ApiDocumentExtractionSchema> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}/power/extraction-schema`,
    documentExtractionSchemaResultSchema,
    {
      method: "PUT",
      body: JSON.stringify({ schema }),
    }
  );
}

const replaceOriginalResultSchema = z.object({
  success: z.boolean(),
  originalStorageKey: z.string(),
  storageId: z.string().nullable(),
  contentType: z.string(),
});
export async function replaceDocumentOriginal(
  organizationSlug: string,
  publicId: string,
  input: { contentBase64: string; contentType: string }
): Promise<z.infer<typeof replaceOriginalResultSchema>> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(publicId)}/power/replace-original`,
    replaceOriginalResultSchema,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}
// ---------------------------------------------------------------------------
// AI
// ---------------------------------------------------------------------------
const annotationItemSchema = z.object({
  page: z.number().int(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  category: z.enum(["obligation", "payment", "risk", "dates", "terms"]),
  severity: z.enum(["informational", "important", "critical"]),
  text: z.string(),
  summary: z.string(),
});
const annotationSchema = z.object({
  id: z.string(),
  publicId: z.string(),
  documentId: z.string(),
  organizationId: z.string(),
  annotations: z.array(annotationItemSchema),
  modelUsed: z.string(),
  tokensUsed: z.number().int(),
  processingTimeMs: z.number().int(),
  status: z.string(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});
export type ApiDocumentAnnotations = z.infer<typeof annotationSchema>;
export async function getDocumentAnnotations(
  publicId: string
): Promise<ApiDocumentAnnotations | null> {
  return apiFetch(
    `/api/ai/${encodeURIComponent(publicId)}/annotations`,
    annotationSchema.nullable()
  );
}
export async function dismissDocumentAnnotations(
  publicId: string
): Promise<void> {
  await apiFetch(
    `/api/ai/${encodeURIComponent(publicId)}/annotations/dismiss`,
    z.void(),
    { method: "POST" }
  );
}
const suggestionItemSchema = z.object({
  fieldType: z.string(),
  page: z.number().int(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  label: z.string(),
  confidence: z.number(),
  isRequired: z.boolean(),
});
const fieldSuggestionSchema = z.object({
  id: z.string(),
  publicId: z.string(),
  documentId: z.string(),
  organizationId: z.string(),
  fields: z.array(suggestionItemSchema),
  modelUsed: z.string(),
  tokensUsed: z.number().int(),
  processingTimeMs: z.number().int(),
  status: z.string(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});
export type ApiFieldSuggestions = z.infer<typeof fieldSuggestionSchema>;
export async function getFieldSuggestions(
  publicId: string
): Promise<ApiFieldSuggestions | null> {
  return apiFetch(
    `/api/ai/${encodeURIComponent(publicId)}/field-suggestions`,
    fieldSuggestionSchema.nullable()
  );
}
export async function applyFieldSuggestions(
  publicId: string,
  suggestionId: string,
  selectedFieldIndices?: number[]
): Promise<{
  fieldIds: string[];
  count: number;
}> {
  return apiFetch(
    `/api/ai/${encodeURIComponent(publicId)}/field-suggestions/${encodeURIComponent(suggestionId)}/apply`,
    z.object({ fieldIds: z.array(z.string()), count: z.number().int() }),
    {
      method: "POST",
      body: JSON.stringify({ selectedFieldIndices }),
    }
  );
}
export async function dismissFieldSuggestions(publicId: string): Promise<void> {
  await apiFetch(
    `/api/ai/${encodeURIComponent(publicId)}/field-suggestions/dismiss`,
    z.void(),
    { method: "POST" }
  );
}
const publicSigningRecipientSchema = z.object({
  _id: z.string(),
  publicId: z.string(),
  name: z.string().nullable().optional(),
  email: z.string(),
  role: z.string(),
  order: z.number().int(),
  status: z.string(),
  esignConsentAt: z.number().nullable().optional(),
  privacyNoticeAt: z.number().nullable().optional(),
  esignOptOutAt: z.number().nullable().optional(),
  esignOptOutMethod: z.string().nullable().optional(),
  awaitingDictation: z.boolean(),
  expiresAt: z.number().nullable().optional(),
  viewedAt: z.number().nullable().optional(),
  signedAt: z.number().nullable().optional(),
  approvedAt: z.number().nullable().optional(),
  declinedAt: z.number().nullable().optional(),
  authMethod: z.enum(["none", "access_code", "email_otp"]).optional(),
  authVerified: z.boolean().optional(),
  authEmailMasked: z.string().nullable().optional(),
});
const publicSigningDocumentSchema = z.object({
  _id: z.string(),
  publicId: z.string(),
  name: z.string(),
  status: z.string(),
  workflowStatus: z.string(),
  description: z.string().nullable().optional(),
  ownerName: z.string().nullable().optional(),
  ownerEmail: z.string().nullable().optional(),
  pageCount: z.number().int().nullable().optional(),
  redirectUrl: z.string().nullable().optional(),
});
const publicSigningSequentialProgressSchema = z.object({
  total: z.number().int(),
  completed: z.number().int(),
  percentComplete: z.number(),
  currentGroup: z.number().int(),
  totalGroups: z.number().int(),
  isWaitingForPreviousGroup: z.boolean(),
});
const publicSigningTokenResponseSchema = z.object({
  recipient: publicSigningRecipientSchema,
  document: publicSigningDocumentSchema,
  waitingForPreviousGroup: z.boolean(),
  sequentialProgress: publicSigningSequentialProgressSchema,
  branding: z
    .object({
      _id: z.string().optional(),
      logoUrl: z.string().nullable().optional(),
      brandColor: z.string().nullable().optional(),
      hideSealBranding: z.boolean().optional(),
      customFooterText: z.string().nullable().optional(),
    })
    .optional(),
  signingSettings: z
    .object({
      esignConsentText: z.string().nullable().optional(),
      esignConsentVersion: z.string().optional(),
      privacyNoticeText: z.string().nullable().optional(),
      privacyNoticeVersion: z.string().optional(),
      requireSignerAccount: z.boolean().optional(),
    })
    .optional(),
});
export type PublicSigningTokenResponse = z.infer<
  typeof publicSigningTokenResponseSchema
>;
export async function getSigningByToken(
  token: string
): Promise<PublicSigningTokenResponse> {
  return apiFetch(
    `/api/public/signing/${encodeURIComponent(token)}`,
    publicSigningTokenResponseSchema
  );
}

export async function challengePublicSigningAuth(token: string): Promise<{
  method: "email_otp";
  maskedEmail: string;
  expiresInSeconds: number;
}> {
  return apiFetch(
    `/api/public/signing/${encodeURIComponent(token)}/auth/challenge`,
    z.object({
      method: z.literal("email_otp"),
      maskedEmail: z.string(),
      expiresInSeconds: z.number().int(),
    }),
    { method: "POST", body: JSON.stringify({}) }
  );
}

export async function verifyPublicSigningAuth(
  token: string,
  code: string
): Promise<{ success: boolean; method: string }> {
  return apiFetch(
    `/api/public/signing/${encodeURIComponent(token)}/auth/verify`,
    z.object({
      success: z.boolean(),
      method: z.string(),
    }),
    { method: "POST", body: JSON.stringify({ code }) }
  );
}
const publicSigningFieldSchema = z.object({
  _id: z.string(),
  id: z.string(),
  publicId: z.string(),
  documentId: z.string(),
  recipientId: z.string().nullable().optional(),
  templateFieldId: z.string().nullable().optional(),
  fieldType: z.string(),
  label: z.string(),
  isRequired: z.boolean(),
  isMainSignature: z.boolean(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  page: z.number().int(),
  properties: z.unknown().nullable().optional(),
  validationRules: z.unknown().nullable().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
  currentValue: z.string().nullable().optional(),
  currentSignatureImageUrl: z.string().nullable().optional(),
  isFilled: z.boolean(),
  signatureDetails: z
    .object({
      signedAt: z.number(),
      signerName: z.string().optional(),
      signerEmail: z.string().optional(),
      signatureMethod: z.string().optional(),
    })
    .optional(),
});
export type PublicSigningField = z.infer<typeof publicSigningFieldSchema>;
export async function getSigningFields(
  token: string
): Promise<PublicSigningField[]> {
  const response = await apiFetch(
    `/api/public/signing/${encodeURIComponent(token)}/fields`,
    z.object({ fields: z.array(publicSigningFieldSchema) })
  );
  return response.fields;
}
export async function savePublicSigningFieldValue(
  token: string,
  fieldPublicId: string,
  input: {
    value?: string;
    signatureImageUrl?: string;
    signatureMethod?: "draw" | "type" | "upload";
    ipAddress: string;
    userAgent: string;
  }
): Promise<{
  success: boolean;
}> {
  return apiFetch(
    `/api/public/signing/${encodeURIComponent(token)}/fields/${encodeURIComponent(fieldPublicId)}/save`,
    z.object({ success: z.boolean() }),
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}
export async function submitPublicSigning(
  token: string,
  input: {
    status: "viewed" | "signed" | "approved" | "declined";
    signatureData?: string;
    signatureType?: "draw" | "type" | "upload";
    declineReason?: string;
    ipAddress: string;
    userAgent: string;
  }
): Promise<{
  success: boolean;
}> {
  return apiFetch(
    `/api/public/signing/${encodeURIComponent(token)}/submit`,
    z.object({ success: z.boolean() }),
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}
const publicPaymentConfigSummarySchema = z.object({
  _id: z.string(),
  id: z.string(),
  publicId: z.string(),
  fieldId: z.string(),
  documentId: z.string(),
  paymentType: z.string(),
  totalAmountCents: z.number().int(),
  currency: z.string(),
  paymentStatus: z.string().nullable().optional(),
});
export type PublicPaymentConfigSummary = z.infer<
  typeof publicPaymentConfigSummarySchema
>;
export async function getPublicSigningPaymentConfigs(
  token: string
): Promise<PublicPaymentConfigSummary[]> {
  return apiFetch(
    `/api/public/signing/${encodeURIComponent(token)}/payment-configs`,
    z.array(publicPaymentConfigSummarySchema)
  );
}
export async function getPublicSigningPdf(token: string): Promise<Blob> {
  const response = await fetch(
    `${getBaseUrl()}/api/public/signing/${encodeURIComponent(token)}/pdf`,
    { credentials: "include" }
  );
  if (!response.ok) {
    throw new Error("Failed to load PDF");
  }
  const blob = await response.blob();
  const contentType = (blob.type || response.headers.get("content-type") || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (contentType && contentType !== "application/pdf") {
    throw new Error("Failed to load PDF");
  }
  if (blob.size < 100) {
    throw new Error("Failed to load PDF");
  }
  return blob;
}
export async function recordPublicSigningConsent(
  token: string,
  input: {
    ipAddress: string;
    userAgent?: string;
    consentText?: string;
    consentVersion?: string;
  }
): Promise<{
  success: boolean;
  consentAt: number;
  consentVersion: string;
  consentTextHash: string;
}> {
  return apiFetch(
    `/api/public/signing/${encodeURIComponent(token)}/consent`,
    z.object({
      success: z.boolean(),
      consentAt: z.number(),
      consentVersion: z.string(),
      consentTextHash: z.string(),
    }),
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}
export async function recordPublicSigningPrivacyNotice(
  token: string,
  input: {
    ipAddress: string;
    userAgent?: string;
    noticeText?: string;
    noticeVersion?: string;
  }
): Promise<{
  success: boolean;
  acknowledgedAt: number;
  noticeVersion: string;
  noticeTextHash: string;
}> {
  return apiFetch(
    `/api/public/signing/${encodeURIComponent(token)}/privacy`,
    z.object({
      success: z.boolean(),
      acknowledgedAt: z.number(),
      noticeVersion: z.string(),
      noticeTextHash: z.string(),
    }),
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}
export async function recordPublicSigningOptOut(
  token: string,
  input: {
    ipAddress: string;
    userAgent?: string;
    method?: string;
  }
): Promise<{
  success: boolean;
  optedOutAt: number;
  method: string;
}> {
  return apiFetch(
    `/api/public/signing/${encodeURIComponent(token)}/opt-out`,
    z.object({
      success: z.boolean(),
      optedOutAt: z.number(),
      method: z.string(),
    }),
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}
export function getPublicSigningSignedPdfUrl(token: string): string {
  return `${getBaseUrl()}/api/public/signing/${encodeURIComponent(token)}/signed-pdf`;
}
export async function dictatePublicSigningNextSigner(
  token: string,
  input: {
    nextName: string;
    nextEmail: string;
  }
): Promise<{
  success: boolean;
}> {
  return apiFetch(
    `/api/public/signing/${encodeURIComponent(token)}/dictate`,
    z.object({ success: z.boolean() }),
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}
const savedSignatureSchema = z.object({
  id: z.string(),
  name: z.string(),
  signatureImageUrl: z.string(),
  signatureType: z.enum(["drawn", "typed", "uploaded"]),
  fontFamily: z.string().nullable().optional(),
  isDefault: z.boolean(),
  usageCount: z.number().int(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});
export type ApiSavedSignature = z.infer<typeof savedSignatureSchema>;
export async function listSavedSignatures(): Promise<ApiSavedSignature[]> {
  return apiFetch("/api/saved-signatures", z.array(savedSignatureSchema));
}
export async function createSavedSignature(input: {
  name: string;
  signatureImageUrl: string;
  signatureType: "drawn" | "typed" | "uploaded";
  fontFamily?: string;
  setAsDefault?: boolean;
}): Promise<ApiSavedSignature> {
  return apiFetch("/api/saved-signatures", savedSignatureSchema, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
export async function updateSavedSignature(
  id: string,
  input: {
    name?: string;
    isDefault?: boolean;
  }
): Promise<ApiSavedSignature> {
  return apiFetch(
    `/api/saved-signatures/${encodeURIComponent(id)}`,
    savedSignatureSchema,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    }
  );
}
export async function deleteSavedSignature(id: string): Promise<{
  success: boolean;
}> {
  return apiFetch(
    `/api/saved-signatures/${encodeURIComponent(id)}`,
    z.object({ success: z.boolean() }),
    { method: "DELETE" }
  );
}
export async function incrementSavedSignatureUsage(id: string): Promise<{
  success: boolean;
}> {
  return apiFetch(
    `/api/saved-signatures/${encodeURIComponent(id)}/use`,
    z.object({ success: z.boolean() }),
    { method: "POST" }
  );
}
export async function getClientIp(): Promise<string> {
  const { ip } = await apiFetch("/api/public/ip", z.object({ ip: z.string() }));
  return ip;
}
function base64FromArrayBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
export async function uploadAttachment(
  token: string,
  file: File
): Promise<string> {
  const buffer = await file.arrayBuffer();
  const { storageKey } = await apiFetch(
    `/api/public/signing/${encodeURIComponent(token)}/attachments`,
    z.object({ storageKey: z.string() }),
    {
      method: "POST",
      body: JSON.stringify({
        contentBase64: base64FromArrayBuffer(buffer),
        contentType: file.type || "application/octet-stream",
      }),
    }
  );
  return storageKey;
}
const publicSignerSchema = z.object({
  name: z.string(),
  maskedEmail: z.string(),
  role: z.string(),
  signedAt: z.number().nullable(),
});
export const verifyDocumentResultSchema = z.object({
  verified: z.boolean(),
  documentName: z.string(),
  completedAt: z.number().nullable(),
  signerCount: z.number(),
  signers: z.array(publicSignerSchema),
  documentHash: z.string().nullable(),
  createdAt: z.number(),
});
export type VerifyDocumentResult = z.infer<typeof verifyDocumentResultSchema>;
export async function verifyDocumentByQrToken(
  qrToken: string
): Promise<VerifyDocumentResult | null> {
  return apiFetch(
    `/api/public/verify/${encodeURIComponent(qrToken)}`,
    verifyDocumentResultSchema.nullable()
  );
}

const verifyUploadResultSchema = verifyDocumentResultSchema.extend({
  hashMatch: z.boolean(),
});
export type VerifyUploadResult = z.infer<typeof verifyUploadResultSchema>;
export async function verifyDocumentByUpload(
  pdfBytes: ArrayBuffer
): Promise<VerifyUploadResult> {
  const response = await fetch("/api/public/verify-upload", {
    method: "POST",
    headers: { "content-type": "application/pdf" },
    body: pdfBytes,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Verification failed (${response.status})`);
  }
  return verifyUploadResultSchema.parse(await response.json());
}

export const apiTokenSchema = z.object({
  id: z.string(),
  publicId: z.string(),
  name: z.string(),
  scopes: z.array(z.string()),
  lastUsedAt: z.string().nullish(),
  revokedAt: z.string().nullish(),
  createdAt: z.string(),
});
export type ApiToken = z.infer<typeof apiTokenSchema>;

export const createdApiTokenSchema = apiTokenSchema.extend({
  token: z.string(),
});
export type CreatedApiToken = z.infer<typeof createdApiTokenSchema>;

export async function getApiTokens(
  organizationSlug: string
): Promise<ApiToken[]> {
  return apiFetch(
    `/api/v1/organizations/${encodeURIComponent(organizationSlug)}/tokens`,
    z.array(apiTokenSchema)
  );
}

export async function createApiToken(
  organizationSlug: string,
  input: { name: string; scopes: string[] }
): Promise<CreatedApiToken> {
  return apiFetch(
    `/api/v1/organizations/${encodeURIComponent(organizationSlug)}/tokens`,
    createdApiTokenSchema,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}

export async function revokeApiToken(
  organizationSlug: string,
  tokenId: string
): Promise<{ revoked: boolean }> {
  return apiFetch(
    `/api/v1/organizations/${encodeURIComponent(organizationSlug)}/tokens/${encodeURIComponent(tokenId)}`,
    z.object({ revoked: z.boolean() }),
    {
      method: "DELETE",
    }
  );
}

const webhookEndpointSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  status: z.string(),
  events: z.array(z.string()),
  description: z.string().optional(),
  secret_prefix: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  stats: z.object({
    total_deliveries: z.number().int(),
    successful: z.number().int(),
    failed: z.number().int(),
    success_rate: z.number(),
  }),
});
export type ApiWebhookEndpoint = z.infer<typeof webhookEndpointSchema>;

const webhookEventTypeSchema = z.object({
  type: z.string(),
  category: z.string(),
  description: z.string(),
});
export type ApiWebhookEventType = z.infer<typeof webhookEventTypeSchema>;

const createdWebhookSchema = z.object({
  id: z.string(),
  secret: z.string(),
});
export type CreatedWebhook = z.infer<typeof createdWebhookSchema>;

export async function getWebhooks(
  organizationSlug: string
): Promise<ApiWebhookEndpoint[]> {
  return apiFetch(
    `/api/v1/organizations/${encodeURIComponent(organizationSlug)}/webhooks`,
    z.array(webhookEndpointSchema)
  );
}

export async function getWebhookEventTypes(
  organizationSlug: string
): Promise<ApiWebhookEventType[]> {
  return apiFetch(
    `/api/v1/organizations/${encodeURIComponent(organizationSlug)}/webhooks/event-types`,
    z.array(webhookEventTypeSchema)
  );
}

export async function createWebhook(
  organizationSlug: string,
  input: {
    name: string;
    url: string;
    events: string[];
    description?: string;
  }
): Promise<CreatedWebhook> {
  return apiFetch(
    `/api/v1/organizations/${encodeURIComponent(organizationSlug)}/webhooks`,
    createdWebhookSchema,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}

export async function deleteWebhook(
  organizationSlug: string,
  webhookId: string
): Promise<{ deleted: boolean }> {
  return apiFetch(
    `/api/v1/organizations/${encodeURIComponent(organizationSlug)}/webhooks/${encodeURIComponent(webhookId)}`,
    z.object({ deleted: z.boolean() }),
    {
      method: "DELETE",
    }
  );
}

const auditLogActorTypeSchema = z.enum(["user", "agent", "api_token"]);
const auditLogEntrySchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  actorId: z.string(),
  actorType: auditLogActorTypeSchema,
  action: z.string(),
  resourceType: z.string(),
  resourceId: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  createdAt: z.string(),
});
const auditLogListSchema = z.object({
  entries: z.array(auditLogEntrySchema),
  has_more: z.boolean(),
  next_cursor: z.string().optional(),
});
export type AuditLogList = z.infer<typeof auditLogListSchema>;

export async function getAuditLogs(
  organizationSlug: string,
  params?: {
    actor?: string;
    action?: string;
    resourceType?: string;
    from?: string;
    to?: string;
    limit?: number;
    cursor?: string;
  }
): Promise<AuditLogList> {
  const url = new URL(
    `/api/v1/organizations/${encodeURIComponent(organizationSlug)}/audit`,
    window.location.origin
  );
  if (params?.actor) url.searchParams.set("actor", params.actor);
  if (params?.action) url.searchParams.set("action", params.action);
  if (params?.resourceType) {
    url.searchParams.set("resourceType", params.resourceType);
  }
  if (params?.from) url.searchParams.set("from", params.from);
  if (params?.to) url.searchParams.set("to", params.to);
  if (params?.limit) url.searchParams.set("limit", String(params.limit));
  if (params?.cursor) url.searchParams.set("cursor", params.cursor);
  return apiFetch(`${url.pathname}${url.search}`, auditLogListSchema);
}

// ── Reviews (legal review matrix + packs + redlines) ──────────────────────

const reviewColumnSchema = z.object({
  index: z.number().int(),
  name: z.string(),
  prompt: z.string(),
});

const reviewCitationSchema = z.object({
  documentId: z.string(),
  page: z.number().int().optional(),
  bbox: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .optional(),
  quote: z.string(),
});
export type ApiReviewCitation = z.infer<typeof reviewCitationSchema>;

const reviewCellSchema = z.object({
  id: z.string(),
  row_id: z.string(),
  column_index: z.number().int(),
  status: z.enum(["pending", "generating", "done", "error"]),
  summary: z.string().nullable(),
  flag: z.enum(["green", "amber", "red", "grey"]).nullable(),
  reasoning: z.string().nullable(),
  citations: z.array(reviewCitationSchema),
});
export type ApiReviewCell = z.infer<typeof reviewCellSchema>;

const reviewMatrixSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  columns: z.array(reviewColumnSchema),
  rows: z.array(
    z.object({
      id: z.string(),
      document_id: z.string(),
      cells: z.array(reviewCellSchema),
    })
  ),
  created_at: z.string(),
  updated_at: z.string(),
});
export type ApiReviewMatrix = z.infer<typeof reviewMatrixSchema>;

const reviewMatrixListItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  row_count: z.number(),
  column_count: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type ApiReviewMatrixListItem = z.infer<
  typeof reviewMatrixListItemSchema
>;

const reviewPackSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  columns: z.array(reviewColumnSchema),
  builtin: z.boolean(),
  created_at: z.string(),
});
export type ApiReviewPack = z.infer<typeof reviewPackSchema>;

const revisionSchema = z.object({
  id: z.string(),
  document_id: z.string(),
  review_cell_id: z.string().nullable(),
  kind: z.enum(["insert", "delete", "replace"]),
  status: z.enum(["pending", "accepted", "rejected"]),
  anchor_quote: z.string(),
  anchor_page: z.number().nullable(),
  anchor_bbox: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .nullable(),
  proposed_text: z.string().nullable(),
  rationale: z.string().nullable(),
  derived_document_id: z.string().nullable(),
  created_by: z.string(),
  created_at: z.string(),
  resolved_at: z.string().nullable(),
});
export type ApiRevision = z.infer<typeof revisionSchema>;

const reviewsBase = (slug: string) =>
  `/api/reviews/${encodeURIComponent(slug)}`;

export async function getReviewMatrices(
  slug: string
): Promise<ApiReviewMatrixListItem[]> {
  const data = await apiFetch(
    reviewsBase(slug),
    z.object({ matrices: z.array(reviewMatrixListItemSchema) })
  );
  return data.matrices;
}

export async function getReviewMatrix(
  slug: string,
  id: string
): Promise<ApiReviewMatrix> {
  return apiFetch(
    `${reviewsBase(slug)}/${encodeURIComponent(id)}`,
    reviewMatrixSchema
  );
}

export async function createReviewMatrix(
  slug: string,
  input: {
    title: string;
    documentIds: string[];
    pack_id?: string;
    columns?: { index: number; name: string; prompt: string }[];
  }
): Promise<ApiReviewMatrix> {
  return apiFetch(reviewsBase(slug), reviewMatrixSchema, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/**
 * SSE stream of a generating matrix — same-origin session auth, so plain
 * EventSource works (cookies travel automatically). Returns a close handle.
 */
export function openReviewStream(
  slug: string,
  id: string,
  onState: (state: {
    id: string;
    status: string;
    cells: {
      id: string;
      row_id: string;
      column_index: number;
      status: string;
      flag: string | null;
      summary: string | null;
    }[];
  }) => void
): () => void {
  const source = new EventSource(
    `${getBaseUrl()}${reviewsBase(slug)}/${encodeURIComponent(id)}/stream`
  );
  source.addEventListener("state", (ev) => {
    try {
      onState(JSON.parse((ev as MessageEvent).data as string));
    } catch {
      // malformed frame — ignore
    }
  });
  return () => source.close();
}

export async function getReviewPacks(slug: string): Promise<ApiReviewPack[]> {
  const data = await apiFetch(
    `${reviewsBase(slug)}/packs`,
    z.object({ packs: z.array(reviewPackSchema) })
  );
  return data.packs;
}

export async function createReviewPack(
  slug: string,
  input: {
    title: string;
    description?: string;
    columns: { index: number; name: string; prompt: string }[];
  }
): Promise<ApiReviewPack> {
  return apiFetch(`${reviewsBase(slug)}/packs`, reviewPackSchema, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function deleteReviewPack(
  slug: string,
  id: string
): Promise<void> {
  await apiFetch(
    `${reviewsBase(slug)}/packs/${encodeURIComponent(id)}`,
    z.object({ deleted: z.literal(true) }),
    { method: "DELETE" }
  );
}

export async function listRevisions(
  slug: string,
  options: { documentId?: string; status?: string } = {}
): Promise<ApiRevision[]> {
  const query = new URLSearchParams();
  if (options.documentId) query.set("document_id", options.documentId);
  if (options.status) query.set("status", options.status);
  const qs = query.toString();
  const data = await apiFetch(
    `${reviewsBase(slug)}/revisions${qs ? `?${qs}` : ""}`,
    z.object({ revisions: z.array(revisionSchema) })
  );
  return data.revisions;
}

export async function proposeRevision(
  slug: string,
  input: {
    document_id: string;
    kind: "insert" | "delete" | "replace";
    anchor_quote: string;
    proposed_text?: string;
    rationale?: string;
    review_cell_id?: string;
  }
): Promise<ApiRevision> {
  return apiFetch(`${reviewsBase(slug)}/revisions`, revisionSchema, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function acceptRevision(
  slug: string,
  id: string,
  output: "pdf" | "docx" = "pdf"
): Promise<ApiRevision> {
  return apiFetch(
    `${reviewsBase(slug)}/revisions/${encodeURIComponent(id)}/accept${output === "docx" ? "?output=docx" : ""}`,
    revisionSchema,
    { method: "POST" }
  );
}

export async function acceptAllRevisions(
  slug: string,
  documentId: string,
  output: "pdf" | "docx" = "pdf"
): Promise<{ derived_document_id: string; accepted: number }> {
  return apiFetch(
    `${reviewsBase(slug)}/revisions/accept-all`,
    z.object({ derived_document_id: z.string(), accepted: z.number() }),
    {
      method: "POST",
      body: JSON.stringify({ document_id: documentId, output }),
    }
  );
}

export async function rejectRevision(
  slug: string,
  id: string
): Promise<ApiRevision> {
  return apiFetch(
    `${reviewsBase(slug)}/revisions/${encodeURIComponent(id)}/reject`,
    revisionSchema,
    { method: "POST" }
  );
}
