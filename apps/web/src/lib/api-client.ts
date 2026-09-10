import { z } from "zod";

import { toContactStatus, type ContactStatus } from "@/lib/contact-status";
import {
  toWorkflowStatus,
  type DocumentWorkflowStatus,
} from "@/lib/document-status";

const organizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  logo: z.string().nullable().optional(),
  metadata: z.string().nullable().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

const teamSummarySchema = z.object({
  total: z.number().int(),
  active: z.number().int(),
  pending: z.number().int(),
  byRole: z.object({
    owner: z.number().int(),
    admin: z.number().int(),
    member: z.number().int(),
    viewer: z.number().int(),
  }),
});

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
  metadata: z.string().nullable().optional(),
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

export type ApiOrganization = z.infer<typeof organizationSchema>;
export type ApiTeamSummary = z.infer<typeof teamSummarySchema>;
export type ApiDocumentStats = z.infer<typeof documentStatsSchema>;
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

export async function getOrganization(slug: string): Promise<ApiOrganization> {
  return apiFetch(
    `/api/organizations/${encodeURIComponent(slug)}`,
    organizationSchema
  );
}

export async function getOrganizationTeam(
  slug: string
): Promise<ApiTeamSummary> {
  return apiFetch(
    `/api/organizations/${encodeURIComponent(slug)}/team`,
    teamSummarySchema
  );
}

export async function getDocumentStats(): Promise<ApiDocumentStats> {
  return apiFetch("/api/documents/stats", documentStatsSchema);
}

export async function getDocumentTrends(
  days = 30
): Promise<ApiDocumentTrend[]> {
  return apiFetch(
    `/api/documents/trends?days=${encodeURIComponent(days)}`,
    z.array(documentTrendSchema)
  );
}

export async function getRecentActivity(limit = 10): Promise<ApiActivity[]> {
  return apiFetch(
    `/api/activity?limit=${encodeURIComponent(limit)}`,
    z.array(activitySchema)
  );
}

export async function getRecentDocuments(
  limit = 5
): Promise<ApiRecentDocument[]> {
  const rows = await apiFetch(
    `/api/documents/recent?limit=${encodeURIComponent(limit)}`,
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

export async function getDocumentAttention(): Promise<ApiDocumentAttention> {
  return apiFetch("/api/documents/attention", documentAttentionSchema);
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
  params: ContactListParams = {}
): Promise<ApiContact[]> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.status) query.set("status", params.status);
  const queryString = query.toString();
  const path = `/api/contacts${queryString ? `?${queryString}` : ""}`;

  const rows = await apiFetch(path, z.array(contactSchema));
  return rows.map(toApiContact);
}

export async function getContactByEmail(
  email: string
): Promise<ApiContact | null> {
  const row = await apiFetch(
    `/api/contacts/by-email?email=${encodeURIComponent(email)}`,
    contactSchema.nullable()
  );
  return row ? toApiContact(row) : null;
}

export async function getContact(publicId: string): Promise<ApiContact> {
  const row = await apiFetch(
    `/api/contacts/${encodeURIComponent(publicId)}`,
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

export async function createContact(input: ContactInput): Promise<ApiContact> {
  const row = await apiFetch("/api/contacts", contactSchema, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return toApiContact(row);
}

export async function updateContact(
  publicId: string,
  input: Partial<ContactInput>
): Promise<ApiContact> {
  const row = await apiFetch(
    `/api/contacts/${encodeURIComponent(publicId)}`,
    contactSchema,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    }
  );
  return toApiContact(row);
}

export async function deleteContact(publicId: string): Promise<void> {
  await apiFetch(`/api/contacts/${encodeURIComponent(publicId)}`, z.void(), {
    method: "DELETE",
  });
}

export async function bulkDeleteContacts(
  publicIds: string[]
): Promise<{ id: string; success: boolean }[]> {
  return apiFetch(
    "/api/contacts/bulk-delete",
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
  email: string
): Promise<ApiRelatedDocument[]> {
  return apiFetch(
    `/api/contacts/related-documents?email=${encodeURIComponent(email)}`,
    z.array(relatedDocumentSchema)
  );
}

export async function getNotifications(limit = 20): Promise<ApiNotification[]> {
  return apiFetch(
    `/api/notifications?limit=${encodeURIComponent(limit)}`,
    z.array(notificationSchema)
  );
}

export async function getUnreadNotificationCount(): Promise<number> {
  const result = await apiFetch(
    "/api/notifications/unread-count",
    z.object({ count: z.number().int() })
  );
  return result.count;
}

export async function markNotificationAsRead(
  publicId: string
): Promise<ApiNotification> {
  return apiFetch(
    `/api/notifications/${encodeURIComponent(publicId)}/read`,
    notificationSchema,
    { method: "POST" }
  );
}

export async function markAllNotificationsAsRead(): Promise<number> {
  const result = await apiFetch(
    "/api/notifications/read-all",
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

const teamMemberSchema = z.object({
  userId: z.string(),
  name: z.string().nullable(),
  email: z.string(),
  role: z.string(),
  avatarUrl: z.string().nullable(),
  status: z.string(),
});

export type ApiTeamMember = z.infer<typeof teamMemberSchema>;

export async function getDocuments(options: {
  filter?: "all" | "owned" | "shared";
  workflowStatus?: string;
  folderId?: string;
  rootOnly?: boolean;
} = {}): Promise<ApiDocument[]> {
  const query = new URLSearchParams();
  if (options.filter && options.filter !== "all") {
    query.set("filter", options.filter);
  }
  if (options.workflowStatus) {
    query.set("status", options.workflowStatus);
  }
  if (options.folderId) {
    query.set("folderId", options.folderId);
  }
  if (options.rootOnly) {
    query.set("rootOnly", "true");
  }
  const queryString = query.toString();
  const path = `/api/documents${queryString ? `?${queryString}` : ""}`;
  return apiFetch(path, z.array(documentSchema));
}

export async function getFolders(options: {
  type?: "document" | "template";
  parentId?: string;
} = {}): Promise<ApiFolder[]> {
  const query = new URLSearchParams();
  query.set("type", options.type ?? "document");
  if (options.parentId) {
    query.set("parentId", options.parentId);
  }
  return apiFetch(`/api/folders?${query.toString()}`, z.array(folderSchema));
}

export async function getAllFolders(
  type: "document" | "template" = "document"
): Promise<ApiFolder[]> {
  return apiFetch(`/api/folders/all?type=${type}`, z.array(folderSchema));
}

export async function createFolder(options: {
  name: string;
  type: "document" | "template";
  parentId?: string;
  visibility?: "everyone" | "members" | "restricted";
  pinned?: boolean;
}): Promise<ApiFolder> {
  return apiFetch("/api/folders", folderSchema, {
    method: "POST",
    body: JSON.stringify(options),
  });
}

export async function getFolderBreadcrumbs(
  publicId: string
): Promise<Array<{ id: string; name: string }>> {
  return apiFetch(
    `/api/folders/${encodeURIComponent(publicId)}/breadcrumbs`,
    z.array(z.object({ id: z.string(), name: z.string() }))
  );
}

export async function createDocument(input: {
  name: string;
  description?: string;
  fileSize?: number;
  contentType?: string;
  pageCount?: number;
  thumbnailDataUrl?: string;
  folderId?: string;
}): Promise<ApiDocument> {
  return apiFetch("/api/documents", documentSchema, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function uploadDocument(
  publicId: string,
  contentBase64: string,
  contentType: string
): Promise<{ storageKey: string; contentType: string; size: number }> {
  return apiFetch(`/api/documents/${encodeURIComponent(publicId)}/upload`,
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

export async function deleteDocument(publicId: string): Promise<void> {
  await apiFetch(`/api/documents/${encodeURIComponent(publicId)}`, z.void(), {
    method: "DELETE",
  });
}

export async function sendDocument(
  publicId: string,
  options?: {
    expirationPeriod?: { amount: number; unit: "day" | "week" | "month" };
    recipientMessages?: Record<string, string>;
  }
): Promise<void> {
  await apiFetch(
    `/api/documents/${encodeURIComponent(publicId)}/send`,
    z.void(),
    {
      method: "POST",
      body: JSON.stringify(options ?? {}),
    }
  );
}

export async function cancelDocument(publicId: string): Promise<void> {
  await apiFetch(
    `/api/documents/${encodeURIComponent(publicId)}/cancel`,
    z.void(),
    { method: "POST" }
  );
}

export async function downloadDocument(publicId: string): Promise<Blob> {
  const response = await fetch(
    `${getBaseUrl()}/api/documents/${encodeURIComponent(publicId)}/download`,
    { credentials: "include" }
  );
  if (!response.ok) {
    const text = await response.text().catch(() => "Unknown error");
    throw new Error(`API error ${response.status}: ${text}`);
  }
  return response.blob();
}

export async function moveDocumentsToFolder(options: {
  documentIds: string[];
  folderId?: string;
}): Promise<{ moved: number }> {
  return apiFetch("/api/documents/move", z.object({ moved: z.number().int() }), {
    method: "POST",
    body: JSON.stringify(options),
  });
}

export async function updateDocumentThumbnail(
  publicId: string,
  thumbnailDataUrl: string
): Promise<ApiDocument> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(publicId)}/thumbnail`,
    documentSchema,
    {
      method: "POST",
      body: JSON.stringify({ thumbnailDataUrl }),
    }
  );
}

export async function transferDocument(
  publicId: string,
  newOwnerId: string
): Promise<ApiDocument> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(publicId)}/transfer`,
    documentSchema,
    {
      method: "POST",
      body: JSON.stringify({ newOwnerId }),
    }
  );
}

export async function getDocumentSharing(
  publicId: string
): Promise<ApiDocumentSharing> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(publicId)}/sharing`,
    sharingResponseSchema
  );
}

export async function updateDocumentSharing(
  publicId: string,
  sharingMode: "private" | "workspace" | "specific"
): Promise<ApiDocumentSharing> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(publicId)}/sharing`,
    sharingResponseSchema,
    {
      method: "POST",
      body: JSON.stringify({ sharingMode }),
    }
  );
}

export async function shareDocument(
  publicId: string,
  userId: string,
  permissionLevel: "view" | "edit" | "manage"
): Promise<void> {
  await apiFetch(`/api/documents/${encodeURIComponent(publicId)}/share`, z.void(), {
    method: "POST",
    body: JSON.stringify({ userId, permissionLevel }),
  });
}

export async function revokeDocumentAccess(
  publicId: string,
  userId: string
): Promise<void> {
  await apiFetch(`/api/documents/${encodeURIComponent(publicId)}/revoke`, z.void(), {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
}

export async function updateDocumentPermission(
  publicId: string,
  userId: string,
  permissionLevel: "view" | "edit" | "manage"
): Promise<void> {
  await apiFetch(
    `/api/documents/${encodeURIComponent(publicId)}/permission`,
    z.void(),
    {
      method: "POST",
      body: JSON.stringify({ userId, permissionLevel }),
    }
  );
}

export async function getOrganizationMembers(
  slug: string
): Promise<ApiTeamMember[]> {
  return apiFetch(
    `/api/organizations/${encodeURIComponent(slug)}/members`,
    z.array(teamMemberSchema)
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

const recipientProgressSchema = z.object({
  total: z.number().int(),
  completed: z.number().int(),
  percentage: z.number().int(),
  byStatus: z.record(z.string(), z.number().int()),
  byRole: z.record(z.string(), z.number().int()),
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

export async function getDocument(publicId: string): Promise<ApiDocument> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(publicId)}`,
    documentSchema
  );
}

export async function updateDocument(
  publicId: string,
  input: {
    name?: string;
    description?: string | null;
    redirectUrl?: string | null;
    allowDictateNextSigner?: boolean;
  }
): Promise<ApiDocument> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(publicId)}`,
    documentSchema,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    }
  );
}

export async function getDocumentRecipients(
  publicId: string
): Promise<ApiRecipient[]> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(publicId)}/recipients`,
    z.array(recipientSchema)
  );
}

export async function getRecipientProgress(
  publicId: string
): Promise<ApiRecipientProgress> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(publicId)}/recipients/progress`,
    recipientProgressSchema
  );
}

export async function getCurrentUserRecipient(
  publicId: string
): Promise<ApiRecipient | null> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(publicId)}/recipients/me`,
    recipientSchema.nullable()
  );
}

export async function addRecipients(
  publicId: string,
  recipients: Array<{
    email: string;
    name?: string;
    role?: "signer" | "viewer" | "approver";
    order?: number;
    isPlaceholder?: boolean;
  }>
): Promise<ApiRecipient[]> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(publicId)}/recipients`,
    z.array(recipientSchema),
    {
      method: "POST",
      body: JSON.stringify({ recipients }),
    }
  );
}

export async function removeRecipient(
  publicId: string,
  recipientPublicId: string
): Promise<{ success: boolean }> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(publicId)}/recipients/${encodeURIComponent(recipientPublicId)}`,
    z.object({ success: z.boolean() }),
    { method: "DELETE" }
  );
}

export async function resendRecipientEmail(
  publicId: string,
  recipientPublicId: string,
  customMessage?: string
): Promise<{ success: boolean }> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(publicId)}/recipients/${encodeURIComponent(recipientPublicId)}/resend`,
    z.object({ success: z.boolean() }),
    {
      method: "POST",
      body: JSON.stringify({ customMessage }),
    }
  );
}

export async function getDocumentSignatureFields(
  publicId: string
): Promise<ApiSignatureField[]> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(publicId)}/signature-fields`,
    z.array(signatureFieldSchema)
  );
}

export async function getCurrentUserSignatureFields(
  publicId: string
): Promise<ApiSignatureFieldWithValues[]> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(publicId)}/signature-fields/me`,
    z.array(signatureFieldWithValuesSchema)
  );
}

export async function getDocumentSignatures(
  publicId: string
): Promise<ApiSignature[]> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(publicId)}/signatures`,
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
  publicId: string
): Promise<ApiPaymentConfig[]> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(publicId)}/payment-configs`,
    z.array(paymentConfigSchema)
  );
}

export async function getPaymentConfig(
  publicId: string,
  fieldPublicId: string
): Promise<ApiPaymentConfigDetail> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(publicId)}/payment-configs/${encodeURIComponent(fieldPublicId)}`,
    paymentConfigDetailSchema
  );
}

export async function upsertPaymentConfig(
  publicId: string,
  input: Omit<ApiPaymentConfigDetail, "id" | "publicId" | "documentId" | "paymentStatus" | "createdAt" | "updatedAt">
): Promise<ApiPaymentConfigDetail> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(publicId)}/payment-configs`,
    paymentConfigDetailSchema,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}

export async function createSignatureField(
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
    `/api/documents/${encodeURIComponent(publicId)}/signature-fields`,
    signatureFieldSchema,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}

export async function updateSignatureField(
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
    `/api/documents/${encodeURIComponent(publicId)}/signature-fields/${encodeURIComponent(fieldPublicId)}`,
    signatureFieldSchema,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    }
  );
}

export async function repositionSignatureField(
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
    `/api/documents/${encodeURIComponent(publicId)}/signature-fields/${encodeURIComponent(fieldPublicId)}/position`,
    signatureFieldSchema,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    }
  );
}

export async function assignSignatureField(
  publicId: string,
  fieldPublicId: string,
  recipientPublicId: string
): Promise<ApiSignatureField> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(publicId)}/signature-fields/${encodeURIComponent(fieldPublicId)}/assign`,
    signatureFieldSchema,
    {
      method: "PATCH",
      body: JSON.stringify({ recipientPublicId }),
    }
  );
}

export async function deleteSignatureField(
  publicId: string,
  fieldPublicId: string
): Promise<{ success: boolean }> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(publicId)}/signature-fields/${encodeURIComponent(fieldPublicId)}`,
    z.object({ success: z.boolean() }),
    { method: "DELETE" }
  );
}

export async function saveSignatureField(
  publicId: string,
  fieldPublicId: string,
  input: {
    value?: string;
    signatureImageUrl?: string;
    signatureMethod?: string;
    userAgent?: string;
  }
): Promise<ApiSignature> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(publicId)}/signature-fields/${encodeURIComponent(fieldPublicId)}/save`,
    signatureSchema,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}

export async function submitSignature(
  publicId: string,
  input: {
    status: "signed" | "approved" | "declined";
    signatureData?: string;
    signatureType?: string;
    declineReason?: string;
  }
): Promise<{ success: boolean }> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(publicId)}/submit`,
    z.object({ success: z.boolean() }),
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
    `/api/documents/${encodeURIComponent(publicId)}/ai/annotations`,
    annotationSchema.nullable()
  );
}

export async function dismissDocumentAnnotations(publicId: string): Promise<void> {
  await apiFetch(
    `/api/documents/${encodeURIComponent(publicId)}/ai/annotations/dismiss`,
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
    `/api/documents/${encodeURIComponent(publicId)}/ai/field-suggestions`,
    fieldSuggestionSchema.nullable()
  );
}

export async function applyFieldSuggestions(
  publicId: string,
  suggestionId: string,
  selectedFieldIndices?: number[]
): Promise<{ fieldIds: string[]; count: number }> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(publicId)}/ai/field-suggestions/${encodeURIComponent(suggestionId)}/apply`,
    z.object({ fieldIds: z.array(z.string()), count: z.number().int() }),
    {
      method: "POST",
      body: JSON.stringify({ selectedFieldIndices }),
    }
  );
}

export async function dismissFieldSuggestions(publicId: string): Promise<void> {
  await apiFetch(
    `/api/documents/${encodeURIComponent(publicId)}/ai/field-suggestions/dismiss`,
    z.void(),
    { method: "POST" }
  );
}

const threadResponseSchema = z.object({
  threadId: z.string().nullable(),
});

export async function getThreadForDocument(
  publicId: string
): Promise<{ threadId: string | null }> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(publicId)}/ai/thread`,
    threadResponseSchema
  );
}

export async function getOrCreateThread(publicId: string): Promise<{ threadId: string | null }> {
  return apiFetch(
    `/api/documents/${encodeURIComponent(publicId)}/ai/thread`,
    threadResponseSchema,
    { method: "POST" }
  );
}
