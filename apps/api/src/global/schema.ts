import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

// -----------------------------------------------------------------------------
// Better Auth core tables
// -----------------------------------------------------------------------------

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .notNull()
    .default(false),
  image: text("image"),
  metadata: text("metadata"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => new Date()),
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date()),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    activeOrganizationId: text("active_organization_id"),
    activeTeamId: text("active_team_id"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)]
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", {
      mode: "timestamp_ms",
    }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", {
      mode: "timestamp_ms",
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("account_userId_idx").on(table.userId),
    index("account_provider_idx").on(table.providerId, table.accountId),
  ]
);

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => new Date()),
});

// -----------------------------------------------------------------------------
// Better Auth organization plugin tables
// -----------------------------------------------------------------------------

export const organization = sqliteTable(
  "organization",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    logo: text("logo"),
    metadata: text("metadata"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date()),
  },
  (table) => [index("organization_slug_idx").on(table.slug)]
);

export const member = sqliteTable(
  "member",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
  },
  (table) => [
    index("member_organizationId_idx").on(table.organizationId),
    index("member_userId_idx").on(table.userId),
    index("member_org_user_idx").on(table.organizationId, table.userId),
  ]
);

export const invitation = sqliteTable(
  "invitation",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role").notNull(),
    status: text("status").notNull().default("pending"),
    teamId: text("team_id").references(() => team.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    inviterId: text("inviter_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
  },
  (table) => [index("invitation_organizationId_idx").on(table.organizationId)]
);

// -----------------------------------------------------------------------------
// Better Auth team tables (organization plugin with teams enabled)
// -----------------------------------------------------------------------------

export const team = sqliteTable(
  "team",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    memberCount: integer("member_count", { mode: "number" })
      .notNull()
      .default(0),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    metadata: text("metadata"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("team_organizationId_idx").on(table.organizationId),
    index("team_org_name_idx").on(table.organizationId, table.name),
  ]
);

export const teamMember = sqliteTable(
  "team_member",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id")
      .notNull()
      .references(() => team.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
    membershipKey: text("membership_key").unique(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
  },
  (table) => [
    index("teamMember_teamId_idx").on(table.teamId),
    index("teamMember_userId_idx").on(table.userId),
    index("teamMember_team_user_idx").on(table.teamId, table.userId),
  ]
);

export const organizationRole = sqliteTable(
  "organization_role",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    permission: text("permission").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("organizationRole_organizationId_idx").on(table.organizationId),
    index("organizationRole_role_idx").on(table.organizationId, table.role),
  ]
);

// -----------------------------------------------------------------------------
// Relations
// -----------------------------------------------------------------------------

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

// -----------------------------------------------------------------------------
// Seal domain tables
// -----------------------------------------------------------------------------

export const folders = sqliteTable(
  "folders",
  {
    id: text("id").primaryKey(),
    publicId: text("public_id").notNull().unique(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    parentId: text("parent_id"),
    type: text("type").notNull().default("document"),
    visibility: text("visibility").notNull().default("everyone"),
    pinned: integer("pinned", { mode: "boolean" }).default(false),
    createdBy: text("created_by").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("folders_organizationId_idx").on(table.organizationId),
    index("folders_parentId_idx").on(table.parentId),
    index("folders_org_type_idx").on(table.organizationId, table.type),
    index("folders_org_createdBy_idx").on(
      table.organizationId,
      table.createdBy
    ),
  ]
);

export const documents = sqliteTable(
  "documents",
  {
    id: text("id").primaryKey(),
    publicId: text("public_id").notNull().unique(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    ownerId: text("owner_id").notNull().default(""),
    folderId: text("folder_id").references(() => folders.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status").notNull().default("draft"),
    documentStatus: text("document_status").notNull().default("active"),
    sharingMode: text("sharing_mode").notNull().default("private"),
    aiProcessingStatus: text("ai_processing_status"),
    storageKey: text("storage_key"),
    contentType: text("content_type"),
    size: integer("size"),
    pageCount: integer("page_count"),
    parsedText: text("parsed_text"),
    parsedTitle: text("parsed_title"),
    parsedFormat: text("parsed_format"),
    pdfType: text("pdf_type"),
    ocrRequired: integer("ocr_required", { mode: "boolean" })
      .notNull()
      .default(false),
    pagesNeedingOcr: text("pages_needing_ocr"),
    fieldCandidates: text("field_candidates"),
    thumbnailDataUrl: text("thumbnail_data_url"),
    qrToken: text("qr_token").unique(),
    documentHash: text("document_hash"),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    sentAt: integer("sent_at", { mode: "timestamp_ms" }),
    deadline: integer("deadline", { mode: "timestamp_ms" }),
    lastExpirationAlertAt: integer("last_expiration_alert_at", {
      mode: "timestamp_ms",
    }),
    redirectUrl: text("redirect_url"),
    allowDictateNextSigner: integer("allow_dictate_next_signer", {
      mode: "boolean",
    })
      .notNull()
      .default(false),
    signingMode: text("signing_mode").notNull().default("parallel"),
    workflowStatus: text("workflow_status").notNull().default("draft"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("documents_organizationId_idx").on(table.organizationId),
    index("documents_publicId_idx").on(table.publicId),
    index("documents_ownerId_idx").on(table.ownerId),
    index("documents_folderId_idx").on(table.folderId),
    index("documents_documentStatus_idx").on(table.documentStatus),
  ]
);

export const documentAccess = sqliteTable(
  "document_access",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    permissionLevel: text("permission_level").notNull().default("view"),
    grantedBy: text("granted_by").notNull(),
    grantedAt: integer("granted_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
    updatedBy: text("updated_by"),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
    revokedBy: text("revoked_by"),
  },
  (table) => [
    index("documentAccess_documentId_idx").on(table.documentId),
    index("documentAccess_userId_idx").on(table.userId),
    index("documentAccess_document_user_idx").on(
      table.documentId,
      table.userId
    ),
  ]
);

export const recipients = sqliteTable(
  "recipients",
  {
    id: text("id").primaryKey(),
    publicId: text("public_id").notNull().unique(),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    name: text("name"),
    email: text("email").notNull(),
    role: text("role").notNull().default("signer"),
    order: integer("order", { mode: "number" }).notNull().default(0),
    status: text("status").notNull().default("pending"),
    signingToken: text("signing_token").unique(),
    tokenExpiresAt: integer("token_expires_at", { mode: "timestamp_ms" }),
    viewedAt: integer("viewed_at", { mode: "timestamp_ms" }),
    signedAt: integer("signed_at", { mode: "timestamp_ms" }),
    approvedAt: integer("approved_at", { mode: "timestamp_ms" }),
    declinedAt: integer("declined_at", { mode: "timestamp_ms" }),
    lastRemindedAt: integer("last_reminded_at", { mode: "timestamp_ms" }),
    reminderCount: integer("reminder_count", { mode: "number" })
      .notNull()
      .default(0),
    signatureData: text("signature_data"),
    signatureType: text("signature_type"),
    authenticationData: text("authentication_data"),
    esignConsentAt: integer("esign_consent_at", { mode: "timestamp_ms" }),
    esignConsentIp: text("esign_consent_ip"),
    esignConsentVersion: text("esign_consent_version"),
    awaitingDictation: integer("awaiting_dictation", {
      mode: "boolean",
    })
      .notNull()
      .default(false),
    isPlaceholder: integer("is_placeholder", { mode: "boolean" })
      .notNull()
      .default(false),
    dictatedBy: text("dictated_by"),
    dictatedAt: integer("dictated_at", { mode: "timestamp_ms" }),
    tokenHash: text("token_hash"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("recipients_documentId_idx").on(table.documentId),
    index("recipients_email_idx").on(table.email),
    index("recipients_signingToken_idx").on(table.signingToken),
  ]
);

export const signatures = sqliteTable(
  "signatures",
  {
    id: text("id").primaryKey(),
    fieldId: text("field_id").references(() => signatureFields.id, {
      onDelete: "set null",
    }),
    recipientId: text("recipient_id")
      .notNull()
      .references(() => recipients.id, { onDelete: "cascade" }),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    signedAt: integer("signed_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    value: text("value"),
    signatureImageUrl: text("signature_image_url"),
    signatureMethod: text("signature_method"),
    signatureHash: text("signature_hash"),
    signatureImageHash: text("signature_image_hash"),
    documentHashAtSigning: text("document_hash_at_signing"),
    authenticationData: text("authentication_data"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("signatures_recipientId_idx").on(table.recipientId),
    index("signatures_documentId_idx").on(table.documentId),
    index("signatures_fieldId_idx").on(table.fieldId),
    index("signatures_documentRecipient_idx").on(
      table.documentId,
      table.recipientId
    ),
  ]
);

export const savedSignatures = sqliteTable(
  "saved_signatures",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    signatureImageUrl: text("signature_image_url").notNull(),
    signatureType: text("signature_type").notNull(),
    fontFamily: text("font_family"),
    isDefault: integer("is_default", { mode: "boolean" })
      .notNull()
      .default(false),
    usageCount: integer("usage_count").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("savedSignatures_userId_idx").on(table.userId),
    index("savedSignatures_organizationId_idx").on(table.organizationId),
  ]
);

export const signatureFields = sqliteTable(
  "signature_fields",
  {
    id: text("id").primaryKey(),
    publicId: text("public_id").notNull().unique(),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    recipientId: text("recipient_id").references(() => recipients.id, {
      onDelete: "set null",
    }),
    templateFieldId: text("template_field_id"),
    fieldType: text("field_type").notNull(),
    label: text("label").notNull(),
    isRequired: integer("is_required", { mode: "boolean" })
      .notNull()
      .default(false),
    isMainSignature: integer("is_main_signature", { mode: "boolean" })
      .notNull()
      .default(false),
    x: real("x").notNull(),
    y: real("y").notNull(),
    width: real("width").notNull(),
    height: real("height").notNull(),
    page: integer("page").notNull(),
    properties: text("properties"),
    validationRules: text("validation_rules"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("signatureFields_documentId_idx").on(table.documentId),
    index("signatureFields_recipientId_idx").on(table.recipientId),
    index("signatureFields_documentPage_idx").on(table.documentId, table.page),
    index("signatureFields_documentRecipient_idx").on(
      table.documentId,
      table.recipientId
    ),
  ]
);

export const vortexBillingWebhookEvents = sqliteTable(
  "vortex_billing_webhook_events",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id").notNull().unique(),
    eventType: text("event_type").notNull(),
    processedAt: integer("processed_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
  },
  (table) => [index("vortexBillingWebhookEvents_eventId_idx").on(table.eventId)]
);

export const paymentFieldConfigs = sqliteTable(
  "payment_field_configs",
  {
    id: text("id").primaryKey(),
    publicId: text("public_id").notNull().unique(),
    fieldId: text("field_id")
      .notNull()
      .references(() => signatureFields.id, { onDelete: "cascade" }),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    paymentType: text("payment_type").notNull(),
    items: text("items").notNull(),
    currency: text("currency").notNull(),
    dueDateTerms: text("due_date_terms").notNull(),
    customDueDays: integer("custom_due_days"),
    customDueDate: text("custom_due_date"),
    lateFees: text("late_fees"),
    recurringConfig: text("recurring_config"),
    installmentsConfig: text("installments_config"),
    depositBalanceConfig: text("deposit_balance_config"),
    allowedPaymentMethods: text("allowed_payment_methods").notNull(),
    feeHandling: text("fee_handling").notNull(),
    taxEnabled: integer("tax_enabled", { mode: "boolean" })
      .notNull()
      .default(false),
    taxBehavior: text("tax_behavior"),
    totalAmountCents: integer("total_amount_cents").notNull(),
    providerInvoiceId: text("provider_invoice_id"),
    providerSubscriptionId: text("provider_subscription_id"),
    providerPaymentIntentId: text("provider_payment_intent_id"),
    hostedInvoiceUrl: text("hosted_invoice_url"),
    vortexPayableId: text("vortex_payable_id"),
    vortexDepositBalancePayableId: text("vortex_deposit_balance_payable_id"),
    vortexInstallmentPayableId: text("vortex_installment_payable_id"),
    vortexRecurringPayableId: text("vortex_recurring_payable_id"),
    vortexPaymentRequestId: text("vortex_payment_request_id"),
    paymentStatus: text("payment_status"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("paymentFieldConfigs_fieldId_idx").on(table.fieldId),
    index("paymentFieldConfigs_documentId_idx").on(table.documentId),
    index("paymentFieldConfigs_organizationId_idx").on(table.organizationId),
  ]
);

export const documentInvoices = sqliteTable(
  "document_invoices",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    provider: text("provider").default("vortex_billing"),
    providerAccountId: text("provider_account_id"),
    providerInvoiceId: text("provider_invoice_id"),
    providerCustomerId: text("provider_customer_id"),
    providerSubscriptionId: text("provider_subscription_id"),
    vortexPayableId: text("vortex_payable_id"),
    vortexPaymentRequestId: text("vortex_payment_request_id"),
    status: text("status").notNull().default("draft"),
    customerEmail: text("customer_email").notNull(),
    customerName: text("customer_name"),
    amountDue: integer("amount_due").notNull(),
    currency: text("currency").notNull(),
    hostedInvoiceUrl: text("hosted_invoice_url"),
    invoicePdf: text("invoice_pdf"),
    finalizedAt: integer("finalized_at", { mode: "timestamp_ms" }),
    paidAt: integer("paid_at", { mode: "timestamp_ms" }),
    voidedAt: integer("voided_at", { mode: "timestamp_ms" }),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    dunningStatus: text("dunning_status").notNull().default("none"),
    dunningStep: integer("dunning_step").notNull().default(0),
    dunningStartedAt: integer("dunning_started_at", { mode: "timestamp_ms" }),
    lastDunningEmailAt: integer("last_dunning_email_at", {
      mode: "timestamp_ms",
    }),
    nextDunningAt: integer("next_dunning_at", { mode: "timestamp_ms" }),
    dunningCompletedAt: integer("dunning_completed_at", {
      mode: "timestamp_ms",
    }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("documentInvoices_documentId_idx").on(table.documentId),
    index("documentInvoices_providerInvoiceId_idx").on(table.providerInvoiceId),
    index("documentInvoices_vortexPayableId_idx").on(table.vortexPayableId),
    index("documentInvoices_organizationId_idx").on(table.organizationId),
    index("documentInvoices_providerSubscriptionId_idx").on(
      table.providerSubscriptionId
    ),
    index("documentInvoices_dunningStatus_nextDunningAt_idx").on(
      table.dunningStatus,
      table.nextDunningAt
    ),
  ]
);

export const subscriptions = sqliteTable(
  "subscriptions",
  {
    id: text("id").primaryKey(),
    publicId: text("public_id").notNull().unique(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    externalCustomerId: text("external_customer_id").notNull(),
    externalSubscriptionId: text("external_subscription_id").notNull().unique(),
    externalPriceId: text("external_price_id"),
    externalProductId: text("external_product_id"),
    status: text("status").notNull(),
    cancelAtPeriodEnd: integer("cancel_at_period_end", { mode: "boolean" })
      .notNull()
      .default(false),
    currentPeriodStart: integer("current_period_start", {
      mode: "timestamp_ms",
    }),
    currentPeriodEnd: integer("current_period_end", { mode: "timestamp_ms" }),
    latestInvoiceId: text("latest_invoice_id"),
    latestInvoiceStatus: text("latest_invoice_status"),
    canceledAt: integer("canceled_at", { mode: "timestamp_ms" }),
    cancelReason: text("cancel_reason"),
    pastDueSince: integer("past_due_since", { mode: "timestamp_ms" }),
    metadata: text("metadata"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("subscriptions_organizationId_idx").on(table.organizationId),
    index("subscriptions_externalSubscriptionId_idx").on(
      table.externalSubscriptionId
    ),
  ]
);

export const activity = sqliteTable(
  "activity",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    actorName: text("actor_name").notNull(),
    targetName: text("target_name"),
    metadata: text("metadata"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
  },
  (table) => [
    index("activity_organizationId_idx").on(table.organizationId),
    index("activity_createdAt_idx").on(table.createdAt),
  ]
);

export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    publicId: text("public_id").notNull().unique(),
    userId: text("user_id").notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    data: text("data").notNull(),
    read: integer("read", { mode: "boolean" }).notNull().default(false),
    readAt: integer("read_at", { mode: "timestamp_ms" }),
    emailStatus: text("email_status"),
    emailSentAt: integer("email_sent_at", { mode: "timestamp_ms" }),
    emailAttempts: integer("email_attempts"),
    lastEmailError: text("last_email_error"),
    emailMessageId: text("email_message_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("notifications_organizationId_idx").on(table.organizationId),
    index("notifications_userId_idx").on(table.userId),
    index("notifications_user_read_idx").on(table.userId, table.read),
    index("notifications_user_createdAt_idx").on(table.userId, table.createdAt),
  ]
);

export const contacts = sqliteTable(
  "contacts",
  {
    id: text("id").primaryKey(),
    publicId: text("public_id").notNull().unique(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    fullName: text("full_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    company: text("company"),
    title: text("title"),
    status: text("status").notNull().default("active"),
    notes: text("notes"),
    tags: text("tags"),
    lastContactedAt: integer("last_contacted_at", { mode: "timestamp_ms" }),
    createdBy: text("created_by").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("contacts_organizationId_idx").on(table.organizationId),
    index("contacts_email_idx").on(table.email),
    index("contacts_org_email_idx").on(table.organizationId, table.email),
    index("contacts_org_status_idx").on(table.organizationId, table.status),
    index("contacts_fullName_idx").on(table.fullName),
  ]
);

export const aiFieldSuggestions = sqliteTable(
  "ai_field_suggestions",
  {
    id: text("id").primaryKey(),
    publicId: text("public_id").notNull().unique(),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    fields: text("fields").notNull(),
    modelUsed: text("model_used").notNull(),
    tokensUsed: integer("tokens_used").notNull(),
    processingTimeMs: integer("processing_time_ms").notNull(),
    paymentExtraction: text("payment_extraction"),
    status: text("status").notNull().default("pending"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("aiFieldSuggestions_documentId_idx").on(table.documentId),
    index("aiFieldSuggestions_documentStatus_idx").on(
      table.documentId,
      table.status
    ),
    index("aiFieldSuggestions_organizationId_idx").on(table.organizationId),
  ]
);

export const aiDocumentAnnotations = sqliteTable(
  "ai_document_annotations",
  {
    id: text("id").primaryKey(),
    publicId: text("public_id").notNull().unique(),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    annotations: text("annotations").notNull(),
    modelUsed: text("model_used").notNull(),
    tokensUsed: integer("tokens_used").notNull(),
    processingTimeMs: integer("processing_time_ms").notNull(),
    status: text("status").notNull().default("active"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("aiDocumentAnnotations_documentId_idx").on(table.documentId),
    index("aiDocumentAnnotations_documentStatus_idx").on(
      table.documentId,
      table.status
    ),
    index("aiDocumentAnnotations_organizationId_idx").on(table.organizationId),
  ]
);

export const templates = sqliteTable(
  "templates",
  {
    id: text("id").primaryKey(),
    publicId: text("public_id").notNull().unique(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    sourceDocumentId: text("source_document_id").references(
      () => documents.id,
      {
        onDelete: "set null",
      }
    ),
    folderId: text("folder_id").references(() => folders.id, {
      onDelete: "set null",
    }),
    storageKey: text("storage_key").notNull(),
    size: integer("size").notNull(),
    contentType: text("content_type").notNull(),
    pageCount: integer("page_count"),
    thumbnailDataUrl: text("thumbnail_data_url"),
    useCount: integer("use_count").notNull().default(0),
    status: text("status").notNull().default("active"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("templates_organizationId_idx").on(table.organizationId),
    index("templates_createdBy_idx").on(table.createdBy),
    index("templates_status_idx").on(table.status),
    index("templates_organizationStatus_idx").on(
      table.organizationId,
      table.status
    ),
    index("templates_useCount_idx").on(table.useCount),
    index("templates_folderId_idx").on(table.folderId),
  ]
);

export const templateFields = sqliteTable(
  "template_fields",
  {
    id: text("id").primaryKey(),
    publicId: text("public_id").notNull().unique(),
    templateId: text("template_id")
      .notNull()
      .references(() => templates.id, { onDelete: "cascade" }),
    fieldType: text("field_type").notNull(),
    label: text("label"),
    isRequired: integer("is_required", { mode: "boolean" })
      .notNull()
      .default(false),
    x: real("x").notNull(),
    y: real("y").notNull(),
    width: real("width").notNull(),
    height: real("height").notNull(),
    page: integer("page").notNull(),
    properties: text("properties"),
    order: integer("order").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("templateFields_templateId_idx").on(table.templateId),
    index("templateFields_templateIdPage_idx").on(table.templateId, table.page),
    index("templateFields_templateIdOrder_idx").on(
      table.templateId,
      table.order
    ),
  ]
);

export const connectedApps = sqliteTable(
  "connected_apps",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    appName: text("app_name").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    connectedAt: integer("connected_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
    lastActivityAt: integer("last_activity_at", { mode: "timestamp_ms" }),
    scopes: text("scopes"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("connectedApps_userId_idx").on(table.userId),
    index("connectedApps_userIdActive_idx").on(table.userId, table.active),
  ]
);

export const integrationActivityLogs = sqliteTable(
  "integration_activity_logs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    integrationName: text("integration_name").notNull(),
    action: text("action").notNull(),
    details: text("details"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
  },
  (table) => [index("integrationActivityLogs_userId_idx").on(table.userId)]
);

export const feedback = sqliteTable(
  "feedback",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    message: text("message").notNull(),
    route: text("route"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
  },
  (table) => [index("feedback_organizationId_idx").on(table.organizationId)]
);

// -----------------------------------------------------------------------------
// MCP OAuth tables
// -----------------------------------------------------------------------------

export const mcpOAuthClients = sqliteTable(
  "mcp_oauth_clients",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    redirectUris: text("redirect_uris").notNull(),
    allowedScopes: text("allowed_scopes").notNull().default("mcp"),
    tokenEndpointAuthMethod: text("token_endpoint_auth_method")
      .notNull()
      .default("none"),
    grantTypes: text("grant_types").notNull().default("authorization_code"),
    responseTypes: text("response_types").notNull().default("code"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date()),
  },
  (table) => [index("mcpOAuthClients_name_idx").on(table.name)]
);

export const mcpOAuthAuthorizationCodes = sqliteTable(
  "mcp_oauth_authorization_codes",
  {
    code: text("code").primaryKey(),
    clientId: text("client_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "cascade",
    }),
    scopes: text("scopes"),
    redirectUri: text("redirect_uri").notNull(),
    codeChallenge: text("code_challenge").notNull(),
    codeChallengeMethod: text("code_challenge_method").notNull(),
    state: text("state"),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    consumedAt: integer("consumed_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
  },
  (table) => [
    index("mcpOAuthAuthorizationCodes_clientId_idx").on(table.clientId),
    index("mcpOAuthAuthorizationCodes_userId_idx").on(table.userId),
    index("mcpOAuthAuthorizationCodes_expiresAt_idx").on(table.expiresAt),
  ]
);

export const mcpOAuthRefreshTokens = sqliteTable(
  "mcp_oauth_refresh_tokens",
  {
    id: text("id").primaryKey(),
    tokenHash: text("token_hash").notNull().unique(),
    clientId: text("client_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "cascade",
    }),
    scopes: text("scopes"),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    consumedAt: integer("consumed_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
  },
  (table) => [
    index("mcpOAuthRefreshTokens_tokenHash_idx").on(table.tokenHash),
    index("mcpOAuthRefreshTokens_userId_idx").on(table.userId),
    index("mcpOAuthRefreshTokens_clientId_idx").on(table.clientId),
  ]
);

export const webhooks = sqliteTable(
  "webhooks",
  {
    id: text("id").primaryKey(),
    publicId: text("public_id").notNull().unique(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    url: text("url").notNull(),
    events: text("events").notNull().default("[]"),
    description: text("description"),
    secret: text("secret").notNull(),
    status: text("status").notNull().default("active"),
    totalDeliveries: integer("total_deliveries").notNull().default(0),
    successfulDeliveries: integer("successful_deliveries").notNull().default(0),
    failedDeliveries: integer("failed_deliveries").notNull().default(0),
    lastDeliveryAt: integer("last_delivery_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("webhooks_organizationId_idx").on(table.organizationId),
    index("webhooks_status_idx").on(table.status),
  ]
);
