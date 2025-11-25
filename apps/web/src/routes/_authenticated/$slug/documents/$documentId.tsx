import { convexQuery } from "@convex-dev/react-query";
import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	useRouteContext,
	useRouter,
} from "@tanstack/react-router";
import { useAction, useMutation } from "convex/react";
import {
	ArrowLeftIcon,
	DownloadIcon,
	FileTextIcon,
	SendIcon,
	UserPlusIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Document, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import "./document-detail.css";
import { toast } from "sonner";
import { PageWrapper } from "@/components/page-wrapper";
import { ActivityFeed } from "../../../../components/documents/activity-feed";
import { AddRecipientDialog } from "../../../../components/documents/add-recipient-dialog";
import {
	FIELD_DIMENSIONS,
	type PlacedField,
} from "../../../../components/documents/draggable-field";
import { FieldList } from "../../../../components/documents/field-list";
import type { FieldType } from "../../../../components/documents/field-toolbar";
import { FieldToolbar } from "../../../../components/documents/field-toolbar";
import { PdfPageWithCanvas } from "../../../../components/documents/pdf-page-with-canvas";
import { PdfZoomControls } from "../../../../components/documents/pdf-zoom-controls";
import { RecipientList } from "../../../../components/documents/recipient-list";
import { RecipientSelectorDialog } from "../../../../components/documents/recipient-selector-dialog";
import { SendDocumentDialog } from "../../../../components/documents/send-document-dialog";
import { SigningProgress } from "../../../../components/documents/signing-progress";
import { WorkflowStatusBadge } from "../../../../components/documents/workflow-status-badge";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "../../../../components/ui/alert-dialog";
import { Button } from "../../../../components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "../../../../components/ui/card";

// SEA-72: Configure PDF.js worker
// Use unpkg CDN which has reliable pdf.js worker files
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export const Route = createFileRoute(
	"/_authenticated/$slug/documents/$documentId",
)({
	component: DocumentDetailPage,
});

function DocumentDetailPage() {
	const { slug, documentId } = Route.useParams();
	const router = useRouter();
	const [addRecipientOpen, setAddRecipientOpen] = useState(false);
	const [sendDocumentOpen, setSendDocumentOpen] = useState(false);

	// SEA-72: PDF viewer state
	const [numPages, setNumPages] = useState<number | null>(null);
	const [pdfUrl, setPdfUrl] = useState<string | null>(null);

	// SEA-84: Responsive PDF width with window resize handling
	const [pdfWidth, setPdfWidth] = useState(700);
	const [pdfHeight, setPdfHeight] = useState(900); // Default height, updated on page load
	const containerRef = useRef<HTMLDivElement>(null);

	// SEA-89: Field drag state
	const [draggingFieldType, setDraggingFieldType] = useState<FieldType | null>(
		null,
	);

	// SEA-90: Field placement state
	const [placedFields, setPlacedFields] = useState<PlacedField[]>([]);
	const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
	const [showFieldDeleteDialog, setShowFieldDeleteDialog] = useState(false);

	// Recipient selector for field assignment
	const [showRecipientSelector, setShowRecipientSelector] = useState(false);
	const [selectedRecipientId, setSelectedRecipientId] =
		useState<Id<"document_recipients"> | null>(null);
	const [pendingFieldData, setPendingFieldData] = useState<{
		fieldType: FieldType;
		x: number;
		y: number;
		width: number;
		height: number;
		page: number;
	} | null>(null);

	const { data: documentData, refetch: refetchDocument } = useSuspenseQuery(
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

	// SEA-91: Load signature fields from database
	const { data: signatureFields = [], refetch: refetchFields } =
		useSuspenseQuery(
			convexQuery(api.signature_fields.queries.getFieldsByDocument, {
				documentId: documentId as Id<"documents">,
			}),
		);

	const removeRecipient = useMutation(
		api.documents.recipients_mutations.removeRecipient,
	);

	// SEA-91: Field mutations
	const createField = useMutation(api.signature_fields.mutations.createField);
	const repositionField = useMutation(
		api.signature_fields.mutations.repositionField,
	);
	const deleteField = useMutation(api.signature_fields.mutations.deleteField);

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

	// SEA-91: Sync database fields to local state
	useEffect(() => {
		const fields: PlacedField[] = signatureFields.map((field) => ({
			id: field._id,
			fieldType: field.fieldType as FieldType,
			x: field.x,
			y: field.y,
			width: field.width,
			height: field.height,
			pageNumber: field.page,
			recipientId: field.recipientId,
		}));
		setPlacedFields(fields);
	}, [signatureFields]);

	// SEA-84: Handle window resize to maintain canvas-PDF alignment
	useEffect(() => {
		const updatePdfWidth = () => {
			if (containerRef.current) {
				// Calculate optimal width based on container size
				// Leave some padding for scrollbar and borders
				const containerWidth = containerRef.current.clientWidth;
				const optimalWidth = Math.min(containerWidth - 40, 900);
				setPdfWidth(optimalWidth);
			}
		};

		// Set initial width after a short delay to ensure container is rendered
		const timeoutId = setTimeout(updatePdfWidth, 100);

		// Add resize listener with debouncing
		let resizeTimeoutId: NodeJS.Timeout;
		const handleResize = () => {
			clearTimeout(resizeTimeoutId);
			resizeTimeoutId = setTimeout(updatePdfWidth, 150);
		};

		window.addEventListener("resize", handleResize);

		// Cleanup
		return () => {
			clearTimeout(timeoutId);
			clearTimeout(resizeTimeoutId);
			window.removeEventListener("resize", handleResize);
		};
	}, []);

	// SEA-72: Download handler - generates fillable PDF with form fields
	const generateFillablePdf = useAction(
		api.documents.generate_fillable_pdf.generateFillablePdfAction,
	);

	const handleDownload = async () => {
		try {
			toast.loading("Generating fillable PDF...");

			// Call the Convex action to generate the fillable PDF
			const result = await generateFillablePdf({
				documentId: documentId as Id<"documents">,
			});

			// Convert base64 to blob
			const binaryString = atob(result.pdfBase64);
			const bytes = new Uint8Array(binaryString.length);
			for (let i = 0; i < binaryString.length; i++) {
				bytes[i] = binaryString.charCodeAt(i);
			}
			const blob = new Blob([bytes], { type: "application/pdf" });

			// Create download link
			const url = URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = url;
			link.download = result.fileName;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(url);

			toast.dismiss();
			toast.success("Fillable PDF downloaded successfully!");
		} catch (error) {
			toast.dismiss();
			toast.error(
				`Failed to generate fillable PDF: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
			console.error("Error generating fillable PDF:", error);
		}
	};

	// SEA-72: PDF document load handlers
	const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
		setNumPages(numPages);
	};

	// SEA-91: Page dimensions handler - captures first page dimensions for coordinate conversion
	const handlePageDimensions = (
		pageNumber: number,
		_width: number,
		height: number,
	) => {
		if (pageNumber === 1) {
			setPdfHeight(height);
		}
	};

	// SEA-91: Field drop handlers with database persistence
	const handleFieldDragOver = (e: React.DragEvent) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = "copy";
	};

	const handleFieldDrop = async (e: React.DragEvent) => {
		e.preventDefault();
		const fieldType = e.dataTransfer.getData("fieldType") as FieldType;

		if (!fieldType) return;

		// Check if we have recipients
		if (recipients.length === 0) {
			toast.error("Please add at least one recipient before placing fields");
			setDraggingFieldType(null);
			return;
		}

		// Get the container and calculate drop position
		const container = containerRef.current;
		if (!container) return;

		// Find which PDF page was dropped on by checking all page elements
		const pageElements = container.querySelectorAll(".react-pdf__Page");
		let targetPageNumber = 1;
		let targetPageElement: Element | null = null;

		for (let i = 0; i < pageElements.length; i++) {
			const pageEl = pageElements[i];
			const rect = pageEl.getBoundingClientRect();

			// Check if drop position is within this page's bounds
			if (
				e.clientX >= rect.left &&
				e.clientX <= rect.right &&
				e.clientY >= rect.top &&
				e.clientY <= rect.bottom
			) {
				targetPageNumber = i + 1;
				targetPageElement = pageEl;
				break;
			}
		}

		// If no page found (dropped outside pages), default to page 1
		if (!targetPageElement && pageElements.length > 0) {
			targetPageElement = pageElements[0];
			targetPageNumber = 1;
		}

		if (!targetPageElement) {
			toast.error("Could not determine drop location");
			setDraggingFieldType(null);
			return;
		}

		// Calculate coordinates relative to the actual page element
		const pageRect = targetPageElement.getBoundingClientRect();

		// Get field dimensions based on type
		const { width: widthPixels, height: heightPixels } =
			FIELD_DIMENSIONS[fieldType];

		// Calculate the scale factor to account for zoom
		const currentScale = pageRect.width / pdfWidth;

		// Get the scaled field dimensions
		const scaledFieldWidth = widthPixels * currentScale;
		const scaledFieldHeight = heightPixels * currentScale;

		// Calculate drop position relative to page, centered on cursor
		// Since the drag image is centered on the cursor, we need to offset by half the field size
		const dropXPixels = e.clientX - pageRect.left - scaledFieldWidth / 2;
		const dropYPixels = e.clientY - pageRect.top - scaledFieldHeight / 2;

		// Convert pixel coordinates to percentages relative to the UNSCALED page dimensions
		// The pageRect dimensions include zoom, but we need percentages relative to the
		// original PDF page size (pdfWidth x pdfHeight) for consistent storage
		const unscaledDropX = dropXPixels / currentScale;
		const unscaledDropY = dropYPixels / currentScale;

		const xPercent = (unscaledDropX / pdfWidth) * 100;
		const yPercent = (unscaledDropY / pdfHeight) * 100;
		const widthPercent = (widthPixels / pdfWidth) * 100;
		const heightPercent = (heightPixels / pdfHeight) * 100;

		// Store pending field data and show recipient selector dialog
		setPendingFieldData({
			fieldType,
			x: xPercent,
			y: yPercent,
			width: widthPercent,
			height: heightPercent,
			page: targetPageNumber,
		});

		// Pre-select first recipient if available
		if (recipients.length > 0) {
			setSelectedRecipientId(recipients[0]._id);
		}

		setShowRecipientSelector(true);
		setDraggingFieldType(null);
	};

	// Helper to format field type as label
	const formatFieldTypeLabel = (fieldType: FieldType): string => {
		const typeLabels: Record<FieldType, string> = {
			signature: "Signature",
			text: "Text",
			date: "Date",
			checkbox: "Checkbox",
			dropdown: "Dropdown",
			radio: "Radio",
			attachment: "Attachment",
		};
		return `${typeLabels[fieldType]} Field`;
	};

	// Handle field creation after recipient selection
	const handleConfirmFieldPlacement = async () => {
		if (!pendingFieldData || !selectedRecipientId) return;

		try {
			// Save field to database with percentage coordinates
			const fieldId = await createField({
				documentId: documentId as Id<"documents">,
				recipientId: selectedRecipientId as Id<"document_recipients">,
				fieldType: pendingFieldData.fieldType,
				label: formatFieldTypeLabel(pendingFieldData.fieldType),
				isRequired: true, // Default to required
				x: pendingFieldData.x,
				y: pendingFieldData.y,
				width: pendingFieldData.width,
				height: pendingFieldData.height,
				page: pendingFieldData.page,
			});

			// Select the newly created field
			setSelectedFieldId(fieldId);
			setDraggingFieldType(null);

			// Refetch fields to sync with database
			await refetchFields();

			toast.success(
				`${formatFieldTypeLabel(pendingFieldData.fieldType)} assigned to recipient`,
			);

			// Close dialog and clear pending data
			setShowRecipientSelector(false);
			setPendingFieldData(null);
			setSelectedRecipientId(null);
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Failed to create field";
			toast.error(errorMessage);
			setDraggingFieldType(null);
		}
	};

	// SEA-91: Field update handlers with database persistence
	const handleFieldUpdate = async (
		fieldId: string,
		x: number,
		y: number,
		width: number,
		height: number,
	) => {
		// Optimistically update local state
		setPlacedFields((prev) =>
			prev.map((field) =>
				field.id === fieldId ? { ...field, x, y, width, height } : field,
			),
		);

		try {
			// Persist to database
			await repositionField({
				fieldId: fieldId as Id<"signature_fields">,
				x,
				y,
				width,
				height,
			});
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Failed to update field";
			toast.error(errorMessage);
			// Revert by refetching
			await refetchFields();
		}
	};

	const handleFieldSelect = (fieldId: string | null) => {
		setSelectedFieldId(fieldId);
	};

	// SEA-91: Field delete handler
	const handleFieldDelete = useCallback(async () => {
		if (!selectedFieldId) return;

		try {
			await deleteField({
				fieldId: selectedFieldId as Id<"signature_fields">,
			});

			setSelectedFieldId(null);
			await refetchFields();

			toast.success("Field deleted");
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Failed to delete field";
			toast.error(errorMessage);
		}
	}, [selectedFieldId, deleteField, refetchFields]);

	const requestFieldDelete = useCallback(() => {
		if (selectedFieldId) {
			setShowFieldDeleteDialog(true);
		}
	}, [selectedFieldId]);

	const handleFieldDeleteConfirm = useCallback(async () => {
		await handleFieldDelete();
		setShowFieldDeleteDialog(false);
	}, [handleFieldDelete]);

	useEffect(() => {
		if (!selectedFieldId) {
			setShowFieldDeleteDialog(false);
		}
	}, [selectedFieldId]);

	// SEA-91: Keyboard shortcuts for field operations
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Delete or Backspace to delete selected field
			if (
				selectedFieldId &&
				(e.key === "Delete" || e.key === "Backspace") &&
				!e.metaKey &&
				!e.ctrlKey
			) {
				// Only if not in an input field
				if (
					window.document.activeElement?.tagName !== "INPUT" &&
					window.document.activeElement?.tagName !== "TEXTAREA"
				) {
					e.preventDefault();
					requestFieldDelete();
				}
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [selectedFieldId, requestFieldDelete]);

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
		timestamp: documentData.createdAt,
		description: `Document "${documentData.name}" was created`,
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

	const canEdit = documentData.status === "active"; // Only edit active documents

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

	// Check if document can be sent
	const canSendDocument =
		documentData.workflowStatus === "draft" && recipients.length > 0 && canEdit;

	return (
		<PageWrapper
			title={documentData.name}
			actions={[
				{
					label: "Back",
					onClick: () =>
						router.navigate({ to: "/$slug/documents", params: { slug } }),
					icon: ArrowLeftIcon,
					variant: "ghost",
				},
				...(canSendDocument
					? [
							{
								label: "Send Document",
								onClick: () => setSendDocumentOpen(true),
								icon: SendIcon,
								variant: "default" as const,
							},
						]
					: []),
				{
					label: "Download PDF",
					onClick: handleDownload,
					icon: DownloadIcon,
					variant: "outline" as const,
				},
			]}
		>
			<div className="space-y-6">
				{/* SEA-72: Main content grid with PDF preview */}
				<div className="grid gap-6 lg:grid-cols-3">
					{/* Left column: PDF Preview */}
					<div className="lg:col-span-2 space-y-6">
						<Card>
							<CardHeader>
								<div className="flex items-center justify-between">
									<div>
										<CardTitle className="flex items-center gap-2">
											<FileTextIcon className="h-5 w-5" />
											PDF Preview
										</CardTitle>
										<CardDescription>
											{numPages ? `${numPages} pages` : "Loading..."}
										</CardDescription>
									</div>
								</div>
							</CardHeader>
							<CardContent>
								{pdfUrl ? (
									<TransformWrapper
										initialScale={1}
										minScale={0.5}
										maxScale={2}
										centerOnInit={true}
										limitToBounds={true}
										doubleClick={{ disabled: false }}
										wheel={{ step: 0.1 }}
										panning={{ disabled: selectedFieldId !== null }}
									>
										<div className="mb-4 flex justify-center">
											<PdfZoomControls />
										</div>
										<TransformComponent
											wrapperClass={`border rounded-lg overflow-auto max-h-[calc(100vh-12rem)] ${
												draggingFieldType
													? "bg-blue-50 border-blue-300"
													: "bg-gray-50"
											}`}
											contentClass="flex flex-col items-center"
											wrapperStyle={{ width: "100%" }}
										>
											<div
												ref={containerRef}
												onDragOver={handleFieldDragOver}
												onDrop={handleFieldDrop}
											>
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
														<PdfPageWithCanvas
															key={`page_${index + 1}`}
															pageNumber={index + 1}
															width={pdfWidth}
															renderTextLayer={true}
															renderAnnotationLayer={true}
															className="mb-4"
															fields={placedFields}
															selectedFieldId={selectedFieldId}
															onFieldSelect={handleFieldSelect}
															onFieldUpdate={handleFieldUpdate}
															onPageDimensions={handlePageDimensions}
														/>
													))}
												</Document>
											</div>
										</TransformComponent>
									</TransformWrapper>
								) : (
									<div className="p-12 text-center text-muted-foreground">
										Loading PDF...
									</div>
								)}
							</CardContent>
						</Card>
					</div>

					{/* Right column: Field toolbar, document info, recipients, activity */}
					<div className="space-y-6">
						{/* SEA-89: Field toolbar */}
						{canEdit && (
							<FieldToolbar
								onFieldDragStart={(fieldType) =>
									setDraggingFieldType(fieldType)
								}
								onFieldDragEnd={() => setDraggingFieldType(null)}
							/>
						)}

						{/* Signature Fields List */}
						<Card>
							<CardHeader>
								<CardTitle>Signature Fields</CardTitle>
								<CardDescription>
									{signatureFields.length}{" "}
									{signatureFields.length === 1 ? "field" : "fields"} added
								</CardDescription>
							</CardHeader>
							<CardContent>
								<FieldList
									fields={signatureFields}
									recipients={recipients}
									selectedFieldId={selectedFieldId}
									canEdit={canEdit}
									onFieldSelect={handleFieldSelect}
									onFieldDelete={requestFieldDelete}
								/>
							</CardContent>
						</Card>

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
									<WorkflowStatusBadge status={documentData.workflowStatus} />
								</div>
								<div>
									<p className="text-sm font-medium text-muted-foreground">
										File Size
									</p>
									<p className="text-sm">
										{formatFileSize(documentData.fileSize)}
									</p>
								</div>
								<div>
									<p className="text-sm font-medium text-muted-foreground">
										Pages
									</p>
									<p className="text-sm">
										{documentData.pageCount || numPages || "—"}
									</p>
								</div>
								<div>
									<p className="text-sm font-medium text-muted-foreground">
										Uploaded
									</p>
									<p className="text-sm">
										{formatDate(documentData.createdAt)}
									</p>
								</div>
								{documentData.description && (
									<div>
										<p className="text-sm font-medium text-muted-foreground">
											Description
										</p>
										<p className="text-sm">{documentData.description}</p>
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

				{/* Recipient selector for field assignment */}
				<RecipientSelectorDialog
					open={showRecipientSelector}
					onOpenChange={setShowRecipientSelector}
					recipients={recipients}
					selectedRecipientId={selectedRecipientId}
					onRecipientSelect={setSelectedRecipientId}
					onConfirm={handleConfirmFieldPlacement}
					fieldType={pendingFieldData?.fieldType || "field"}
				/>

				{/* Send document dialog */}
				<SendDocumentDialog
					documentId={documentId as Id<"documents">}
					documentName={documentData.name}
					recipients={recipients}
					open={sendDocumentOpen}
					onOpenChange={setSendDocumentOpen}
					onSuccess={() => {
						refetchDocument();
						refetchRecipients();
					}}
				/>

				<AlertDialog
					open={showFieldDeleteDialog}
					onOpenChange={setShowFieldDeleteDialog}
				>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Delete field?</AlertDialogTitle>
							<AlertDialogDescription>
								This action cannot be undone and will permanently remove the
								field from the document.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>Cancel</AlertDialogCancel>
							<AlertDialogAction
								onClick={handleFieldDeleteConfirm}
								variant="destructive"
							>
								Delete
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</div>
		</PageWrapper>
	);
}
