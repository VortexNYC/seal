import { relations, sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
// Vortex Sign domain tables
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
    thumbnailDataUrl: text("thumbnail_data_url"),
    sentAt: integer("sent_at", { mode: "timestamp_ms" }),
    deadline: integer("deadline", { mode: "timestamp_ms" }),
    redirectUrl: text("redirect_url"),
    allowDictateNextSigner: integer("allow_dictate_next_signer", {
      mode: "boolean",
    })
      .notNull()
      .default(false),
    signingMode: text("signing_mode").notNull().default("parallel"),
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
    signatureData: text("signature_data"),
    signatureType: text("signature_type"),
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
