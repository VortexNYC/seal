/**
 * Audit Logs Module
 *
 * Provides audit trail functionality for legal compliance (ESIGN Act, UETA)
 * and security auditing.
 *
 * SEA-31: Database Schemas - Audit Trail Implementation
 * SEA-108: Digital Signature Implementation - Audit Trail Export
 */

export {
  getDocumentAuditTrail,
  getOrganizationAuditTrail,
  getRecipientAuditTrail,
  logAction,
  logDocumentAction,
  logFieldAction,
  logRecipientAction,
  logSignatureAction,
} from "./helpers";

export {
  exportDocumentAuditTrail,
  getDocumentAuditLogs,
  getOrganizationAuditLogs,
  getSigningSessionAuditTrail,
} from "./queries";
