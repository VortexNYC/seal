import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { UserIcon } from "lucide-react";
import { useEffect, useState } from "react";

interface AddMyselfDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void;
	userEmail?: string;
	userName?: string;
}

/**
 * AddMyselfDialog - Confirmation dialog for adding yourself as a signer
 */
export function AddMyselfDialog({
	open,
	onOpenChange,
	onConfirm,
	userEmail,
	userName,
}: AddMyselfDialogProps) {
	const [isConfirming, setIsConfirming] = useState(false);

	// Reset state when dialog closes
	useEffect(() => {
		if (!open) {
			setIsConfirming(false);
		}
	}, [open]);

	const handleConfirm = () => {
		setIsConfirming(true);
		onConfirm();
	};

	return (
		<AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
			<AlertDialogPrimitive.Portal>
				<AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-150" />

				<AlertDialogPrimitive.Content className="fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-32px)] max-w-[400px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-150">
					<div className="bg-white rounded-lg shadow-lg border border-gray-200">
						<div className="p-6">
							<div className="flex items-center gap-3 mb-4">
								<div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
									<UserIcon className="w-5 h-5 text-blue-600" />
								</div>
								<AlertDialogPrimitive.Title className="text-base font-semibold text-gray-900">
									Add yourself as a signer?
								</AlertDialogPrimitive.Title>
							</div>

							<AlertDialogPrimitive.Description className="text-sm text-gray-500">
								You will be added as a signer to this document.
							</AlertDialogPrimitive.Description>

							<div className="mt-3 bg-gray-50 rounded-md px-3 py-2 border border-gray-100">
								{userName && (
									<div className="text-sm font-medium text-gray-900">
										{userName}
									</div>
								)}
								<div className="text-sm text-gray-500">{userEmail}</div>
							</div>
						</div>

						<div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 rounded-b-lg">
							<AlertDialogPrimitive.Cancel asChild>
								<button
									type="button"
									className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
								>
									Cancel
								</button>
							</AlertDialogPrimitive.Cancel>

							<button
								type="button"
								onClick={handleConfirm}
								disabled={isConfirming}
								className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
							>
								{isConfirming ? "Adding..." : "Add as signer"}
							</button>
						</div>
					</div>
				</AlertDialogPrimitive.Content>
			</AlertDialogPrimitive.Portal>
		</AlertDialogPrimitive.Root>
	);
}
