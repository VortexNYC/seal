import { describe, test, expect } from "vitest";

import {
  documentStatusSchema,
  recipientRoleSchema,
  recipientStatusSchema,
  templateStatusSchema,
  signatureMethodSchema,
  fieldTypeSchema,
  listDocumentsSchema,
  getDocumentSchema,
  createDocumentSchema,
  updateDocumentSchema,
  documentIdSchema,
  sendDocumentSchema,
  voidDocumentSchema,
  listRecipientsSchema,
  getRecipientSchema,
  addRecipientSchema,
  updateRecipientSchema,
  removeRecipientSchema,
  sendReminderSchema,
  addRecipientsBulkSchema,
  updateRecipientsBulkSchema,
  listTemplatesSchema,
  getTemplateSchema,
  templateIdSchema,
  createTemplateSchema,
  updateTemplateSchema,
  useTemplateSchema,
  signatureDocumentIdSchema,
  getSignatureSchema,
  getAuditTrailSchema,
  uploadFileSchema,
  uploadFileContentSchema,
} from "../api";

// =============================================================================
// Enum Schemas
// =============================================================================

describe("documentStatusSchema", () => {
  test.each(["draft", "sent", "in_progress", "completed", "cancelled", "declined"])(
    "accepts valid status: %s",
    (status) => {
      expect(documentStatusSchema.parse(status)).toBe(status);
    },
  );

  test("rejects invalid status", () => {
    const result = documentStatusSchema.safeParse("unknown");
    expect(result.success).toBe(false);
  });

  test("rejects empty string", () => {
    expect(documentStatusSchema.safeParse("").success).toBe(false);
  });

  test("rejects number", () => {
    expect(documentStatusSchema.safeParse(1).success).toBe(false);
  });
});

describe("recipientRoleSchema", () => {
  test.each(["signer", "approver", "viewer"])("accepts valid role: %s", (role) => {
    expect(recipientRoleSchema.parse(role)).toBe(role);
  });

  test("rejects carbon_copy (not in schema)", () => {
    expect(recipientRoleSchema.safeParse("carbon_copy").success).toBe(false);
  });

  test("rejects invalid role", () => {
    expect(recipientRoleSchema.safeParse("admin").success).toBe(false);
  });
});

describe("recipientStatusSchema", () => {
  test.each(["pending", "viewed", "signed", "approved", "declined"])(
    "accepts valid status: %s",
    (status) => {
      expect(recipientStatusSchema.parse(status)).toBe(status);
    },
  );

  test("rejects invalid status", () => {
    expect(recipientStatusSchema.safeParse("completed").success).toBe(false);
  });
});

describe("templateStatusSchema", () => {
  test.each(["active", "archived"])("accepts valid status: %s", (status) => {
    expect(templateStatusSchema.parse(status)).toBe(status);
  });

  test("rejects invalid status", () => {
    expect(templateStatusSchema.safeParse("deleted").success).toBe(false);
  });
});

describe("signatureMethodSchema", () => {
  test.each(["draw", "type", "upload"])("accepts valid method: %s", (method) => {
    expect(signatureMethodSchema.parse(method)).toBe(method);
  });

  test("rejects invalid method", () => {
    expect(signatureMethodSchema.safeParse("stamp").success).toBe(false);
  });
});

describe("fieldTypeSchema", () => {
  test.each(["signature", "text", "date", "checkbox", "dropdown", "radio", "attachment"])(
    "accepts valid type: %s",
    (type) => {
      expect(fieldTypeSchema.parse(type)).toBe(type);
    },
  );

  test("rejects invalid type", () => {
    expect(fieldTypeSchema.safeParse("number").success).toBe(false);
  });
});

// =============================================================================
// Document Schemas
// =============================================================================

describe("listDocumentsSchema", () => {
  test("accepts empty object (all optional)", () => {
    expect(listDocumentsSchema.parse({})).toEqual({});
  });

  test("accepts valid limit", () => {
    const result = listDocumentsSchema.parse({ limit: 50 });
    expect(result.limit).toBe(50);
  });

  test("accepts limit of 1 (min boundary)", () => {
    expect(listDocumentsSchema.parse({ limit: 1 }).limit).toBe(1);
  });

  test("accepts limit of 100 (max boundary)", () => {
    expect(listDocumentsSchema.parse({ limit: 100 }).limit).toBe(100);
  });

  test("rejects limit of 0", () => {
    expect(listDocumentsSchema.safeParse({ limit: 0 }).success).toBe(false);
  });

  test("rejects limit over 100", () => {
    expect(listDocumentsSchema.safeParse({ limit: 101 }).success).toBe(false);
  });

  test("rejects negative limit", () => {
    expect(listDocumentsSchema.safeParse({ limit: -1 }).success).toBe(false);
  });

  test("accepts valid cursor", () => {
    expect(listDocumentsSchema.parse({ cursor: "abc123" }).cursor).toBe("abc123");
  });

  test("accepts valid status filter", () => {
    expect(listDocumentsSchema.parse({ status: "draft" }).status).toBe("draft");
  });

  test("rejects invalid status filter", () => {
    expect(listDocumentsSchema.safeParse({ status: "invalid" }).success).toBe(false);
  });

  test("accepts all fields together", () => {
    const input = { limit: 25, cursor: "next_page", status: "sent" as const };
    const result = listDocumentsSchema.parse(input);
    expect(result).toEqual(input);
  });
});

describe("getDocumentSchema", () => {
  test("accepts valid input", () => {
    expect(getDocumentSchema.parse({ id: "doc_123" })).toEqual({ id: "doc_123" });
  });

  test("accepts with include_recipients", () => {
    const result = getDocumentSchema.parse({ id: "doc_123", include_recipients: true });
    expect(result.include_recipients).toBe(true);
  });

  test("rejects missing id", () => {
    expect(getDocumentSchema.safeParse({}).success).toBe(false);
  });
});

describe("createDocumentSchema", () => {
  const validInput = {
    title: "My Document",
    storage_id: "storage_abc123",
    file_size: 1024,
  };

  test("accepts valid required fields", () => {
    const result = createDocumentSchema.parse(validInput);
    expect(result.title).toBe("My Document");
    expect(result.storage_id).toBe("storage_abc123");
    expect(result.file_size).toBe(1024);
  });

  test("accepts all optional fields", () => {
    const input = {
      ...validInput,
      description: "A test document",
      file_type: "application/pdf",
      page_count: 5,
      deadline: "2026-12-31T23:59:59Z",
    };
    const result = createDocumentSchema.parse(input);
    expect(result.description).toBe("A test document");
    expect(result.page_count).toBe(5);
  });

  test("rejects missing title", () => {
    const { title: _, ...noTitle } = validInput;
    expect(createDocumentSchema.safeParse(noTitle).success).toBe(false);
  });

  test("rejects missing storage_id", () => {
    const { storage_id: _, ...noStorageId } = validInput;
    expect(createDocumentSchema.safeParse(noStorageId).success).toBe(false);
  });

  test("rejects missing file_size", () => {
    const { file_size: _, ...noFileSize } = validInput;
    expect(createDocumentSchema.safeParse(noFileSize).success).toBe(false);
  });
});

describe("updateDocumentSchema", () => {
  test("accepts id only (no updates)", () => {
    expect(updateDocumentSchema.parse({ id: "doc_123" })).toEqual({ id: "doc_123" });
  });

  test("accepts with optional title", () => {
    const result = updateDocumentSchema.parse({ id: "doc_123", title: "Updated" });
    expect(result.title).toBe("Updated");
  });

  test("rejects missing id", () => {
    expect(updateDocumentSchema.safeParse({ title: "Updated" }).success).toBe(false);
  });
});

describe("documentIdSchema", () => {
  test("accepts valid id", () => {
    expect(documentIdSchema.parse({ id: "doc_123" })).toEqual({ id: "doc_123" });
  });

  test("rejects missing id", () => {
    expect(documentIdSchema.safeParse({}).success).toBe(false);
  });

  test("rejects non-string id", () => {
    expect(documentIdSchema.safeParse({ id: 123 }).success).toBe(false);
  });
});

describe("sendDocumentSchema", () => {
  test("accepts id only", () => {
    expect(sendDocumentSchema.parse({ id: "doc_123" })).toEqual({ id: "doc_123" });
  });

  test("accepts with optional message", () => {
    const result = sendDocumentSchema.parse({ id: "doc_123", message: "Please sign" });
    expect(result.message).toBe("Please sign");
  });
});

describe("voidDocumentSchema", () => {
  test("accepts valid input", () => {
    const result = voidDocumentSchema.parse({ id: "doc_123", reason: "No longer needed" });
    expect(result.reason).toBe("No longer needed");
  });

  test("rejects missing reason", () => {
    expect(voidDocumentSchema.safeParse({ id: "doc_123" }).success).toBe(false);
  });

  test("rejects missing id", () => {
    expect(voidDocumentSchema.safeParse({ reason: "test" }).success).toBe(false);
  });
});

// =============================================================================
// Recipient Schemas
// =============================================================================

describe("listRecipientsSchema", () => {
  test("accepts valid document_id", () => {
    expect(listRecipientsSchema.parse({ document_id: "doc_123" })).toEqual({
      document_id: "doc_123",
    });
  });

  test("rejects missing document_id", () => {
    expect(listRecipientsSchema.safeParse({}).success).toBe(false);
  });
});

describe("getRecipientSchema", () => {
  test("accepts valid input", () => {
    const result = getRecipientSchema.parse({ document_id: "doc_123", id: "rec_456" });
    expect(result.document_id).toBe("doc_123");
    expect(result.id).toBe("rec_456");
  });

  test("rejects missing document_id", () => {
    expect(getRecipientSchema.safeParse({ id: "rec_456" }).success).toBe(false);
  });

  test("rejects missing id", () => {
    expect(getRecipientSchema.safeParse({ document_id: "doc_123" }).success).toBe(false);
  });
});

describe("addRecipientSchema", () => {
  const validInput = {
    document_id: "doc_123",
    email: "user@example.com",
    name: "John Doe",
    role: "signer" as const,
  };

  test("accepts valid required fields", () => {
    const result = addRecipientSchema.parse(validInput);
    expect(result.email).toBe("user@example.com");
    expect(result.name).toBe("John Doe");
    expect(result.role).toBe("signer");
  });

  test("accepts with optional order", () => {
    const result = addRecipientSchema.parse({ ...validInput, order: 1 });
    expect(result.order).toBe(1);
  });

  test("accepts with optional message", () => {
    const result = addRecipientSchema.parse({ ...validInput, message: "Please review" });
    expect(result.message).toBe("Please review");
  });

  test("rejects invalid email", () => {
    expect(addRecipientSchema.safeParse({ ...validInput, email: "not-an-email" }).success).toBe(
      false,
    );
  });

  test("rejects empty email", () => {
    expect(addRecipientSchema.safeParse({ ...validInput, email: "" }).success).toBe(false);
  });

  test("rejects missing email", () => {
    const { email: _, ...noEmail } = validInput;
    expect(addRecipientSchema.safeParse(noEmail).success).toBe(false);
  });

  test("rejects missing name", () => {
    const { name: _, ...noName } = validInput;
    expect(addRecipientSchema.safeParse(noName).success).toBe(false);
  });

  test("rejects empty name", () => {
    expect(addRecipientSchema.safeParse({ ...validInput, name: "" }).success).toBe(false);
  });

  test("rejects whitespace-only name", () => {
    expect(addRecipientSchema.safeParse({ ...validInput, name: "   " }).success).toBe(false);
  });

  test("rejects invalid role", () => {
    expect(addRecipientSchema.safeParse({ ...validInput, role: "editor" }).success).toBe(false);
  });

  test("rejects missing role", () => {
    const { role: _, ...noRole } = validInput;
    expect(addRecipientSchema.safeParse(noRole).success).toBe(false);
  });

  test("accepts all valid roles", () => {
    for (const role of ["signer", "approver", "viewer"] as const) {
      expect(addRecipientSchema.parse({ ...validInput, role }).role).toBe(role);
    }
  });
});

describe("updateRecipientSchema", () => {
  test("accepts minimal input (ids only)", () => {
    const result = updateRecipientSchema.parse({ document_id: "doc_123", id: "rec_456" });
    expect(result.document_id).toBe("doc_123");
    expect(result.id).toBe("rec_456");
  });

  test("accepts all optional update fields", () => {
    const result = updateRecipientSchema.parse({
      document_id: "doc_123",
      id: "rec_456",
      name: "Jane Doe",
      role: "approver",
      order: 2,
      message: "Updated message",
    });
    expect(result.name).toBe("Jane Doe");
    expect(result.role).toBe("approver");
    expect(result.order).toBe(2);
  });

  test("rejects invalid role in update", () => {
    expect(
      updateRecipientSchema.safeParse({
        document_id: "doc_123",
        id: "rec_456",
        role: "invalid",
      }).success,
    ).toBe(false);
  });
});

describe("removeRecipientSchema", () => {
  test("accepts valid input", () => {
    const result = removeRecipientSchema.parse({ document_id: "doc_123", id: "rec_456" });
    expect(result.document_id).toBe("doc_123");
    expect(result.id).toBe("rec_456");
  });

  test("rejects missing fields", () => {
    expect(removeRecipientSchema.safeParse({}).success).toBe(false);
    expect(removeRecipientSchema.safeParse({ document_id: "doc_123" }).success).toBe(false);
    expect(removeRecipientSchema.safeParse({ id: "rec_456" }).success).toBe(false);
  });
});

describe("sendReminderSchema", () => {
  test("accepts valid input with optional message", () => {
    const result = sendReminderSchema.parse({
      document_id: "doc_123",
      id: "rec_456",
      message: "Reminder!",
    });
    expect(result.message).toBe("Reminder!");
  });

  test("accepts without message", () => {
    const result = sendReminderSchema.parse({ document_id: "doc_123", id: "rec_456" });
    expect(result.message).toBeUndefined();
  });
});

describe("addRecipientsBulkSchema", () => {
  test("accepts valid bulk recipients", () => {
    const result = addRecipientsBulkSchema.parse({
      document_id: "doc_123",
      recipients: [
        { email: "a@example.com", name: "Alice", role: "signer" },
        { email: "b@example.com", name: "Bob", role: "viewer" },
      ],
    });
    expect(result.recipients).toHaveLength(2);
    expect(result.recipients[0].email).toBe("a@example.com");
  });

  test("accepts empty recipients array", () => {
    const result = addRecipientsBulkSchema.parse({
      document_id: "doc_123",
      recipients: [],
    });
    expect(result.recipients).toHaveLength(0);
  });

  test("recipients do not include document_id (omitted)", () => {
    const result = addRecipientsBulkSchema.parse({
      document_id: "doc_123",
      recipients: [{ email: "a@example.com", name: "Alice", role: "signer" }],
    });
    expect("document_id" in result.recipients[0]).toBe(false);
  });

  test("rejects invalid email in bulk recipients", () => {
    expect(
      addRecipientsBulkSchema.safeParse({
        document_id: "doc_123",
        recipients: [{ email: "invalid", name: "Alice", role: "signer" }],
      }).success,
    ).toBe(false);
  });

  test("rejects missing required fields in recipient", () => {
    expect(
      addRecipientsBulkSchema.safeParse({
        document_id: "doc_123",
        recipients: [{ email: "a@example.com" }],
      }).success,
    ).toBe(false);
  });

  test("rejects missing document_id", () => {
    expect(
      addRecipientsBulkSchema.safeParse({
        recipients: [{ email: "a@example.com", name: "Alice", role: "signer" }],
      }).success,
    ).toBe(false);
  });
});

describe("updateRecipientsBulkSchema", () => {
  test("accepts valid bulk updates", () => {
    const result = updateRecipientsBulkSchema.parse({
      document_id: "doc_123",
      updates: [
        { id: "rec_1", name: "Updated Alice" },
        { id: "rec_2", role: "approver" },
      ],
    });
    expect(result.updates).toHaveLength(2);
    expect(result.updates[0].name).toBe("Updated Alice");
  });

  test("accepts empty updates array", () => {
    const result = updateRecipientsBulkSchema.parse({
      document_id: "doc_123",
      updates: [],
    });
    expect(result.updates).toHaveLength(0);
  });

  test("rejects update without id", () => {
    expect(
      updateRecipientsBulkSchema.safeParse({
        document_id: "doc_123",
        updates: [{ name: "No ID" }],
      }).success,
    ).toBe(false);
  });
});

// =============================================================================
// Template Schemas
// =============================================================================

describe("listTemplatesSchema", () => {
  test("accepts empty object", () => {
    expect(listTemplatesSchema.parse({})).toEqual({});
  });

  test("accepts valid limit", () => {
    expect(listTemplatesSchema.parse({ limit: 50 }).limit).toBe(50);
  });

  test("rejects limit of 0", () => {
    expect(listTemplatesSchema.safeParse({ limit: 0 }).success).toBe(false);
  });

  test("rejects limit over 100", () => {
    expect(listTemplatesSchema.safeParse({ limit: 101 }).success).toBe(false);
  });

  test("accepts valid template status filter", () => {
    expect(listTemplatesSchema.parse({ status: "active" }).status).toBe("active");
    expect(listTemplatesSchema.parse({ status: "archived" }).status).toBe("archived");
  });

  test("rejects invalid template status", () => {
    expect(listTemplatesSchema.safeParse({ status: "draft" }).success).toBe(false);
  });
});

describe("getTemplateSchema", () => {
  test("accepts valid input", () => {
    expect(getTemplateSchema.parse({ id: "tpl_123" })).toEqual({ id: "tpl_123" });
  });

  test("accepts with include_fields", () => {
    const result = getTemplateSchema.parse({ id: "tpl_123", include_fields: true });
    expect(result.include_fields).toBe(true);
  });

  test("rejects missing id", () => {
    expect(getTemplateSchema.safeParse({}).success).toBe(false);
  });
});

describe("templateIdSchema", () => {
  test("accepts valid id", () => {
    expect(templateIdSchema.parse({ id: "tpl_123" })).toEqual({ id: "tpl_123" });
  });

  test("rejects missing id", () => {
    expect(templateIdSchema.safeParse({}).success).toBe(false);
  });
});

describe("createTemplateSchema", () => {
  test("accepts valid input", () => {
    const result = createTemplateSchema.parse({
      document_id: "doc_123",
      name: "My Template",
    });
    expect(result.name).toBe("My Template");
  });

  test("accepts with description", () => {
    const result = createTemplateSchema.parse({
      document_id: "doc_123",
      name: "My Template",
      description: "A reusable template",
    });
    expect(result.description).toBe("A reusable template");
  });

  test("rejects missing document_id", () => {
    expect(createTemplateSchema.safeParse({ name: "My Template" }).success).toBe(false);
  });

  test("rejects missing name", () => {
    expect(createTemplateSchema.safeParse({ document_id: "doc_123" }).success).toBe(false);
  });
});

describe("updateTemplateSchema", () => {
  test("accepts id only", () => {
    expect(updateTemplateSchema.parse({ id: "tpl_123" })).toEqual({ id: "tpl_123" });
  });

  test("accepts with status update", () => {
    const result = updateTemplateSchema.parse({ id: "tpl_123", status: "archived" });
    expect(result.status).toBe("archived");
  });

  test("rejects invalid status", () => {
    expect(updateTemplateSchema.safeParse({ id: "tpl_123", status: "deleted" }).success).toBe(
      false,
    );
  });
});

describe("useTemplateSchema", () => {
  test("accepts id only", () => {
    expect(useTemplateSchema.parse({ id: "tpl_123" })).toEqual({ id: "tpl_123" });
  });

  test("accepts with optional title and description", () => {
    const result = useTemplateSchema.parse({
      id: "tpl_123",
      title: "New Doc",
      description: "From template",
    });
    expect(result.title).toBe("New Doc");
    expect(result.description).toBe("From template");
  });
});

// =============================================================================
// Signature Schemas
// =============================================================================

describe("signatureDocumentIdSchema", () => {
  test("accepts valid document_id", () => {
    expect(signatureDocumentIdSchema.parse({ document_id: "doc_123" })).toEqual({
      document_id: "doc_123",
    });
  });

  test("rejects missing document_id", () => {
    expect(signatureDocumentIdSchema.safeParse({}).success).toBe(false);
  });
});

describe("getSignatureSchema", () => {
  test("accepts valid input", () => {
    const result = getSignatureSchema.parse({ document_id: "doc_123", id: "sig_789" });
    expect(result.document_id).toBe("doc_123");
    expect(result.id).toBe("sig_789");
  });

  test("rejects missing document_id", () => {
    expect(getSignatureSchema.safeParse({ id: "sig_789" }).success).toBe(false);
  });

  test("rejects missing id", () => {
    expect(getSignatureSchema.safeParse({ document_id: "doc_123" }).success).toBe(false);
  });
});

describe("getAuditTrailSchema", () => {
  test("accepts document_id only", () => {
    expect(getAuditTrailSchema.parse({ document_id: "doc_123" })).toEqual({
      document_id: "doc_123",
    });
  });

  test("accepts with valid limit", () => {
    const result = getAuditTrailSchema.parse({ document_id: "doc_123", limit: 50 });
    expect(result.limit).toBe(50);
  });

  test("rejects limit of 0", () => {
    expect(getAuditTrailSchema.safeParse({ document_id: "doc_123", limit: 0 }).success).toBe(false);
  });

  test("rejects limit over 100", () => {
    expect(getAuditTrailSchema.safeParse({ document_id: "doc_123", limit: 101 }).success).toBe(
      false,
    );
  });
});

// =============================================================================
// Upload Schemas
// =============================================================================

describe("uploadFileSchema", () => {
  test("accepts valid file path", () => {
    expect(uploadFileSchema.parse({ file_path: "/tmp/document.pdf" })).toEqual({
      file_path: "/tmp/document.pdf",
    });
  });

  test("rejects missing file_path", () => {
    expect(uploadFileSchema.safeParse({}).success).toBe(false);
  });

  test("rejects non-string file_path", () => {
    expect(uploadFileSchema.safeParse({ file_path: 123 }).success).toBe(false);
  });
});

describe("uploadFileContentSchema", () => {
  test("accepts valid input", () => {
    const result = uploadFileContentSchema.parse({
      file_name: "document.pdf",
      content_base64: "JVBERi0xLjQK",
    });
    expect(result.file_name).toBe("document.pdf");
    expect(result.content_base64).toBe("JVBERi0xLjQK");
  });

  test("rejects missing file_name", () => {
    expect(uploadFileContentSchema.safeParse({ content_base64: "JVBERi0xLjQK" }).success).toBe(
      false,
    );
  });

  test("rejects missing content_base64", () => {
    expect(uploadFileContentSchema.safeParse({ file_name: "document.pdf" }).success).toBe(false);
  });

  test("rejects empty object", () => {
    expect(uploadFileContentSchema.safeParse({}).success).toBe(false);
  });
});
