import type { Id } from "@seal/backend/convex/_generated/dataModel";
import {
	CheckCircle2Icon,
	CircleIcon,
	ClockIcon,
	CopyIcon,
	EyeIcon,
	XCircleIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "../ui/table";

type RecipientStatus =
	| "pending"
	| "viewed"
	| "signed"
	| "approved"
	| "declined";
type RecipientRole = "signer" | "viewer" | "approver";

interface Recipient {
	_id: Id<"document_recipients">;
	email: string;
	name?: string;
	role: RecipientRole;
	status: RecipientStatus;
	order?: number;
	viewedAt?: number;
	signedAt?: number;
	approvedAt?: number;
	declinedAt?: number;
	createdAt: number;
	signingToken?: string;
	signatureData?: string;
	signatureType?: "drawn" | "typed" | "uploaded";
}

interface RecipientListProps {
	recipients: Recipient[];
	onRemoveRecipient?: (recipientId: Id<"document_recipients">) => void;
	canEdit?: boolean;
}

function getStatusIcon(status: RecipientStatus) {
	switch (status) {
		case "pending":
			return <ClockIcon className="h-4 w-4 text-muted-foreground" />;
		case "viewed":
			return <EyeIcon className="h-4 w-4 text-blue-500" />;
		case "signed":
			return <CheckCircle2Icon className="h-4 w-4 text-green-500" />;
		case "approved":
			return <CheckCircle2Icon className="h-4 w-4 text-green-500" />;
		case "declined":
			return <XCircleIcon className="h-4 w-4 text-destructive" />;
		default:
			return <CircleIcon className="h-4 w-4 text-muted-foreground" />;
	}
}

function getStatusBadge(status: RecipientStatus) {
	const config: Record<
		RecipientStatus,
		{ label: string; variant: "default" | "secondary" | "destructive" }
	> = {
		pending: { label: "Pending", variant: "secondary" },
		viewed: { label: "Viewed", variant: "default" },
		signed: { label: "Signed", variant: "default" },
		approved: { label: "Approved", variant: "default" },
		declined: { label: "Declined", variant: "destructive" },
	};

	const { label, variant } = config[status];
	return <Badge variant={variant}>{label}</Badge>;
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

function formatTimestamp(timestamp: number | undefined) {
	if (!timestamp) return "—";
	return new Date(timestamp).toLocaleString("en-US", {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
}

export function RecipientList({
	recipients,
	onRemoveRecipient,
	canEdit = false,
}: RecipientListProps) {
	const handleCopySigningLink = (recipient: Recipient) => {
		if (!recipient.signingToken) {
			toast.error("Signing token not available");
			return;
		}

		const signingUrl = `${window.location.origin}/sign/${recipient.signingToken}`;

		navigator.clipboard
			.writeText(signingUrl)
			.then(() => {
				toast.success("Signing link copied to clipboard!");
			})
			.catch(() => {
				toast.error("Failed to copy link");
			});
	};

	if (recipients.length === 0) {
		return (
			<div className="text-center py-8 text-muted-foreground">
				No recipients added yet. Add recipients to send this document.
			</div>
		);
	}

	return (
		<div className="border rounded-lg">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead className="w-12">#</TableHead>
						<TableHead>Name/Email</TableHead>
						<TableHead>Role</TableHead>
						<TableHead>Status</TableHead>
						<TableHead>Activity</TableHead>
						<TableHead className="w-32">Actions</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{recipients.map((recipient, index) => (
						<TableRow key={recipient._id}>
							<TableCell className="font-medium">
								{recipient.order ?? index + 1}
							</TableCell>
							<TableCell>
								<div className="flex flex-col">
									{recipient.name && (
										<span className="font-medium">{recipient.name}</span>
									)}
									<span className="text-sm text-muted-foreground">
										{recipient.email}
									</span>
								</div>
							</TableCell>
							<TableCell>{getRoleLabel(recipient.role)}</TableCell>
							<TableCell>
								<div className="flex items-center gap-2">
									{getStatusIcon(recipient.status)}
									{getStatusBadge(recipient.status)}
								</div>
							</TableCell>
							<TableCell className="text-sm text-muted-foreground">
								{recipient.status === "viewed" && (
									<div>Viewed {formatTimestamp(recipient.viewedAt)}</div>
								)}
								{recipient.status === "signed" && (
									<div>
										Signed {formatTimestamp(recipient.signedAt)}
										{recipient.signatureData && (
											<div className="mt-1">
												<img
													src={recipient.signatureData}
													alt="Signature"
													className="h-8 border rounded"
												/>
											</div>
										)}
									</div>
								)}
								{recipient.status === "approved" && (
									<div>Approved {formatTimestamp(recipient.approvedAt)}</div>
								)}
								{recipient.status === "declined" && (
									<div>Declined {formatTimestamp(recipient.declinedAt)}</div>
								)}
								{recipient.status === "pending" && <div>Not yet viewed</div>}
							</TableCell>
							<TableCell>
								<div className="flex gap-1">
									<Button
										variant="ghost"
										size="sm"
										onClick={() => handleCopySigningLink(recipient)}
										title="Copy signing link"
									>
										<CopyIcon className="h-4 w-4" />
									</Button>
									{canEdit && onRemoveRecipient && (
										<Button
											variant="ghost"
											size="sm"
											onClick={() => onRemoveRecipient(recipient._id)}
										>
											Remove
										</Button>
									)}
								</div>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}
