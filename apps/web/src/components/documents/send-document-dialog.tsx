/**
 * Send Document Dialog Component
 * Allows users to send documents to recipients with optional custom message
 */

import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { useAction } from "convex/react";
import { Loader2Icon, MailIcon, SendIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "../ui/dialog";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";

interface SendDocumentDialogProps {
	documentId: Id<"documents">;
	documentName: string;
	recipients: Array<{
		_id: Id<"document_recipients">;
		name?: string;
		email: string;
		role: "signer" | "viewer" | "approver";
		status: "pending" | "viewed" | "signed" | "approved" | "declined";
	}>;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess?: () => void;
}

export function SendDocumentDialog({
	documentId,
	documentName,
	recipients,
	open,
	onOpenChange,
	onSuccess,
}: SendDocumentDialogProps) {
	const [customMessage, setCustomMessage] = useState("");
	const [isSending, setIsSending] = useState(false);

	const sendDocumentEmails = useAction(
		api.documents.send_document_action.sendDocumentEmails,
	);

	// Count pending recipients
	const pendingRecipients = recipients.filter(
		(r) =>
			r.status !== "signed" &&
			r.status !== "approved" &&
			r.status !== "declined",
	);

	const handleSend = async () => {
		if (pendingRecipients.length === 0) {
			toast.error("All recipients have already completed their actions");
			return;
		}

		setIsSending(true);

		try {
			const result = await sendDocumentEmails({
				documentId,
				customMessage: customMessage.trim() || undefined,
			});

			if (result.success) {
				toast.success(
					`Document sent successfully to ${result.emailsSent} recipient${result.emailsSent !== 1 ? "s" : ""}`,
				);
				onSuccess?.();
				onOpenChange(false);
				setCustomMessage("");
			} else {
				toast.error(
					`Failed to send to ${result.emailsFailed} recipient${result.emailsFailed !== 1 ? "s" : ""}`,
				);
			}
		} catch (error) {
			console.error("Error sending document:", error);
			toast.error(
				error instanceof Error ? error.message : "Failed to send document",
			);
		} finally {
			setIsSending(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle>Send Document</DialogTitle>
					<DialogDescription>
						Send "{documentName}" to {pendingRecipients.length} recipient
						{pendingRecipients.length !== 1 ? "s" : ""} for signing.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-4">
					{/* Recipients list */}
					<div>
						<Label className="text-sm font-medium mb-2">Recipients</Label>
						<div className="space-y-2 mt-2">
							{pendingRecipients.map((recipient) => (
								<div
									key={recipient._id}
									className="flex items-center justify-between p-2 bg-muted rounded-md"
								>
									<div className="flex items-center gap-2">
										<MailIcon className="h-4 w-4 text-muted-foreground" />
										<div>
											<p className="text-sm font-medium">
												{recipient.name || recipient.email}
											</p>
											<p className="text-xs text-muted-foreground">
												{recipient.role.charAt(0).toUpperCase() +
													recipient.role.slice(1)}
											</p>
										</div>
									</div>
									<div className="text-xs text-muted-foreground px-2 py-1 bg-background rounded">
										{recipient.status}
									</div>
								</div>
							))}
						</div>
					</div>

					{/* Custom message */}
					<div>
						<Label htmlFor="message" className="text-sm font-medium">
							Custom Message (Optional)
						</Label>
						<Textarea
							id="message"
							placeholder="Add a personal message for recipients..."
							value={customMessage}
							onChange={(e) => setCustomMessage(e.target.value)}
							className="mt-2 min-h-[100px]"
							maxLength={500}
						/>
						<p className="text-xs text-muted-foreground mt-1">
							{customMessage.length}/500 characters
						</p>
					</div>

					{/* Info box */}
					<div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md p-3">
						<p className="text-sm text-blue-900 dark:text-blue-100">
							Recipients will receive an email with a link to sign the document.
						</p>
					</div>
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={isSending}
					>
						Cancel
					</Button>
					<Button onClick={handleSend} disabled={isSending}>
						{isSending ? (
							<>
								<Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
								Sending...
							</>
						) : (
							<>
								<SendIcon className="mr-2 h-4 w-4" />
								Send Document
							</>
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
