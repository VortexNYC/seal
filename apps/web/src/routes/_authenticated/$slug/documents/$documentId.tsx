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
	ArrowLeftIcon,
	DownloadIcon,
	FileTextIcon,
	UserPlusIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { toast } from "sonner";
import { PageWrapper } from "@/components/page-wrapper";
import { ActivityFeed } from "../../../../components/documents/activity-feed";
import { AddRecipientDialog } from "../../../../components/documents/add-recipient-dialog";
import { RecipientList } from "../../../../components/documents/recipient-list";
import { SigningProgress } from "../../../../components/documents/signing-progress";
import { WorkflowStatusBadge } from "../../../../components/documents/workflow-status-badge";
import { Button } from "../../../../components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "../../../../components/ui/card";

// SEA-72: Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

export const Route = createFileRoute(
	"/_authenticated/$slug/documents/$documentId",
)({
	component: DocumentDetailPage,
});

function DocumentDetailPage() {
	const { slug, documentId } = Route.useParams();
	const router = useRouter();
	const [addRecipientOpen, setAddRecipientOpen] = useState(false);

	// SEA-72: PDF viewer state
	const [numPages, setNumPages] = useState<number | null>(null);
	const [pdfUrl, setPdfUrl] = useState<string | null>(null);

	const { data: document } = useSuspenseQuery(
		convexQuery(api.documents.queries.getDocument, {
			documentId: documentId as Id<"documents">,
		}),
	);

	const { data: recipients = [], refetch: refetchRecipients } =
		useSuspenseQuery(
			convexQuery(api.documents.recipients_queries.getDocumentRecipients, {
				documentId: documentId as Id<"documents">,
			}),
		);

	const { data: progress } = useSuspenseQuery(
		convexQuery(api.documents.recipients_queries.getRecipientProgress, {
			documentId: documentId as Id<"documents">,
		}),
	);

	const removeRecipient = useMutation(
		api.documents.recipients_mutations.removeRecipient,
	);

	// SEA-72: Fetch PDF URL on mount
	const { convexClient } = useRouteContext({ from: "__root__" });
	useEffect(() => {
		const fetchPdfUrl = async () => {
			try {
				const url = await convexClient.query(
					api.documents.queries.getDocumentUrl,
					{ documentId: documentId as Id<"documents"> },
				);
				setPdfUrl(url);
			} catch (_error) {
				toast.error("Failed to load PDF");
			}
		};
		fetchPdfUrl();
	}, [convexClient, documentId]);

	// SEA-72: Download handler
	const handleDownload = () => {
		if (pdfUrl) {
			window.open(pdfUrl, "_blank");
		}
	};

	// SEA-72: PDF document load handlers
	const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
		setNumPages(numPages);
	};

	const handleRemoveRecipient = async (
		recipientId: Id<"document_recipients">,
	) => {
		if (!confirm("Remove this recipient?")) {
			return;
		}

		try {
			await removeRecipient({ recipientId });
			toast.success("Recipient removed");
			refetchRecipients();
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Failed to remove recipient";
			toast.error(errorMessage);
		}
	};

	// Build activity events from document and recipients
	const activityEvents = [];

	// Document created
	activityEvents.push({
		type: "created" as const,
		timestamp: document.createdAt,
		description: `Document "${document.name}" was created`,
	});

	// Recipients added
	for (const recipient of recipients) {
		activityEvents.push({
			type: "recipient_added" as const,
			timestamp: recipient.createdAt,
			description: `${recipient.name || recipient.email} was added as a ${recipient.role}`,
		});

		if (recipient.viewedAt) {
			activityEvents.push({
				type: "viewed" as const,
				timestamp: recipient.viewedAt,
				description: `${recipient.name || recipient.email} viewed the document`,
			});
		}

		if (recipient.signedAt) {
			activityEvents.push({
				type: "signed" as const,
				timestamp: recipient.signedAt,
				description: `${recipient.name || recipient.email} signed the document`,
			});
		}

		if (recipient.approvedAt) {
			activityEvents.push({
				type: "approved" as const,
				timestamp: recipient.approvedAt,
				description: `${recipient.name || recipient.email} approved the document`,
			});
		}

		if (recipient.declinedAt) {
			activityEvents.push({
				type: "declined" as const,
				timestamp: recipient.declinedAt,
				description: `${recipient.name || recipient.email} declined`,
			});
		}
	}

	// Sort by timestamp (newest first)
	activityEvents.sort((a, b) => b.timestamp - a.timestamp);

	const canEdit = document.status === "active"; // Only edit active documents

	// SEA-72: Format file size helper
	const formatFileSize = (bytes: number) => {
		if (bytes === 0) return "0 Bytes";
		const k = 1024;
		const sizes = ["Bytes", "KB", "MB", "GB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${Math.round((bytes / k ** i) * 100) / 100} ${sizes[i]}`;
	};

	const formatDate = (timestamp: number) => {
		return new Date(timestamp).toLocaleDateString("en-US", {
			year: "numeric",
			month: "long",
			day: "numeric",
		});
	};

	return (
		<PageWrapper title={document.name}>
			<div className="space-y-6">
				<div className="flex items-center justify-between">
					<Button
						variant="ghost"
						size="sm"
						onClick={() =>
							router.navigate({ to: "/$slug/documents", params: { slug } })
						}
					>
						<ArrowLeftIcon className="mr-2 h-4 w-4" />
						Back to Documents
					</Button>
					<Button onClick={handleDownload}>
						<DownloadIcon className="mr-2 h-4 w-4" />
						Download PDF
					</Button>
				</div>

				{/* SEA-72: Main content grid with PDF preview */}
				<div className="grid gap-6 lg:grid-cols-3">
					{/* Left column: PDF Preview */}
					<div className="lg:col-span-2 space-y-6">
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<FileTextIcon className="h-5 w-5" />
									PDF Preview
								</CardTitle>
								<CardDescription>
									{numPages ? `${numPages} pages` : "Loading..."}
								</CardDescription>
							</CardHeader>
							<CardContent>
								{pdfUrl ? (
									<div className="border rounded-lg overflow-auto max-h-[800px] bg-gray-50">
										<Document
											file={pdfUrl}
											onLoadSuccess={onDocumentLoadSuccess}
											loading={
												<div className="p-12 text-center text-muted-foreground">
													Loading PDF...
												</div>
											}
											error={
												<div className="p-12 text-center text-destructive">
													Failed to load PDF
												</div>
											}
										>
											{Array.from(new Array(numPages), (_el, index) => (
												<Page
													key={`page_${index + 1}`}
													pageNumber={index + 1}
													renderTextLayer={true}
													renderAnnotationLayer={true}
													className="mb-4"
													width={700}
												/>
											))}
										</Document>
									</div>
								) : (
									<div className="p-12 text-center text-muted-foreground">
										Loading PDF...
									</div>
								)}
							</CardContent>
						</Card>
					</div>

					{/* Right column: Document info, recipients, activity */}
					<div className="space-y-6">
						{/* SEA-72: Document metadata */}
						<Card>
							<CardHeader>
								<CardTitle>Document Details</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div>
									<p className="text-sm font-medium text-muted-foreground">
										Status
									</p>
									<WorkflowStatusBadge status={document.workflowStatus} />
								</div>
								<div>
									<p className="text-sm font-medium text-muted-foreground">
										File Size
									</p>
									<p className="text-sm">{formatFileSize(document.fileSize)}</p>
								</div>
								<div>
									<p className="text-sm font-medium text-muted-foreground">
										Pages
									</p>
									<p className="text-sm">
										{document.pageCount || numPages || "—"}
									</p>
								</div>
								<div>
									<p className="text-sm font-medium text-muted-foreground">
										Uploaded
									</p>
									<p className="text-sm">{formatDate(document.createdAt)}</p>
								</div>
								{document.description && (
									<div>
										<p className="text-sm font-medium text-muted-foreground">
											Description
										</p>
										<p className="text-sm">{document.description}</p>
									</div>
								)}
							</CardContent>
						</Card>

						{/* Recipients section */}
						<Card>
							<CardHeader>
								<div className="flex items-center justify-between">
									<CardTitle>Recipients</CardTitle>
									{canEdit && (
										<Button
											size="sm"
											variant="outline"
											onClick={() => setAddRecipientOpen(true)}
										>
											<UserPlusIcon className="mr-2 h-4 w-4" />
											Add
										</Button>
									)}
								</div>
							</CardHeader>
							<CardContent>
								<RecipientList
									recipients={recipients}
									onRemoveRecipient={
										canEdit ? handleRemoveRecipient : undefined
									}
									canEdit={canEdit}
								/>
							</CardContent>
						</Card>

						{/* Progress */}
						{progress && <SigningProgress progress={progress} />}

						{/* Activity feed */}
						<ActivityFeed events={activityEvents} />
					</div>
				</div>

				<AddRecipientDialog
					documentId={documentId as Id<"documents">}
					open={addRecipientOpen}
					onOpenChange={setAddRecipientOpen}
					onSuccess={() => refetchRecipients()}
				/>
			</div>
		</PageWrapper>
	);
}
