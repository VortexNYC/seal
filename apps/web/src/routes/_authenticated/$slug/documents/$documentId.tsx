import { Button } from "@cloudflare/kumo/components/button";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Loader } from "@cloudflare/kumo/components/loader";
import { Text } from "@cloudflare/kumo/components/text";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  type ErrorComponentProps,
  createFileRoute,
  useRouter,
} from "@tanstack/react-router";
import { ArrowLeft as ArrowLeftIcon, DownloadSimple as DownloadIcon, FloppyDisk as SaveIcon, PaperPlaneTilt as SendIcon } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";

import { DocumentToolRow } from "@/components/documents/document-tool-row";
import type { FieldType } from "@/lib/field-types";
import { NotFoundPage } from "@/components/not-found-page";
import { PageWrapper } from "@/components/page-wrapper";
import { RouteErrorComponent } from "@/components/route-error-component";
import { FormSkeleton } from "@/components/skeletons";
import { useDocumentDetail } from "@/data/document-detail";
import { useCurrentUser as useUser } from "@/hooks/use-current-user";
import { useSubscriptionLimits } from "@/hooks/use-subscription-limits";
import {
  addRecipients as addRecipientsApi,
  cancelDocument,
  downloadDocument,
  getAiSettings,
  getSigningSettings,
  removeRecipient as removeRecipientApi,
  replaceDocumentPdf,
  resendRecipientEmail as resendRecipientEmailApi,
} from "@/lib/api-client";
import { buildActivityEvents } from "@/lib/document-activity";
import {
  documentHeaderAction,
  signedPdfFilename,
  toWorkflowStatus,
} from "@/lib/document-status";
import { parseId } from "@/lib/ids";
import { toast } from "@/lib/toast";

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
import { DocumentCanvas } from "../../../../components/documents/document-canvas";
import { DocumentPresence } from "../../../../components/documents/document-presence";
import { DocumentSidebar } from "../../../../components/documents/document-sidebar";
import {
  FINISH_FIELD_MESSAGE,
  activeRailPanel,
  countSigningFields,
  asOptionsFieldType,
  canLeaveFieldSetup,
  fieldOptionsPanelReady,
  railStepFor,
  resolvePagePlaceIntent,
  resolvePlaceFieldsIntent,
  resolveSendIntent,
  sendDocumentReadiness,
  signerRecipients,
} from "../../../../components/documents/document-rail";
import { thumbnailPdfUrl } from "../../../../components/documents/document-surface";
import { FieldOptionsDialog } from "../../../../components/documents/field-options-dialog";
import { FieldPropertiesDialog } from "../../../../components/documents/field-properties-dialog";
import { useDocumentState } from "../../../../components/documents/hooks/use-document-state";
import {
  useFieldPlacement,
  type SignatureData,
} from "../../../../components/documents/hooks/use-field-placement";
import { usePdfPageThumbnails } from "../../../../components/documents/hooks/use-pdf-page-thumbnails";
import { usePdfViewer } from "../../../../components/documents/hooks/use-pdf-viewer";
import { useSectionState } from "../../../../components/documents/hooks/use-section-state";
import { PaymentConfigModal } from "../../../../components/documents/payment-config-modal";
import { RecipientOptionsDialog } from "../../../../components/documents/recipient-options-dialog";
import { RemoveRecipientDialog } from "../../../../components/documents/remove-recipient-dialog";
import { SaveAsTemplateDialog } from "../../../../components/documents/save-as-template-dialog";
import { SendDocumentDialog } from "../../../../components/documents/send-document-dialog";
import {
  DocumentViewerShell,
  ThumbnailSidebar,
} from "../../../../components/kumo-docs";

export const Route = createFileRoute(
  "/_authenticated/$slug/documents/$documentId"
)({
  component: DocumentDetailPage,
  pendingComponent: DocumentDetailSkeleton,
  errorComponent: DocumentErrorComponent,
  validateSearch: (
    search: Record<string, unknown>
  ): {
    focus?: "recipients" | "send";
    hl?: string;
  } => {
    const out: { focus?: "recipients" | "send"; hl?: string } = {};
    if (search.focus === "recipients" || search.focus === "send") {
      out.focus = search.focus;
    }
    // ?hl=page,x,y,w,h — citation/deep-link highlight, percent-of-page
    if (
      typeof search.hl === "string" &&
      /^\d+,(\d+\.?\d*,){3}\d+\.?\d*$/.test(search.hl)
    ) {
      out.hl = search.hl;
    }
    return out;
  },
  head: () => ({
    meta: [
      { title: "Document - Seal" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function DocumentDetailSkeleton(): ReactElement {
  return (
    <PageWrapper title="Document">
      <div className="flex w-full flex-col gap-4">
        <FormSkeleton />
      </div>
    </PageWrapper>
  );
}

function DocumentErrorComponent(props: ErrorComponentProps) {
  const message =
    props.error instanceof Error ? props.error.message : String(props.error);

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
  const { focus, hl } = Route.useSearch();
  const documentPublicId = documentId;
  const router = useRouter();

  // ── Worker queries ──────────────────────────────────────────────────────
  const {
    documentData,
    recipients,
    progress,
    signatureFields,
    documentSignatures,
    paymentConfigs,
    currentUserRecipient,
    currentUserFields,
    refetchDocument,
    refetchRecipients,
    refetchProgress,
    refetchFields,
    refetchCurrentUserRecipient,
    refetchCurrentUserFields,
  } = useDocumentDetail(slug, documentPublicId);

  const signatureFieldCount = countSigningFields(signatureFields);

  const { data: aiSettings } = useQuery({
    queryKey: ["organization", slug, "ai-settings"],
    queryFn: () => getAiSettings(slug),
  });
  const aiEnabled = aiSettings?.aiEnabled !== false;
  const isScannedOrImageDocument =
    documentData.pdf_type === "Scanned" ||
    documentData.pdf_type === "ImageBased";
  const showAiFeatures = aiEnabled && !isScannedOrImageDocument;

  const { data: signingSettings } = useQuery({
    queryKey: ["organization", slug, "signing-settings"],
    queryFn: () => getSigningSettings(slug),
  });

  const { canCreateTemplates } = useSubscriptionLimits();

  // ── Memoized maps ───────────────────────────────────────────────────────
  const paymentConfigByFieldId = useMemo(() => {
    const map = new Map<
      string,
      {
        totalAmountCents: number;
        currency: string;
        paymentType: string;
        paymentStatus?: string;
      }
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
    [recipients]
  );

  const signaturesByFieldId = useMemo(
    () =>
      new Map<string, SignatureData>(
        documentSignatures.map((signature) => {
          const signer = recipientsById.get(signature.recipientId);
          return [
            signature.fieldId ? signature.fieldId : "",
            {
              signatureImageUrl: signature.signatureImageUrl,
              value: signature.value,
              signedAt: signature.signedAt,
              signatureMethod: signature.signatureMethod,
              signerName: signer?.name,
              signerEmail: signer?.email,
            },
          ];
        })
      ),
    [documentSignatures, recipientsById]
  );

  // ── Mutations ───────────────────────────────────────────────────────────
  const removeRecipient = async (recipientPublicId: string) => {
    await removeRecipientApi(slug, documentPublicId, recipientPublicId);
  };
  const addRecipients = async (
    recipientsInput: {
      email: string;
      name?: string;
      role: "signer" | "viewer" | "approver";
    }[]
  ) => {
    await addRecipientsApi(slug, documentPublicId, recipientsInput);
  };
  const resendRecipientEmail = async (recipientPublicId: string) => {
    await resendRecipientEmailApi(slug, documentPublicId, recipientPublicId);
  };

  // ── Auth ────────────────────────────────────────────────────────────────
  const { user } = useUser();
  const userEmail = user?.primaryEmailAddress?.emailAddress?.toLowerCase();
  const isUserAlreadyRecipient = userEmail
    ? recipients.some((r) => r.email.toLowerCase() === userEmail)
    : false;

  // ── Custom hooks ────────────────────────────────────────────────────────
  const [armedField, setArmedField] = useState<FieldType | null>(null);
  const [pdfReloadKey, setPdfReloadKey] = useState(0);
  const [openFieldsToken, setOpenFieldsToken] = useState(0);
  const pdfViewer = usePdfViewer(slug, documentPublicId, pdfReloadKey);

  // ?hl=page,x,y,w,h — citation/deep-link highlight (percent-of-page)
  const [hlRect, setHlRect] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const hlApplied = useRef(false);
  useEffect(() => {
    if (!hl || hlApplied.current || !pdfViewer.numPages) return;
    const [page, x, y, w, h] = hl.split(",").map(Number);
    if (!page || page < 1 || page > pdfViewer.numPages) return;
    hlApplied.current = true;
    pdfViewer.setCurrentPage(page);
    setHlRect({ x, y, w, h });
  }, [hl, pdfViewer.numPages, pdfViewer.setCurrentPage]);

  const saveMarkupMutation = useMutation({
    mutationFn: async (input: { buffer: ArrayBuffer; keepalive?: boolean }) => {
      const bytes = new Uint8Array(input.buffer);
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      return replaceDocumentPdf(
        slug,
        documentPublicId,
        { contentBase64: btoa(binary) },
        { keepalive: input.keepalive }
      );
    },
  });
  const savedMarkupUrlRef = useRef<string | null>(null);
  const [savedMarkupUrl, setSavedMarkupUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!savedMarkupUrlRef.current) return;
    URL.revokeObjectURL(savedMarkupUrlRef.current);
    savedMarkupUrlRef.current = null;
    setSavedMarkupUrl(null);
  }, [pdfViewer.pdfUrl]);
  useEffect(() => {
    return () => {
      if (!savedMarkupUrlRef.current) return;
      URL.revokeObjectURL(savedMarkupUrlRef.current);
      savedMarkupUrlRef.current = null;
    };
  }, []);
  const pageThumbnails = usePdfPageThumbnails(
    thumbnailPdfUrl(pdfViewer.pdfUrl, savedMarkupUrl),
    pdfViewer.numPages
  );

  const fieldPlacement = useFieldPlacement({
    organizationSlug: slug,
    documentPublicId,
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

  const documentAnnotations = useDocumentAnnotations(documentPublicId);
  const { openSections, toggleSection } = useSectionState(
    documentAnnotations.annotations !== null
  );

  const focusAppliedRef = useRef(false);
  useEffect(() => {
    if (focusAppliedRef.current || focus === undefined) {
      return;
    }
    focusAppliedRef.current = true;
    if (focus === "recipients" && !openSections.has("recipients")) {
      toggleSection("recipients");
    }
    if (focus === "send") {
      docState.setSendDocumentOpen(true);
    }
  }, [focus, openSections, toggleSection, docState]);

  // ── Derived state ───────────────────────────────────────────────────────
  // API maps documents.status → workflowStatus. Prep states: draft, and legacy
  // "uploaded" left by older upload handlers before they stopped overwriting draft.
  const prepStatuses = new Set(["draft", "uploaded"]);
  const isPrepStatus =
    !documentData.workflowStatus ||
    prepStatuses.has(documentData.workflowStatus);

  const canEdit = documentData.status === "active" && isPrepStatus;

  // SEA-85: OCR/detect field_candidates → one-tap Accept on Fields canvas.
  const fieldSuggestions = useAIFieldSuggestions(documentPublicId, {
    enabled: canEdit && showAiFeatures,
    onApplied: () => {
      void refetchFields();
    },
  });

  const sharedPdfCanvas = Boolean(pdfViewer.pdfUrl);

  const isExpired = documentData.workflowStatus === "expired";

  const fieldCountsByRecipient = new Map<string, number>();
  for (const field of signatureFields) {
    if (field.recipientId) {
      const count = fieldCountsByRecipient.get(field.recipientId) ?? 0;
      fieldCountsByRecipient.set(field.recipientId, count + 1);
    }
  }

  const sendDocumentValidation = sendDocumentReadiness({
    workflowStatus: documentData.workflowStatus,
    documentStatus: documentData.status,
    recipients,
    fields: signatureFields,
  });

  const activityEvents = useMemo(
    () => buildActivityEvents(documentData, recipients),
    [documentData, recipients]
  );

  // Map fields and recipients to the exact types DocumentSidebar/FieldList expect
  const sidebarFields = useMemo(
    () =>
      signatureFields.map((f) => ({
        ...f,
        fieldType: f.fieldType,
        recipientId: f.recipientId ?? undefined,
        paymentConfig: paymentConfigByFieldId.get(f._id),
      })),
    [signatureFields, paymentConfigByFieldId]
  );

  const sidebarRecipients = useMemo(
    () => recipients.map((r) => ({ ...r, name: r.name ?? undefined })),
    [recipients]
  );

  // ── Effects ─────────────────────────────────────────────────────────────
  // Toast when AI pipeline completes or fails
  const prevAiStatus = useRef(documentData.aiProcessingStatus);
  useEffect(() => {
    const prev = prevAiStatus.current;
    const current = documentData.aiProcessingStatus;
    prevAiStatus.current = current;

    if (prev === "processing" && current === "completed") {
      toast.success("Analysis complete", {
        description: "Field suggestions and insights are ready to review.",
      });
    } else if (prev === "processing" && current === "failed") {
      toast.error("Analysis failed", {
        description: "The document could not be analyzed. You can retry later.",
      });
    }
  }, [documentData.aiProcessingStatus]);

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleRemoveRecipientConfirm = async () => {
    if (!docState.recipientToRemove) return;

    try {
      await removeRecipient(docState.recipientToRemove.publicId);
      const hasFields = docState.recipientToRemove.fieldCount > 0;
      toast.success(
        hasFields
          ? `Recipient and ${docState.recipientToRemove.fieldCount} ${docState.recipientToRemove.fieldCount === 1 ? "field" : "fields"} removed`
          : "Recipient removed"
      );
      docState.setRemoveRecipientOpen(false);
      docState.setRecipientToRemove(null);
      docState.setRecipientOptionsOpen(false);
      void refetchRecipients();
      void refetchFields();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to remove recipient";
      toast.error(errorMessage);
      docState.setRemoveRecipientOpen(false);
      docState.setRecipientToRemove(null);
    }
  };

  const handleVoidDocument = async (): Promise<void> => {
    try {
      await cancelDocument(slug, documentPublicId);
      toast.success("Document voided");
      void refetchDocument();
      void refetchRecipients();
      void refetchProgress();
      void refetchCurrentUserRecipient();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not void");
    }
  };

  const handleResendEmail = async (recipientId: string) => {
    const recipient = recipients.find((r) => r._id === recipientId);
    if (!recipient) return;

    try {
      await resendRecipientEmail(recipient.publicId);
      toast.success("Email resent successfully");
      void refetchRecipients();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to resend email"
      );
    }
  };

  const handleAddMyselfConfirm = async (): Promise<void> => {
    const email =
      userEmail ?? user?.primaryEmailAddress?.emailAddress ?? undefined;
    if (!email) {
      toast.error("Could not get your email address");
      docState.setAddMyselfOpen(false);
      return;
    }

    try {
      await addRecipients([
        {
          email,
          name: user?.fullName || undefined,
          role: "signer",
        },
      ]);
      toast.success("Added yourself as a signer");
      docState.setAddMyselfOpen(false);
      void refetchRecipients();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to add yourself";
      toast.error(errorMessage);
      docState.setAddMyselfOpen(false);
    }
  };

  const openRemoveRecipientDialog = (recipient: {
    _id: string;
    email: string;
    name?: string;
    role: string;
  }) => {
    const full = recipients.find((r) => r._id === recipient._id);
    if (!full) return;
    const fieldCount = signatureFields.filter(
      (f) => f.recipientId === full._id
    ).length;
    docState.setRecipientToRemove({
      id: full._id,
      publicId: full.publicId,
      email: full.email,
      name: full.name,
      role: full.role,
      fieldCount,
    });
    docState.setRemoveRecipientOpen(true);
  };

  // ── Header action elements ───────────────────────────────────────────────
  const sendButtonLabel = isExpired ? "Re-send Document" : "Send Document";

  const saveAsTemplateButton =
    canEdit && signatureFields.length > 0 ? (
      <div key="save-template" className="flex-1 sm:flex-none">
        <span
          title={
            canCreateTemplates
              ? "Save this document as a template"
              : "Templates require a Professional plan"
          }
          className="inline-flex w-full"
        >
        <Button
          onClick={() => {
            if (!dismissRail()) return;
            docState.setSaveAsTemplateOpen(true);
          }}
          size="sm"
          variant="outline"
          className="w-full"
          disabled={!canCreateTemplates}
         icon={SaveIcon}>
          <span className="truncate">Save as Template</span>
        </Button>
        </span>
      </div>
    ) : null;

  const openFieldMenu = (): void => {
    setOpenFieldsToken((token) => token + 1);
    if (!openSections.has("fields")) toggleSection("fields");
  };

  const handlePlaceFields = (): void => {
    const intent = resolvePlaceFieldsIntent({
      canEdit,
      signerCount: signerRecipients(recipients).length,
    });
    if (intent === "stay") return;
    if (intent === "add-recipient") {
      if (!dismissRail()) return;
      docState.setAddRecipientOpen(true);
      return;
    }
    openFieldMenu();
  };

  const handleSendIntent = (): void => {
    const intent = resolveSendIntent({
      fieldSetupOpen: fieldPlacement.fieldSetupOpen,
      canSend: sendDocumentValidation.canSend,
      canEdit,
      signerCount: signerRecipients(recipients).length,
      blockedReason: sendDocumentValidation.tooltip,
    });
    if (intent.kind === "finish-field") {
      toast.info(FINISH_FIELD_MESSAGE);
      return;
    }
    if (intent.kind === "open-send") {
      dismissRail();
      docState.setSendDocumentOpen(true);
      return;
    }
    if (intent.kind === "open-add-recipient") {
      dismissRail();
      docState.setAddRecipientOpen(true);
      return;
    }
    toast.info(intent.message);
    if (!intent.openFields || !dismissRail()) return;
    openFieldMenu();
  };

  const downloadSignedPdf = (): void => {
    void downloadDocument(slug, documentPublicId)
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = signedPdfFilename(documentData.name);
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      })
      .catch(() => {
        toast.error("Failed to download the PDF");
      });
  };

  const sendDocumentButton = (
    <div key="send-document" className="flex-1 sm:flex-none">
      <span
        title={
          sendDocumentValidation.canSend
            ? "Send this document"
            : sendDocumentValidation.tooltip
        }
        className="inline-flex"
      >
        <Button
          onClick={handleSendIntent}
          size="sm"
          variant="primary"
          className="w-full"
          icon={SendIcon}
        >
          <span className="truncate">{sendButtonLabel}</span>
        </Button>
      </span>
    </div>
  );

  const dismissRail = (): boolean => {
    if (!canLeaveFieldSetup(fieldPlacement.fieldSetupOpen)) {
      toast.info(FINISH_FIELD_MESSAGE);
      return false;
    }
    docState.setAddRecipientOpen(false);
    docState.setAddMyselfOpen(false);
    docState.setSendDocumentOpen(false);
    docState.setSaveAsTemplateOpen(false);
    docState.setRecipientOptionsOpen(false);
    docState.setRemoveRecipientOpen(false);
    docState.setRecipientToRemove(null);
    fieldPlacement.setShowFieldProperties(false);
    fieldPlacement.setFieldPropertiesId(null);
    fieldPlacement.setShowFieldDeleteDialog(false);
    fieldPlacement.setShowPaymentConfigModal(false);
    fieldPlacement.setPaymentConfigFieldId(null);
    fieldPlacement.setShowRecipientSelector(false);
    return true;
  };

  const optionsFieldType = asOptionsFieldType(
    fieldPlacement.pendingFieldData?.fieldType
  );
  const railPanelId = activeRailPanel({
    removeRecipient: docState.removeRecipientOpen,
    recipientOptions: docState.recipientOptionsOpen,
    deleteField: fieldPlacement.showFieldDeleteDialog,
    fieldOptions: fieldOptionsPanelReady(
      fieldPlacement.showFieldOptions,
      fieldPlacement.pendingFieldData?.fieldType
    ),
    payment: fieldPlacement.showPaymentConfigModal,
    fieldProperties: fieldPlacement.showFieldProperties,
    send: docState.sendDocumentOpen,
    saveTemplate: docState.saveAsTemplateOpen,
    addMyself: docState.addMyselfOpen,
    addRecipient: docState.addRecipientOpen,
  });
  const railStep = railStepFor(railPanelId);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <PageWrapper
      title={documentData.name}
      dense
      headerActions={
        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
          <span title="Return to documents" className="inline-flex">
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
            icon={ArrowLeftIcon}
          >
            <span className="truncate">Documents</span>
          </Button>
          </span>
          <DocumentPresence documentId={documentId} />
          {documentHeaderAction(documentData.workflowStatus) === "download" ? (
            <div key="download-pdf" className="flex-1 sm:flex-none">
              <Button
                onClick={downloadSignedPdf}
                size="sm"
                variant="primary"
                className="w-full"
                icon={DownloadIcon}
              >
                <span className="truncate">Download PDF</span>
              </Button>
            </div>
          ) : (
            sendDocumentButton
          )}
          {saveAsTemplateButton}
        </div>
      }
    >
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
          {/* Left column: PDF Preview — Kumo viewer shell + thumbnail rail */}
          <div className="flex h-full max-h-[42dvh] min-h-0 min-w-0 flex-col lg:max-h-none lg:min-h-0">
            <DocumentViewerShell
              left={
                <ThumbnailSidebar
                  pages={pageThumbnails.pages}
                  currentPage={pdfViewer.currentPage}
                  onSelectPage={pdfViewer.handlePageChange}
                  loading={pageThumbnails.loading || !pdfViewer.numPages}
                />
              }
              main={
                <div
                  ref={pdfViewer.pdfWrapperRef}
                  className="bg-kumo-canvas relative flex h-full min-h-0 flex-col gap-3 p-3 md:p-4"
                >
                  {sharedPdfCanvas && pdfViewer.pdfUrl ? (
                    <>
                      {canEdit && isScannedOrImageDocument ? (
                        <div className="border-kumo-warning/30 bg-kumo-warning-tint/40 text-kumo-warning rounded-lg border px-3 py-2 text-xs">
                          This is a scanned or image-only PDF. Field detection
                          is not available — choose a field, then click the page.
                        </div>
                      ) : null}
                      {canEdit &&
                      fieldSuggestions.suggestions &&
                      fieldSuggestions.suggestions.fields.length > 0 ? (
                        <AIFieldReviewBar
                          suggestions={fieldSuggestions.suggestions}
                          selectedIndices={fieldSuggestions.selectedIndices}
                          isApplying={fieldSuggestions.isApplying}
                          selectAll={fieldSuggestions.selectAll}
                          selectHighConfidence={
                            fieldSuggestions.selectHighConfidence
                          }
                          handleApply={() => {
                            void fieldSuggestions.handleApply();
                          }}
                          handleDismiss={() => {
                            void fieldSuggestions.handleDismiss();
                          }}
                        />
                      ) : null}
                      <DocumentCanvas
                        src={pdfViewer.pdfUrl}
                        interaction={canEdit ? "fields" : "view"}
                        suspendMarkup={canEdit && armedField !== null}
                        onClearTool={() => {
                          setArmedField(null);
                        }}
                        onMarkupToolChange={(toolId) => {
                          if (toolId === null) return;
                          setArmedField(null);
                        }}
                        onEmptyClick={
                          canEdit && armedField
                            ? (clientX, clientY) => {
                                const intent = resolvePagePlaceIntent({
                                  fieldSetupOpen: fieldPlacement.fieldSetupOpen,
                                  signerCount: signerRecipients(recipients).length,
                                });
                                if (intent === "finish-field") {
                                  toast.info(FINISH_FIELD_MESSAGE);
                                  return;
                                }
                                if (intent === "add-recipient") {
                                  if (!dismissRail()) return;
                                  docState.setAddRecipientOpen(true);
                                  return;
                                }
                                void fieldPlacement.placeFieldAt(
                                  armedField,
                                  clientX,
                                  clientY
                                );
                              }
                            : undefined
                        }
                        toolbarExtras={
                          canEdit ? (
                            <DocumentToolRow
                              organizationSlug={slug}
                              documentPublicId={documentPublicId}
                              pageCount={pdfViewer.numPages ?? 0}
                              currentPage={pdfViewer.currentPage}
                              armedField={armedField}
                              onArmField={(fieldType) => {
                                if (!canLeaveFieldSetup(fieldPlacement.fieldSetupOpen)) {
                                  toast.info(FINISH_FIELD_MESSAGE);
                                  return;
                                }
                                dismissRail();
                                setArmedField(fieldType);
                                if (!openSections.has("fields")) {
                                  toggleSection("fields");
                                }
                              }}
                              onClearField={() => {
                                setArmedField(null);
                              }}
                              onPdfChanged={() => {
                                setPdfReloadKey((key) => key + 1);
                              }}
                              openFieldsToken={openFieldsToken}
                            />
                          ) : null
                        }
                        currentPage={pdfViewer.currentPage}
                        onPageChange={pdfViewer.handlePageChange}
                        onZoomChange={pdfViewer.setCurrentZoom}
                        onDocumentMeta={(meta) => {
                          pdfViewer.onDocumentLoadSuccess({
                            numPages: meta.numPages,
                          });
                          pdfViewer.handlePageDimensions(
                            pdfViewer.currentPage,
                            meta.pageWidth,
                            meta.pageHeight
                          );
                        }}
                        fields={
                          documentData.workflowStatus === "completed"
                            ? []
                            : fieldPlacement.placedFields
                        }
                        selectedFieldId={
                          canEdit ? fieldPlacement.selectedFieldId : null
                        }
                        onFieldSelect={
                          canEdit ? fieldPlacement.handleFieldSelect : undefined
                        }
                        onFieldUpdate={
                          canEdit ? fieldPlacement.handleFieldUpdate : undefined
                        }
                        onFieldDragOver={
                          canEdit
                            ? fieldPlacement.handleFieldDragOver
                            : undefined
                        }
                        onFieldDrop={
                          canEdit
                            ? (event) => {
                                const intent = resolvePagePlaceIntent({
                                  fieldSetupOpen: fieldPlacement.fieldSetupOpen,
                                  signerCount: signerRecipients(recipients).length,
                                });
                                if (intent === "finish-field") {
                                  event.preventDefault();
                                  toast.info(FINISH_FIELD_MESSAGE);
                                  return;
                                }
                                if (intent === "add-recipient") {
                                  event.preventDefault();
                                  if (!dismissRail()) return;
                                  docState.setAddRecipientOpen(true);
                                  return;
                                }
                                void fieldPlacement.handleFieldDrop(event);
                              }
                            : undefined
                        }
                        fieldContainerRef={pdfViewer.containerRef}
                        fieldDragging={Boolean(
                          fieldPlacement.draggingFieldType
                        )}
                        fieldOverlayExtra={
                          <>
                            {hlRect && pdfViewer.currentPage > 0 ? (
                              <div
                                data-testid="citation-highlight"
                                className="border-kumo-warning bg-kumo-warning/20 pointer-events-none absolute rounded-sm border-2"
                                style={{
                                  left: `${hlRect.x}%`,
                                  top: `${hlRect.y}%`,
                                  width: `${hlRect.w}%`,
                                  height: `${hlRect.h}%`,
                                }}
                              />
                            ) : null}
                            {canEdit &&
                            fieldSuggestions.suggestions &&
                            fieldSuggestions.suggestions.fields.length > 0 ? (
                              <AIFieldOverlays
                                suggestions={fieldSuggestions.suggestions}
                                selectedIndices={
                                  fieldSuggestions.selectedIndices
                                }
                                toggleField={fieldSuggestions.toggleField}
                                currentPage={pdfViewer.currentPage}
                                pdfPageWidth={pdfViewer.pdfWidth}
                                pdfPageHeight={pdfViewer.pdfHeight}
                              />
                            ) : null}
                            {showAiFeatures &&
                            documentAnnotations.annotations ? (
                              <AIAnnotationOverlays
                                annotations={documentAnnotations.annotations}
                                enabledCategories={
                                  documentAnnotations.enabledCategories
                                }
                                currentPage={pdfViewer.currentPage}
                                pdfPageWidth={pdfViewer.pdfWidth}
                                pdfPageHeight={pdfViewer.pdfHeight}
                              />
                            ) : null}
                          </>
                        }
                        onSaveMarkup={
                          canEdit
                            ? async (buffer, options) => {
                                const copy = buffer.slice(0);
                                await saveMarkupMutation.mutateAsync({
                                  buffer,
                                  keepalive: options?.keepalive,
                                });
                                const url = URL.createObjectURL(
                                  new Blob([copy], { type: "application/pdf" })
                                );
                                if (savedMarkupUrlRef.current) {
                                  URL.revokeObjectURL(savedMarkupUrlRef.current);
                                }
                                savedMarkupUrlRef.current = url;
                                setSavedMarkupUrl(url);
                              }
                            : undefined
                        }
                      />
                    </>
                  ) : (
                    <>
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="text-kumo-default flex items-center gap-3 font-serif text-lg font-medium sm:flex-wrap sm:text-base">
                          <span>Document Preview</span>
                          {pdfViewer.numPages && (
                            <span className="bg-kumo-elevated text-kumo-secondary rounded-full px-2.5 py-1 font-sans text-xs font-medium">
                              {pdfViewer.numPages}{" "}
                              {pdfViewer.numPages === 1 ? "page" : "pages"}
                            </span>
                          )}
                        </div>
                      </div>
                      <LayerCard className="p-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <Loader />
                          <Text variant="secondary" size="sm">
                            Loading document…
                          </Text>
                        </div>
                      </LayerCard>
                    </>
                  )}
                </div>
              }
            />
          </div>

          <div className="flex min-h-0 flex-col overflow-hidden">
            <DocumentSidebar
              documentId={documentId}
              documentPublicId={documentPublicId}
              workflowStatus={
                documentData.workflowStatus
                  ? toWorkflowStatus(documentData.workflowStatus)
                  : undefined
              }
              createdAt={documentData.createdAt}
              description={documentData.description}
              fileSize={documentData.fileSize ?? 0}
              pageCount={documentData.pageCount}
              numPages={pdfViewer.numPages}
              recipients={sidebarRecipients}
              progress={progress}
              signatureFields={sidebarFields}
              currentUserRecipient={currentUserRecipient}
              currentUserFields={currentUserFields}
              onCurrentUserFieldsRefetch={() => {
                void refetchCurrentUserFields();
                void refetchCurrentUserRecipient();
                void refetchRecipients();
                void refetchFields();
              }}
              canEdit={canEdit}
              isUserAlreadyRecipient={isUserAlreadyRecipient}
              openSections={openSections}
              toggleSection={toggleSection}
              aiEnabled={showAiFeatures}
              documentAnnotations={documentAnnotations}
              aiProcessingStatus={documentData.aiProcessingStatus}
              selectedFieldId={fieldPlacement.selectedFieldId}
              onFieldSelect={fieldPlacement.handleFieldSelect}
              onFieldDelete={fieldPlacement.requestFieldDelete}
              onFieldProperties={(fieldId) => {
                if (!dismissRail()) return;
                fieldPlacement.setFieldPropertiesId(fieldId);
                fieldPlacement.setShowFieldProperties(true);
              }}
              onAddRecipient={() => {
                if (!dismissRail()) return;
                docState.setAddRecipientOpen(true);
              }}
              onAddMyself={() => {
                if (!dismissRail()) return;
                docState.setAddMyselfOpen(true);
              }}
              onRecipientOptions={(recipient) => {
                const full = recipients.find((r) => r._id === recipient._id);
                if (!full || !dismissRail()) return;
                docState.setSelectedRecipientForOptions({
                  _id: full._id,
                  publicId: full.publicId,
                  email: full.email,
                  name: full.name ?? undefined,
                  role: full.role,
                  status: full.status,
                  signingToken: full.signingToken,
                });
                docState.setRecipientOptionsOpen(true);
              }}
              activityEvents={activityEvents}
              onPageJump={pdfViewer.setCurrentPage}
              currentPage={pdfViewer.currentPage}
              onPdfChanged={() => {
                setPdfReloadKey((key) => key + 1);
              }}
              sendLabel={sendButtonLabel}
              canSend={sendDocumentValidation.canSend}
              sendBlockedReason={
                sendDocumentValidation.canSend
                  ? undefined
                  : sendDocumentValidation.tooltip
              }
              onSendDocument={handleSendIntent}
              onDownloadPdf={downloadSignedPdf}
              onVoidDocument={() => {
                void handleVoidDocument();
              }}
              onPlaceFields={handlePlaceFields}
              onEnsureSection={(section) => {
                if (!openSections.has(section)) {
                  toggleSection(section);
                }
              }}
              railOpen={railPanelId !== null}
              railStep={railStep}
              placementSignerId={fieldPlacement.selectedRecipientId}
              onPlacementSignerChange={(signerId) => {
                fieldPlacement.setSelectedRecipientId(
                  parseId("document_recipients", signerId)
                );
              }}
              onDismissRail={dismissRail}
              railPanel={
                railPanelId === "remove-recipient" ? (
                  <RemoveRecipientDialog
                    presentation="panel"
                    open
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
                ) : railPanelId === "recipient-options" ? (
                  <RecipientOptionsDialog
                    presentation="panel"
                    open
                    onOpenChange={docState.setRecipientOptionsOpen}
                    recipient={docState.selectedRecipientForOptions}
                    documentStatus={documentData.workflowStatus}
                    canEdit={canEdit}
                    onResendEmail={handleResendEmail}
                    onRemove={(recipient) => {
                      openRemoveRecipientDialog(recipient);
                    }}
                  />
                ) : railPanelId === "delete-field" ? (
                  <DeleteFieldDialog
                    presentation="panel"
                    open
                    onOpenChange={fieldPlacement.setShowFieldDeleteDialog}
                    onConfirm={fieldPlacement.handleFieldDeleteConfirm}
                    fieldType={
                      fieldPlacement.selectedFieldId
                        ? fieldPlacement.placedFields.find(
                            (field) => field.id === fieldPlacement.selectedFieldId
                          )?.fieldType
                        : undefined
                    }
                  />
                ) : railPanelId === "field-options" && optionsFieldType ? (
                  <FieldOptionsDialog
                    presentation="panel"
                    open
                    onOpenChange={(open) => {
                      if (!open) fieldPlacement.handleFieldOptionsCancel();
                    }}
                    fieldType={optionsFieldType}
                    onConfirm={fieldPlacement.handleFieldOptionsConfirm}
                    initialConfig={fieldPlacement.pendingFieldOptions ?? undefined}
                  />
                ) : railPanelId === "payment" ? (
                  <PaymentConfigModal
                    presentation="panel"
                    organizationSlug={slug}
                    documentPublicId={documentPublicId}
                    open
                    onSaved={fieldPlacement.commitPaymentConfig}
                    onOpenChange={(open) => {
                      if (!open) void fieldPlacement.closePaymentConfig();
                    }}
                    fieldPublicId={fieldPlacement.paymentConfigFieldId}
                  />
                ) : railPanelId === "field-properties" ? (
                  <FieldPropertiesDialog
                    presentation="panel"
                    organizationSlug={slug}
                    documentPublicId={documentPublicId}
                    open
                    onOpenChange={(open) => {
                      fieldPlacement.setShowFieldProperties(open);
                      if (!open) fieldPlacement.setFieldPropertiesId(null);
                    }}
                    field={
                      fieldPlacement.fieldPropertiesId
                        ? (signatureFields.find(
                            (field) =>
                              field._id === fieldPlacement.fieldPropertiesId
                          ) ?? null)
                        : null
                    }
                    recipients={recipients}
                    onSave={() => {
                      void refetchFields();
                    }}
                    onConfigurePayment={(fieldId) => {
                      const field = signatureFields.find(
                        (item) => item._id === fieldId
                      );
                      fieldPlacement.setShowFieldProperties(false);
                      fieldPlacement.openExistingPaymentConfig(
                        field?.publicId ?? null
                      );
                    }}
                  />
                ) : railPanelId === "send" ? (
                  <SendDocumentDialog
                    presentation="panel"
                    organizationSlug={slug}
                    documentPublicId={documentPublicId}
                    documentName={documentData.name}
                    recipients={recipients}
                    signatureFieldCount={signatureFieldCount}
                    requiresSigningField={signerRecipients(recipients).length > 0}
                    fieldCountsByRecipient={fieldCountsByRecipient}
                    paymentConfigs={paymentConfigs}
                    open
                    onOpenChange={docState.setSendDocumentOpen}
                    defaultDeadlineDays={signingSettings?.defaultDeadlineDays}
                    onSuccess={() => {
                      void refetchDocument();
                      void refetchRecipients();
                      void refetchProgress();
                      void refetchCurrentUserRecipient();
                      void refetchCurrentUserFields();
                    }}
                  />
                ) : railPanelId === "save-template" ? (
                  <SaveAsTemplateDialog
                    presentation="panel"
                    organizationSlug={slug}
                    documentPublicId={documentPublicId}
                    documentName={documentData.name}
                    open
                    onOpenChange={docState.setSaveAsTemplateOpen}
                  />
                ) : railPanelId === "add-myself" ? (
                  <AddMyselfDialog
                    open
                    onOpenChange={docState.setAddMyselfOpen}
                    onConfirm={handleAddMyselfConfirm}
                    userEmail={
                      userEmail ??
                      user?.primaryEmailAddress?.emailAddress ??
                      undefined
                    }
                    userName={user?.fullName || undefined}
                  />
                ) : railPanelId === "add-recipient" ? (
                  <AddRecipientDialog
                    presentation="panel"
                    organizationSlug={slug}
                    documentPublicId={documentPublicId}
                    slug={slug}
                    open={docState.addRecipientOpen}
                    onOpenChange={docState.setAddRecipientOpen}
                    onSuccess={() => refetchRecipients()}
                    existingRecipientEmails={recipients.map((r) => r.email)}
                    currentUserEmail={userEmail}
                  />
                ) : null
              }
            />
          </div>
        </div>

      </div>
    </PageWrapper>
  );
}
