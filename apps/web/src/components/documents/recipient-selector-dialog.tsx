import type { Id } from "@seal/backend/convex/_generated/dataModel";
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
}

interface RecipientSelectorDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	recipients: Recipient[];
	selectedRecipientId: Id<"document_recipients"> | null;
	onRecipientSelect: (recipientId: Id<"document_recipients">) => void;
	onConfirm: () => void;
	fieldType: string;
}

function getRoleLabel(role: RecipientRole): string {
	switch (role) {
		case "signer":
			return "Signer";
		case "viewer":
			return "Viewer";
		case "approver":
			return "Approver";
		default:
			return role;
	}
}

export function RecipientSelectorDialog({
	open,
	onOpenChange,
	recipients,
	selectedRecipientId,
	onRecipientSelect,
	onConfirm,
	fieldType,
}: RecipientSelectorDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Assign Field to Recipient</DialogTitle>
					<DialogDescription>
						Choose which recipient should fill this {fieldType} field.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-4">
					<div className="space-y-2">
						<Label htmlFor="recipient">Recipient</Label>
						<Select
							value={selectedRecipientId || undefined}
							onValueChange={(value) =>
								onRecipientSelect(value as Id<"document_recipients">)
							}
						>
							<SelectTrigger id="recipient">
								<SelectValue placeholder="Select a recipient..." />
							</SelectTrigger>
							<SelectContent>
								{recipients.map((recipient) => (
									<SelectItem key={recipient._id} value={recipient._id}>
										<div className="flex flex-col">
											<span className="font-medium">
												{recipient.name || recipient.email}
											</span>
											<span className="text-xs text-muted-foreground">
												{getRoleLabel(recipient.role)}
												{recipient.name && ` • ${recipient.email}`}
											</span>
										</div>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<p className="text-xs text-muted-foreground">
							This recipient will see and fill this field on the signing page.
						</p>
					</div>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button onClick={onConfirm} disabled={!selectedRecipientId}>
						Place Field
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
