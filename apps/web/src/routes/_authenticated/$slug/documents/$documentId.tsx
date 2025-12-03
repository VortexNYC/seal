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
	ActivityIcon,
	ArrowLeftIcon,
	ChevronDownIcon,
	CopyIcon,
	DownloadIcon,
	FileSignatureIcon,
	FileTextIcon,
	InfoIcon,
	MailIcon,
	PlusIcon,
	SendIcon,
	Trash2Icon,
	UserPlusIcon,
	UsersIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Document, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import "./document-detail.css";
import * as Collapsible from "@radix-ui/react-collapsible";
import { toast } from "sonner";
import { PageWrapper } from "@/components/page-wrapper";
import { countSignatureFields } from "@/lib/signature-fields";
import { AddRecipientDialog } from "../../../../components/documents/add-recipient-dialog";
import { DeleteFieldDialog } from "../../../../components/documents/delete-field-dialog";
import {
	FIELD_DIMENSIONS,
	type PlacedField,
} from "../../../../components/documents/draggable-field";
import { FieldList } from "../../../../components/documents/field-list";
import {
	type FieldOptionsConfig,
	FieldOptionsDialog,
} from "../../../../components/documents/field-options-dialog";
import type { FieldType } from "../../../../components/documents/field-toolbar";
import { FieldToolbar } from "../../../../components/documents/field-toolbar";
import { PdfPageWithCanvas } from "../../../../components/documents/pdf-page-with-canvas";
import { PdfZoomControls } from "../../../../components/documents/pdf-zoom-controls";
import { RecipientSelectorDialog } from "../../../../components/documents/recipient-selector-dialog";
import { SendDocumentDialog } from "../../../../components/documents/send-document-dialog";
import type { DocumentWorkflowStatus } from "../../../../components/documents/workflow-status-badge";
import { Button } from "../../../../components/ui/button";

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

	// Zoom state for PDF viewer
	const [currentZoom, setCurrentZoom] = useState(1);

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

	// Field options dialog for checkbox/dropdown/radio configuration
	const [showFieldOptions, setShowFieldOptions] = useState(false);
	const [pendingFieldOptions, setPendingFieldOptions] =
		useState<FieldOptionsConfig | null>(null);

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
	const signatureFieldCount = countSignatureFields(signatureFields);

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
			label: field.label,
			properties: field.properties,
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

	// Resend email action
	const resendRecipientEmail = useAction(
		api.documents.send_document_action.resendRecipientEmail,
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

	// Check if field type requires options configuration
	const fieldTypeRequiresOptions = (fieldType: FieldType): boolean => {
		return (
			fieldType === "checkbox" ||
			fieldType === "dropdown" ||
			fieldType === "radio"
		);
	};

	// Handle field creation after recipient selection
	const handleConfirmFieldPlacement = async () => {
		if (!pendingFieldData || !selectedRecipientId) return;

		// For checkbox, dropdown, radio - show options dialog first
		if (fieldTypeRequiresOptions(pendingFieldData.fieldType)) {
			setShowRecipientSelector(false);
			setShowFieldOptions(true);
			return;
		}

		// For other field types, create immediately
		await createFieldWithOptions(null);
	};

	// Handle field options confirmation
	const handleFieldOptionsConfirm = async (config: FieldOptionsConfig) => {
		setPendingFieldOptions(config);
		setShowFieldOptions(false);
		await createFieldWithOptions(config);
	};

	// Handle field options cancel
	const handleFieldOptionsCancel = () => {
		setShowFieldOptions(false);
		// Clear all pending data
		setPendingFieldData(null);
		setSelectedRecipientId(null);
		setPendingFieldOptions(null);
		setDraggingFieldType(null);
	};

	// Create field with optional options configuration
	const createFieldWithOptions = async (
		optionsConfig: FieldOptionsConfig | null,
	) => {
		if (!pendingFieldData || !selectedRecipientId) return;

		try {
			// Calculate dimensions for multi-option fields
			let finalWidth = pendingFieldData.width;
			let finalHeight = pendingFieldData.height;

			if (optionsConfig && optionsConfig.options.length > 0) {
				// For checkbox/radio/dropdown with options, calculate proper size
				// Based on the rendering: 22px per row + padding + title
				const optionCount = optionsConfig.options.length;
				const rowHeight = 22; // matches renderCheckbox rowHeight
				const padding = 16; // top + bottom padding
				const titleHeight = 16; // space for title
				const minWidth = 140; // minimum width for option labels

				// Calculate pixel dimensions needed
				const heightPixels = titleHeight + padding + optionCount * rowHeight;
				const widthPixels = Math.max(minWidth, 150);

				// Convert to percentage using pdfWidth/pdfHeight
				finalWidth = (widthPixels / pdfWidth) * 100;
				finalHeight = (heightPixels / pdfHeight) * 100;
			}

			// Save field to database with percentage coordinates
			const fieldId = await createField({
				documentId: documentId as Id<"documents">,
				recipientId: selectedRecipientId as Id<"document_recipients">,
				fieldType: pendingFieldData.fieldType,
				label: formatFieldTypeLabel(pendingFieldData.fieldType),
				isRequired: true, // Default to required
				x: pendingFieldData.x,
				y: pendingFieldData.y,
				width: finalWidth,
				height: finalHeight,
				page: pendingFieldData.page,
				// Include options for multi-choice fields inside properties
				...(optionsConfig &&
					optionsConfig.options.length > 0 && {
						properties: {
							options: optionsConfig.options.map((opt) => opt.label),
						},
					}),
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
			setPendingFieldOptions(null);
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

	const handleResendEmail = async (recipientId: Id<"document_recipients">) => {
		try {
			const result = await resendRecipientEmail({
				documentId: documentId as Id<"documents">,
				recipientId,
			});

			if (result.success) {
				toast.success("Email resent successfully");
			} else {
				toast.error(result.error || "Failed to resend email");
			}
		} catch (error) {
			console.error("Error resending email:", error);
			toast.error(
				error instanceof Error ? error.message : "Failed to resend email",
			);
		}
	};

	// Build activity events from document and recipients
	type ActivityEventType =
		| "created"
		| "recipient_added"
		| "sent"
		| "viewed"
		| "signed"
		| "approved"
		| "declined"
		| "completed"
		| "cancelled";

	const activityEvents: Array<{
		type: ActivityEventType;
		timestamp: number;
		description: string;
	}> = [];

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

	// Collapsible section state
	const [openSections, setOpenSections] = useState<Set<string>>(
		new Set(["fields", "recipients"]),
	);

	const toggleSection = (section: string) => {
		setOpenSections((prev) => {
			const newSet = new Set(prev);
			if (newSet.has(section)) {
				newSet.delete(section);
			} else {
				newSet.add(section);
			}
			return newSet;
		});
	};

	// Helper to get initials from name or email
	const getInitials = (name?: string, email?: string): string => {
		if (name) {
			return name
				.split(" ")
				.map((n) => n[0])
				.join("")
				.toUpperCase()
				.slice(0, 2);
		}
		return email ? email[0].toUpperCase() : "?";
	};

	// Helper to get status label
	const getStatusLabel = (
		status: DocumentWorkflowStatus | undefined,
	): string => {
		const labels: Record<DocumentWorkflowStatus, string> = {
			draft: "Draft",
			sent: "Sent",
			in_progress: "In Progress",
			completed: "Completed",
			cancelled: "Cancelled",
			declined: "Declined",
		};
		return labels[status ?? "draft"];
	};

	// Helper to format relative time
	const formatRelativeTime = (timestamp: number): string => {
		const now = Date.now();
		const diff = now - timestamp;
		const minutes = Math.floor(diff / 60000);
		const hours = Math.floor(diff / 3600000);
		const days = Math.floor(diff / 86400000);

		if (minutes < 1) return "Just now";
		if (minutes < 60) return `${minutes}m ago`;
		if (hours < 24) return `${hours}h ago`;
		if (days < 7) return `${days}d ago`;

		return new Date(timestamp).toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
		});
	};

	// Get activity icon
	const getActivityIcon = (type: ActivityEventType) => {
		switch (type) {
			case "created":
				return <FileTextIcon className="h-3.5 w-3.5" />;
			case "recipient_added":
				return <UserPlusIcon className="h-3.5 w-3.5" />;
			case "sent":
				return <SendIcon className="h-3.5 w-3.5" />;
			case "viewed":
				return (
					<svg
						className="h-3.5 w-3.5"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						aria-hidden="true"
					>
						<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
						<circle cx="12" cy="12" r="3" />
					</svg>
				);
			case "signed":
			case "approved":
			case "completed":
				return (
					<svg
						className="h-3.5 w-3.5"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						aria-hidden="true"
					>
						<polyline points="20 6 9 17 4 12" />
					</svg>
				);
			case "declined":
			case "cancelled":
				return (
					<svg
						className="h-3.5 w-3.5"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						aria-hidden="true"
					>
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				);
			default:
				return <FileTextIcon className="h-3.5 w-3.5" />;
		}
	};

	// Copy signing link handler
	const handleCopySigningLink = (signingToken?: string) => {
		if (!signingToken) {
			toast.error("Signing link not available");
			return;
		}
		const signingUrl = `${window.location.origin}/sign/${signingToken}`;
		navigator.clipboard.writeText(signingUrl).then(
			() => toast.success("Signing link copied!"),
			() => toast.error("Failed to copy link"),
		);
	};

	// Only edit active documents that are in draft workflow status
	const canEdit =
		documentData.status === "active" &&
		(documentData.workflowStatus === "draft" || !documentData.workflowStatus);

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

	// Calculate progress ring circumference
	const ringRadius = 52;
	const ringCircumference = 2 * Math.PI * ringRadius;
	const progressOffset = progress
		? ringCircumference - (progress.percentComplete / 100) * ringCircumference
		: ringCircumference;

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
				{/* Main content grid with PDF preview */}
				<div className="grid gap-6 lg:grid-cols-3">
					{/* Left column: PDF Preview */}
					<div className="lg:col-span-2">
						<div className="document-preview-wrapper">
							<div className="document-preview-header">
								<span>Document Preview</span>
								{numPages && (
									<span className="page-count">
										{numPages} {numPages === 1 ? "page" : "pages"}
									</span>
								)}
							</div>

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
									onTransformed={(_ref, state) => {
										setCurrentZoom(state.scale);
									}}
								>
									<div className="mb-4 flex justify-center">
										<div className="zoom-controls-bar">
											<PdfZoomControls currentZoom={currentZoom} />
										</div>
									</div>
									<TransformComponent
										wrapperClass="w-full"
										contentClass="flex flex-col items-center"
										wrapperStyle={{ width: "100%" }}
									>
										<div
											ref={containerRef}
											onDragOver={handleFieldDragOver}
											onDrop={handleFieldDrop}
											className={`document-canvas-container ${draggingFieldType ? "drag-active" : ""}`}
										>
											<Document
												file={pdfUrl}
												onLoadSuccess={onDocumentLoadSuccess}
												loading={
													<div
														className="p-16 text-center"
														style={{ color: "hsl(220 10% 55%)" }}
													>
														<div className="animate-pulse">
															Loading document...
														</div>
													</div>
												}
												error={
													<div
														className="p-16 text-center"
														style={{ color: "hsl(0 65% 50%)" }}
													>
														Failed to load document
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
														className="mb-1 last:mb-0"
														fields={placedFields}
														selectedFieldId={canEdit ? selectedFieldId : null}
														onFieldSelect={
															canEdit ? handleFieldSelect : undefined
														}
														onFieldUpdate={
															canEdit ? handleFieldUpdate : undefined
														}
														onPageDimensions={handlePageDimensions}
													/>
												))}
											</Document>
										</div>
									</TransformComponent>
								</TransformWrapper>
							) : (
								<div
									className="document-canvas-container p-16 text-center"
									style={{ color: "hsl(220 10% 55%)" }}
								>
									<div className="animate-pulse">Loading document...</div>
								</div>
							)}
						</div>
					</div>

					{/* Right column: Document Options Panel */}
					<div className="document-options-panel">
						{/* Status Hero */}
						<div
							className={`status-hero status-${documentData.workflowStatus ?? "draft"}`}
						>
							<div className="status-label">Document Status</div>
							<div className="status-value">
								{getStatusLabel(documentData.workflowStatus)}
							</div>
							<div className="status-date">
								Created {formatDate(documentData.createdAt)}
							</div>
						</div>

						{/* Progress Ring - Only show when document is sent */}
						{progress && documentData.workflowStatus !== "draft" && (
							<div className="progress-ring-container animate-fade-in-up">
								<div className="progress-ring">
									<svg
										width="120"
										height="120"
										viewBox="0 0 120 120"
										aria-hidden="true"
									>
										<circle
											className="ring-bg"
											cx="60"
											cy="60"
											r={ringRadius}
										/>
										<circle
											className="ring-progress"
											cx="60"
											cy="60"
											r={ringRadius}
											strokeDasharray={ringCircumference}
											strokeDashoffset={progressOffset}
										/>
									</svg>
									<div className="ring-center">
										<span className="ring-percent">
											{progress.percentComplete}%
										</span>
										<span className="ring-label">Complete</span>
									</div>
								</div>
								<div className="progress-stats">
									<div className="progress-stat stat-signed">
										<div className="stat-value">{progress.byStatus.signed}</div>
										<div className="stat-label">Signed</div>
									</div>
									<div className="progress-stat stat-pending">
										<div className="stat-value">
											{progress.byStatus.pending}
										</div>
										<div className="stat-label">Pending</div>
									</div>
									<div className="progress-stat">
										<div className="stat-value">{progress.byStatus.viewed}</div>
										<div className="stat-label">Viewed</div>
									</div>
									{progress.byStatus.declined > 0 && (
										<div className="progress-stat stat-declined">
											<div className="stat-value">
												{progress.byStatus.declined}
											</div>
											<div className="stat-label">Declined</div>
										</div>
									)}
								</div>
							</div>
						)}

						{/* Signature Fields Section */}
						{(signatureFields.length > 0 || canEdit) && (
							<Collapsible.Root
								open={openSections.has("fields")}
								onOpenChange={() => toggleSection("fields")}
								className="options-section section-fields"
							>
								<Collapsible.Trigger asChild>
									<button type="button" className="options-section-header">
										<div className="section-title-group">
											<div className="section-icon">
												<FileSignatureIcon />
											</div>
											<span className="section-title">Signature Fields</span>
											{signatureFields.length > 0 && (
												<span className="section-count">
													{signatureFields.length}
												</span>
											)}
										</div>
										<ChevronDownIcon
											className={`section-chevron h-4 w-4 transition-transform ${openSections.has("fields") ? "rotate-180" : ""}`}
										/>
									</button>
								</Collapsible.Trigger>
								<Collapsible.Content className="options-section-content">
									{canEdit && (
										<div className="mt-4 mb-4">
											<FieldToolbar
												onFieldDragStart={(fieldType) =>
													setDraggingFieldType(fieldType)
												}
												onFieldDragEnd={() => setDraggingFieldType(null)}
											/>
										</div>
									)}
									{signatureFields.length > 0 ? (
										<FieldList
											fields={signatureFields}
											recipients={recipients}
											selectedFieldId={canEdit ? selectedFieldId : null}
											canEdit={canEdit}
											onFieldSelect={canEdit ? handleFieldSelect : undefined}
											onFieldDelete={canEdit ? requestFieldDelete : undefined}
										/>
									) : (
										<div className="empty-state">
											<div className="empty-icon">
												<FileSignatureIcon className="h-6 w-6" />
											</div>
											<div className="empty-title">No fields yet</div>
											<div className="empty-description">
												Drag fields from above onto the document to mark where
												recipients should sign or fill in information.
											</div>
										</div>
									)}
								</Collapsible.Content>
							</Collapsible.Root>
						)}

						{/* Recipients Section */}
						<Collapsible.Root
							open={openSections.has("recipients")}
							onOpenChange={() => toggleSection("recipients")}
							className="options-section section-recipients"
						>
							<Collapsible.Trigger asChild>
								<button type="button" className="options-section-header">
									<div className="section-title-group">
										<div className="section-icon">
											<UsersIcon />
										</div>
										<span className="section-title">Recipients</span>
										{recipients.length > 0 && (
											<span className="section-count">{recipients.length}</span>
										)}
									</div>
									<ChevronDownIcon
										className={`section-chevron h-4 w-4 transition-transform ${openSections.has("recipients") ? "rotate-180" : ""}`}
									/>
								</button>
							</Collapsible.Trigger>
							<Collapsible.Content className="options-section-content">
								{recipients.length > 0 ? (
									<div className="recipient-cards">
										{recipients.map((recipient) => (
											<div key={recipient._id} className="recipient-card">
												<div
													className={`recipient-avatar status-${recipient.status}`}
												>
													{getInitials(recipient.name, recipient.email)}
												</div>
												<div className="recipient-info">
													<div className="recipient-name">
														{recipient.name || recipient.email}
													</div>
													{recipient.name && (
														<div className="recipient-email">
															{recipient.email}
														</div>
													)}
												</div>
												<span
													className={`recipient-status-badge status-${recipient.status}`}
												>
													{recipient.status.charAt(0).toUpperCase() +
														recipient.status.slice(1)}
												</span>
												<div className="recipient-actions">
													{"signingToken" in recipient &&
														recipient.signingToken && (
															<Button
																variant="ghost"
																size="icon-sm"
																onClick={() =>
																	handleCopySigningLink(
																		recipient.signingToken as string,
																	)
																}
																title="Copy signing link"
															>
																<CopyIcon className="h-4 w-4" />
															</Button>
														)}
													{documentData.workflowStatus !== "draft" &&
														(recipient.status === "pending" ||
															recipient.status === "viewed") && (
															<Button
																variant="ghost"
																size="icon-sm"
																onClick={() => handleResendEmail(recipient._id)}
																title="Resend email"
															>
																<MailIcon className="h-4 w-4" />
															</Button>
														)}
													{canEdit && (
														<Button
															variant="ghost"
															size="icon-sm"
															onClick={() =>
																handleRemoveRecipient(recipient._id)
															}
															title="Remove recipient"
														>
															<Trash2Icon className="h-4 w-4" />
														</Button>
													)}
												</div>
											</div>
										))}
									</div>
								) : (
									<div className="empty-state">
										<div className="empty-icon">
											<UsersIcon className="h-6 w-6" />
										</div>
										<div className="empty-title">No recipients</div>
										<div className="empty-description">
											Add recipients who need to sign or view this document.
										</div>
									</div>
								)}
								{canEdit && (
									<button
										type="button"
										className="add-item-button"
										onClick={() => setAddRecipientOpen(true)}
									>
										<PlusIcon />
										Add Recipient
									</button>
								)}
							</Collapsible.Content>
						</Collapsible.Root>

						{/* Document Details Section */}
						<Collapsible.Root
							open={openSections.has("details")}
							onOpenChange={() => toggleSection("details")}
							className="options-section section-details"
						>
							<Collapsible.Trigger asChild>
								<button type="button" className="options-section-header">
									<div className="section-title-group">
										<div className="section-icon">
											<InfoIcon />
										</div>
										<span className="section-title">Details</span>
									</div>
									<ChevronDownIcon
										className={`section-chevron h-4 w-4 transition-transform ${openSections.has("details") ? "rotate-180" : ""}`}
									/>
								</button>
							</Collapsible.Trigger>
							<Collapsible.Content className="options-section-content">
								<div className="details-grid">
									<div className="details-item">
										<div className="details-label">File Size</div>
										<div className="details-value">
											{formatFileSize(documentData.fileSize)}
										</div>
									</div>
									<div className="details-item">
										<div className="details-label">Pages</div>
										<div className="details-value">
											{documentData.pageCount || numPages || "—"}
										</div>
									</div>
									<div className="details-item">
										<div className="details-label">Uploaded</div>
										<div className="details-value">
											{formatDate(documentData.createdAt)}
										</div>
									</div>
									<div className="details-item">
										<div className="details-label">Fields</div>
										<div className="details-value">
											{signatureFields.length}
										</div>
									</div>
								</div>
								{documentData.description && (
									<div
										className="details-item mt-4"
										style={{ gridColumn: "1 / -1" }}
									>
										<div className="details-label">Description</div>
										<div className="details-value">
											{documentData.description}
										</div>
									</div>
								)}
							</Collapsible.Content>
						</Collapsible.Root>

						{/* Activity Section */}
						<Collapsible.Root
							open={openSections.has("activity")}
							onOpenChange={() => toggleSection("activity")}
							className="options-section section-activity"
						>
							<Collapsible.Trigger asChild>
								<button type="button" className="options-section-header">
									<div className="section-title-group">
										<div className="section-icon">
											<ActivityIcon />
										</div>
										<span className="section-title">Activity</span>
										{activityEvents.length > 0 && (
											<span className="section-count">
												{activityEvents.length}
											</span>
										)}
									</div>
									<ChevronDownIcon
										className={`section-chevron h-4 w-4 transition-transform ${openSections.has("activity") ? "rotate-180" : ""}`}
									/>
								</button>
							</Collapsible.Trigger>
							<Collapsible.Content className="options-section-content">
								{activityEvents.length > 0 ? (
									<div className="activity-timeline">
										{activityEvents.slice(0, 10).map((event, index) => (
											<div
												key={`${event.type}-${event.timestamp}`}
												className={`activity-item type-${event.type}`}
												style={{ animationDelay: `${index * 0.05}s` }}
											>
												<div className="activity-dot">
													{getActivityIcon(event.type)}
												</div>
												<div className="activity-content">
													<div className="activity-description">
														{event.description}
													</div>
													<div className="activity-timestamp">
														{formatRelativeTime(event.timestamp)}
													</div>
												</div>
											</div>
										))}
									</div>
								) : (
									<div className="empty-state">
										<div className="empty-icon">
											<ActivityIcon className="h-6 w-6" />
										</div>
										<div className="empty-title">No activity yet</div>
										<div className="empty-description">
											Activity will appear here as recipients interact with this
											document.
										</div>
									</div>
								)}
							</Collapsible.Content>
						</Collapsible.Root>
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

				{/* Field options dialog for checkbox/dropdown/radio */}
				{pendingFieldData &&
					(pendingFieldData.fieldType === "checkbox" ||
						pendingFieldData.fieldType === "dropdown" ||
						pendingFieldData.fieldType === "radio") && (
						<FieldOptionsDialog
							open={showFieldOptions}
							onOpenChange={(open) => {
								if (!open) handleFieldOptionsCancel();
							}}
							fieldType={pendingFieldData.fieldType}
							onConfirm={handleFieldOptionsConfirm}
							initialConfig={pendingFieldOptions ?? undefined}
						/>
					)}

				{/* Send document dialog */}
				<SendDocumentDialog
					documentId={documentId as Id<"documents">}
					documentName={documentData.name}
					recipients={recipients}
					signatureFieldCount={signatureFieldCount}
					open={sendDocumentOpen}
					onOpenChange={setSendDocumentOpen}
					onSuccess={() => {
						refetchDocument();
						refetchRecipients();
					}}
				/>

				<DeleteFieldDialog
					open={showFieldDeleteDialog}
					onOpenChange={setShowFieldDeleteDialog}
					onConfirm={handleFieldDeleteConfirm}
					fieldType={
						selectedFieldId
							? placedFields.find((f) => f.id === selectedFieldId)?.fieldType
							: undefined
					}
				/>
			</div>
		</PageWrapper>
	);
}
