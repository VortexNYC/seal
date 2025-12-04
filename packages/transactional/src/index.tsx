import { render } from "@react-email/render";
import {
	DocumentCompleted,
	type DocumentCompletedProps,
} from "./emails/document-completed.js";
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
	SigningComplete,
	type SigningCompleteProps,
} from "./emails/signing-complete.js";
import {
	TeamInvitation,
	type TeamInvitationProps,
} from "./emails/team-invitation.js";
import { Welcome, type WelcomeProps } from "./emails/welcome.js";

// Re-export components for direct use
export {
	DocumentInvitation,
	DocumentCompleted,
	DocumentReminder,
	DocumentShared,
	SigningComplete,
	TeamInvitation,
	Welcome,
};

// Re-export types
export type {
	DocumentInvitationProps,
	SigningCompleteProps,
	DocumentCompletedProps,
	DocumentReminderProps,
	DocumentSharedProps,
	TeamInvitationProps,
	WelcomeProps,
};

/**
 * Render DocumentInvitation email to HTML string
 */
export async function renderDocumentInvitation(
	props: DocumentInvitationProps,
): Promise<string> {
	return render(<DocumentInvitation {...props} />);
}

/**
 * Render SigningComplete email to HTML string
 */
export async function renderSigningComplete(
	props: SigningCompleteProps,
): Promise<string> {
	return render(<SigningComplete {...props} />);
}

/**
 * Render DocumentCompleted email to HTML string
 */
export async function renderDocumentCompleted(
	props: DocumentCompletedProps,
): Promise<string> {
	return render(<DocumentCompleted {...props} />);
}

/**
 * Render DocumentReminder email to HTML string
 */
export async function renderDocumentReminder(
	props: DocumentReminderProps,
): Promise<string> {
	return render(<DocumentReminder {...props} />);
}

/**
 * Render Welcome email to HTML string
 */
export async function renderWelcome(props: WelcomeProps): Promise<string> {
	return render(<Welcome {...props} />);
}

/**
 * Render TeamInvitation email to HTML string
 */
export async function renderTeamInvitation(
	props: TeamInvitationProps,
): Promise<string> {
	return render(<TeamInvitation {...props} />);
}

/**
 * Render DocumentShared email to HTML string
 */
export async function renderDocumentShared(
	props: DocumentSharedProps,
): Promise<string> {
	return render(<DocumentShared {...props} />);
}
