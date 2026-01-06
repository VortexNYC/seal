/**
 * Custom hook for fetching and managing document-related data.
 * Consolidates all document data fetching into a single hook.
 */

import { convexQuery } from "@convex-dev/react-query";
import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";

export interface UseDocumentDataOptions {
	documentId: Id<"documents">;
}

export function useDocumentData({ documentId }: UseDocumentDataOptions) {
	// Core document data
	const { data: document, refetch: refetchDocument } = useSuspenseQuery(
		convexQuery(api.documents.queries.getDocument, { documentId }),
	);

	// Recipients
	const { data: recipients = [], refetch: refetchRecipients } =
		useSuspenseQuery(
			convexQuery(api.documents.recipients_queries.getDocumentRecipients, {
				documentId,
			}),
		);

	// Progress
	const { data: progress } = useSuspenseQuery(
		convexQuery(api.documents.recipients_queries.getRecipientProgress, {
			documentId,
		}),
	);

	// Signature fields
	const { data: signatureFields = [], refetch: refetchFields } =
		useSuspenseQuery(
			convexQuery(api.signature_fields.queries.getFieldsByDocument, {
				documentId,
			}),
		);

	// Signatures (for displaying filled signature images)
	const { data: signatures = [] } = useSuspenseQuery(
		convexQuery(api.signatures.queries.getSignaturesByDocument, {
			documentId,
		}),
	);

	// Current user's recipient record (if they are a recipient)
	const { data: currentUserRecipient, refetch: refetchCurrentUserRecipient } =
		useSuspenseQuery(
			convexQuery(
				api.documents.recipients_queries.getRecipientByAuthenticatedUser,
				{ documentId },
			),
		);

	// Fields assigned to current user (if they are a recipient)
	const { data: currentUserFields = [], refetch: refetchCurrentUserFields } =
		useSuspenseQuery(
			convexQuery(
				api.signature_fields.queries.getFieldsForAuthenticatedRecipient,
				{ documentId },
			),
		);

	// Derived data: recipients by ID map
	const recipientsById = useMemo(
		() => new Map(recipients.map((recipient) => [recipient._id, recipient])),
		[recipients],
	);

	// Derived data: signatures by field ID map
	const signaturesByFieldId = useMemo(
		() =>
			new Map(
				signatures.map((signature) => {
					const signer = recipientsById.get(signature.recipientId);
					return [
						signature.fieldId,
						{
							signatureImageUrl: signature.signatureImageUrl,
							value: signature.value,
							signedAt: signature.signedAt,
							signatureMethod: signature.signatureMethod,
							signerName: signer?.name,
							signerEmail: signer?.email,
						},
					];
				}),
			),
		[signatures, recipientsById],
	);

	// Derived data: field counts per recipient
	const fieldCountsByRecipient = useMemo(() => {
		const counts = new Map<string, number>();
		for (const field of signatureFields) {
			const count = counts.get(field.recipientId) ?? 0;
			counts.set(field.recipientId, count + 1);
		}
		return counts;
	}, [signatureFields]);

	// Derived data: signers (recipients with role "signer")
	const signers = useMemo(
		() => recipients.filter((r) => r.role === "signer"),
		[recipients],
	);

	// Derived data: can edit document
	const canEdit = useMemo(
		() =>
			document.status === "active" &&
			(document.workflowStatus === "draft" || !document.workflowStatus),
		[document.status, document.workflowStatus],
	);

	// Refetch all data
	const refetchAll = async () => {
		await Promise.all([
			refetchDocument(),
			refetchRecipients(),
			refetchFields(),
			refetchCurrentUserRecipient(),
			refetchCurrentUserFields(),
		]);
	};

	return {
		// Core data
		document,
		recipients,
		progress,
		signatureFields,
		signatures,
		currentUserRecipient,
		currentUserFields,

		// Derived data
		recipientsById,
		signaturesByFieldId,
		fieldCountsByRecipient,
		signers,
		canEdit,

		// Refetch functions
		refetchDocument,
		refetchRecipients,
		refetchFields,
		refetchCurrentUserRecipient,
		refetchCurrentUserFields,
		refetchAll,
	};
}
