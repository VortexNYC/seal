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
	ArrowDownIcon,
	ArrowUpIcon,
	BanIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	DownloadIcon,
	FileIcon,
	LayoutGridIcon,
	LayoutListIcon,
	MoreVerticalIcon,
	SendIcon,
	Share2Icon,
	TrashIcon,
	UploadIcon,
} from "lucide-react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ShareDialog } from "@/components/documents/share-dialog";
import { UploadDialog } from "@/components/documents/upload-dialog";
import { WorkflowStatusBadge } from "@/components/documents/workflow-status-badge";
import { PageWrapper } from "@/components/page-wrapper";
import { CardSkeleton } from "@/components/skeletons/card-skeleton";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/$slug/documents/")({
	component: DocumentsPage,
});

type FilterType = "all" | "owned" | "shared";
type WorkflowStatusFilter =
	| "all"
	| "draft"
	| "sent"
	| "in_progress"
	| "completed"
	| "cancelled";

type ViewMode = "grid" | "table";
type SortField = "name" | "createdAt" | "workflowStatus";
type SortDirection = "asc" | "desc";

interface DocumentsListProps {
	organizationId: Id<"organizations">;
	filter: FilterType;
	workflowStatusFilter: WorkflowStatusFilter;
	viewMode: ViewMode;
	sortField: SortField;
	sortDirection: SortDirection;
	onShareClick: (documentId: Id<"documents">) => void;
	onSortChange: (field: SortField) => void;
}

function DocumentsList({
	organizationId,
	filter,
	workflowStatusFilter,
	viewMode,
	sortField,
	sortDirection,
	onShareClick,
	onSortChange,
}: DocumentsListProps) {
	const { slug } = Route.useParams();
	const router = useRouter();
	const { convexClient } = useRouteContext({ from: "__root__" });

	// Pagination state (SEA-68: 20 items per page)
	const [currentPage, setCurrentPage] = useState(1);
	const ITEMS_PER_PAGE = 20;

	const { data: allDocuments, refetch } = useSuspenseQuery(
		convexQuery(api.documents.queries.listDocuments, {
			organizationId,
			filter,
		}),
	);

	// Filter documents by workflow status on the client side
	const filteredDocuments =
		workflowStatusFilter === "all"
			? allDocuments
			: allDocuments.filter((doc) => {
					const docWorkflowStatus = doc.workflowStatus ?? "draft";
					return docWorkflowStatus === workflowStatusFilter;
				});

	// Sort documents (SEA-68: sorting by name and date)
	const sortedDocuments = useMemo(() => {
		const docs = [...filteredDocuments];
		docs.sort((a, b) => {
			let comparison = 0;

			if (sortField === "name") {
				comparison = a.name.localeCompare(b.name);
			} else if (sortField === "createdAt") {
				comparison = a.createdAt - b.createdAt;
			} else if (sortField === "workflowStatus") {
				const aStatus = a.workflowStatus ?? "draft";
				const bStatus = b.workflowStatus ?? "draft";
				comparison = aStatus.localeCompare(bStatus);
			}

			return sortDirection === "asc" ? comparison : -comparison;
		});
		return docs;
	}, [filteredDocuments, sortField, sortDirection]);

	// Pagination logic (SEA-68)
	const totalPages = Math.ceil(sortedDocuments.length / ITEMS_PER_PAGE);
	const paginatedDocuments = useMemo(() => {
		const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
		return sortedDocuments.slice(startIndex, startIndex + ITEMS_PER_PAGE);
	}, [sortedDocuments, currentPage]);

	// Reset to page 1 when filters change
	// biome-ignore lint/correctness/useExhaustiveDependencies: We want to reset page when filters change
	useEffect(() => {
		setCurrentPage(1);
	}, [filter, workflowStatusFilter, sortField, sortDirection]);

	const deleteDocument = useMutation(api.documents.mutations.deleteDocument);
	const sendDocument = useMutation(api.documents.mutations.sendDocument);
	const cancelDocument = useMutation(api.documents.mutations.cancelDocument);

	// Confirmation dialog state
	const [confirmDialog, setConfirmDialog] = useState<{
		open: boolean;
		type: "delete" | "send" | "cancel";
		documentId: Id<"documents"> | null;
	}>({
		open: false,
		type: "delete",
		documentId: null,
	});

	const handleDelete = (documentId: Id<"documents">) => {
		setConfirmDialog({
			open: true,
			type: "delete",
			documentId,
		});
	};

	const handleSendDocument = (documentId: Id<"documents">) => {
		setConfirmDialog({
			open: true,
			type: "send",
			documentId,
		});
	};

	const handleCancelDocument = (documentId: Id<"documents">) => {
		setConfirmDialog({
			open: true,
			type: "cancel",
			documentId,
		});
	};

	const handleConfirmAction = async () => {
		if (!confirmDialog.documentId) return;

		try {
			if (confirmDialog.type === "delete") {
				await deleteDocument({ documentId: confirmDialog.documentId });
				toast.success("Document deleted");
				refetch();
			} else if (confirmDialog.type === "send") {
				await sendDocument({ documentId: confirmDialog.documentId });
				toast.success("Document sent successfully");
				refetch();
			} else if (confirmDialog.type === "cancel") {
				await cancelDocument({ documentId: confirmDialog.documentId });
				toast.success("Document cancelled");
				refetch();
			}
		} catch (error) {
			const errorMessage =
				error instanceof Error
					? error.message
					: `Failed to ${confirmDialog.type} document`;
			toast.error(errorMessage);
		} finally {
			setConfirmDialog({ open: false, type: "delete", documentId: null });
		}
	};

	const handleDownload = async (documentId: Id<"documents">) => {
		try {
			const url = await convexClient.query(
				api.documents.queries.getDocumentUrl,
				{
					documentId,
				},
			);
			window.open(url, "_blank");
		} catch (_error) {
			toast.error("Failed to download document");
		}
	};

	const formatBytes = (bytes: number) => {
		if (bytes === 0) return "0 Bytes";
		const k = 1024;
		const sizes = ["Bytes", "KB", "MB", "GB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${Math.round((bytes / k ** i) * 100) / 100} ${sizes[i]}`;
	};

	const formatDate = (timestamp: number) => {
		return new Date(timestamp).toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	};

	const getConfirmDialogContent = () => {
		switch (confirmDialog.type) {
			case "delete":
				return {
					title: "Delete Document",
					description:
						"Are you sure you want to delete this document? This action cannot be undone.",
				};
			case "send":
				return {
					title: "Send Document",
					description:
						"Send this document? Once sent, recipients will be notified to take action.",
				};
			case "cancel":
				return {
					title: "Cancel Document",
					description:
						"Cancel this document? This action cannot be undone and recipients will be notified.",
				};
		}
	};

	const dialogContent = getConfirmDialogContent();

	// SEA-68: Sort header component
	const SortHeader = ({
		field,
		label,
	}: {
		field: SortField;
		label: string;
	}) => (
		<Button
			variant="ghost"
			onClick={() => onSortChange(field)}
			className="h-auto p-0 hover:bg-transparent"
		>
			<span className="font-medium">{label}</span>
			{sortField === field &&
				(sortDirection === "asc" ? (
					<ArrowUpIcon className="ml-2 h-4 w-4" />
				) : (
					<ArrowDownIcon className="ml-2 h-4 w-4" />
				))}
		</Button>
	);

	return (
		<>
			{/* Empty state */}
			{sortedDocuments.length === 0 ? (
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
				<div className="space-y-4">
					{/* Table View (SEA-68) */}
					{viewMode === "table" ? (
						<div className="border rounded-lg">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead className="w-[100px]">Thumbnail</TableHead>
										<TableHead>
											<SortHeader field="name" label="Title" />
										</TableHead>
										<TableHead>
											<SortHeader field="createdAt" label="Upload Date" />
										</TableHead>
										<TableHead>
											<SortHeader field="workflowStatus" label="Status" />
										</TableHead>
										<TableHead className="text-right">Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{paginatedDocuments.map((doc) => (
										<TableRow
											key={doc._id}
											className="cursor-pointer hover:bg-muted/50"
											onClick={() =>
												router.navigate({
													to: "/$slug/documents/$documentId",
													params: { slug, documentId: doc._id },
												})
											}
										>
											<TableCell>
												<div className="w-16 h-20 bg-muted rounded border border-border flex items-center justify-center">
													<FileIcon className="h-8 w-8 text-muted-foreground" />
												</div>
											</TableCell>
											<TableCell>
												<div>
													<p className="font-medium">{doc.name}</p>
													{doc.description && (
														<p className="text-sm text-muted-foreground line-clamp-1">
															{doc.description}
														</p>
													)}
													{doc.pageCount !== undefined && doc.pageCount > 0 && (
														<p className="text-xs text-muted-foreground mt-1">
															{doc.pageCount}{" "}
															{doc.pageCount === 1 ? "page" : "pages"}
														</p>
													)}
												</div>
											</TableCell>
											<TableCell>
												<div className="text-sm">
													<p>{formatDate(doc.createdAt)}</p>
													<p className="text-muted-foreground">
														{formatBytes(doc.fileSize)}
													</p>
												</div>
											</TableCell>
											<TableCell>
												<WorkflowStatusBadge status={doc.workflowStatus} />
											</TableCell>
											<TableCell className="text-right">
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
														{(doc.workflowStatus ?? "draft") === "draft" && (
															<DropdownMenuItem
																onClick={() => handleSendDocument(doc._id)}
															>
																<SendIcon className="mr-2 h-4 w-4" />
																Send Document
															</DropdownMenuItem>
														)}
														{((doc.workflowStatus ?? "draft") === "sent" ||
															(doc.workflowStatus ?? "draft") ===
																"in_progress") && (
															<DropdownMenuItem
																onClick={() => handleCancelDocument(doc._id)}
																className="text-destructive"
															>
																<BanIcon className="mr-2 h-4 w-4" />
																Cancel Document
															</DropdownMenuItem>
														)}
														<DropdownMenuItem
															onClick={() => handleDownload(doc._id)}
														>
															<DownloadIcon className="mr-2 h-4 w-4" />
															Download
														</DropdownMenuItem>
														<DropdownMenuItem
															onClick={() => onShareClick(doc._id)}
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
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					) : (
						/* Grid View */
						<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
							{paginatedDocuments.map((doc) => (
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
													{(doc.workflowStatus ?? "draft") === "draft" && (
														<DropdownMenuItem
															onClick={() => handleSendDocument(doc._id)}
														>
															<SendIcon className="mr-2 h-4 w-4" />
															Send Document
														</DropdownMenuItem>
													)}
													{((doc.workflowStatus ?? "draft") === "sent" ||
														(doc.workflowStatus ?? "draft") ===
															"in_progress") && (
														<DropdownMenuItem
															onClick={() => handleCancelDocument(doc._id)}
															className="text-destructive"
														>
															<BanIcon className="mr-2 h-4 w-4" />
															Cancel Document
														</DropdownMenuItem>
													)}
													<DropdownMenuItem
														onClick={() => handleDownload(doc._id)}
													>
														<DownloadIcon className="mr-2 h-4 w-4" />
														Download
													</DropdownMenuItem>
													<DropdownMenuItem
														onClick={() => onShareClick(doc._id)}
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
														doc.sharingMode === "private"
															? "secondary"
															: "default"
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

					{/* Pagination (SEA-68: 20 items per page) */}
					{totalPages > 1 && (
						<div className="flex items-center justify-between">
							<p className="text-sm text-muted-foreground">
								Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
								{Math.min(currentPage * ITEMS_PER_PAGE, sortedDocuments.length)}{" "}
								of {sortedDocuments.length} documents
							</p>
							<div className="flex items-center gap-2">
								<Button
									variant="outline"
									size="sm"
									onClick={() =>
										setCurrentPage((prev) => Math.max(1, prev - 1))
									}
									disabled={currentPage === 1}
								>
									<ChevronLeftIcon className="h-4 w-4" />
									Previous
								</Button>
								<div className="flex items-center gap-1">
									{Array.from({ length: totalPages }, (_, i) => i + 1).map(
										(page) => (
											<Button
												key={page}
												variant={page === currentPage ? "default" : "outline"}
												size="sm"
												onClick={() => setCurrentPage(page)}
												className="w-8 h-8 p-0"
											>
												{page}
											</Button>
										),
									)}
								</div>
								<Button
									variant="outline"
									size="sm"
									onClick={() =>
										setCurrentPage((prev) => Math.min(totalPages, prev + 1))
									}
									disabled={currentPage === totalPages}
								>
									Next
									<ChevronRightIcon className="h-4 w-4" />
								</Button>
							</div>
						</div>
					)}
				</div>
			)}

			{/* Confirmation Dialog */}
			<AlertDialog
				open={confirmDialog.open}
				onOpenChange={(open) =>
					setConfirmDialog({ open, type: "delete", documentId: null })
				}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{dialogContent.title}</AlertDialogTitle>
						<AlertDialogDescription>
							{dialogContent.description}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleConfirmAction}
							className={
								confirmDialog.type === "delete" ||
								confirmDialog.type === "cancel"
									? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
									: ""
							}
						>
							{confirmDialog.type === "delete" && "Delete"}
							{confirmDialog.type === "send" && "Send"}
							{confirmDialog.type === "cancel" && "Cancel Document"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
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

	// SEA-68: View mode, sorting state
	const [viewMode, setViewMode] = useState<ViewMode>("table");
	const [sortField, setSortField] = useState<SortField>("createdAt");
	const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

	const handleSortChange = (field: SortField) => {
		if (sortField === field) {
			// Toggle direction if clicking same field
			setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
		} else {
			// Default to descending for new field
			setSortField(field);
			setSortDirection("desc");
		}
	};

	const { data: organization } = useSuspenseQuery(
		convexQuery(api.organizations.queries.getOrganization, { slug }),
	);

	const handleRefetch = () => {
		setRefreshKey((prev) => prev + 1);
	};

	const handleShareClick = (documentId: Id<"documents">) => {
		setSelectedDocumentId(documentId);
		setShareDialogOpen(true);
	};

	return (
		<PageWrapper title="Documents">
			<div className="space-y-6">
				<div className="flex items-center justify-between">
					<p className="text-muted-foreground">
						Manage and share documents with your team
					</p>
					<div className="flex items-center gap-2">
						{/* SEA-68: View mode toggle */}
						<div className="flex items-center gap-1 border rounded-md">
							<Button
								variant={viewMode === "table" ? "default" : "ghost"}
								size="icon"
								className="h-9 w-9"
								onClick={() => setViewMode("table")}
							>
								<LayoutListIcon className="h-4 w-4" />
							</Button>
							<Button
								variant={viewMode === "grid" ? "default" : "ghost"}
								size="icon"
								className="h-9 w-9"
								onClick={() => setViewMode("grid")}
							>
								<LayoutGridIcon className="h-4 w-4" />
							</Button>
						</div>
						<Button onClick={() => setUploadOpen(true)}>
							<UploadIcon className="mr-2 h-4 w-4" />
							Upload Document
						</Button>
					</div>
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
						viewMode === "table" ? (
							<div className="border rounded-lg p-12 flex items-center justify-center">
								<p className="text-muted-foreground">Loading documents...</p>
							</div>
						) : (
							<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
								<CardSkeleton showDescription showFooter={false} />
								<CardSkeleton showDescription showFooter={false} />
								<CardSkeleton showDescription showFooter={false} />
								<CardSkeleton showDescription showFooter={false} />
								<CardSkeleton showDescription showFooter={false} />
								<CardSkeleton showDescription showFooter={false} />
							</div>
						)
					}
				>
					<DocumentsList
						organizationId={organization._id}
						filter={filter}
						workflowStatusFilter={workflowStatusFilter}
						viewMode={viewMode}
						sortField={sortField}
						sortDirection={sortDirection}
						onShareClick={handleShareClick}
						onSortChange={handleSortChange}
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
	);
}
