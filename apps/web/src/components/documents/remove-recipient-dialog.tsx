import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { AlertTriangleIcon, UserXIcon } from "lucide-react";
import { useEffect, useState } from "react";

interface RemoveRecipientDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void;
	recipientEmail?: string;
	recipientName?: string;
	recipientRole?: string;
	fieldCount?: number;
}

/**
 * RemoveRecipientDialog - Confirmation dialog for removing a recipient
 */
export function RemoveRecipientDialog({
	open,
	onOpenChange,
	onConfirm,
	recipientEmail,
	recipientName,
	recipientRole,
	fieldCount = 0,
}: RemoveRecipientDialogProps) {
	const [isRemoving, setIsRemoving] = useState(false);

	// Reset state when dialog closes
	useEffect(() => {
		if (!open) {
			setIsRemoving(false);
		}
	}, [open]);

	const handleConfirm = () => {
		setIsRemoving(true);
		onConfirm();
	};

	const formatRole = (role?: string) => {
		if (!role) return "";
		return role.charAt(0).toUpperCase() + role.slice(1);
	};

	const hasFields = fieldCount > 0;

	return (
		<AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
			<AlertDialogPrimitive.Portal>
				<AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-150" />

				<AlertDialogPrimitive.Content className="fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-32px)] max-w-[400px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-150">
					<div className="bg-white rounded-lg shadow-lg border border-gray-200">
						<div className="p-6">
							<div className="flex items-center gap-3 mb-4">
								<div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
									<UserXIcon className="w-5 h-5 text-red-600" />
								</div>
								<AlertDialogPrimitive.Title className="text-base font-semibold text-gray-900">
									Remove recipient?
								</AlertDialogPrimitive.Title>
							</div>

							<AlertDialogPrimitive.Description className="text-sm text-gray-500">
								This recipient will no longer have access to this document.
							</AlertDialogPrimitive.Description>

							<div className="mt-3 bg-gray-50 rounded-md px-3 py-2 border border-gray-100">
								{recipientName && (
									<div className="text-sm font-medium text-gray-900">
										{recipientName}
									</div>
								)}
								<div className="text-sm text-gray-500">{recipientEmail}</div>
								{recipientRole && (
									<div className="text-xs text-gray-400 mt-1">
										{formatRole(recipientRole)}
									</div>
								)}
							</div>

							{hasFields && (
								<div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-md flex items-start gap-2.5">
									<AlertTriangleIcon className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
									<div>
										<div className="text-sm font-medium text-amber-800">
											{fieldCount} {fieldCount === 1 ? "field" : "fields"} will
											be deleted
										</div>
										<div className="text-xs text-amber-700 mt-0.5">
											All fields assigned to this recipient will be permanently
											removed from the document.
										</div>
									</div>
								</div>
							)}
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
								disabled={isRemoving}
								className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
							>
								{isRemoving
									? "Removing..."
									: hasFields
										? "Remove with fields"
										: "Remove"}
							</button>
						</div>
					</div>
				</AlertDialogPrimitive.Content>
			</AlertDialogPrimitive.Portal>
		</AlertDialogPrimitive.Root>
	);
}
