import { convexQuery } from "@convex-dev/react-query";
import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { useSuspenseQuery } from "@tanstack/react-query";
import { type ErrorComponentProps, createFileRoute, useRouter } from "@tanstack/react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import {
  ArrowLeftIcon,
  EyeIcon,
  EyeOffIcon,
  Loader2Icon,
  MessageSquareIcon,
  SaveIcon,
  SendIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Document } from "react-pdf";
import { pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import { toast } from "sonner";

import { NotFoundPage } from "@/components/not-found-page";
import { PageWrapper } from "@/components/page-wrapper";
import { RouteErrorComponent } from "@/components/route-error-component";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCurrentUser as useUser } from "@/hooks/use-current-user";
import { useSubscriptionLimits } from "@/hooks/use-subscription-limits";
import { buildActivityEvents } from "@/lib/document-activity";
import { countSignatureFields } from "@/lib/signature-fields";
import { cn } from "@/lib/utils";

import { AddMyselfDialog } from "../../../../components/documents/add-myself-dialog";
import { AddRecipientDialog } from "../../../../components/documents/add-recipient-dialog";
import {
  AIAnnotationOverlays,
  useDocumentAnnotations,
} from "../../../../components/documents/ai-annotation-overlays";
import {
  AIFieldOverlays,
  AIFieldReviewBar,
  useAIFieldSuggestions,
} from "../../../../components/documents/ai-field-suggestions";
import { DeleteFieldDialog } from "../../../../components/documents/delete-field-dialog";
import { DocumentPresence } from "../../../../components/documents/document-presence";
import { DocumentSidebar } from "../../../../components/documents/document-sidebar";
import { FieldOptionsDialog } from "../../../../components/documents/field-options-dialog";
import { FieldPropertiesDialog } from "../../../../components/documents/field-properties-dialog";
import type { FieldType } from "../../../../components/documents/field-toolbar";
import { useDocumentState } from "../../../../components/documents/hooks/use-document-state";
import { useDocumentThread } from "../../../../components/documents/hooks/use-document-thread";
import { useFieldPlacement } from "../../../../components/documents/hooks/use-field-placement";
import { usePdfViewer } from "../../../../components/documents/hooks/use-pdf-viewer";
import { useSectionState } from "../../../../components/documents/hooks/use-section-state";
import { PaymentConfigModal } from "../../../../components/documents/payment-config-modal";
import { PdfPageWithCanvas } from "../../../../components/documents/pdf-page-with-canvas";
import { PdfViewerControls } from "../../../../components/documents/pdf-viewer-controls";
import { RecipientOptionsDialog } from "../../../../components/documents/recipient-options-dialog";
import { RecipientSelectorDialog } from "../../../../components/documents/recipient-selector-dialog";
import { RemoveRecipientDialog } from "../../../../components/documents/remove-recipient-dialog";
import { SaveAsTemplateDialog } from "../../../../components/documents/save-as-template-dialog";
import { SendDocumentDialog } from "../../../../components/documents/send-document-dialog";
import { Button } from "../../../../components/ui/button";

// SEA-72: Configure PDF.js worker
// Use unpkg CDN which has reliable pdf.js worker files
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export const Route = createFileRoute("/_authenticated/$slug/documents/$documentId")({
  component: DocumentDetailPage,
  errorComponent: DocumentErrorComponent,
  head: () => ({
    meta: [{ title: "Document - Seal" }, { name: "robots", content: "noindex, nofollow" }],
  }),
});

function DocumentErrorComponent(props: ErrorComponentProps) {
  const message =
    props.error instanceof ConvexError
      ? String(props.error.data)
      : props.error instanceof Error
        ? props.error.message
        : "";

  const isNotFound =
    message.includes("not found") ||
    message.includes("Could not find") ||
    message.includes("does not match validator");

  if (isNotFound) {
    return <NotFoundPage />;
  }

  return <RouteErrorComponent {...props} />;
}

function DocumentDetailPage() {
  const { slug, documentId } = Route.useParams();
  const router = useRouter();

  // ── Convex queries ──────────────────────────────────────────────────────
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

  const { data: signatureFields = [], refetch: refetchFields } = useSuspenseQuery(
    convexQuery(api.signature_fields.queries.getFieldsByDocument, {
      documentId: documentId as Id<"documents">,
    }),
  );

  const signatureFieldCount = countSignatureFields(signatureFields);

  const { data: documentSignatures = [] } = useSuspenseQuery(
    convexQuery(api.signatures.queries.getSignaturesByDocument, {
      documentId: documentId as Id<"documents">,
    }),
  );

  const { data: paymentConfigs = [] } = useSuspenseQuery(
    convexQuery(api.payment_fields.queries.getPaymentConfigsByDocument, {
      documentId: documentId as Id<"documents">,
    }),
  );

  const { data: currentUserRecipient, refetch: refetchCurrentUserRecipient } = useSuspenseQuery(
    convexQuery(api.documents.recipients_queries.getRecipientByAuthenticatedUser, {
      documentId: documentId as Id<"documents">,
    }),
  );

  const { data: currentUserFields = [], refetch: refetchCurrentUserFields } = useSuspenseQuery(
    convexQuery(api.signature_fields.queries.getFieldsForAuthenticatedRecipient, {
      documentId: documentId as Id<"documents">,
    }),
  );

  const connectedAccount = useQuery(api.stripe.connect_queries.getConnectedAccount, {
    slug,
  }) as { status: string; account: { chargesEnabled: boolean } | null } | undefined;
  const stripeConnected =
    connectedAccount?.status === "connected" &&
    (connectedAccount?.account?.chargesEnabled ?? false);

  const aiSettings = useQuery(api.organizations.queries.getAiSettings, {
    organizationId: documentData.organizationId,
  });
  const aiEnabled = aiSettings?.aiEnabled !== false;

  const signingSettings = useQuery(api.organizations.queries.getSigningSettings, {
    organizationId: documentData.organizationId,
  });

  const { canCreateTemplates } = useSubscriptionLimits();

  // ── Memoized maps ───────────────────────────────────────────────────────
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

  const recipientsById = useMemo(
    () => new Map(recipients.map((recipient) => [recipient._id, recipient])),
    [recipients],
  );

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
              primarySignerEmail: signer?.email,
            },
          ];
        }),
      ),
    [documentSignatures, recipientsById],
  );

  // ── Mutations ───────────────────────────────────────────────────────────
  const removeRecipient = useMutation(api.documents.recipients_mutations.removeRecipient);
  const addRecipients = useMutation(api.documents.recipients_mutations.addRecipients);
  const updateDocument = useMutation(api.documents.mutations.updateDocument);
  const resendRecipientEmail = useAction(api.documents.send_document_action.resendRecipientEmail);

  // ── Auth ────────────────────────────────────────────────────────────────
  const { user } = useUser();
  const userEmail = user?.primaryEmailAddress?.emailAddress?.toLowerCase();
  const isUserAlreadyRecipient = userEmail
    ? recipients.some((r) => r.email.toLowerCase() === userEmail)
    : false;

  // ── Custom hooks ────────────────────────────────────────────────────────
  const pdfViewer = usePdfViewer(documentId as Id<"documents">);

  const fieldPlacement = useFieldPlacement({
    documentId: documentId as Id<"documents">,
    recipients,
    signatureFields,
    currentPage: pdfViewer.currentPage,
    pdfWidth: pdfViewer.pdfWidth,
    pdfHeight: pdfViewer.pdfHeight,
    refetchFields,
    containerRef: pdfViewer.containerRef,
    signaturesByFieldId,
    paymentConfigByFieldId,
  });

  const docState = useDocumentState(documentData.redirectUrl ?? "");

  const documentAnnotations = useDocumentAnnotations(documentId as Id<"documents">);
  const { openSections, toggleSection } = useSectionState(documentAnnotations.annotations !== null);

  const aiSuggestions = useAIFieldSuggestions(documentId as Id<"documents">);
  const {
    threadId,
    isCreating: isCreatingThread,
    getOrCreateThread,
  } = useDocumentThread(documentId as Id<"documents">);
  const [showAIChat, setShowAIChat] = useState(false);
  const [showAiSuggestions, setShowAiSuggestions] = useState(true);

  // ── Derived state ───────────────────────────────────────────────────────
  const canEdit =
    documentData.status === "active" &&
    (documentData.workflowStatus === "draft" || !documentData.workflowStatus);

  const isExpired = documentData.workflowStatus === "expired";

  const fieldCountsByRecipient = new Map<string, number>();
  for (const field of signatureFields) {
    if (field.recipientId) {
      const count = fieldCountsByRecipient.get(field.recipientId) ?? 0;
      fieldCountsByRecipient.set(field.recipientId, count + 1);
    }
  }

  const getSendDocumentValidation = () => {
    const canSendStatus = documentData.workflowStatus === "draft" || isExpired;
    if (!canSendStatus || recipients.length === 0 || (!canEdit && !isExpired)) {
      return {
        canSend: false,
        tooltip: "Document must be in draft or expired status with recipients to send",
      };
    }

    const unassignedFields = signatureFields.filter((f) => !f.recipientId);
    if (unassignedFields.length > 0) {
      return {
        canSend: false,
        tooltip: `${unassignedFields.length} field(s) are not assigned to a recipient. Assign all fields before sending.`,
      };
    }

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

  const activityEvents = useMemo(
    () => buildActivityEvents(documentData, recipients),
    [documentData, recipients],
  );

  // Map fields and recipients to the exact types DocumentSidebar/FieldList expect
  const sidebarFields = useMemo(
    () =>
      signatureFields.map((f) => ({
        ...f,
        fieldType: f.fieldType as FieldType,
        recipientId: f.recipientId ?? undefined,
        paymentConfig: paymentConfigByFieldId.get(f._id),
      })),
    [signatureFields, paymentConfigByFieldId],
  );

  const sidebarRecipients = useMemo(
    () => recipients.map((r) => ({ ...r, name: r.name ?? undefined })),
    [recipients],
  );

  // ── Effects ─────────────────────────────────────────────────────────────
  // Toast when AI pipeline completes or fails
  const prevAiStatus = useRef(documentData.aiProcessingStatus);
  useEffect(() => {
    const prev = prevAiStatus.current;
    const current = documentData.aiProcessingStatus;
    prevAiStatus.current = current;

    if (prev === "processing" && current === "completed") {
      toast.success("AI analysis complete", {
        description: "Field suggestions and insights are ready to review.",
      });
    } else if (prev === "processing" && current === "failed") {
      toast.error("AI analysis failed", {
        description: "The document could not be analyzed. You can retry later.",
      });
    }
  }, [documentData.aiProcessingStatus]);

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleToggleAiSuggestions = useCallback(() => {
    setShowAiSuggestions((prev) => !prev);
  }, []);

  const handleToggleAIChat = useCallback(async () => {
    const willOpen = !showAIChat;
    setShowAIChat(willOpen);
    if (willOpen && !threadId) {
      await getOrCreateThread();
    }
  }, [showAIChat, threadId, getOrCreateThread]);

  const handleRemoveRecipientConfirm = async () => {
    if (!docState.recipientToRemove) return;

    try {
      await removeRecipient({ recipientId: docState.recipientToRemove.id });
      const hasFields = docState.recipientToRemove.fieldCount > 0;
      toast.success(
        hasFields
          ? `Recipient and ${docState.recipientToRemove.fieldCount} ${docState.recipientToRemove.fieldCount === 1 ? "field" : "fields"} removed`
          : "Recipient removed",
      );
      docState.setRemoveRecipientOpen(false);
      docState.setRecipientToRemove(null);
      refetchRecipients();
      refetchFields();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to remove recipient";
      toast.error(errorMessage);
      docState.setRemoveRecipientOpen(false);
      docState.setRecipientToRemove(null);
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
      toast.error(error instanceof Error ? error.message : "Failed to resend email");
    }
  };

  const handleAddMyselfConfirm = async () => {
    if (!user?.primaryEmailAddress?.emailAddress) {
      toast.error("Could not get your email address");
      docState.setAddMyselfOpen(false);
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
      docState.setAddMyselfOpen(false);
      refetchRecipients();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to add yourself";
      toast.error(errorMessage);
      docState.setAddMyselfOpen(false);
    }
  };

  const handleSaveRedirectUrl = async () => {
    const url = docState.redirectUrlInput.trim();
    if (url) {
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          docState.setRedirectUrlError("Must use http or https protocol");
          return;
        }
      } catch {
        docState.setRedirectUrlError("Enter a valid URL");
        return;
      }
    }
    docState.setRedirectUrlError(null);
    docState.setIsSavingRedirect(true);
    try {
      await updateDocument({
        documentId: documentId as Id<"documents">,
        redirectUrl: url || null,
      });
      toast.success(url ? "Redirect URL saved" : "Redirect URL removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save redirect URL");
    } finally {
      docState.setIsSavingRedirect(false);
    }
  };

  const openRemoveRecipientDialog = (recipient: {
    _id: Id<"document_recipients">;
    email: string;
    name?: string;
    role: string;
  }) => {
    const fieldCount = signatureFields.filter((f) => f.recipientId === recipient._id).length;
    docState.setRecipientToRemove({
      id: recipient._id,
      email: recipient.email,
      name: recipient.name,
      role: recipient.role,
      fieldCount,
    });
    docState.setRemoveRecipientOpen(true);
  };

  // ── Header action elements ───────────────────────────────────────────────
  const sendButtonLabel = isExpired ? "Re-send Document" : "Send Document";

  const aiSuggestionsToggle =
    canEdit && aiEnabled ? (
      <div key="ai-toggle" className="flex items-center gap-1.5 sm:flex-none">
        {documentData.aiProcessingStatus === "processing" && (
          <span className="text-ai-accent flex items-center gap-1.5 text-xs">
            <Loader2Icon className="h-3 w-3 animate-spin" />
            Analyzing...
          </span>
        )}
        {documentData.aiProcessingStatus === "failed" && (
          <span className="text-warning flex items-center gap-1.5 text-xs">
            Analysis incomplete
          </span>
        )}
        <Button
          onClick={handleToggleAiSuggestions}
          size="sm"
          variant="ghost"
          className="text-ai-accent"
        >
          {showAiSuggestions ? (
            <EyeIcon className="mr-1.5 h-3.5 w-3.5" />
          ) : (
            <EyeOffIcon className="mr-1.5 h-3.5 w-3.5" />
          )}
          <span className="truncate text-xs">AI Suggestions</span>
        </Button>
        <Button
          onClick={handleToggleAIChat}
          size="sm"
          variant="ghost"
          disabled={isCreatingThread}
          className={cn("text-ai-accent", showAIChat && "bg-ai-accent/20 dark:bg-ai-accent/20")}
          aria-pressed={showAIChat}
        >
          {isCreatingThread ? (
            <Loader2Icon className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <MessageSquareIcon className="mr-1.5 h-3.5 w-3.5" />
          )}
          <span className="truncate text-xs">AI Chat</span>
        </Button>
      </div>
    ) : null;

  const saveAsTemplateButton =
    canEdit && signatureFields.length > 0 ? (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="flex-1 sm:flex-none" tabIndex={!canCreateTemplates ? 0 : undefined}>
            <Button
              key="save-template"
              onClick={() => docState.setSaveAsTemplateOpen(true)}
              size="sm"
              variant="outline"
              className="w-full"
              disabled={!canCreateTemplates}
            >
              <SaveIcon className="mr-2 h-4 w-4" />
              <span className="truncate">Save as Template</span>
            </Button>
          </span>
        </TooltipTrigger>
        {!canCreateTemplates && (
          <TooltipContent>Templates require a Professional plan</TooltipContent>
        )}
      </Tooltip>
    ) : null;

  const sendDocumentButton = sendDocumentValidation.canSend ? (
    <Button
      key="send-document"
      onClick={() => docState.setSendDocumentOpen(true)}
      size="sm"
      className="flex-1 sm:flex-none"
    >
      <SendIcon className="mr-2 h-4 w-4" />
      <span className="truncate">{sendButtonLabel}</span>
    </Button>
  ) : (
    <Tooltip key="send-document">
      <TooltipTrigger asChild>
        <Button disabled size="sm" className="flex-1 sm:flex-none">
          <SendIcon className="mr-2 h-4 w-4" />
          <span className="truncate">{sendButtonLabel}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{sendDocumentValidation.tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <PageWrapper
      title={documentData.name}
      headerActions={
        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
          <Button
            onClick={() =>
              router.navigate({
                to: "/$slug/documents",
                params: { slug },
                search: { folderId: undefined },
              })
            }
            variant="ghost"
            size="sm"
            className="flex-1 sm:flex-none"
          >
            <ArrowLeftIcon className="mr-2 h-4 w-4" />
            <span className="truncate">Back</span>
          </Button>
          <DocumentPresence documentId={documentId} />
          {sendDocumentButton}
          {aiSuggestionsToggle}
          {saveAsTemplateButton}
        </div>
      }
    >
      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left column: PDF Preview */}
          <div className="lg:col-span-2">
            <div
              ref={pdfViewer.pdfWrapperRef}
              className="bg-muted/80 dark:bg-background relative min-h-[600px] rounded-2xl p-6 sm:min-h-[400px] sm:rounded-xl sm:p-3 md:p-4"
            >
              {pdfViewer.pdfUrl ? (
                <TransformWrapper
                  initialScale={1}
                  minScale={0.5}
                  maxScale={2}
                  centerOnInit={true}
                  limitToBounds={true}
                  doubleClick={{ disabled: false }}
                  wheel={{ step: 0.1 }}
                  panning={{ disabled: fieldPlacement.selectedFieldId !== null }}
                  onTransformed={(_ref, state) => {
                    pdfViewer.setCurrentZoom(state.scale);
                  }}
                >
                  <div className="mb-3 flex flex-col gap-2 sm:mb-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <div className="text-foreground flex items-center gap-2 font-serif text-base font-medium sm:gap-3 sm:text-lg">
                      <span>Document Preview</span>
                    </div>
                    <PdfViewerControls
                      currentZoom={pdfViewer.currentZoom}
                      currentPage={pdfViewer.currentPage}
                      totalPages={pdfViewer.numPages ?? 1}
                      onPageChange={pdfViewer.handlePageChange}
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
                      ref={pdfViewer.containerRef}
                      onDragOver={fieldPlacement.handleFieldDragOver}
                      onDrop={fieldPlacement.handleFieldDrop}
                      className={cn(
                        "border-border bg-card dark:border-border/80 dark:bg-card relative overflow-hidden rounded-lg border shadow-sm transition-[transform,box-shadow,border-color,background-color] duration-300",
                        fieldPlacement.draggingFieldType &&
                          "border-primary ring-primary/20 scale-[1.002] shadow-lg ring-4",
                      )}
                    >
                      <Document
                        file={pdfViewer.pdfUrl}
                        onLoadSuccess={pdfViewer.onDocumentLoadSuccess}
                        loading={
                          <div className="text-muted-foreground p-16 text-center">
                            <div className="animate-pulse">Loading document...</div>
                          </div>
                        }
                        error={
                          <div className="text-destructive p-16 text-center">
                            Failed to load document
                          </div>
                        }
                      >
                        <PdfPageWithCanvas
                          key={`page_${pdfViewer.currentPage}`}
                          pageNumber={pdfViewer.currentPage}
                          width={pdfViewer.pdfWidth}
                          renderTextLayer={true}
                          renderAnnotationLayer={true}
                          fields={fieldPlacement.placedFields}
                          selectedFieldId={canEdit ? fieldPlacement.selectedFieldId : null}
                          onFieldSelect={canEdit ? fieldPlacement.handleFieldSelect : undefined}
                          onFieldUpdate={canEdit ? fieldPlacement.handleFieldUpdate : undefined}
                          onPageDimensions={pdfViewer.handlePageDimensions}
                          onPageRef={(pageNumber, element) => {
                            if (element) {
                              pdfViewer.pageRefs.current.set(pageNumber, element);
                            } else {
                              pdfViewer.pageRefs.current.delete(pageNumber);
                            }
                          }}
                        />
                      </Document>

                      {canEdit && aiEnabled && showAiSuggestions && aiSuggestions.suggestions && (
                        <AIFieldOverlays
                          suggestions={aiSuggestions.suggestions}
                          selectedIndices={aiSuggestions.selectedIndices}
                          toggleField={aiSuggestions.toggleField}
                          currentPage={pdfViewer.currentPage}
                          pdfPageWidth={pdfViewer.pdfWidth}
                          pdfPageHeight={pdfViewer.pdfHeight}
                        />
                      )}

                      {canEdit && aiEnabled && documentAnnotations.annotations && (
                        <AIAnnotationOverlays
                          annotations={documentAnnotations.annotations}
                          enabledCategories={documentAnnotations.enabledCategories}
                          currentPage={pdfViewer.currentPage}
                          pdfPageWidth={pdfViewer.pdfWidth}
                          pdfPageHeight={pdfViewer.pdfHeight}
                        />
                      )}
                    </div>
                  </TransformComponent>

                  {canEdit && aiEnabled && showAiSuggestions && aiSuggestions.suggestions && (
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

                  {canEdit &&
                    aiEnabled &&
                    showAiSuggestions &&
                    !aiSuggestions.suggestions &&
                    documentData.aiProcessingStatus === "processing" && (
                      <div className="border-ai-accent/40 bg-ai-accent/10 dark:border-ai-accent/30 dark:bg-ai-accent/15 mt-3 flex items-center gap-3 rounded-xl border border-dashed px-4 py-3">
                        <Loader2Icon className="text-ai-accent h-4 w-4 animate-spin" />
                        <span className="text-ai-accent font-sans text-xs">
                          Detecting form fields...
                        </span>
                      </div>
                    )}
                </TransformWrapper>
              ) : (
                <>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-foreground flex items-center gap-3 font-serif text-lg font-medium sm:flex-wrap sm:text-base">
                      <span>Document Preview</span>
                      {pdfViewer.numPages && (
                        <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-1 font-sans text-xs font-medium">
                          {pdfViewer.numPages} {pdfViewer.numPages === 1 ? "page" : "pages"}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="border-border bg-card text-muted-foreground dark:border-border/80 dark:bg-card relative overflow-hidden rounded-lg border p-16 text-center shadow-sm">
                    <div className="animate-pulse">Loading document...</div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right column: Document Sidebar */}
          <div>
            <DocumentSidebar
              documentId={documentId}
              slug={slug}
              workflowStatus={documentData.workflowStatus}
              createdAt={documentData.createdAt}
              description={documentData.description}
              fileSize={documentData.fileSize}
              pageCount={documentData.pageCount}
              numPages={pdfViewer.numPages}
              recipients={sidebarRecipients}
              progress={progress}
              signatureFields={sidebarFields}
              hasSigners={recipients.some((r) => r.role === "signer")}
              currentUserRecipient={currentUserRecipient}
              currentUserFields={currentUserFields}
              onCurrentUserFieldsRefetch={() => {
                refetchCurrentUserFields();
                refetchCurrentUserRecipient();
                refetchRecipients();
                refetchFields();
              }}
              canEdit={canEdit}
              isUserAlreadyRecipient={isUserAlreadyRecipient}
              stripeConnected={stripeConnected}
              openSections={openSections}
              toggleSection={toggleSection}
              aiEnabled={aiEnabled}
              documentAnnotations={documentAnnotations}
              showAIChat={showAIChat}
              onCloseAIChat={() => setShowAIChat(false)}
              threadId={threadId}
              aiProcessingStatus={documentData.aiProcessingStatus}
              selectedFieldId={fieldPlacement.selectedFieldId}
              onFieldSelect={fieldPlacement.handleFieldSelect}
              onFieldDelete={fieldPlacement.requestFieldDelete}
              onFieldProperties={(fieldId) => {
                fieldPlacement.setFieldPropertiesId(fieldId);
                fieldPlacement.setShowFieldProperties(true);
              }}
              onFieldDragStart={(fieldType) =>
                fieldPlacement.setDraggingFieldType(
                  fieldType as Parameters<typeof fieldPlacement.setDraggingFieldType>[0],
                )
              }
              onFieldDragEnd={() => fieldPlacement.setDraggingFieldType(null)}
              redirectUrlInput={docState.redirectUrlInput}
              redirectUrlError={docState.redirectUrlError}
              isSavingRedirect={docState.isSavingRedirect}
              onRedirectUrlChange={(url) => {
                docState.setRedirectUrlInput(url);
                docState.setRedirectUrlError(null);
              }}
              onSaveRedirectUrl={handleSaveRedirectUrl}
              onAddRecipient={() => docState.setAddRecipientOpen(true)}
              onAddMyself={() => docState.setAddMyselfOpen(true)}
              onRecipientOptions={(recipient) => {
                const full = recipients.find((r) => r._id === recipient._id);
                if (!full) return;
                docState.setSelectedRecipientForOptions({
                  _id: full._id,
                  email: full.email,
                  name: full.name ?? undefined,
                  role: full.role,
                  status: full.status as
                    | "pending"
                    | "viewed"
                    | "signed"
                    | "approved"
                    | "declined"
                    | "expired",
                  signingToken: "signingToken" in full ? (full.signingToken as string) : undefined,
                });
                docState.setRecipientOptionsOpen(true);
              }}
              activityEvents={activityEvents}
              onPageJump={pdfViewer.setCurrentPage}
            />
          </div>
        </div>

        {/* ── Dialogs ─────────────────────────────────────────────────────── */}
        <AddRecipientDialog
          documentId={documentId as Id<"documents">}
          organizationId={documentData.organizationId}
          open={docState.addRecipientOpen}
          onOpenChange={docState.setAddRecipientOpen}
          onSuccess={() => refetchRecipients()}
          existingRecipientEmails={recipients.map((r) => r.email)}
          currentUserEmail={userEmail}
        />

        <AddMyselfDialog
          open={docState.addMyselfOpen}
          onOpenChange={docState.setAddMyselfOpen}
          onConfirm={handleAddMyselfConfirm}
          userEmail={user?.primaryEmailAddress?.emailAddress}
          userName={user?.fullName || undefined}
        />

        <RemoveRecipientDialog
          open={docState.removeRecipientOpen}
          onOpenChange={(open) => {
            docState.setRemoveRecipientOpen(open);
            if (!open) docState.setRecipientToRemove(null);
          }}
          onConfirm={handleRemoveRecipientConfirm}
          recipientEmail={docState.recipientToRemove?.email}
          recipientName={docState.recipientToRemove?.name}
          recipientRole={docState.recipientToRemove?.role}
          fieldCount={docState.recipientToRemove?.fieldCount}
        />

        <RecipientSelectorDialog
          open={fieldPlacement.showRecipientSelector}
          onOpenChange={fieldPlacement.setShowRecipientSelector}
          recipients={recipients}
          selectedRecipientId={fieldPlacement.selectedRecipientId}
          onRecipientSelect={fieldPlacement.setSelectedRecipientId}
          onConfirm={fieldPlacement.handleConfirmFieldPlacement}
          fieldType={fieldPlacement.pendingFieldData?.fieldType || "field"}
          pageNumber={fieldPlacement.pendingFieldData?.page || 1}
        />

        {fieldPlacement.pendingFieldData &&
          (fieldPlacement.pendingFieldData.fieldType === "checkbox" ||
            fieldPlacement.pendingFieldData.fieldType === "dropdown" ||
            fieldPlacement.pendingFieldData.fieldType === "radio") && (
            <FieldOptionsDialog
              open={fieldPlacement.showFieldOptions}
              onOpenChange={(open) => {
                if (!open) fieldPlacement.handleFieldOptionsCancel();
              }}
              fieldType={fieldPlacement.pendingFieldData.fieldType}
              onConfirm={fieldPlacement.handleFieldOptionsConfirm}
              initialConfig={fieldPlacement.pendingFieldOptions ?? undefined}
            />
          )}

        <FieldPropertiesDialog
          open={fieldPlacement.showFieldProperties}
          onOpenChange={(open) => {
            fieldPlacement.setShowFieldProperties(open);
            if (!open) fieldPlacement.setFieldPropertiesId(null);
          }}
          field={
            fieldPlacement.fieldPropertiesId
              ? (signatureFields.find((f) => f._id === fieldPlacement.fieldPropertiesId) ?? null)
              : null
          }
          recipients={recipients}
          onSave={() => {
            refetchFields();
          }}
          onConfigurePayment={(fieldId) => {
            fieldPlacement.setShowFieldProperties(false);
            fieldPlacement.setPaymentConfigFieldId(fieldId);
            fieldPlacement.setShowPaymentConfigModal(true);
          }}
        />

        <PaymentConfigModal
          open={fieldPlacement.showPaymentConfigModal}
          onOpenChange={(open) => {
            fieldPlacement.setShowPaymentConfigModal(open);
            if (!open) fieldPlacement.setPaymentConfigFieldId(null);
          }}
          fieldId={fieldPlacement.paymentConfigFieldId}
        />

        <SendDocumentDialog
          documentId={documentId as Id<"documents">}
          documentName={documentData.name}
          recipients={recipients}
          signatureFieldCount={signatureFieldCount}
          fieldCountsByRecipient={fieldCountsByRecipient}
          open={docState.sendDocumentOpen}
          onOpenChange={docState.setSendDocumentOpen}
          defaultDeadlineDays={signingSettings?.defaultDeadlineDays}
          onSuccess={() => {
            refetchDocument();
            refetchRecipients();
          }}
        />

        <SaveAsTemplateDialog
          documentId={documentId as Id<"documents">}
          documentName={documentData.name}
          open={docState.saveAsTemplateOpen}
          onOpenChange={docState.setSaveAsTemplateOpen}
        />

        <DeleteFieldDialog
          open={fieldPlacement.showFieldDeleteDialog}
          onOpenChange={fieldPlacement.setShowFieldDeleteDialog}
          onConfirm={fieldPlacement.handleFieldDeleteConfirm}
          fieldType={
            fieldPlacement.selectedFieldId
              ? fieldPlacement.placedFields.find((f) => f.id === fieldPlacement.selectedFieldId)
                  ?.fieldType
              : undefined
          }
        />

        <RecipientOptionsDialog
          open={docState.recipientOptionsOpen}
          onOpenChange={docState.setRecipientOptionsOpen}
          recipient={docState.selectedRecipientForOptions}
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
