import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { useState } from "react";
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

interface AddRecipientDialogProps {
	documentId: Id<"documents">;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess?: () => void;
}

export function AddRecipientDialog({
	documentId,
	open,
	onOpenChange,
	onSuccess,
}: AddRecipientDialogProps) {
	const [email, setEmail] = useState("");
	const [name, setName] = useState("");
	const [role, setRole] = useState<"signer" | "viewer" | "approver">("signer");
	const [loading, setLoading] = useState(false);

	const addRecipients = useMutation(
		api.documents.recipients_mutations.addRecipients,
	);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!email || !email.includes("@")) {
			toast.error("Please enter a valid email address");
			return;
		}

		setLoading(true);

		try {
			await addRecipients({
				documentId,
				recipients: [
					{
						email: email.toLowerCase().trim(),
						name: name.trim() || undefined,
						role,
					},
				],
			});

			toast.success("Recipient added successfully");
			setEmail("");
			setName("");
			setRole("signer");
			onOpenChange(false);
			onSuccess?.();
		} catch (error) {
			toast.error("Failed to add recipient", {
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
					<DialogTitle>Add Recipient</DialogTitle>
					<DialogDescription>
						Add a person who needs to take action on this document.
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="email">Email Address *</Label>
						<Input
							id="email"
							type="email"
							placeholder="recipient@example.com"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							required
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="name">Name (Optional)</Label>
						<Input
							id="name"
							type="text"
							placeholder="John Doe"
							value={name}
							onChange={(e) => setName(e.target.value)}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="role">Role</Label>
						<Select
							value={role}
							onValueChange={(v) => setRole(v as typeof role)}
						>
							<SelectTrigger id="role">
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
							{loading ? "Adding..." : "Add Recipient"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
