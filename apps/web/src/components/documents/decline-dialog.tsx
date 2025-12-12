import { useState } from "react";
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

interface DeclineDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onDecline: (reason: string) => Promise<void>;
	isSubmitting: boolean;
}

export function DeclineDialog({
	open,
	onOpenChange,
	onDecline,
	isSubmitting,
}: DeclineDialogProps) {
	const [reason, setReason] = useState("");

	const handleConfirm = async () => {
		if (!reason.trim()) {
			return;
		}
		await onDecline(reason);
		setReason("");
	};

	const handleCancel = () => {
		onOpenChange(false);
		setReason("");
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Decline Document</DialogTitle>
					<DialogDescription>
						Please provide a reason for declining this document. This will be
						visible to the document owner.
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-2">
					<Label htmlFor="decline-reason">Reason</Label>
					<Textarea
						id="decline-reason"
						value={reason}
						onChange={(e) => setReason(e.target.value)}
						placeholder="Enter your reason here..."
						rows={4}
						className="resize-none"
					/>
				</div>
				<DialogFooter className="gap-2 sm:gap-0">
					<Button
						variant="outline"
						onClick={handleCancel}
						disabled={isSubmitting}
					>
						Cancel
					</Button>
					<Button
						variant="destructive"
						onClick={handleConfirm}
						disabled={isSubmitting || !reason.trim()}
					>
						{isSubmitting ? "Declining..." : "Decline"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
