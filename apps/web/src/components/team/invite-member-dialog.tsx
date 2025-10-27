/**
 * Invite Member Dialog Component
 *
 * Modal for inviting new members to the organization
 */

import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { useAction } from "convex/react";
import { AlertCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

interface InviteMemberDialogProps {
	organizationId: Id<"organizations">;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function InviteMemberDialog({
	organizationId: _organizationId,
	open,
	onOpenChange,
}: InviteMemberDialogProps) {
	const [email, setEmail] = useState("");
	const [role, setRole] = useState<"admin" | "member" | "viewer">("member");
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const clerkInvite = useAction(api.organizations.actions.clerkInvite);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setIsSubmitting(true);

		try {
			// Validate email
			if (!email || !email.includes("@")) {
				setError("Please enter a valid email address");
				setIsSubmitting(false);
				return;
			}

			const result = await clerkInvite({
				email: email.trim().toLowerCase(),
				role,
				organizationId: _organizationId,
			});

			if (result.ok) {
				toast.success("Invitation sent", {
					description: `An invitation has been sent to ${email} via email`,
				});

				// Reset form and close dialog
				setEmail("");
				setRole("member");
				onOpenChange(false);
			} else {
				setError(result.message || "Failed to send invitation");
				toast.error("Failed to send invitation", {
					description: result.message,
				});
			}
		} catch (err) {
			const errorMessage =
				err instanceof Error ? err.message : "Failed to send invitation";
			setError(errorMessage);
			toast.error("Failed to send invitation", {
				description: errorMessage,
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleOpenChange = (newOpen: boolean) => {
		onOpenChange(newOpen);
		if (!newOpen) {
			// Reset form when closing
			setEmail("");
			setRole("member");
			setError(null);
		}
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-[425px]">
				<form onSubmit={handleSubmit}>
					<DialogHeader>
						<DialogTitle>Invite Team Member</DialogTitle>
						<DialogDescription>
							Send an invitation to join this workspace. They'll receive an
							email with instructions.
						</DialogDescription>
					</DialogHeader>

					<div className="grid gap-4 py-4">
						{error && (
							<Alert variant="destructive">
								<AlertCircle className="h-4 w-4" />
								<AlertDescription>{error}</AlertDescription>
							</Alert>
						)}

						<div className="grid gap-2">
							<Label htmlFor="email">Email address</Label>
							<Input
								id="email"
								type="email"
								placeholder="colleague@example.com"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								required
								autoFocus
							/>
							<p className="text-xs text-muted-foreground">
								We'll send them an invitation to join your workspace
							</p>
						</div>

						<div className="grid gap-2">
							<Label htmlFor="role">Role</Label>
							<Select
								value={role}
								onValueChange={(value) =>
									setRole(value as "admin" | "member" | "viewer")
								}
							>
								<SelectTrigger id="role">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="viewer">
										<div className="flex flex-col items-start">
											<span className="font-medium">Viewer</span>
											<span className="text-xs text-muted-foreground">
												Can view documents and signatures
											</span>
										</div>
									</SelectItem>
									<SelectItem value="member">
										<div className="flex flex-col items-start">
											<span className="font-medium">Member</span>
											<span className="text-xs text-muted-foreground">
												Can create and send documents
											</span>
										</div>
									</SelectItem>
									<SelectItem value="admin">
										<div className="flex flex-col items-start">
											<span className="font-medium">Admin</span>
											<span className="text-xs text-muted-foreground">
												Can manage team and settings
											</span>
										</div>
									</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
							disabled={isSubmitting}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={isSubmitting}>
							{isSubmitting ? "Sending..." : "Send Invitation"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
