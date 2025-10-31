import { convexQuery } from "@convex-dev/react-query";
import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { ArrowLeftIcon, UserPlusIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageWrapper } from "@/components/page-wrapper";
import { ActivityFeed } from "../../../../components/documents/activity-feed";
import { AddRecipientDialog } from "../../../../components/documents/add-recipient-dialog";
import { RecipientList } from "../../../../components/documents/recipient-list";
import { SigningProgress } from "../../../../components/documents/signing-progress";
import { Button } from "../../../../components/ui/button";

export const Route = createFileRoute(
	"/_authenticated/$slug/documents/$documentId",
)({
	component: DocumentDetailPage,
});

function DocumentDetailPage() {
	const { slug, documentId } = Route.useParams();
	const router = useRouter();
	const [addRecipientOpen, setAddRecipientOpen] = useState(false);

	const { data: document } = useSuspenseQuery(
		convexQuery(api.documents.queries.getDocument, {
			documentId: documentId as Id<"documents">,
		}),
	);

	const { data: recipients = [], refetch: refetchRecipients } = useSuspenseQuery(
		convexQuery(api.documents.recipients_queries.getDocumentRecipients, {
			documentId: documentId as Id<"documents">,
		}),
	);

	const { data: progress } = useSuspenseQuery(
		convexQuery(api.documents.recipients_queries.getRecipientProgress, {
			documentId: documentId as Id<"documents">,
		}),
	);

	const removeRecipient = useMutation(
		api.documents.recipients_mutations.removeRecipient,
	);

	const handleRemoveRecipient = async (
		recipientId: Id<"document_recipients">,
	) => {
		if (!confirm("Remove this recipient?")) {
			return;
		}

		try {
			await removeRecipient({ recipientId });
			toast.success("Recipient removed");
			refetchRecipients();
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Failed to remove recipient";
			toast.error(errorMessage);
		}
	};

	// Build activity events from document and recipients
	const activityEvents = [];

	// Document created
	activityEvents.push({
		type: "created" as const,
		timestamp: document.createdAt,
		description: `Document "${document.name}" was created`,
	});

	// Recipients added
	for (const recipient of recipients) {
		activityEvents.push({
			type: "recipient_added" as const,
			timestamp: recipient.createdAt,
			description: `${recipient.name || recipient.email} was added as a ${recipient.role}`,
		});

		if (recipient.viewedAt) {
			activityEvents.push({
				type: "viewed" as const,
				timestamp: recipient.viewedAt,
				description: `${recipient.name || recipient.email} viewed the document`,
			});
		}

		if (recipient.signedAt) {
			activityEvents.push({
				type: "signed" as const,
				timestamp: recipient.signedAt,
				description: `${recipient.name || recipient.email} signed the document`,
			});
		}

		if (recipient.approvedAt) {
			activityEvents.push({
				type: "approved" as const,
				timestamp: recipient.approvedAt,
				description: `${recipient.name || recipient.email} approved the document`,
			});
		}

		if (recipient.declinedAt) {
			activityEvents.push({
				type: "declined" as const,
				timestamp: recipient.declinedAt,
				description: `${recipient.name || recipient.email} declined`,
			});
		}
	}

	// Sort by timestamp (newest first)
	activityEvents.sort((a, b) => b.timestamp - a.timestamp);

	const canEdit = document.status === "active"; // Only edit active documents

	return (
		<PageWrapper title={document.name}>
			<div className="space-y-6">
				<div>
					<Button
						variant="ghost"
						size="sm"
						onClick={() =>
							router.navigate({ to: "/$slug/documents", params: { slug } })
						}
					>
						<ArrowLeftIcon className="mr-2 h-4 w-4" />
						Back to Documents
					</Button>
				</div>

				<div className="grid gap-6 lg:grid-cols-2">
					<div className="space-y-6">
						<div className="flex items-center justify-between">
							<h2 className="text-lg font-semibold">Recipients</h2>
							{canEdit && (
								<Button
									size="sm"
									onClick={() => setAddRecipientOpen(true)}
								>
									<UserPlusIcon className="mr-2 h-4 w-4" />
									Add Recipient
								</Button>
							)}
						</div>

						<RecipientList
							recipients={recipients}
							onRemoveRecipient={canEdit ? handleRemoveRecipient : undefined}
							canEdit={canEdit}
						/>
					</div>

					<div className="space-y-6">
						{progress && <SigningProgress progress={progress} />}
						<ActivityFeed events={activityEvents} />
					</div>
				</div>

				<AddRecipientDialog
					documentId={documentId as Id<"documents">}
					open={addRecipientOpen}
					onOpenChange={setAddRecipientOpen}
					onSuccess={() => refetchRecipients()}
				/>
			</div>
		</PageWrapper>
	);
}
