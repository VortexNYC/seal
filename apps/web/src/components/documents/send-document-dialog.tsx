/**
 * Send Document Dialog Component
 * SEA-119: Allows users to send documents to recipients with per-recipient custom messages
 * and optional signing deadline
 */

import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { useAction } from "convex/react";
import { addDays, format } from "date-fns";
import {
	CalendarIcon,
	ChevronDownIcon,
	ChevronUpIcon,
	Loader2Icon,
	SendIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";
import { Button } from "../ui/button";
import { Calendar } from "../ui/calendar";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "../ui/collapsible";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "../ui/dialog";
import { Label } from "../ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
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
	signatureFieldCount: number;
	/** Map of recipientId to field count */
	fieldCountsByRecipient?: Map<string, number>;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess?: () => void;
}

export function SendDocumentDialog({
	documentId,
	documentName,
	recipients,
	signatureFieldCount,
	fieldCountsByRecipient,
	open,
	onOpenChange,
	onSuccess,
}: SendDocumentDialogProps) {
	const [customMessage, setCustomMessage] = useState("");
	const [isSending, setIsSending] = useState(false);

	// SEA-119: Per-recipient messages
	const [recipientMessages, setRecipientMessages] = useState<
		Record<string, string>
	>({});
	const [expandedRecipient, setExpandedRecipient] = useState<string | null>(
		null,
	);

	// SEA-119: Deadline picker state
	const [deadline, setDeadline] = useState<Date | undefined>(undefined);

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

	// SEA-119: Get message for a specific recipient
	const getRecipientMessage = (recipientId: string) => {
		return recipientMessages[recipientId] ?? "";
	};

	// SEA-119: Set message for a specific recipient
	const setRecipientMessage = (recipientId: string, message: string) => {
		setRecipientMessages((prev) => ({
			...prev,
			[recipientId]: message,
		}));
	};

	const handleSend = async () => {
		if (pendingRecipients.length === 0) {
			toast.error("All recipients have already completed their actions");
			return;
		}

		// SEA-119: Validate deadline is at least 24 hours in the future
		if (deadline) {
			const minDeadline = addDays(new Date(), 1);
			if (deadline < minDeadline) {
				toast.error("Deadline must be at least 24 hours from now");
				return;
			}
		}

		setIsSending(true);

		try {
			// SEA-119: Build per-recipient messages array
			const perRecipientMessages = pendingRecipients
				.filter((r) => recipientMessages[r._id]?.trim())
				.map((r) => ({
					recipientId: r._id,
					message: recipientMessages[r._id].trim(),
				}));

			const result = await sendDocumentEmails({
				documentId,
				customMessage: customMessage.trim() || undefined,
				recipientMessages:
					perRecipientMessages.length > 0 ? perRecipientMessages : undefined,
				deadline: deadline?.getTime(),
			});

			if (result.success) {
				toast.success(
					`Document sent successfully to ${result.emailsSent} recipient${result.emailsSent !== 1 ? "s" : ""}`,
				);
				onSuccess?.();
				onOpenChange(false);
				// Reset state
				setCustomMessage("");
				setRecipientMessages({});
				setDeadline(undefined);
			} else {
				toast.error(
					`Failed to send to ${result.emailsFailed} recipient${result.emailsFailed !== 1 ? "s" : ""}`,
				);
			}
		} catch (error) {
			console.error("Error sending document:", error);
			toast.error("Failed to send document", {
				description: getErrorMessage(error),
			});
		} finally {
			setIsSending(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Send Document</DialogTitle>
					<DialogDescription>
						Send "{documentName}" to {pendingRecipients.length} recipient
						{pendingRecipients.length !== 1 ? "s" : ""} for signing.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-4">
					{/* SEA-119: Recipients list with per-recipient message */}
					<div>
						<Label className="text-sm font-medium mb-2">Recipients</Label>
						<div className="space-y-2 mt-2">
							{pendingRecipients.map((recipient) => (
								<Collapsible
									key={recipient._id}
									open={expandedRecipient === recipient._id}
									onOpenChange={(open) =>
										setExpandedRecipient(open ? recipient._id : null)
									}
								>
									<div className="border rounded-md overflow-hidden">
										<CollapsibleTrigger asChild>
											<button
												type="button"
												className="flex items-center justify-between w-full p-3 bg-muted hover:bg-muted/80 transition-colors"
											>
												<div className="flex items-center gap-3 min-w-0 flex-1">
													<div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium shrink-0">
														{(recipient.name ||
															recipient.email)[0].toUpperCase()}
													</div>
													<div className="text-left min-w-0 flex-1">
														<p className="text-sm font-medium truncate">
															{recipient.name || recipient.email}
														</p>
														<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
															{recipient.name && (
																<span className="truncate max-w-[180px]">
																	{recipient.email}
																</span>
															)}
															{recipient.name && <span>•</span>}
															<span className="capitalize shrink-0">
																{recipient.role}
															</span>
															{getRecipientMessage(recipient._id) && (
																<>
																	<span>•</span>
																	<span className="text-primary shrink-0">
																		Custom message
																	</span>
																</>
															)}
														</div>
													</div>
												</div>
												<div className="flex items-center gap-2 shrink-0 ml-2">
													{fieldCountsByRecipient && (
														<span className="text-xs font-medium px-2 py-1 bg-background rounded border">
															{fieldCountsByRecipient.get(recipient._id) ?? 0}{" "}
															{(fieldCountsByRecipient.get(recipient._id) ??
																0) === 1
																? "field"
																: "fields"}
														</span>
													)}
													{expandedRecipient === recipient._id ? (
														<ChevronUpIcon className="h-4 w-4 text-muted-foreground" />
													) : (
														<ChevronDownIcon className="h-4 w-4 text-muted-foreground" />
													)}
												</div>
											</button>
										</CollapsibleTrigger>
										<CollapsibleContent>
											<div className="p-3 border-t space-y-2">
												<Textarea
													placeholder={`Custom message for ${recipient.name || recipient.email}...`}
													value={getRecipientMessage(recipient._id)}
													onChange={(e) =>
														setRecipientMessage(recipient._id, e.target.value)
													}
													className="min-h-[80px]"
													maxLength={500}
												/>
												<p className="text-xs text-muted-foreground">
													{getRecipientMessage(recipient._id).length}/500
													characters (leave empty to use default message)
												</p>
											</div>
										</CollapsibleContent>
									</div>
								</Collapsible>
							))}
						</div>
					</div>

					{/* Default message for all (used when no per-recipient message) */}
					<div>
						<Label htmlFor="message" className="text-sm font-medium">
							Default Message (Optional)
						</Label>
						<p className="text-xs text-muted-foreground mb-2">
							Used for recipients without a custom message
						</p>
						<Textarea
							id="message"
							placeholder="Add a personal message for all recipients..."
							value={customMessage}
							onChange={(e) => setCustomMessage(e.target.value)}
							className="min-h-[80px]"
							maxLength={500}
						/>
						<p className="text-xs text-muted-foreground mt-1">
							{customMessage.length}/500 characters
						</p>
					</div>

					{/* SEA-119: Deadline picker */}
					<div>
						<Label className="text-sm font-medium">
							Signing Deadline (Optional)
						</Label>
						<p className="text-xs text-muted-foreground mb-2">
							Recipients must sign by this date
						</p>
						<Popover>
							<PopoverTrigger asChild>
								<Button
									variant="outline"
									className="w-full justify-start text-left font-normal"
								>
									<CalendarIcon className="mr-2 h-4 w-4" />
									{deadline ? (
										format(deadline, "PPP")
									) : (
										<span className="text-muted-foreground">
											No deadline set
										</span>
									)}
								</Button>
							</PopoverTrigger>
							<PopoverContent className="w-auto p-0" align="start">
								<Calendar
									mode="single"
									selected={deadline}
									onSelect={setDeadline}
									disabled={(date) => date < addDays(new Date(), 1)}
									initialFocus
								/>
								{deadline && (
									<div className="p-3 border-t">
										<Button
											variant="outline"
											size="sm"
											className="w-full"
											onClick={() => setDeadline(undefined)}
										>
											Clear Deadline
										</Button>
									</div>
								)}
							</PopoverContent>
						</Popover>
					</div>

					{/* Error box - No signature fields */}
					{signatureFieldCount === 0 && (
						<div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md p-3">
							<p className="text-sm text-red-900 dark:text-red-100 font-medium">
								Cannot send document without signature fields.
							</p>
							<p className="text-xs text-red-800 dark:text-red-200 mt-1">
								Please add at least one signature field before sending.
							</p>
						</div>
					)}

					{/* Info box */}
					{signatureFieldCount > 0 && (
						<div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md p-3">
							<p className="text-sm text-blue-900 dark:text-blue-100">
								Recipients will receive an email with a link to sign the
								document.
								{deadline && (
									<span className="block mt-1">
										Deadline: {format(deadline, "PPP")}
									</span>
								)}
							</p>
						</div>
					)}
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={isSending}
					>
						Cancel
					</Button>
					<Button
						onClick={handleSend}
						disabled={isSending || signatureFieldCount === 0}
					>
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
