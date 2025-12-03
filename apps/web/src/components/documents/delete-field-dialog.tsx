import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { Trash2Icon } from "lucide-react";
import { useEffect, useState } from "react";

interface DeleteFieldDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void;
	fieldType?: string;
}

/**
 * DeleteFieldDialog - Editorial-styled confirmation dialog
 *
 * A thoughtfully designed delete confirmation that treats
 * destructive actions with appropriate gravity while maintaining
 * the app's refined editorial aesthetic.
 */
export function DeleteFieldDialog({
	open,
	onOpenChange,
	onConfirm,
	fieldType = "field",
}: DeleteFieldDialogProps) {
	const [isConfirming, setIsConfirming] = useState(false);

	// Reset state when dialog closes
	useEffect(() => {
		if (!open) {
			setIsConfirming(false);
		}
	}, [open]);

	const handleConfirm = () => {
		setIsConfirming(true);
		// Small delay for visual feedback
		setTimeout(() => {
			onConfirm();
			onOpenChange(false);
		}, 150);
	};

	return (
		<AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
			<AlertDialogPrimitive.Portal>
				{/* Overlay with subtle blur */}
				<AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

				{/* Dialog Content */}
				<AlertDialogPrimitive.Content className="fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-32px)] max-w-[380px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] duration-200">
					{/* Card with layered shadow for depth */}
					<div className="relative bg-white rounded-2xl overflow-hidden shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15),0_0_0_1px_rgba(0,0,0,0.03)]">
						{/* Decorative top accent - warm destructive red */}
						<div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-400 via-red-500 to-rose-500" />

						{/* Content area */}
						<div className="px-6 pt-8 pb-6">
							{/* Icon with animated ring */}
							<div className="relative mx-auto w-16 h-16 mb-5">
								{/* Outer ring - subtle pulse */}
								<div className="absolute inset-0 rounded-full bg-red-50 animate-[pulse_2s_ease-in-out_infinite]" />
								{/* Inner circle */}
								<div className="absolute inset-2 rounded-full bg-gradient-to-br from-red-50 to-rose-100 flex items-center justify-center shadow-inner">
									<Trash2Icon
										className="w-6 h-6 text-red-500"
										strokeWidth={1.75}
									/>
								</div>
							</div>

							{/* Title */}
							<AlertDialogPrimitive.Title className="text-center font-['Newsreader',Georgia,serif] text-xl font-medium text-gray-900 tracking-tight mb-2">
								Remove this {fieldType}?
							</AlertDialogPrimitive.Title>

							{/* Description */}
							<AlertDialogPrimitive.Description className="text-center font-['DM_Sans',system-ui,sans-serif] text-sm text-gray-500 leading-relaxed max-w-[280px] mx-auto">
								This action cannot be undone. The field will be permanently
								removed from your document.
							</AlertDialogPrimitive.Description>
						</div>

						{/* Footer with actions */}
						<div className="px-6 pb-6 flex gap-3">
							{/* Cancel button */}
							<AlertDialogPrimitive.Cancel asChild>
								<button
									type="button"
									className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-['DM_Sans',system-ui,sans-serif] text-sm font-medium rounded-xl transition-all duration-150 hover:shadow-sm active:scale-[0.98]"
								>
									Keep field
								</button>
							</AlertDialogPrimitive.Cancel>

							{/* Delete button */}
							<button
								type="button"
								onClick={handleConfirm}
								disabled={isConfirming}
								className="flex-1 px-4 py-2.5 bg-gradient-to-b from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-['DM_Sans',system-ui,sans-serif] text-sm font-medium rounded-xl transition-all duration-150 shadow-[0_1px_2px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] hover:shadow-[0_2px_4px_rgba(220,38,38,0.25),inset_0_1px_0_rgba(255,255,255,0.1)] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
							>
								{isConfirming ? (
									<span className="flex items-center justify-center gap-2">
										<svg
											className="animate-spin h-4 w-4"
											viewBox="0 0 24 24"
											fill="none"
											aria-hidden="true"
										>
											<circle
												className="opacity-25"
												cx="12"
												cy="12"
												r="10"
												stroke="currentColor"
												strokeWidth="3"
											/>
											<path
												className="opacity-75"
												fill="currentColor"
												d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
											/>
										</svg>
										Deleting...
									</span>
								) : (
									"Delete field"
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
