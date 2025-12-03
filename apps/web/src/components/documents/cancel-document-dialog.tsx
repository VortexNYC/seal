import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { BanIcon, Loader2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";

interface CancelDocumentDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	documentId: Id<"documents">;
	documentName: string;
	pendingRecipientCount?: number;
	onSuccess?: () => void;
}

/**
 * CancelDocumentDialog - Editorial-styled cancellation confirmation
 *
 * A thoughtfully designed cancel confirmation that treats
 * destructive workflow actions with appropriate gravity while
 * informing users of the impact on recipients and reminders.
 */
export function CancelDocumentDialog({
	open,
	onOpenChange,
	documentId,
	documentName,
	pendingRecipientCount = 0,
	onSuccess,
}: CancelDocumentDialogProps) {
	const [reason, setReason] = useState("");
	const [isCancelling, setIsCancelling] = useState(false);

	const cancelDocument = useMutation(
		api.documents.workflow_mutations.cancelDocument,
	);

	// Reset state when dialog closes
	useEffect(() => {
		if (!open) {
			setReason("");
			setIsCancelling(false);
		}
	}, [open]);

	const handleConfirm = async () => {
		setIsCancelling(true);
		try {
			await cancelDocument({
				documentId,
				reason: reason.trim() || undefined,
			});
			toast.success("Document cancelled", {
				description: "The document workflow has been stopped.",
			});
			onOpenChange(false);
			onSuccess?.();
		} catch (error) {
			toast.error("Failed to cancel document", {
				description:
					error instanceof Error ? error.message : "Please try again.",
			});
			setIsCancelling(false);
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
						{/* Decorative top accent - warm amber/orange for cancel */}
						<div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-orange-500 to-red-500" />

						{/* Content area */}
						<div className="px-6 pt-8 pb-6">
							{/* Icon with animated ring */}
							<div className="relative mx-auto w-16 h-16 mb-5">
								{/* Outer ring - subtle pulse */}
								<div className="absolute inset-0 rounded-full bg-amber-50 animate-[pulse_2s_ease-in-out_infinite]" />
								{/* Inner circle */}
								<div className="absolute inset-2 rounded-full bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center shadow-inner">
									<BanIcon
										className="w-6 h-6 text-orange-500"
										strokeWidth={1.75}
									/>
								</div>
							</div>

							{/* Title */}
							<AlertDialogPrimitive.Title className="text-center font-['Newsreader',Georgia,serif] text-xl font-medium text-gray-900 tracking-tight mb-2">
								Cancel this document?
							</AlertDialogPrimitive.Title>

							{/* Description */}
							<AlertDialogPrimitive.Description className="text-center font-['DM_Sans',system-ui,sans-serif] text-sm text-gray-500 leading-relaxed max-w-[320px] mx-auto mb-4">
								<span className="font-medium text-gray-700">
									"{documentName}"
								</span>{" "}
								will be cancelled and recipients will no longer be able to sign.
							</AlertDialogPrimitive.Description>

							{/* Impact notice */}
							{pendingRecipientCount > 0 && (
								<div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
									<p className="text-sm text-amber-800 text-center">
										<span className="font-medium">{pendingRecipientCount}</span>{" "}
										{pendingRecipientCount === 1
											? "recipient has"
											: "recipients have"}{" "}
										not yet signed. Any scheduled reminders will also be
										cancelled.
									</p>
								</div>
							)}

							{/* Reason field */}
							<div className="space-y-2">
								<Label
									htmlFor="cancel-reason"
									className="text-sm font-medium text-gray-700"
								>
									Reason for cancellation{" "}
									<span className="text-gray-400">(optional)</span>
								</Label>
								<Textarea
									id="cancel-reason"
									placeholder="e.g., Document needs to be revised, Wrong recipient..."
									value={reason}
									onChange={(e) => setReason(e.target.value)}
									className="resize-none h-20 text-sm"
									disabled={isCancelling}
								/>
							</div>
						</div>

						{/* Footer with actions */}
						<div className="px-6 pb-6 flex gap-3">
							{/* Keep button */}
							<AlertDialogPrimitive.Cancel asChild>
								<button
									type="button"
									disabled={isCancelling}
									className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-['DM_Sans',system-ui,sans-serif] text-sm font-medium rounded-xl transition-all duration-150 hover:shadow-sm active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
								>
									Keep document
								</button>
							</AlertDialogPrimitive.Cancel>

							{/* Cancel document button */}
							<button
								type="button"
								onClick={handleConfirm}
								disabled={isCancelling}
								className="flex-1 px-4 py-2.5 bg-gradient-to-b from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-['DM_Sans',system-ui,sans-serif] text-sm font-medium rounded-xl transition-all duration-150 shadow-[0_1px_2px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] hover:shadow-[0_2px_4px_rgba(234,88,12,0.25),inset_0_1px_0_rgba(255,255,255,0.1)] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
							>
								{isCancelling ? (
									<span className="flex items-center justify-center gap-2">
										<Loader2Icon className="animate-spin h-4 w-4" />
										Cancelling...
									</span>
								) : (
									"Cancel document"
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
