import { convexQuery } from "@convex-dev/react-query";
import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	useRouteContext,
	useRouter,
} from "@tanstack/react-router";
import { useMutation } from "convex/react";
import {
	BanIcon,
	DownloadIcon,
	FileIcon,
	MoreVerticalIcon,
	SendIcon,
	Share2Icon,
	TrashIcon,
	UploadIcon,
} from "lucide-react";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { PageWrapper } from "@/components/page-wrapper";
import { CardSkeleton } from "@/components/skeletons/card-skeleton";
import { DocumentsSkeleton } from "@/components/skeletons/documents-skeleton";
import { ShareDialog } from "@/components/documents/share-dialog";
import { UploadDialog } from "@/components/documents/upload-dialog";
import { WorkflowStatusBadge } from "@/components/documents/workflow-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated/$slug/documents/")({
	component: DocumentsPage,
	pendingComponent: DocumentsSkeleton,
});

type FilterType = "all" | "owned" | "shared";
type WorkflowStatusFilter =
	| "all"
	| "draft"
	| "sent"
	| "in_progress"
	| "completed"
	| "cancelled";

interface DocumentsListProps {
	organizationId: Id<"organizations">;
	filter: FilterType;
	workflowStatusFilter: WorkflowStatusFilter;
	onRefetch: () => void;
	onShareClick: (documentId: Id<"documents">) => void;
}

function DocumentsList({
	organizationId,
	filter,
	workflowStatusFilter,
	onRefetch,
	onShareClick,
}: DocumentsListProps) {
	const { slug } = Route.useParams();
	const router = useRouter();
	const { convexClient } = useRouteContext({ from: "__root__" });

	const { data: allDocuments, refetch } = useSuspenseQuery(
		convexQuery(api.documents.queries.listDocuments, {
			organizationId,
			filter,
		}),
	)

	// Filter documents by workflow status on the client side
	const documents =
		workflowStatusFilter === "all"
			? allDocuments
			: allDocuments.filter((doc) => {
					const docWorkflowStatus = doc.workflowStatus ?? "draft";
					return docWorkflowStatus === workflowStatusFilter;
				})

	const deleteDocument = useMutation(api.documents.mutations.deleteDocument);
	const sendDocument = useMutation(api.documents.mutations.sendDocument);
	const cancelDocument = useMutation(api.documents.mutations.cancelDocument);

	const handleDelete = async (documentId: Id<"documents">) => {
		if (!confirm("Are you sure you want to delete this document?")) {
			return
		}

		try {
			await deleteDocument({ documentId });
			toast.success("Document deleted");
			onRefetch();
		} catch (_error) {
			toast.error("Failed to delete document");
		}
	}

	const handleSendDocument = async (documentId: Id<"documents">) => {
		if (
			!confirm(
				"Send this document? Once sent, recipients will be notified to take action.",
			)
		) {
			return
		}

		try {
			await sendDocument({ documentId });
			toast.success("Document sent successfully");
			refetch();
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Failed to send document";
			toast.error(errorMessage);
		}
	}

	const handleCancelDocument = async (documentId: Id<"documents">) => {
		if (
			!confirm(
				"Cancel this document? This action cannot be undone and recipients will be notified.",
			)
		) {
			return
		}

		try {
			await cancelDocument({ documentId });
			toast.success("Document cancelled");
			refetch();
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Failed to cancel document";
			toast.error(errorMessage);
		}
	}

	const handleDownload = async (documentId: Id<"documents">) => {
		try {
			const url = await convexClient.query(
				api.documents.queries.getDocumentUrl,
				{
					documentId,
				},
			)
			window.open(url, "_blank");
		} catch (_error) {
			toast.error("Failed to download document");
		}
	}

	const formatBytes = (bytes: number) => {
		if (bytes === 0) return "0 Bytes";
		const k = 1024;
		const sizes = ["Bytes", "KB", "MB", "GB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${Math.round((bytes / k ** i) * 100) / 100} ${sizes[i]}`;
	}

	const formatDate = (timestamp: number) => {
		return new Date(timestamp).toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
		})
	}

	return (
		<>
			{/* Documents Grid */}
			{documents.length === 0 ? (
				<Card>
					<CardContent className="flex flex-col items-center justify-center py-12">
						<FileIcon className="h-12 w-12 text-muted-foreground mb-4" />
						<p className="text-lg font-medium">No documents yet</p>
						<p className="text-sm text-muted-foreground mb-4">
							Upload your first document to get started
						</p>
					</CardContent>
				</Card>
			) : (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{documents.map((doc) => (
						<Card
							key={doc._id}
							className="hover:shadow-lg transition-shadow cursor-pointer"
							onClick={() =>
								router.navigate({
									to: "/$slug/documents/$documentId",
									params: { slug, documentId: doc._id },
								})
							}
						>
							<CardHeader>
								<div className="flex items-start justify-between">
									<div className="flex items-center gap-2">
										<FileIcon className="h-5 w-5 text-muted-foreground" />
										<CardTitle className="text-base truncate">
											{doc.name}
										</CardTitle>
									</div>
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button
												variant="ghost"
												size="icon"
												className="h-8 w-8"
												onClick={(e) => e.stopPropagation()}
											>
												<MoreVerticalIcon className="h-4 w-4" />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent
											align="end"
											onClick={(e) => e.stopPropagation()}
										>
											{/* Send Document - only for drafts */}
											{(doc.workflowStatus ?? "draft") === "draft" && (
												<DropdownMenuItem
													onClick={() => handleSendDocument(doc._id)}
												>
													<SendIcon className="mr-2 h-4 w-4" />
													Send Document
												</DropdownMenuItem>
											)}

											{/* Cancel Document - for sent or in_progress */}
											{((doc.workflowStatus ?? "draft") === "sent" ||
												(doc.workflowStatus ?? "draft") === "in_progress") && (
												<DropdownMenuItem
													onClick={() => handleCancelDocument(doc._id)}
													className="text-destructive"
												>
													<BanIcon className="mr-2 h-4 w-4" />
													Cancel Document
												</DropdownMenuItem>
											)}
											<DropdownMenuItem onClick={() => handleDownload(doc._id)}>
												<DownloadIcon className="mr-2 h-4 w-4" />
												Download
											</DropdownMenuItem>
											<DropdownMenuItem
												onClick={() => {
													onShareClick(doc._id)
												}}
											>
												<Share2Icon className="mr-2 h-4 w-4" />
												Share
											</DropdownMenuItem>
											<DropdownMenuItem
												onClick={() => handleDelete(doc._id)}
												className="text-destructive"
											>
												<TrashIcon className="mr-2 h-4 w-4" />
												Delete
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								</div>
								{doc.description && (
									<CardDescription className="line-clamp-2">
										{doc.description}
									</CardDescription>
								)}
							</CardHeader>
							<CardContent>
								<div className="space-y-2">
									<div className="flex items-center justify-between text-sm">
										<span className="text-muted-foreground">Status</span>
										<WorkflowStatusBadge status={doc.workflowStatus} />
									</div>
									<div className="flex items-center justify-between text-sm">
										<span className="text-muted-foreground">Size</span>
										<span>{formatBytes(doc.fileSize)}</span>
									</div>
									<div className="flex items-center justify-between text-sm">
										<span className="text-muted-foreground">Uploaded</span>
										<span>{formatDate(doc.createdAt)}</span>
									</div>
									<div className="flex items-center justify-between text-sm">
										<span className="text-muted-foreground">Sharing</span>
										<Badge
											variant={
												doc.sharingMode === "private" ? "secondary" : "default"
											}
										>
											{doc.sharingMode === "private" && "Private"}
											{doc.sharingMode === "workspace" && "Team"}
											{doc.sharingMode === "specific" && "Specific"}
										</Badge>
									</div>
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}
		</>
	)
}

function DocumentsPage() {
	const { slug } = Route.useParams();
	const [uploadOpen, setUploadOpen] = useState(false);
	const [shareDialogOpen, setShareDialogOpen] = useState(false);
	const [selectedDocumentId, setSelectedDocumentId] =
		useState<Id<"documents"> | null>(null);
	const [filter, setFilter] = useState<FilterType>("all");
	const [workflowStatusFilter, setWorkflowStatusFilter] =
		useState<WorkflowStatusFilter>("all");
	const [refreshKey, setRefreshKey] = useState(0);

	const { data: organization } = useSuspenseQuery(
		convexQuery(api.organizations.queries.getOrganization, { slug }),
	)

	const handleRefetch = () => {
		setRefreshKey((prev) => prev + 1);
	}

	const handleShareClick = (documentId: Id<"documents">) => {
		setSelectedDocumentId(documentId);
		setShareDialogOpen(true);
	}

	return (
		<PageWrapper title="Documents">
			<div className="space-y-6">
				<div className="flex items-center justify-between">
					<p className="text-muted-foreground">
						Manage and share documents with your team
					</p>
					<Button onClick={() => setUploadOpen(true)}>
						<UploadIcon className="mr-2 h-4 w-4" />
						Upload Document
					</Button>
				</div>

				{/* Filter Tabs */}
				<div className="space-y-4">
					<div className="flex gap-2 flex-wrap">
						<Button
							variant={filter === "all" ? "default" : "outline"}
							onClick={() => setFilter("all")}
						>
							All Documents
						</Button>
						<Button
							variant={filter === "owned" ? "default" : "outline"}
							onClick={() => setFilter("owned")}
						>
							My Documents
						</Button>
						<Button
							variant={filter === "shared" ? "default" : "outline"}
							onClick={() => setFilter("shared")}
						>
							Shared with Me
						</Button>
					</div>

					{/* Workflow Status Filters */}
					<div className="flex gap-2 flex-wrap">
						<span className="text-sm text-muted-foreground self-center">
							Status:
						</span>
						<Button
							size="sm"
							variant={workflowStatusFilter === "all" ? "default" : "outline"}
							onClick={() => setWorkflowStatusFilter("all")}
						>
							All
						</Button>
						<Button
							size="sm"
							variant={workflowStatusFilter === "draft" ? "default" : "outline"}
							onClick={() => setWorkflowStatusFilter("draft")}
						>
							Drafts
						</Button>
						<Button
							size="sm"
							variant={workflowStatusFilter === "sent" ? "default" : "outline"}
							onClick={() => setWorkflowStatusFilter("sent")}
						>
							Sent
						</Button>
						<Button
							size="sm"
							variant={
								workflowStatusFilter === "in_progress" ? "default" : "outline"
							}
							onClick={() => setWorkflowStatusFilter("in_progress")}
						>
							In Progress
						</Button>
						<Button
							size="sm"
							variant={
								workflowStatusFilter === "completed" ? "default" : "outline"
							}
							onClick={() => setWorkflowStatusFilter("completed")}
						>
							Completed
						</Button>
						<Button
							size="sm"
							variant={
								workflowStatusFilter === "cancelled" ? "default" : "outline"
							}
							onClick={() => setWorkflowStatusFilter("cancelled")}
						>
							Cancelled
						</Button>
					</div>
				</div>

				{/* Documents List with Suspense */}
				<Suspense
					key={`${filter}-${workflowStatusFilter}-${refreshKey}`}
					fallback={
						<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
							<CardSkeleton showDescription showFooter={false} />
							<CardSkeleton showDescription showFooter={false} />
							<CardSkeleton showDescription showFooter={false} />
							<CardSkeleton showDescription showFooter={false} />
							<CardSkeleton showDescription showFooter={false} />
							<CardSkeleton showDescription showFooter={false} />
						</div>
					}
				>
					<DocumentsList
						organizationId={organization._id}
						filter={filter}
						workflowStatusFilter={workflowStatusFilter}
						onRefetch={handleRefetch}
						onShareClick={handleShareClick}
					/>
				</Suspense>

				<UploadDialog
					organizationId={organization._id}
					open={uploadOpen}
					onOpenChange={setUploadOpen}
					onSuccess={handleRefetch}
				/>

				{selectedDocumentId && (
					<ShareDialog
						documentId={selectedDocumentId}
						organizationId={organization._id}
						open={shareDialogOpen}
						onOpenChange={setShareDialogOpen}
						onSuccess={handleRefetch}
					/>
				)}
			</div>
		</PageWrapper>
	)
}
