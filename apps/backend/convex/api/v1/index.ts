/**
 * @fileoverview V1 API module exports.
 * Re-exports all V1 API internal queries and mutations.
 *
 * @module api/v1
 */

// Account & organization info
export * as account from "./account";

// Analytics & reporting
export * as analytics from "./analytics";

// Audit log
export * as audit from "./audit";

// Documents API internal queries/mutations
export * as documents from "./documents";

// Team members
export * as members from "./members";

// Recipients API internal queries/mutations
export * as recipients from "./recipients";

// Signatures API internal queries/mutations
export * as signatures from "./signatures";

// Organization settings
export * as settings from "./settings";

// Templates API internal queries/mutations
export * as templates from "./templates";

// Webhooks Management API internal queries/mutations
export * as webhooks from "./webhooks";
