import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";
import { Button } from "../ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../ui/select";

type RecipientRole = "signer" | "viewer" | "approver";

interface Recipient {
	_id: Id<"document_recipients">;
	email: string;
	name?: string;
	role: RecipientRole;
	order?: number;
}

interface EditRecipientDialogProps {
	recipient: Recipient | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess?: () => void;
}

export function EditRecipientDialog({
	recipient,
	open,
	onOpenChange,
	onSuccess,
}: EditRecipientDialogProps) {
	const [email, setEmail] = useState("");
	const [name, setName] = useState("");
	const [role, setRole] = useState<RecipientRole>("signer");
	const [loading, setLoading] = useState(false);

	const updateRecipient = useMutation(
		api.documents.recipients_mutations.updateRecipient,
	);

	// Reset form when recipient changes
	useEffect(() => {
		if (recipient) {
			setEmail(recipient.email);
			setName(recipient.name || "");
			setRole(recipient.role);
		}
	}, [recipient]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!recipient) return;

		if (!email || !email.includes("@")) {
			toast.error("Please enter a valid email address");
			return;
		}

		setLoading(true);

		try {
			await updateRecipient({
				recipientId: recipient._id,
				email: email.toLowerCase().trim(),
				name: name.trim() || undefined,
				role,
			});

			toast.success("Recipient updated successfully");
			onOpenChange(false);
			onSuccess?.();
		} catch (error) {
			toast.error("Failed to update recipient", {
				description: getErrorMessage(error),
			});
		} finally {
			setLoading(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Edit Recipient</DialogTitle>
					<DialogDescription>
						Update this recipient's information.
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="edit-email">Email Address *</Label>
						<Input
							id="edit-email"
							type="email"
							placeholder="recipient@example.com"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							required
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="edit-name">Name (Optional)</Label>
						<Input
							id="edit-name"
							type="text"
							placeholder="John Doe"
							value={name}
							onChange={(e) => setName(e.target.value)}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="edit-role">Role</Label>
						<Select
							value={role}
							onValueChange={(v) => setRole(v as RecipientRole)}
						>
							<SelectTrigger id="edit-role">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="signer">Signer (Must sign)</SelectItem>
								<SelectItem value="viewer">Viewer (View only)</SelectItem>
								<SelectItem value="approver">
									Approver (Must approve)
								</SelectItem>
							</SelectContent>
						</Select>
						<p className="text-xs text-muted-foreground">
							{role === "signer" && "This person must sign the document."}
							{role === "viewer" && "This person can only view the document."}
							{role === "approver" &&
								"This person must approve before signing can proceed."}
						</p>
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
							disabled={loading}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={loading}>
							{loading ? "Saving..." : "Save Changes"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
