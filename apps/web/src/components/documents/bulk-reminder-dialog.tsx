import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { BellRingIcon, Loader2Icon, UsersIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";

interface BulkReminderDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	documentId: Id<"documents">;
	documentName: string;
	onSuccess?: () => void;
}

/**
 * BulkReminderDialog - Send reminders to all pending recipients
 *
 * An editorial-styled dialog for sending bulk reminders
 * to all recipients who haven't yet completed their action.
 */
export function BulkReminderDialog({
	open,
	onOpenChange,
	documentId,
	documentName,
	onSuccess,
}: BulkReminderDialogProps) {
	const [customMessage, setCustomMessage] = useState("");
	const [isSending, setIsSending] = useState(false);

	const progress = useQuery(
		api.documents.recipients_queries.getRecipientProgress,
		{ documentId },
	);

	const sendBulkReminder = useMutation(
		api.documents.reminders.sendBulkReminder,
	);

	// Reset state when dialog closes
	useEffect(() => {
		if (!open) {
			setCustomMessage("");
			setIsSending(false);
		}
	}, [open]);

	const pendingCount = progress
		? progress.byStatus.pending + progress.byStatus.viewed
		: 0;

	const handleConfirm = async () => {
		setIsSending(true);
		try {
			const result = await sendBulkReminder({
				documentId,
				customMessage: customMessage.trim() || undefined,
			});
			toast.success("Reminders sent", {
				description: `Sent reminders to ${result.count} recipient${result.count !== 1 ? "s" : ""}.`,
			});
			onOpenChange(false);
			onSuccess?.();
		} catch (error) {
			toast.error("Failed to send reminders", {
				description:
					error instanceof Error ? error.message : "Please try again.",
			});
			setIsSending(false);
		}
	};

	return (
		<AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
			<AlertDialogPrimitive.Portal>
				{/* Overlay with subtle blur */}
				<AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

				{/* Dialog Content */}
				<AlertDialogPrimitive.Content className="fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-32px)] max-w-[420px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] duration-200">
					{/* Card with layered shadow for depth */}
					<div className="relative bg-white rounded-2xl overflow-hidden shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15),0_0_0_1px_rgba(0,0,0,0.03)]">
						{/* Decorative top accent - blue for reminder */}
						<div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 via-blue-500 to-indigo-500" />

						{/* Content area */}
						<div className="px-6 pt-8 pb-6">
							{/* Icon with animated ring */}
							<div className="relative mx-auto w-16 h-16 mb-5">
								{/* Outer ring - subtle pulse */}
								<div className="absolute inset-0 rounded-full bg-blue-50 animate-[pulse_2s_ease-in-out_infinite]" />
								{/* Inner circle */}
								<div className="absolute inset-2 rounded-full bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center shadow-inner">
									<BellRingIcon
										className="w-6 h-6 text-blue-500"
										strokeWidth={1.75}
									/>
								</div>
							</div>

							{/* Title */}
							<AlertDialogPrimitive.Title className="text-center font-['Newsreader',Georgia,serif] text-xl font-medium text-gray-900 tracking-tight mb-2">
								Send bulk reminders?
							</AlertDialogPrimitive.Title>

							{/* Description */}
							<AlertDialogPrimitive.Description className="text-center font-['DM_Sans',system-ui,sans-serif] text-sm text-gray-500 leading-relaxed max-w-[320px] mx-auto mb-4">
								Send reminder emails to all recipients who haven't completed
								signing{" "}
								<span className="font-medium text-gray-700">
									"{documentName}"
								</span>
							</AlertDialogPrimitive.Description>

							{/* Recipient count notice */}
							{pendingCount > 0 ? (
								<div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4">
									<p className="text-sm text-blue-800 text-center flex items-center justify-center gap-2">
										<UsersIcon className="h-4 w-4" />
										<span className="font-medium">{pendingCount}</span>{" "}
										{pendingCount === 1
											? "recipient will receive a reminder"
											: "recipients will receive reminders"}
									</p>
								</div>
							) : (
								<div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-4">
									<p className="text-sm text-gray-600 text-center">
										All recipients have already completed their action.
									</p>
								</div>
							)}

							{/* Custom message field */}
							{pendingCount > 0 && (
								<div className="space-y-2">
									<Label
										htmlFor="bulk-reminder-message"
										className="text-sm font-medium text-gray-700"
									>
										Custom message{" "}
										<span className="text-gray-400">(optional)</span>
									</Label>
									<Textarea
										id="bulk-reminder-message"
										placeholder="Add a personal note to include in the reminder email..."
										value={customMessage}
										onChange={(e) => setCustomMessage(e.target.value)}
										className="resize-none h-20 text-sm"
										disabled={isSending}
									/>
								</div>
							)}
						</div>

						{/* Footer with actions */}
						<div className="px-6 pb-6 flex gap-3">
							{/* Cancel button */}
							<AlertDialogPrimitive.Cancel asChild>
								<button
									type="button"
									disabled={isSending}
									className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-['DM_Sans',system-ui,sans-serif] text-sm font-medium rounded-xl transition-all duration-150 hover:shadow-sm active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
								>
									Cancel
								</button>
							</AlertDialogPrimitive.Cancel>

							{/* Send button */}
							<button
								type="button"
								onClick={handleConfirm}
								disabled={isSending || pendingCount === 0}
								className="flex-1 px-4 py-2.5 bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-['DM_Sans',system-ui,sans-serif] text-sm font-medium rounded-xl transition-all duration-150 shadow-[0_1px_2px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] hover:shadow-[0_2px_4px_rgba(59,130,246,0.25),inset_0_1px_0_rgba(255,255,255,0.1)] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
							>
								{isSending ? (
									<span className="flex items-center justify-center gap-2">
										<Loader2Icon className="animate-spin h-4 w-4" />
										Sending...
									</span>
								) : (
									`Send ${pendingCount > 0 ? pendingCount : ""} reminder${pendingCount !== 1 ? "s" : ""}`
								)}
							</button>
						</div>

						{/* Subtle paper texture overlay */}
						<div
							className="absolute inset-0 pointer-events-none opacity-[0.015] mix-blend-multiply"
							style={{
								backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
							}}
						/>
					</div>
				</AlertDialogPrimitive.Content>
			</AlertDialogPrimitive.Portal>
		</AlertDialogPrimitive.Root>
	);
}
