import { renderEmail } from "@vortexnyc/email";

import {
  DocumentCompleted,
  type DocumentCompletedProps,
} from "./emails/document-completed.js";
import {
  DocumentExpirationAlert,
  type DocumentExpirationAlertProps,
} from "./emails/document-expiration-alert.js";
import {
  DocumentExpired,
  type DocumentExpiredProps,
} from "./emails/document-expired.js";
import {
  DocumentInvitation,
  type DocumentInvitationProps,
} from "./emails/document-invitation.js";
import {
  DocumentReminder,
  type DocumentReminderProps,
} from "./emails/document-reminder.js";
import {
  DocumentShared,
  type DocumentSharedProps,
} from "./emails/document-shared.js";
import {
  DocumentViewed,
  type DocumentViewedProps,
} from "./emails/document-viewed.js";
import {
  OwnershipTransferred,
  type OwnershipTransferredProps,
} from "./emails/ownership-transferred.js";
import {
  SigningComplete,
  type SigningCompleteProps,
} from "./emails/signing-complete.js";

// Re-export components for direct use
export {
  DocumentInvitation,
  DocumentCompleted,
  DocumentExpirationAlert,
  DocumentExpired,
  DocumentReminder,
  DocumentShared,
  DocumentViewed,
  SigningComplete,
  OwnershipTransferred,
};

// Re-export types
export type {
  DocumentInvitationProps,
  SigningCompleteProps,
  DocumentCompletedProps,
  DocumentExpirationAlertProps,
  DocumentExpiredProps,
  DocumentReminderProps,
  DocumentSharedProps,
  DocumentViewedProps,
  OwnershipTransferredProps,
};

/**
 * Render DocumentInvitation email to HTML string
 */
export async function renderDocumentInvitation(
  props: DocumentInvitationProps
): Promise<string> {
  return renderEmail(<DocumentInvitation {...props} />);
}

/**
 * Render SigningComplete email to HTML string
 */
export async function renderSigningComplete(
  props: SigningCompleteProps
): Promise<string> {
  return renderEmail(<SigningComplete {...props} />);
}

/**
 * Render DocumentCompleted email to HTML string
 */
export async function renderDocumentCompleted(
  props: DocumentCompletedProps
): Promise<string> {
  return renderEmail(<DocumentCompleted {...props} />);
}

/**
 * Render DocumentReminder email to HTML string
 */
export async function renderDocumentReminder(
  props: DocumentReminderProps
): Promise<string> {
  return renderEmail(<DocumentReminder {...props} />);
}

/**
 * Render DocumentShared email to HTML string
 */
export async function renderDocumentShared(
  props: DocumentSharedProps
): Promise<string> {
  return renderEmail(<DocumentShared {...props} />);
}

/**
 * Render DocumentExpired email to HTML string
 */
export async function renderDocumentExpired(
  props: DocumentExpiredProps
): Promise<string> {
  return renderEmail(<DocumentExpired {...props} />);
}

/**
 * Render DocumentExpirationAlert email to HTML string
 */
export async function renderDocumentExpirationAlert(
  props: DocumentExpirationAlertProps
): Promise<string> {
  return renderEmail(<DocumentExpirationAlert {...props} />);
}

/**
 * Render DocumentViewed email to HTML string
 */
export async function renderDocumentViewed(
  props: DocumentViewedProps
): Promise<string> {
  return renderEmail(<DocumentViewed {...props} />);
}

/**
 * Render OwnershipTransferred email to HTML string
 */
export async function renderOwnershipTransferred(
  props: OwnershipTransferredProps
): Promise<string> {
  return renderEmail(<OwnershipTransferred {...props} />);
}
