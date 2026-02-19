import { useUser } from "@clerk/clerk-react";
import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useRouteContext, useRouter } from "@tanstack/react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  ActivityIcon,
  ArrowLeftIcon,
  ChevronDownIcon,
  FileSignatureIcon,
  FileTextIcon,
  InfoIcon,
  LoaderIcon,
  PlusIcon,
  SaveIcon,
  SendIcon,
  SettingsIcon,
  SparklesIcon,
  UserIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Document, pdfjs } from "react-pdf";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import { toast } from "sonner";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { PageWrapper } from "@/components/page-wrapper";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDate, formatFileSize, formatRelativeTime, getInitials } from "@/lib/formatting";
import { countSignatureFields } from "@/lib/signature-fields";
import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";

import { AddMyselfDialog } from "../../../../components/documents/add-myself-dialog";
import { AddRecipientDialog } from "../../../../components/documents/add-recipient-dialog";
import {
  AIFieldOverlays,
  AIFieldReviewBar,
  useAIFieldSuggestions,
} from "../../../../components/documents/ai-field-suggestions";
import { AIChatPanel } from "../../../../components/documents/ai-chat-panel";
import { useDocumentThread } from "../../../../components/documents/hooks/use-document-thread";
import { DeleteFieldDialog } from "../../../../components/documents/delete-field-dialog";
import { DocumentProgressRing } from "../../../../components/documents/document-progress-ring";
import { DocumentStatusHero } from "../../../../components/documents/document-status-hero";
import {
  FIELD_DIMENSIONS,
  type PlacedField,
} from "../../../../components/documents/draggable-field";
import { FieldList } from "../../../../components/documents/field-list";
import {
  type FieldOptionsConfig,
  FieldOptionsDialog,
} from "../../../../components/documents/field-options-dialog";
import { FieldPropertiesDialog } from "../../../../components/documents/field-properties-dialog";
import type { FieldType } from "../../../../components/documents/field-toolbar";
import { FieldToolbar } from "../../../../components/documents/field-toolbar";
import { InAppSigningSection } from "../../../../components/documents/in-app-signing-section";
import { PaymentConfigModal } from "../../../../components/documents/payment-config-modal";
import { PdfPageWithCanvas } from "../../../../components/documents/pdf-page-with-canvas";
import { PdfViewerControls } from "../../../../components/documents/pdf-viewer-controls";
import { RecipientOptionsDialog } from "../../../../components/documents/recipient-options-dialog";
import { RecipientSelectorDialog } from "../../../../components/documents/recipient-selector-dialog";
import { RemoveRecipientDialog } from "../../../../components/documents/remove-recipient-dialog";
import { SaveAsTemplateDialog } from "../../../../components/documents/save-as-template-dialog";
import { SendDocumentDialog } from "../../../../components/documents/send-document-dialog";
import { Button } from "../../../../components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../../../components/ui/collapsible";

// SEA-72: Configure PDF.js worker
// Use unpkg CDN which has reliable pdf.js worker files
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export const Route = createFileRoute("/_authenticated/$slug/documents/$documentId")({
  component: DocumentDetailPage,
});

function DocumentDetailPage() {
  const { slug, documentId } = Route.useParams();
  const router = useRouter();
  const [addRecipientOpen, setAddRecipientOpen] = useState(false);
  const [addMyselfOpen, setAddMyselfOpen] = useState(false);
  const [removeRecipientOpen, setRemoveRecipientOpen] = useState(false);
  const [recipientToRemove, setRecipientToRemove] = useState<{
    id: Id<"document_recipients">;
    email: string;
    name?: string;
    role: string;
    fieldCount: number;
  } | null>(null);
  const [recipientOptionsOpen, setRecipientOptionsOpen] = useState(false);
  const [selectedRecipientForOptions, setSelectedRecipientForOptions] = useState<{
    _id: Id<"document_recipients">;
    email: string;
    name?: string;
    role: "signer" | "viewer" | "approver";
    status: "pending" | "viewed" | "signed" | "approved" | "declined";
    signingToken?: string;
  } | null>(null);
  const [sendDocumentOpen, setSendDocumentOpen] = useState(false);
  const [saveAsTemplateOpen, setSaveAsTemplateOpen] = useState(false);

  // SEA-72: PDF viewer state
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  // SEA-78: Current page for navigation
  const [currentPage, setCurrentPage] = useState(1);

  // SEA-84: Responsive PDF width with window resize handling
  const [pdfWidth, setPdfWidth] = useState(700);
  const [pdfHeight, setPdfHeight] = useState(900); // Default height, updated on page load
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // SEA-89: Field drag state
  const [draggingFieldType, setDraggingFieldType] = useState<FieldType | null>(null);

  // Zoom state for PDF viewer
  const [currentZoom, setCurrentZoom] = useState(1);

  // SEA-90: Field placement state
  const [placedFields, setPlacedFields] = useState<PlacedField[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [showFieldDeleteDialog, setShowFieldDeleteDialog] = useState(false);

  // Recipient selector for field assignment
  const [showRecipientSelector, setShowRecipientSelector] = useState(false);
  const [selectedRecipientId, setSelectedRecipientId] = useState<Id<"document_recipients"> | null>(
    null,
  );
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
  const [pendingFieldOptions, setPendingFieldOptions] = useState<FieldOptionsConfig | null>(null);

  // Pending field name from recipient selector dialog
  const [pendingFieldName, setPendingFieldName] = useState<string | null>(null);

  // Field properties dialog
  const [showFieldProperties, setShowFieldProperties] = useState(false);
  const [fieldPropertiesId, setFieldPropertiesId] = useState<string | null>(null);

  // Payment config modal
  const [showPaymentConfigModal, setShowPaymentConfigModal] = useState(false);
  const [paymentConfigFieldId, setPaymentConfigFieldId] = useState<Id<"signature_fields"> | null>(
    null,
  );

  const { data: documentData, refetch: refetchDocument } = useSuspenseQuery(
    convexQuery(api.documents.queries.getDocument, {
      documentId: documentId as Id<"documents">,
    }),
  );

  const { data: recipients = [], refetch: refetchRecipients } = useSuspenseQuery(
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
  const { data: signatureFields = [], refetch: refetchFields } = useSuspenseQuery(
    convexQuery(api.signature_fields.queries.getFieldsByDocument, {
      documentId: documentId as Id<"documents">,
    }),
  );
  const signatureFieldCount = countSignatureFields(signatureFields);

  // Load signatures to display filled signature images
  const { data: documentSignatures = [] } = useSuspenseQuery(
    convexQuery(api.signatures.queries.getSignaturesByDocument, {
      documentId: documentId as Id<"documents">,
    }),
  );

  // Load payment configs for canvas display (shows total amount on payment fields)
  const { data: paymentConfigs = [] } = useSuspenseQuery(
    convexQuery(api.payment_fields.queries.getPaymentConfigsByDocument, {
      documentId: documentId as Id<"documents">,
    }),
  );

  const paymentConfigByFieldId = useMemo(() => {
    const map = new Map<
      string,
      { totalAmountCents: number; currency: string; paymentType: string; paymentStatus?: string }
    >();
    for (const config of paymentConfigs) {
      map.set(config.fieldId, {
        totalAmountCents: config.totalAmountCents,
        currency: config.currency,
        paymentType: config.paymentType,
        paymentStatus: config.paymentStatus,
      });
    }
    return map;
  }, [paymentConfigs]);

  const recipientsById = useMemo(() => {
    return new Map(recipients.map((recipient) => [recipient._id, recipient]));
  }, [recipients]);

  // In-app signing: Get current user's recipient record (if they are a recipient)
  const { data: currentUserRecipient, refetch: refetchCurrentUserRecipient } = useSuspenseQuery(
    convexQuery(api.documents.recipients_queries.getRecipientByAuthenticatedUser, {
      documentId: documentId as Id<"documents">,
    }),
  );

  // In-app signing: Get fields assigned to current user (if they are a recipient)
  const { data: currentUserFields = [], refetch: refetchCurrentUserFields } = useSuspenseQuery(
    convexQuery(api.signature_fields.queries.getFieldsForAuthenticatedRecipient, {
      documentId: documentId as Id<"documents">,
    }),
  );

  // Stripe connected account status for payment fields
  const connectedAccount = useQuery(api.stripe.connect_queries.getConnectedAccount, {
    slug,
  }) as { status: string; account: { chargesEnabled: boolean } | null } | undefined;
  const stripeConnected =
    connectedAccount?.status === "connected" &&
    (connectedAccount?.account?.chargesEnabled ?? false);

  // Create a map of fieldId to signature data for easy lookup (memoized to prevent infinite loops)
  const signaturesByFieldId = useMemo(
    () =>
      new Map(
        documentSignatures.map((signature) => {
          const signer = recipientsById.get(signature.recipientId);

          return [
            signature.fieldId,
            {
              signatureImageUrl: signature.signatureImageUrl,
              value: signature.value,
              signedAt: signature.signedAt,
              signatureMethod: signature.signatureMethod,
              signerName: signer?.name,
              signerEmail: signer?.email,
            },
          ];
        }),
      ),
    [documentSignatures, recipientsById],
  );

  // Compute field counts per recipient for the send dialog
  const fieldCountsByRecipient = new Map<string, number>();
  for (const field of signatureFields) {
    if (field.recipientId) {
      const count = fieldCountsByRecipient.get(field.recipientId) ?? 0;
      fieldCountsByRecipient.set(field.recipientId, count + 1);
    }
  }

  const removeRecipient = useMutation(api.documents.recipients_mutations.removeRecipient);
  const addRecipients = useMutation(api.documents.recipients_mutations.addRecipients);

  // Current user for "Add myself" functionality
  const { user } = useUser();

  // SEA-91: Field mutations
  const createField = useMutation(api.signature_fields.mutations.createField);
  const repositionField = useMutation(api.signature_fields.mutations.repositionField);
  const deleteField = useMutation(api.signature_fields.mutations.deleteField);

  // SEA-72: Fetch PDF URL on mount
  const { convexClient } = useRouteContext({ from: "__root__" });
  useEffect(() => {
    const fetchPdfUrl = async () => {
      try {
        const url = await convexClient.query(api.documents.queries.getDocumentUrl, {
          documentId: documentId as Id<"documents">,
        });
        setPdfUrl(url);
      } catch (_error) {
        toast.error("Failed to load PDF");
      }
    };
    fetchPdfUrl();
  }, [convexClient, documentId]);

  // SEA-91: Sync database fields to local state, including signature data
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
      paymentTotalCents: paymentConfigByFieldId.get(field._id)?.totalAmountCents,
      signatureData: signaturesByFieldId.get(field._id),
    }));
    setPlacedFields(fields);
  }, [signatureFields, signaturesByFieldId, paymentConfigByFieldId]);

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

  // Resend email action
  const resendRecipientEmail = useAction(api.documents.send_document_action.resendRecipientEmail);

  // AI field analysis + chat
  const aiSuggestions = useAIFieldSuggestions(documentId as Id<"documents">);
  const { threadId, getOrCreateThread, isCreating: isAnalyzing } = useDocumentThread(
    documentId as Id<"documents">,
  );
  const [showAIChat, setShowAIChat] = useState(false);
  const sendMessageMutation = useMutation(api.ai.threads.sendMessage);

  const handleAnalyzeWithAI = useCallback(async () => {
    // If thread already exists, just open the chat panel
    if (threadId) {
      setShowAIChat(true);
      return;
    }

    try {
      const tid = await getOrCreateThread();
      setShowAIChat(true);
      // Send the initial analysis prompt for new threads
      await sendMessageMutation({
        threadId: tid,
        prompt: `Analyze the document with ID "${documentId}" and detect all form fields that should be placed on it.`,
      });
    } catch {
      toast.error("AI analysis failed. Please try again.");
    }
  }, [threadId, getOrCreateThread, sendMessageMutation, documentId]);

  // SEA-72: PDF document load handlers
  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  // SEA-78: Page navigation handler - updates current page for single-page view
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  // SEA-91: Page dimensions handler - captures first page dimensions for coordinate conversion
  const handlePageDimensions = (pageNumber: number, _width: number, height: number) => {
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

    // Check if we have signers (only signers can have fields assigned)
    const signers = recipients.filter((r) => r.role === "signer");
    if (signers.length === 0) {
      toast.error(
        "Please add at least one signer before placing fields. Approvers and viewers cannot have fields assigned.",
      );
      setDraggingFieldType(null);
      return;
    }

    // Get the container and calculate drop position
    const container = containerRef.current;
    if (!container) return;

    // With single-page view, there's only one page element rendered at a time
    // The target page is always the currentPage being displayed
    const targetPageNumber = currentPage;
    const targetPageElement = container.querySelector(".react-pdf__Page");

    if (!targetPageElement) {
      toast.error("Could not determine drop location");
      setDraggingFieldType(null);
      return;
    }

    // Calculate coordinates relative to the actual page element
    const pageRect = targetPageElement.getBoundingClientRect();

    // Get field dimensions based on type
    const { width: widthPixels, height: heightPixels } = FIELD_DIMENSIONS[fieldType];

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

    // Pre-select first signer if available
    if (signers.length > 0) {
      setSelectedRecipientId(signers[0]._id);
    }

    setShowRecipientSelector(true);
    setDraggingFieldType(null);
  };

  // Helper to format field type as label
  const formatFieldTypeLabel = (fieldType: FieldType): string => {
    const typeLabels: Record<FieldType, string> = {
      signature: "Signature",
      text: "Text",
      number: "Number",
      date: "Date",
      checkbox: "Checkbox",
      dropdown: "Dropdown",
      radio: "Radio",
      attachment: "Attachment",
      payment: "Payment",
    };
    return `${typeLabels[fieldType]} Field`;
  };

  // Check if field type requires options configuration
  const fieldTypeRequiresOptions = (fieldType: FieldType): boolean => {
    return fieldType === "checkbox" || fieldType === "dropdown" || fieldType === "radio";
  };

  // Handle field creation after recipient selection
  const handleConfirmFieldPlacement = async (fieldName: string) => {
    if (!pendingFieldData || !selectedRecipientId) return;

    // Store the field name for use in createFieldWithOptions
    setPendingFieldName(fieldName);

    // For checkbox, dropdown, radio - show options dialog first
    if (fieldTypeRequiresOptions(pendingFieldData.fieldType)) {
      setShowRecipientSelector(false);
      setShowFieldOptions(true);
      return;
    }

    // For other field types, create immediately
    await createFieldWithOptions(null, fieldName);
  };

  // Handle field options confirmation
  const handleFieldOptionsConfirm = async (config: FieldOptionsConfig) => {
    setPendingFieldOptions(config);
    setShowFieldOptions(false);
    await createFieldWithOptions(config, pendingFieldName);
  };

  // Handle field options cancel
  const handleFieldOptionsCancel = () => {
    setShowFieldOptions(false);
    // Clear all pending data
    setPendingFieldData(null);
    setSelectedRecipientId(null);
    setPendingFieldOptions(null);
    setPendingFieldName(null);
    setDraggingFieldType(null);
  };

  // Create field with optional options configuration
  const createFieldWithOptions = async (
    optionsConfig: FieldOptionsConfig | null,
    fieldName?: string | null,
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

      // Use provided field name or fall back to default
      const label = fieldName || formatFieldTypeLabel(pendingFieldData.fieldType);

      // Save field to database with percentage coordinates
      const fieldId = await createField({
        documentId: documentId as Id<"documents">,
        recipientId: selectedRecipientId as Id<"document_recipients">,
        fieldType: pendingFieldData.fieldType,
        label,
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

      // Auto-open payment config modal for newly created payment fields
      if (pendingFieldData.fieldType === "payment") {
        setPaymentConfigFieldId(fieldId);
        setShowPaymentConfigModal(true);
      }

      // Refetch fields to sync with database
      await refetchFields();

      toast.success(`${label} assigned to recipient`);

      // Close dialog and clear pending data
      setShowRecipientSelector(false);
      setPendingFieldData(null);
      setSelectedRecipientId(null);
      setPendingFieldOptions(null);
      setPendingFieldName(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create field";
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
      prev.map((field) => (field.id === fieldId ? { ...field, x, y, width, height } : field)),
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
      const errorMessage = error instanceof Error ? error.message : "Failed to update field";
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
      const errorMessage = error instanceof Error ? error.message : "Failed to delete field";
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

  const openRemoveRecipientDialog = (recipient: {
    _id: Id<"document_recipients">;
    email: string;
    name?: string;
    role: string;
  }) => {
    // Count fields assigned to this recipient
    const fieldCount = signatureFields.filter((f) => f.recipientId === recipient._id).length;

    setRecipientToRemove({
      id: recipient._id,
      email: recipient.email,
      name: recipient.name,
      role: recipient.role,
      fieldCount,
    });
    setRemoveRecipientOpen(true);
  };

  const handleRemoveRecipientConfirm = async () => {
    if (!recipientToRemove) return;

    try {
      await removeRecipient({ recipientId: recipientToRemove.id });
      const hasFields = recipientToRemove.fieldCount > 0;
      toast.success(
        hasFields
          ? `Recipient and ${recipientToRemove.fieldCount} ${recipientToRemove.fieldCount === 1 ? "field" : "fields"} removed`
          : "Recipient removed",
      );
      setRemoveRecipientOpen(false);
      setRecipientToRemove(null);
      refetchRecipients();
      refetchFields(); // Also refetch fields since they may have been deleted
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to remove recipient";
      toast.error(errorMessage);
      setRemoveRecipientOpen(false);
      setRecipientToRemove(null);
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
      toast.error(error instanceof Error ? error.message : "Failed to resend email");
    }
  };

  // Check if current user is already a recipient
  const userEmail = user?.primaryEmailAddress?.emailAddress?.toLowerCase();
  const isUserAlreadyRecipient = userEmail
    ? recipients.some((r) => r.email.toLowerCase() === userEmail)
    : false;

  const handleAddMyselfConfirm = async () => {
    if (!user?.primaryEmailAddress?.emailAddress) {
      toast.error("Could not get your email address");
      setAddMyselfOpen(false);
      return;
    }

    try {
      await addRecipients({
        documentId: documentId as Id<"documents">,
        recipients: [
          {
            email: user.primaryEmailAddress.emailAddress,
            name: user.fullName || undefined,
            role: "signer",
          },
        ],
      });
      toast.success("Added yourself as a signer");
      setAddMyselfOpen(false);
      refetchRecipients();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to add yourself";
      toast.error(errorMessage);
      setAddMyselfOpen(false);
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
    new Set(["fields", "recipients", "your-signature", "invoice"]),
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

  // Only edit active documents that are in draft workflow status
  const canEdit =
    documentData.status === "active" &&
    (documentData.workflowStatus === "draft" || !documentData.workflowStatus);

  // Check if document can be sent
  const getSendDocumentValidation = () => {
    // Basic checks
    if (documentData.workflowStatus !== "draft" || recipients.length === 0 || !canEdit) {
      return {
        canSend: false,
        tooltip: "Document must be in draft status with recipients and edit permissions to send",
      };
    }

    // Check for unassigned fields (e.g. from templates)
    const unassignedFields = signatureFields.filter((f) => !f.recipientId);
    if (unassignedFields.length > 0) {
      return {
        canSend: false,
        tooltip: `${unassignedFields.length} field(s) are not assigned to a recipient. Assign all fields before sending.`,
      };
    }

    // Check that all signers have at least one signature field
    const signers = recipients.filter((r) => r.role === "signer");
    const signersWithoutFields = signers.filter(
      (signer) => !signatureFields.some((field) => field.recipientId === signer._id),
    );

    if (signersWithoutFields.length > 0) {
      const signerNames = signersWithoutFields.map((s) => s.name || s.email).join(", ");
      return {
        canSend: false,
        tooltip: `The following signers need at least one signature field: ${signerNames}`,
      };
    }

    return { canSend: true };
  };

  const sendDocumentValidation = getSendDocumentValidation();

  // Create conditional buttons
  const analyzeWithAIButton = canEdit ? (
    <Button
      key="analyze-ai"
      onClick={handleAnalyzeWithAI}
      disabled={isAnalyzing}
      size="sm"
      variant="outline"
      className="flex-1 border-violet-200 text-violet-700 hover:bg-violet-50 sm:flex-none dark:border-violet-800 dark:text-violet-400 dark:hover:bg-violet-950"
    >
      {isAnalyzing ? (
        <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <SparklesIcon className="mr-2 h-4 w-4" />
      )}
      <span className="truncate">{isAnalyzing ? "Analyzing..." : "Analyze with AI"}</span>
    </Button>
  ) : null;

  const saveAsTemplateButton =
    canEdit && signatureFields.length > 0 ? (
      <Button
        key="save-template"
        onClick={() => setSaveAsTemplateOpen(true)}
        size="sm"
        variant="outline"
        className="flex-1 sm:flex-none"
      >
        <SaveIcon className="mr-2 h-4 w-4" />
        <span className="truncate">Save as Template</span>
      </Button>
    ) : null;

  const sendDocumentButton = sendDocumentValidation.canSend ? (
    <Button
      key="send-document"
      onClick={() => setSendDocumentOpen(true)}
      size="sm"
      className="flex-1 sm:flex-none"
    >
      <SendIcon className="mr-2 h-4 w-4" />
      <span className="truncate">Send Document</span>
    </Button>
  ) : (
    <Tooltip key="send-document">
      <TooltipTrigger asChild>
        <Button disabled size="sm" className="flex-1 sm:flex-none">
          <SendIcon className="mr-2 h-4 w-4" />
          <span className="truncate">Send Document</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{sendDocumentValidation.tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );

  return (
    <PageWrapper
      title={documentData.name}
      headerActions={
        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
          <Button
            onClick={() => router.navigate({ to: "/$slug/documents", params: { slug } })}
            variant="ghost"
            size="sm"
            className="flex-1 sm:flex-none"
          >
            <ArrowLeftIcon className="mr-2 h-4 w-4" />
            <span className="truncate">Back</span>
          </Button>
          {sendDocumentButton}
          {analyzeWithAIButton}
          {saveAsTemplateButton}
        </div>
      }
    >
      <div className="space-y-6">
        {/* Main content grid with PDF preview */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left column: PDF Preview */}
          <div className="lg:col-span-2">
            <div className="relative min-h-[600px] rounded-2xl bg-stone-100 p-6 sm:min-h-[400px] sm:rounded-xl sm:p-3 md:p-4 dark:bg-stone-900">
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
                  <div className="mb-3 flex flex-col gap-2 sm:mb-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <div className="flex items-center gap-2 font-serif text-base font-medium text-stone-800 sm:gap-3 sm:text-lg dark:text-stone-200">
                      <span>Document Preview</span>
                    </div>

                    <PdfViewerControls
                      currentZoom={currentZoom}
                      currentPage={currentPage}
                      totalPages={numPages ?? 1}
                      onPageChange={handlePageChange}
                      enableKeyboardShortcuts={true}
                      className="w-full justify-center sm:w-auto sm:justify-start"
                    />
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
                      className={`relative overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm transition-all duration-300 dark:border-slate-700 dark:bg-slate-900 ${draggingFieldType ? "scale-[1.002] border-blue-500 shadow-lg ring-4 ring-blue-500/10" : ""}`}
                    >
                      <Document
                        file={pdfUrl}
                        onLoadSuccess={onDocumentLoadSuccess}
                        loading={
                          <div className="p-16 text-center" style={{ color: "hsl(220 10% 55%)" }}>
                            <div className="animate-pulse">Loading document...</div>
                          </div>
                        }
                        error={
                          <div className="p-16 text-center" style={{ color: "hsl(0 65% 50%)" }}>
                            Failed to load document
                          </div>
                        }
                      >
                        {/* Single page view - only render current page */}
                        <PdfPageWithCanvas
                          key={`page_${currentPage}`}
                          pageNumber={currentPage}
                          width={pdfWidth}
                          renderTextLayer={true}
                          renderAnnotationLayer={true}
                          fields={placedFields}
                          selectedFieldId={canEdit ? selectedFieldId : null}
                          onFieldSelect={canEdit ? handleFieldSelect : undefined}
                          onFieldUpdate={canEdit ? handleFieldUpdate : undefined}
                          onPageDimensions={handlePageDimensions}
                          onPageRef={(pageNumber, element) => {
                            if (element) {
                              pageRefs.current.set(pageNumber, element);
                            } else {
                              pageRefs.current.delete(pageNumber);
                            }
                          }}
                        />
                      </Document>

                      {/* AI field suggestion overlays — inside TransformComponent so they zoom with PDF */}
                      {canEdit && aiSuggestions.suggestions && (
                        <AIFieldOverlays
                          suggestions={aiSuggestions.suggestions}
                          selectedIndices={aiSuggestions.selectedIndices}
                          toggleField={aiSuggestions.toggleField}
                          currentPage={currentPage}
                          pdfPageWidth={pdfWidth}
                          pdfPageHeight={pdfHeight}
                        />
                      )}
                    </div>
                  </TransformComponent>

                  {/* AI review bar — outside TransformComponent so it stays at fixed size */}
                  {canEdit && aiSuggestions.suggestions && (
                    <div className="mt-3">
                      <AIFieldReviewBar
                        suggestions={aiSuggestions.suggestions}
                        selectedIndices={aiSuggestions.selectedIndices}
                        isApplying={aiSuggestions.isApplying}
                        selectAll={aiSuggestions.selectAll}
                        selectHighConfidence={aiSuggestions.selectHighConfidence}
                        handleApply={aiSuggestions.handleApply}
                        handleDismiss={aiSuggestions.handleDismiss}
                      />
                    </div>
                  )}
                </TransformWrapper>
              ) : (
                <>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 font-serif text-lg font-medium text-stone-800 sm:flex-wrap sm:text-base dark:text-stone-200">
                      <span>Document Preview</span>
                      {numPages && (
                        <span className="rounded-full bg-stone-200 px-2.5 py-1 font-sans text-xs font-medium text-stone-500 dark:bg-stone-700 dark:text-stone-400">
                          {numPages} {numPages === 1 ? "page" : "pages"}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="relative overflow-hidden rounded-lg border border-stone-200 bg-white p-16 text-center text-stone-500 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-stone-400">
                    <div className="animate-pulse">Loading document...</div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right column: Document Options Panel */}
          <div>
            <div className="flex flex-col gap-5 sm:gap-4">
              {/* Status Hero */}
              <DocumentStatusHero
                workflowStatus={documentData.workflowStatus}
                createdAt={documentData.createdAt}
              />

              {/* Progress Ring - Only show when document is sent */}
              {progress && documentData.workflowStatus !== "draft" && (
                <DocumentProgressRing progress={progress} />
              )}

              {/* In-App Signing Section - Show when user is a recipient who needs to sign */}
              {currentUserRecipient &&
                documentData.workflowStatus !== "draft" &&
                documentData.workflowStatus !== "completed" &&
                (currentUserRecipient.role === "signer" ||
                  currentUserRecipient.role === "approver") && (
                  <InAppSigningSection
                    documentId={documentId as Id<"documents">}
                    recipient={currentUserRecipient}
                    fields={currentUserFields.filter(
                      (f): f is typeof f & { recipientId: Id<"document_recipients"> } =>
                        !!f.recipientId,
                    )}
                    isOpen={openSections.has("your-signature")}
                    onOpenChange={() => toggleSection("your-signature")}
                    onFieldsRefetch={() => {
                      refetchCurrentUserFields();
                      refetchCurrentUserRecipient();
                      refetchRecipients();
                      refetchFields();
                    }}
                  />
                )}

              {/* Recipients Section */}
              <Collapsible
                open={openSections.has("recipients")}
                onOpenChange={() => toggleSection("recipients")}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:rounded-xl dark:border-slate-700 dark:bg-slate-900"
              >
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full cursor-pointer items-center justify-between px-5 py-4 transition-colors select-none hover:bg-slate-50 sm:px-4 sm:py-3.5 dark:hover:bg-slate-800"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-blue-100 text-blue-600 sm:h-8 sm:w-8 sm:rounded-lg dark:bg-blue-900 dark:text-blue-400">
                        <UsersIcon className="h-[18px] w-[18px] sm:h-4 sm:w-4" />
                      </div>
                      <span className="font-sans text-[0.9375rem] font-semibold text-slate-800 sm:text-sm dark:text-slate-200">
                        Recipients
                      </span>
                      {recipients.length > 0 && (
                        <span className="ml-2 rounded-xl bg-slate-100 px-2 py-0.5 font-sans text-[0.6875rem] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                          {recipients.length}
                        </span>
                      )}
                    </div>
                    <ChevronDownIcon
                      className={`h-4 w-4 text-slate-500 transition-transform dark:text-slate-400 ${openSections.has("recipients") ? "rotate-180" : ""}`}
                    />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="border-t border-slate-100 px-5 pb-5 sm:px-4 sm:pb-4 dark:border-slate-800">
                  {canEdit && !isUserAlreadyRecipient && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 mb-3 w-full"
                      onClick={() => setAddMyselfOpen(true)}
                    >
                      <UserIcon className="mr-2 h-4 w-4" />
                      Add myself as signer
                    </Button>
                  )}
                  {recipients.length > 0 ? (
                    <div className="mt-4 flex flex-col gap-2.5 sm:gap-2">
                      {recipients.map((recipient) => (
                        <div
                          key={recipient._id}
                          className="flex items-center gap-3.5 rounded-xl border border-transparent bg-slate-50 p-3.5 transition-all hover:border-slate-200 hover:bg-slate-100 sm:flex-wrap sm:gap-2.5 sm:p-3 dark:bg-slate-800 dark:hover:border-slate-600 dark:hover:bg-slate-700"
                        >
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-sans text-sm font-semibold sm:h-9 sm:w-9 sm:text-[0.8125rem] ${
                              recipient.status === "pending"
                                ? "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                                : recipient.status === "viewed"
                                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                                  : recipient.status === "signed" || recipient.status === "approved"
                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                                    : recipient.status === "declined"
                                      ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                                      : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                            }`}
                          >
                            {getInitials(recipient.name, recipient.email)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-sans text-sm font-semibold text-slate-800 sm:text-[0.8125rem] dark:text-slate-200">
                              {recipient.name || recipient.email}
                            </div>
                            {recipient.name && (
                              <div className="truncate font-sans text-xs text-slate-500 sm:text-[0.6875rem] dark:text-slate-400">
                                {recipient.email}
                              </div>
                            )}
                          </div>
                          <span
                            className={`rounded-full px-2.5 py-1 font-sans text-[0.6875rem] font-semibold whitespace-nowrap sm:px-2 sm:py-0.5 sm:text-[0.625rem] ${
                              recipient.status === "pending"
                                ? "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                                : recipient.status === "viewed"
                                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                                  : recipient.status === "signed" || recipient.status === "approved"
                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                                    : recipient.status === "declined"
                                      ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                                      : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                            }`}
                          >
                            {recipient.status.charAt(0).toUpperCase() + recipient.status.slice(1)}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => {
                              setSelectedRecipientForOptions({
                                _id: recipient._id,
                                email: recipient.email,
                                name: recipient.name,
                                role: recipient.role,
                                status: recipient.status,
                                signingToken:
                                  "signingToken" in recipient
                                    ? (recipient.signingToken as string)
                                    : undefined,
                              });
                              setRecipientOptionsOpen(true);
                            }}
                            title="Recipient options"
                          >
                            <SettingsIcon className="text-muted-foreground h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-8 text-center sm:px-3 sm:py-6">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500 sm:h-10 sm:w-10 sm:rounded-[10px] dark:bg-slate-800 dark:text-slate-400">
                        <UsersIcon className="h-6 w-6" />
                      </div>
                      <div className="mb-1 font-sans text-sm font-semibold text-slate-700 sm:text-[0.8125rem] dark:text-slate-300">
                        No recipients
                      </div>
                      <div className="font-sans text-xs leading-relaxed text-slate-500 sm:text-[0.6875rem] dark:text-slate-400">
                        Add recipients who need to sign or view this document.
                      </div>
                    </div>
                  )}
                  {canEdit && (
                    <button
                      type="button"
                      className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] border-2 border-dashed border-slate-200 bg-transparent p-3 font-sans text-[0.8125rem] font-semibold text-slate-500 transition-all hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 sm:rounded-lg sm:p-2.5 sm:text-xs dark:border-slate-700 dark:text-slate-400 dark:hover:border-blue-600 dark:hover:bg-blue-950 dark:hover:text-blue-400"
                      onClick={() => setAddRecipientOpen(true)}
                    >
                      <PlusIcon className="h-4 w-4" />
                      Add Recipient
                    </button>
                  )}
                </CollapsibleContent>
              </Collapsible>

              {/* AI Chat Panel - Shows when user opens AI assistant */}
              {canEdit && showAIChat && threadId && (
                <AIChatPanel
                  threadId={threadId}
                  onClose={() => setShowAIChat(false)}
                />
              )}

              {/* Signature Fields Section */}
              {(signatureFields.length > 0 || canEdit) && (
                <Collapsible
                  open={openSections.has("fields")}
                  onOpenChange={() => toggleSection("fields")}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:rounded-xl dark:border-slate-700 dark:bg-slate-900"
                >
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full cursor-pointer items-center justify-between px-5 py-4 transition-colors select-none hover:bg-slate-50 sm:px-4 sm:py-3.5 dark:hover:bg-slate-800"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-violet-100 text-violet-600 sm:h-8 sm:w-8 sm:rounded-lg dark:bg-violet-900 dark:text-violet-400">
                          <FileSignatureIcon className="h-[18px] w-[18px] sm:h-4 sm:w-4" />
                        </div>
                        <span className="font-sans text-[0.9375rem] font-semibold text-slate-800 sm:text-sm dark:text-slate-200">
                          Signature Fields
                        </span>
                        {signatureFields.length > 0 && (
                          <span className="ml-2 rounded-xl bg-slate-100 px-2 py-0.5 font-sans text-[0.6875rem] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            {signatureFields.length}
                          </span>
                        )}
                      </div>
                      <ChevronDownIcon
                        className={`h-4 w-4 text-slate-500 transition-transform duration-200 dark:text-slate-400 ${openSections.has("fields") ? "rotate-180" : ""}`}
                      />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="border-t border-slate-100 px-5 pb-5 sm:px-4 sm:pb-4 dark:border-slate-800">
                    {canEdit && (
                      <div className="mt-4 mb-4">
                        <FieldToolbar
                          onFieldDragStart={(fieldType) => setDraggingFieldType(fieldType)}
                          onFieldDragEnd={() => setDraggingFieldType(null)}
                          disabled={recipients.filter((r) => r.role === "signer").length === 0}
                          stripeConnected={stripeConnected}
                        />
                      </div>
                    )}
                    {signatureFields.length > 0 ? (
                      <FieldList
                        fields={signatureFields.map((f) => ({
                          ...f,
                          paymentConfig: paymentConfigByFieldId.get(f._id),
                        }))}
                        recipients={recipients}
                        selectedFieldId={canEdit ? selectedFieldId : null}
                        canEdit={canEdit}
                        onFieldSelect={canEdit ? handleFieldSelect : undefined}
                        onFieldDelete={canEdit ? requestFieldDelete : undefined}
                        onFieldProperties={
                          canEdit
                            ? (fieldId) => {
                                setFieldPropertiesId(fieldId);
                                setShowFieldProperties(true);
                              }
                            : undefined
                        }
                      />
                    ) : (
                      <div className="px-4 py-8 text-center sm:px-3 sm:py-6">
                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500 sm:h-10 sm:w-10 sm:rounded-[10px] dark:bg-slate-800 dark:text-slate-400">
                          <FileSignatureIcon className="h-6 w-6" />
                        </div>
                        <div className="mb-1 font-sans text-sm font-semibold text-slate-700 sm:text-[0.8125rem] dark:text-slate-300">
                          No fields yet
                        </div>
                        <div className="font-sans text-xs leading-relaxed text-slate-500 sm:text-[0.6875rem] dark:text-slate-400">
                          Drag fields from above onto the document to mark where recipients should
                          sign or fill in information.
                        </div>
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Document Details Section */}
              <Collapsible
                open={openSections.has("details")}
                onOpenChange={() => toggleSection("details")}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:rounded-xl dark:border-slate-700 dark:bg-slate-900"
              >
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full cursor-pointer items-center justify-between px-5 py-4 transition-colors select-none hover:bg-slate-50 sm:px-4 sm:py-3.5 dark:hover:bg-slate-800"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-teal-100 text-teal-600 sm:h-8 sm:w-8 sm:rounded-lg dark:bg-teal-900 dark:text-teal-400">
                        <InfoIcon className="h-[18px] w-[18px] sm:h-4 sm:w-4" />
                      </div>
                      <span className="font-sans text-[0.9375rem] font-semibold text-slate-800 sm:text-sm dark:text-slate-200">
                        Details
                      </span>
                    </div>
                    <ChevronDownIcon
                      className={`h-4 w-4 text-slate-500 transition-transform dark:text-slate-400 ${openSections.has("details") ? "rotate-180" : ""}`}
                    />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="border-t border-slate-100 px-5 pb-5 sm:px-4 sm:pb-4 dark:border-slate-800">
                  <div className="mt-4 grid grid-cols-2 gap-4 sm:gap-2.5">
                    <div className="rounded-[10px] bg-slate-50 p-3.5 sm:rounded-lg sm:p-3 dark:bg-slate-800">
                      <div className="mb-1 font-sans text-[0.625rem] font-semibold tracking-wide text-slate-500 uppercase sm:text-[0.5625rem] dark:text-slate-400">
                        File Size
                      </div>
                      <div className="font-sans text-sm font-medium text-slate-800 sm:text-[0.8125rem] dark:text-slate-200">
                        {formatFileSize(documentData.fileSize)}
                      </div>
                    </div>
                    <div className="rounded-[10px] bg-slate-50 p-3.5 sm:rounded-lg sm:p-3 dark:bg-slate-800">
                      <div className="mb-1 font-sans text-[0.625rem] font-semibold tracking-wide text-slate-500 uppercase sm:text-[0.5625rem] dark:text-slate-400">
                        Pages
                      </div>
                      <div className="font-sans text-sm font-medium text-slate-800 sm:text-[0.8125rem] dark:text-slate-200">
                        {documentData.pageCount || numPages || "—"}
                      </div>
                    </div>
                    <div className="rounded-[10px] bg-slate-50 p-3.5 sm:rounded-lg sm:p-3 dark:bg-slate-800">
                      <div className="mb-1 font-sans text-[0.625rem] font-semibold tracking-wide text-slate-500 uppercase sm:text-[0.5625rem] dark:text-slate-400">
                        Uploaded
                      </div>
                      <div className="font-sans text-sm font-medium text-slate-800 sm:text-[0.8125rem] dark:text-slate-200">
                        {formatDate(documentData.createdAt)}
                      </div>
                    </div>
                    <div className="rounded-[10px] bg-slate-50 p-3.5 sm:rounded-lg sm:p-3 dark:bg-slate-800">
                      <div className="mb-1 font-sans text-[0.625rem] font-semibold tracking-wide text-slate-500 uppercase sm:text-[0.5625rem] dark:text-slate-400">
                        Fields
                      </div>
                      <div className="font-sans text-sm font-medium text-slate-800 sm:text-[0.8125rem] dark:text-slate-200">
                        {signatureFields.length}
                      </div>
                    </div>
                  </div>
                  {documentData.description && (
                    <div className="col-span-2 mt-4 rounded-[10px] bg-slate-50 p-3.5 sm:rounded-lg sm:p-3 dark:bg-slate-800">
                      <div className="mb-1 font-sans text-[0.625rem] font-semibold tracking-wide text-slate-500 uppercase sm:text-[0.5625rem] dark:text-slate-400">
                        Description
                      </div>
                      <div className="font-sans text-sm font-medium text-slate-800 sm:text-[0.8125rem] dark:text-slate-200">
                        {documentData.description}
                      </div>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>

              {/* Activity Section */}
              <Collapsible
                open={openSections.has("activity")}
                onOpenChange={() => toggleSection("activity")}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:rounded-xl dark:border-slate-700 dark:bg-slate-900"
              >
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full cursor-pointer items-center justify-between px-5 py-4 transition-colors select-none hover:bg-slate-50 sm:px-4 sm:py-3.5 dark:hover:bg-slate-800"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-amber-100 text-amber-600 sm:h-8 sm:w-8 sm:rounded-lg dark:bg-amber-900 dark:text-amber-400">
                        <ActivityIcon className="h-[18px] w-[18px] sm:h-4 sm:w-4" />
                      </div>
                      <span className="font-sans text-[0.9375rem] font-semibold text-slate-800 sm:text-sm dark:text-slate-200">
                        Activity
                      </span>
                      {activityEvents.length > 0 && (
                        <span className="ml-2 rounded-xl bg-slate-100 px-2 py-0.5 font-sans text-[0.6875rem] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                          {activityEvents.length}
                        </span>
                      )}
                    </div>
                    <ChevronDownIcon
                      className={`h-4 w-4 text-slate-500 transition-transform dark:text-slate-400 ${openSections.has("activity") ? "rotate-180" : ""}`}
                    />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="border-t border-slate-100 px-5 pb-5 sm:px-4 sm:pb-4 dark:border-slate-800">
                  {activityEvents.length > 0 ? (
                    <div className="relative mt-4 before:absolute before:top-2 before:bottom-2 before:left-[15px] before:w-0.5 before:rounded-sm before:bg-slate-200 before:content-[''] sm:before:left-[13px] dark:before:bg-slate-700">
                      {activityEvents.slice(0, 10).map((event, index) => (
                        <div
                          key={`${event.type}-${event.timestamp}`}
                          className={`relative flex gap-4 py-3 first:pt-0 last:pb-0 ${
                            event.type === "signed" ||
                            event.type === "approved" ||
                            event.type === "completed"
                              ? "[&_.activity-dot]:border-emerald-300 [&_.activity-dot]:bg-emerald-50 [&_.activity-dot]:text-emerald-600 dark:[&_.activity-dot]:border-emerald-700 dark:[&_.activity-dot]:bg-emerald-950 dark:[&_.activity-dot]:text-emerald-400"
                              : event.type === "viewed"
                                ? "[&_.activity-dot]:border-blue-300 [&_.activity-dot]:bg-blue-50 [&_.activity-dot]:text-blue-600 dark:[&_.activity-dot]:border-blue-700 dark:[&_.activity-dot]:bg-blue-950 dark:[&_.activity-dot]:text-blue-400"
                                : event.type === "declined"
                                  ? "[&_.activity-dot]:border-red-300 [&_.activity-dot]:bg-red-50 [&_.activity-dot]:text-red-600 dark:[&_.activity-dot]:border-red-700 dark:[&_.activity-dot]:bg-red-950 dark:[&_.activity-dot]:text-red-400"
                                  : "[&_.activity-dot]:border-slate-200 [&_.activity-dot]:bg-white [&_.activity-dot]:text-slate-500 dark:[&_.activity-dot]:border-slate-700 dark:[&_.activity-dot]:bg-slate-900 dark:[&_.activity-dot]:text-slate-400"
                          }`}
                          style={{ animationDelay: `${index * 0.05}s` }}
                        >
                          <div className="activity-dot relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 sm:h-7 sm:w-7">
                            {getActivityIcon(event.type)}
                          </div>
                          <div className="min-w-0 flex-1 pt-1">
                            <div className="font-sans text-[0.8125rem] leading-snug text-slate-700 sm:text-xs dark:text-slate-300">
                              {event.description}
                            </div>
                            <div className="mt-1 font-sans text-[0.6875rem] text-slate-500 sm:text-[0.625rem] dark:text-slate-400">
                              {formatRelativeTime(event.timestamp)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-8 text-center sm:px-3 sm:py-6">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500 sm:h-10 sm:w-10 sm:rounded-[10px] dark:bg-slate-800 dark:text-slate-400">
                        <ActivityIcon className="h-6 w-6" />
                      </div>
                      <div className="mb-1 font-sans text-sm font-semibold text-slate-700 sm:text-[0.8125rem] dark:text-slate-300">
                        No activity yet
                      </div>
                      <div className="font-sans text-xs leading-relaxed text-slate-500 sm:text-[0.6875rem] dark:text-slate-400">
                        Activity will appear here as recipients interact with this document.
                      </div>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </div>
          </div>
        </div>

        <AddRecipientDialog
          documentId={documentId as Id<"documents">}
          organizationId={documentData.organizationId}
          open={addRecipientOpen}
          onOpenChange={setAddRecipientOpen}
          onSuccess={() => refetchRecipients()}
          existingRecipientEmails={recipients.map((r) => r.email)}
          currentUserEmail={userEmail}
        />

        {/* Add myself confirmation dialog */}
        <AddMyselfDialog
          open={addMyselfOpen}
          onOpenChange={setAddMyselfOpen}
          onConfirm={handleAddMyselfConfirm}
          userEmail={user?.primaryEmailAddress?.emailAddress}
          userName={user?.fullName || undefined}
        />

        {/* Remove recipient confirmation dialog */}
        <RemoveRecipientDialog
          open={removeRecipientOpen}
          onOpenChange={(open) => {
            setRemoveRecipientOpen(open);
            if (!open) setRecipientToRemove(null);
          }}
          onConfirm={handleRemoveRecipientConfirm}
          recipientEmail={recipientToRemove?.email}
          recipientName={recipientToRemove?.name}
          recipientRole={recipientToRemove?.role}
          fieldCount={recipientToRemove?.fieldCount}
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
          pageNumber={pendingFieldData?.page || 1}
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

        {/* Field properties dialog */}
        <FieldPropertiesDialog
          open={showFieldProperties}
          onOpenChange={(open) => {
            setShowFieldProperties(open);
            if (!open) setFieldPropertiesId(null);
          }}
          field={
            fieldPropertiesId
              ? (signatureFields.find((f) => f._id === fieldPropertiesId) ?? null)
              : null
          }
          recipients={recipients}
          onSave={() => {
            refetchFields();
          }}
          onConfigurePayment={(fieldId) => {
            setShowFieldProperties(false);
            setPaymentConfigFieldId(fieldId);
            setShowPaymentConfigModal(true);
          }}
        />

        {/* Payment config modal */}
        <PaymentConfigModal
          open={showPaymentConfigModal}
          onOpenChange={(open) => {
            setShowPaymentConfigModal(open);
            if (!open) setPaymentConfigFieldId(null);
          }}
          fieldId={paymentConfigFieldId}
        />

        {/* Send document dialog */}
        <SendDocumentDialog
          documentId={documentId as Id<"documents">}
          documentName={documentData.name}
          recipients={recipients}
          signatureFieldCount={signatureFieldCount}
          fieldCountsByRecipient={fieldCountsByRecipient}
          open={sendDocumentOpen}
          onOpenChange={setSendDocumentOpen}
          onSuccess={() => {
            refetchDocument();
            refetchRecipients();
          }}
        />

        {/* Save as template dialog */}
        <SaveAsTemplateDialog
          documentId={documentId as Id<"documents">}
          documentName={documentData.name}
          open={saveAsTemplateOpen}
          onOpenChange={setSaveAsTemplateOpen}
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

        {/* Recipient options dialog */}
        <RecipientOptionsDialog
          open={recipientOptionsOpen}
          onOpenChange={setRecipientOptionsOpen}
          recipient={selectedRecipientForOptions}
          documentStatus={documentData.workflowStatus}
          canEdit={canEdit}
          onResendEmail={handleResendEmail}
          onRemove={(recipient) => {
            openRemoveRecipientDialog(recipient);
          }}
        />
      </div>
    </PageWrapper>
  );
}
