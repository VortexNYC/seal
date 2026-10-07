import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { Collapsible } from "@cloudflare/kumo/components/collapsible";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Select } from "@cloudflare/kumo/components/select";
import { Loader } from "@cloudflare/kumo/components/loader";
import { Text } from "@cloudflare/kumo/components/text";
import { CaretDown as ChevronDownIcon, Check as CheckIcon, Eye as EyeIcon, Gear as SettingsIcon, PaperPlaneTilt as SendIcon, Plus as PlusIcon, Pulse as ActivityIcon, Signature as FileSignatureIcon, User as UserIcon, UserPlus as UserPlusIcon, Users as UsersIcon, X as XIcon } from "@phosphor-icons/react";
import { useEffect, useState, type ReactNode } from "react";

import { CitationReviewPanel } from "@/components/kumo-docs";
import type { ActivityEvent, ActivityEventType } from "@/lib/document-activity";
import {
  recipientFacingStatus,
  recipientMarkClass,
} from "@/lib/document-status";
import {
  formatDate,
  formatFileSize,
  formatRelativeTime,
  getInitials,
} from "@/lib/formatting";
import { parseId } from "@/lib/ids";
import { cn } from "@/lib/utils";

import { AIInsightsPanel } from "./ai-annotation-overlays";
import type { useDocumentAnnotations } from "./ai-annotation-overlays";
import {
  DocumentNextAction,
  type DocumentNextActionModel,
} from "./document-next-action";
import { DocumentProgressRing } from "./document-progress-ring";
import {
  DocumentSendSteps,
  resolveSendStep,
  type SendStepId,
} from "./document-send-steps";
import { placementFieldChooser } from "./document-rail";
import { FieldList } from "./field-list";
import { InAppSigningSection } from "./in-app-signing-section";
import type { DocumentWorkflowStatus } from "./workflow-status-badge";

type AIAnnotationsState = ReturnType<typeof useDocumentAnnotations>;

// Derive child-component prop types from their signatures to avoid duplication
type InAppRecipient = Parameters<typeof InAppSigningSection>[0]["recipient"];
type InAppFields = Parameters<typeof InAppSigningSection>[0]["fields"];
type ProgressData = Parameters<typeof DocumentProgressRing>[0]["progress"];
type FieldListField = Parameters<typeof FieldList>[0]["fields"][number];
type FieldListRecipient = Parameters<typeof FieldList>[0]["recipients"][number];

interface DocumentSidebarProps {
  documentId: string;
  documentPublicId: string;

  // Document metadata
  workflowStatus: DocumentWorkflowStatus | null | undefined;
  createdAt: number;
  description?: string | null;
  fileSize: number;
  pageCount?: number | null;
  numPages: number | null;

  // Recipients & progress
  recipients: FieldListRecipient[];
  progress: ProgressData | null | undefined;
  signatureFields: FieldListField[];

  // Current user's signing state
  currentUserRecipient: InAppRecipient | null;
  currentUserFields: InAppFields;
  onCurrentUserFieldsRefetch: () => void;

  // Permissions
  canEdit: boolean;
  isUserAlreadyRecipient: boolean;

  // Collapsible section state
  openSections: Set<string>;
  toggleSection: (section: string) => void;

  // AI state
  aiEnabled: boolean;
  documentAnnotations: AIAnnotationsState;
  aiProcessingStatus?: string | null;

  // Field placement callbacks (from useFieldPlacement)
  selectedFieldId: string | null;
  onFieldSelect: (fieldId: string | null) => void;
  onFieldDelete: () => void;
  onFieldProperties: (fieldId: string) => void;

  // Recipient action callbacks
  onAddRecipient: () => void;
  onAddMyself: () => void;
  onRecipientOptions: (
    recipient: FieldListRecipient & { status: string; signingToken?: string }
  ) => void;

  // Send / next-action
  sendLabel: string;
  canSend: boolean;
  sendBlockedReason?: string;
  onSendDocument: () => void;
  onDownloadPdf: () => void;
  onVoidDocument?: () => void;
  onPlaceFields: () => void;
  onEnsureSection: (section: string) => void;
  /** Replaces the rail body. People, Fields, and Send stay above it. */
  railOpen: boolean;
  railPanel: ReactNode;
  /** Returns false when the open form must stay. */
  onDismissRail: () => boolean;
  /** Which step stays selected while the rail body is replaced. */
  railStep?: SendStepId;
  placementSignerId?: string | null;
  onPlacementSignerChange?: (signerId: string) => void;

  // Activity
  activityEvents: ActivityEvent[];

  // Page navigation from insights panel
  onPageJump: (page: number) => void;

  /** Current PDF page (for rotate-current-page). */
  currentPage?: number;
  /** Called after rotate rewrites the stored PDF. */
  onPdfChanged?: () => void;
}

function getActivityIcon(type: ActivityEventType) {
  switch (type) {
    case "created":
      return <ActivityIcon className="h-3.5 w-3.5" />;
    case "recipient_added":
      return <UserPlusIcon className="h-3.5 w-3.5" />;
    case "sent":
      return <SendIcon className="h-3.5 w-3.5" />;
    case "viewed":
      return <EyeIcon className="h-3.5 w-3.5" />;
    case "signed":
    case "approved":
    case "completed":
      return <CheckIcon className="h-3.5 w-3.5" />;
    case "declined":
    case "cancelled":
      return <XIcon className="h-3.5 w-3.5" />;
    default:
      return <ActivityIcon className="h-3.5 w-3.5" />;
  }
}

function activityDotClass(type: ActivityEventType): string {
  switch (type) {
    case "declined":
      return "[&_.activity-dot]:border-kumo-danger/30 [&_.activity-dot]:bg-kumo-danger/10 [&_.activity-dot]:text-kumo-danger";
    default:
      return "[&_.activity-dot]:border-kumo-line [&_.activity-dot]:bg-kumo-base [&_.activity-dot]:text-kumo-secondary";
  }
}

function EmptySection({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="px-4 py-8 text-center sm:px-3 sm:py-6">
      <div className="bg-kumo-elevated text-kumo-secondary sm:rounded-card mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl sm:h-10 sm:w-10">
        {icon}
      </div>
      <div className="text-kumo-default mb-1 font-sans text-sm font-semibold">
        {title}
      </div>
      <div className="text-kumo-secondary font-sans text-xs leading-relaxed">
        {description}
      </div>
    </div>
  );
}

function RecipientRow({
  recipient,
  onRecipientOptions,
  workflowStatus,
}: {
  recipient: FieldListRecipient;
  onRecipientOptions: DocumentSidebarProps["onRecipientOptions"];
  workflowStatus: DocumentWorkflowStatus | undefined;
}) {
  const storedStatus =
    "status" in recipient && typeof recipient.status === "string"
      ? recipient.status
      : "pending";
  const status = recipientFacingStatus(workflowStatus, storedStatus);
  const statusColorClass = recipientMarkClass(status);

  return (
    <div className="bg-kumo-elevated hover:border-kumo-line hover:bg-kumo-elevated flex items-center gap-3.5 rounded-xl border border-transparent p-3.5 transition-colors sm:flex-wrap sm:gap-2.5 sm:p-3">
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-sans text-sm font-semibold sm:h-9 sm:w-9",
          statusColorClass
        )}
      >
        {getInitials(recipient.name ?? undefined, recipient.email)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-kumo-default truncate font-sans text-sm font-semibold">
          {recipient.name || recipient.email}
        </div>
        {recipient.name && (
          <div className="text-kumo-secondary truncate font-sans text-xs">
            {recipient.email}
          </div>
        )}
      </div>
      <span
        className={cn(
          "text-xs rounded-full px-2.5 py-1 font-sans font-semibold whitespace-nowrap sm:px-2 sm:py-0.5",
          statusColorClass
        )}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
      <span title="Options for this recipient" className="inline-flex">
      <Button
        variant="ghost"
        shape="square"
        size="sm"
        aria-label="Recipient options"
        icon={SettingsIcon}
        onClick={() =>
          onRecipientOptions({
            ...recipient,
            status: storedStatus,
            signingToken:
              "signingToken" in recipient &&
              typeof recipient.signingToken === "string"
                ? recipient.signingToken
                : undefined,
          })
        }
      />
      </span>
    </div>
  );
}

function RecipientsSection({
  recipients,
  canEdit,
  isUserAlreadyRecipient,
  open,
  onOpenChange,
  onAddMyself,
  onAddRecipient,
  onRecipientOptions,
  workflowStatus,
}: {
  recipients: FieldListRecipient[];
  canEdit: boolean;
  isUserAlreadyRecipient: boolean;
  open: boolean;
  onOpenChange: () => void;
  onAddMyself: () => void;
  onAddRecipient: () => void;
  onRecipientOptions: DocumentSidebarProps["onRecipientOptions"];
  workflowStatus: DocumentWorkflowStatus | undefined;
}) {
  return (
    <LayerCard>
      <Collapsible.Root open={open} onOpenChange={onOpenChange}>
      <Collapsible.Trigger title="Show or hide recipients" className="flex w-full items-center justify-between gap-2 p-4 text-left">
        <div className="flex items-center gap-3">
          <span className="font-medium">
            Recipients
          </span>
          {recipients.length > 0 && (
            <Badge variant="secondary">{recipients.length}</Badge>
          )}
        </div>
        <ChevronDownIcon
          className={cn(
            "text-kumo-secondary h-4 w-4 transition-transform",
            open && "rotate-180"
          )}
        />
      </Collapsible.Trigger>
      <Collapsible.Panel className="px-4 pb-4">
        {recipients.length > 0 ? (
          <div className="mt-4 flex flex-col gap-2.5 sm:gap-2">
            {recipients.map((recipient) => (
              <RecipientRow
                key={recipient._id}
                recipient={recipient}
                onRecipientOptions={onRecipientOptions}
                workflowStatus={workflowStatus}
              />
            ))}
          </div>
        ) : !canEdit ? (
          <EmptySection
            icon={<UsersIcon className="size-6" />}
            title="No recipients"
            description="Recipients who need to sign or view this document show up here."
          />
        ) : null}
        {canEdit ? (
          <div className="mt-3 flex flex-col gap-2">
            {!isUserAlreadyRecipient ? (
              <span title="Add your account as a signer" className="inline-flex w-full">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={onAddMyself}
                  icon={UserIcon}
                >
                  Add myself as signer
                </Button>
              </span>
            ) : null}
            <span title="Add someone who needs to sign or view" className="inline-flex w-full">
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                icon={PlusIcon}
                onClick={onAddRecipient}
              >
                Add Recipient
              </Button>
            </span>
          </div>
        ) : null}
      </Collapsible.Panel>
      </Collapsible.Root>
    </LayerCard>
  );
}

function AIInsightsSection({
  canEdit,
  aiEnabled,
  documentAnnotations,
  aiProcessingStatus,
  open,
  onOpenChange,
  onPageJump,
}: {
  canEdit: boolean;
  aiEnabled: boolean;
  documentAnnotations: AIAnnotationsState;
  aiProcessingStatus?: string | null;
  open: boolean;
  onOpenChange: () => void;
  onPageJump: (page: number) => void;
}) {
  if (!canEdit || !aiEnabled) return null;
  if (!documentAnnotations.annotations && aiProcessingStatus === "processing") {
    return (
      <LayerCard className="flex items-center gap-3 p-4">
        <Loader size="sm" />
        <Text size="sm" bold>
          Scanning for insights...
        </Text>
      </LayerCard>
    );
  }
  if (!documentAnnotations.annotations) return null;

  return (
    <LayerCard>
      <Collapsible.Root open={open} onOpenChange={onOpenChange}>
      <Collapsible.Trigger title="Show or hide insights" className="flex w-full items-center justify-between gap-2 p-4 text-left">
        <div className="flex items-center gap-3">
          <span className="font-medium">
            Insights
          </span>
          <Badge variant="secondary">{documentAnnotations.annotations.annotations.length}</Badge>
        </div>
        <ChevronDownIcon
          className={cn(
            "text-kumo-secondary h-4 w-4 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </Collapsible.Trigger>
      <Collapsible.Panel className="px-4 pb-4">
        <div className="mt-3 space-y-4">
          <AIInsightsPanel
            annotations={documentAnnotations.annotations}
            enabledCategories={documentAnnotations.enabledCategories}
            toggleCategory={documentAnnotations.toggleCategory}
            onDismiss={documentAnnotations.handleDismiss}
            onPageJump={onPageJump}
          />
          <CitationReviewPanel
            className="border-kumo-line max-h-80 overflow-hidden rounded-lg border"
            fields={documentAnnotations.annotations.annotations.map(
              (annotation, index) => ({
                id: `${annotation.page}-${index}`,
                label: annotation.summary || annotation.category,
                value: annotation.text,
                category: annotation.category,
                severity: annotation.severity,
                bbox: {
                  page: annotation.page,
                  x: annotation.x,
                  y: annotation.y,
                  width: annotation.width,
                  height: annotation.height,
                },
              })
            )}
            onJumpToCitation={(field) => {
              if (field.bbox) onPageJump(field.bbox.page);
            }}
            onFocus={(field) => {
              if (field.bbox) onPageJump(field.bbox.page);
            }}
            onDismiss={documentAnnotations.handleDismiss}
          />
        </div>
      </Collapsible.Panel>
      </Collapsible.Root>
    </LayerCard>
  );
}

function SignatureFieldsSection({
  recipients,
  signatureFields,
  canEdit,
  selectedFieldId,
  open,
  onOpenChange,
  onFieldSelect,
  onFieldDelete,
  onFieldProperties,
  placementSigners,
  placementSignerId,
  onPlacementSignerChange,
}: {
  recipients: FieldListRecipient[];
  signatureFields: FieldListField[];
  canEdit: boolean;
  selectedFieldId: string | null;
  open: boolean;
  onOpenChange: () => void;
  onFieldSelect: (fieldId: string | null) => void;
  onFieldDelete: () => void;
  onFieldProperties: (fieldId: string) => void;
  placementSigners: ReadonlyArray<{
    _id: string;
    name?: string;
    email: string;
  }>;
  placementSignerId?: string | null;
  onPlacementSignerChange?: (signerId: string) => void;
}) {
  if (signatureFields.length === 0 && !canEdit) return null;

  return (
    <LayerCard>
      <Collapsible.Root open={open} onOpenChange={onOpenChange}>
      <Collapsible.Trigger title="Show or hide placed fields" className="flex w-full items-center justify-between gap-2 p-4 text-left">
        <div className="flex items-center gap-3">
          <span className="font-medium">
            Fields
          </span>
          {signatureFields.length > 0 && (
            <Badge variant="secondary">{signatureFields.length}</Badge>
          )}
        </div>
        <ChevronDownIcon
          className={cn(
            "text-kumo-secondary h-4 w-4 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </Collapsible.Trigger>
      <Collapsible.Panel className="px-4 pb-4">
        {canEdit && placementFieldChooser(placementSigners.length) === "named" ? (
          <Text as="p" variant="secondary" size="xs" DANGEROUS_className="mt-3">
            Placing fields for{" "}
            {placementSigners[0]?.name || placementSigners[0]?.email}
          </Text>
        ) : null}
        {canEdit &&
        placementFieldChooser(placementSigners.length) === "select" &&
        onPlacementSignerChange ? (
          <div className="mt-3">
            <Select
              value={placementSignerId ?? placementSigners[0]?._id ?? ""}
              onValueChange={(value) => {
                if (value) onPlacementSignerChange(value);
              }}
              label="Placing fields for"
              renderValue={(value) => {
                const signer = placementSigners.find(
                  (recipient) => recipient._id === value
                );
                return signer?.name || signer?.email || "Choose a signer";
              }}
            >
              {placementSigners.map((signer) => (
                <Select.Option key={signer._id} value={signer._id}>
                  {signer.name || signer.email}
                </Select.Option>
              ))}
            </Select>
          </div>
        ) : null}
        {signatureFields.length > 0 ? (
          <FieldList
            fields={signatureFields}
            recipients={recipients}
            selectedFieldId={canEdit ? selectedFieldId : null}
            canEdit={canEdit}
            onFieldSelect={canEdit ? onFieldSelect : undefined}
            onFieldDelete={canEdit ? onFieldDelete : undefined}
            onFieldProperties={canEdit ? onFieldProperties : undefined}
          />
        ) : (
          <EmptySection
            icon={<FileSignatureIcon className="size-6" />}
            title="No fields yet"
            description="Choose a field on the toolbar, then click the page."
          />
        )}
      </Collapsible.Panel>
      </Collapsible.Root>
    </LayerCard>
  );
}

function DetailMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <LayerCard className="p-3">
      <Text variant="secondary" size="xs">
        {label}
      </Text>
      <Text size="sm">{value}</Text>
    </LayerCard>
  );
}

function DocumentDetailsSection({
  open,
  onOpenChange,
  fileSize,
  pageCount,
  numPages,
  createdAt,
  signatureFields,
  description,
}: {
  open: boolean;
  onOpenChange: () => void;
  fileSize: number;
  pageCount?: number | null;
  numPages: number | null;
  createdAt: number;
  signatureFields: FieldListField[];
  description?: string | null;
}) {
  return (
    <LayerCard>
      <Collapsible.Root open={open} onOpenChange={onOpenChange}>
      <Collapsible.Trigger title="Show or hide document details" className="flex w-full items-center justify-between gap-2 p-4 text-left">
        <div className="flex items-center gap-3">
          <span className="font-medium">
            Details
          </span>
        </div>
        <ChevronDownIcon
          className={cn(
            "text-kumo-secondary h-4 w-4 transition-transform",
            open && "rotate-180"
          )}
        />
      </Collapsible.Trigger>
      <Collapsible.Panel className="px-4 pb-4">
        <div className="mt-4 grid grid-cols-2 gap-4 sm:gap-2.5">
          <DetailMetric label="File Size" value={formatFileSize(fileSize)} />
          <DetailMetric label="Pages" value={pageCount || numPages || "—"} />
          <DetailMetric label="Uploaded" value={formatDate(createdAt)} />
          <DetailMetric label="Fields" value={signatureFields.length} />
        </div>
        {description && (
          <LayerCard className="col-span-2 mt-4 p-3">
            <Text variant="secondary" size="xs">
              Description
            </Text>
            <Text size="sm">{description}</Text>
          </LayerCard>
        )}
      </Collapsible.Panel>
      </Collapsible.Root>
    </LayerCard>
  );
}

function ActivityEventRow({
  event,
  index,
}: {
  event: ActivityEvent;
  index: number;
}) {
  return (
    <div
      className={cn(
        "relative flex gap-4 py-3 first:pt-0 last:pb-0",
        activityDotClass(event.type)
      )}
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div className="activity-dot relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 sm:h-7 sm:w-7">
        {getActivityIcon(event.type)}
      </div>
      <div className="min-w-0 flex-1 pt-1">
        <div className="text-kumo-default text-sm font-sans leading-snug sm:text-xs">
          {event.description}
        </div>
        <div className="text-kumo-secondary text-xs mt-1 font-sans">
          {formatRelativeTime(event.timestamp)}
        </div>
      </div>
    </div>
  );
}

function ActivitySection({
  open,
  onOpenChange,
  activityEvents,
}: {
  open: boolean;
  onOpenChange: () => void;
  activityEvents: ActivityEvent[];
}) {
  return (
    <LayerCard>
      <Collapsible.Root open={open} onOpenChange={onOpenChange}>
      <Collapsible.Trigger title="Show or hide activity" className="flex w-full items-center justify-between gap-2 p-4 text-left">
        <div className="flex items-center gap-3">
          <span className="font-medium">
            Activity
          </span>
          {activityEvents.length > 0 && (
            <Badge variant="secondary">{activityEvents.length}</Badge>
          )}
        </div>
        <ChevronDownIcon
          className={cn(
            "text-kumo-secondary h-4 w-4 transition-transform",
            open && "rotate-180"
          )}
        />
      </Collapsible.Trigger>
      <Collapsible.Panel className="px-4 pb-4">
        {activityEvents.length > 0 ? (
          <div className="before:bg-border before:content-empty relative mt-4 before:absolute before:top-2 before:bottom-2 before:left-3.75 before:w-0.5 before:rounded-sm sm:before:left-3.25">
            {activityEvents.slice(0, 10).map((event, index) => (
              <ActivityEventRow
                key={`${event.type}-${event.timestamp}`}
                event={event}
                index={index}
              />
            ))}
          </div>
        ) : (
          <EmptySection
            icon={<ActivityIcon className="size-6" />}
            title="No activity yet"
            description="Activity will appear here as recipients interact with this document."
          />
        )}
      </Collapsible.Panel>
      </Collapsible.Root>
    </LayerCard>
  );
}

function buildNextActionModel(input: {
  isDraftBuilder: boolean;
  isCompleted: boolean;
  signingRecipient: InAppRecipient | null;
  recipients: FieldListRecipient[];
  signatureFields: FieldListField[];
  canSend: boolean;
  sendBlockedReason?: string;
  sendLabel: string;
  onSendDocument: () => void;
  onDownloadPdf: () => void;
  onAddRecipient: () => void;
  onEnsureSection: (section: string) => void;
  waitingDetail: string;
  workflowStatus: DocumentWorkflowStatus | undefined;
}): DocumentNextActionModel {
  if (input.isCompleted) {
    return { kind: "done", onDownload: input.onDownloadPdf };
  }

  if (input.workflowStatus === "cancelled") {
    return {
      kind: "status",
      detail: "This document was voided. Signers can no longer finish it.",
    };
  }

  if (input.signingRecipient) {
    return {
      kind: "sign_yourself",
      onAction: () => input.onEnsureSection("your-signature"),
    };
  }

  if (input.isDraftBuilder) {
    if (input.recipients.length === 0) {
      return {
        kind: "add_people",
        onAction: () => {
          input.onEnsureSection("recipients");
          input.onAddRecipient();
        },
      };
    }
    if (input.signatureFields.length === 0) {
      return {
        kind: "place_fields",
        onAction: () => input.onEnsureSection("fields"),
      };
    }
    if (input.canSend) {
      return {
        kind: "send",
        label: input.sendLabel,
        onAction: input.onSendDocument,
      };
    }
    return {
      kind: "fix_fields",
      detail:
        input.sendBlockedReason ??
        "Assign every field to a recipient before sending.",
      onAction: () => input.onEnsureSection("fields"),
    };
  }

  return {
    kind: "waiting",
    detail: input.waitingDetail,
  };
}

export function DocumentSidebar(props: DocumentSidebarProps) {
  // Normalize null → undefined for components that don't accept null
  const normalizedWorkflowStatus = props.workflowStatus ?? undefined;
  const isDraft =
    !normalizedWorkflowStatus || normalizedWorkflowStatus === "draft";
  const isDraftBuilder = props.canEdit && isDraft;
  const isOversight = !isDraft;
  const visibleProgress =
    isOversight && normalizedWorkflowStatus !== "cancelled"
      ? props.progress
      : null;
  const signingRecipient =
    props.currentUserRecipient !== null &&
    isOversight &&
    normalizedWorkflowStatus !== "completed" &&
    normalizedWorkflowStatus !== "cancelled" &&
    (props.currentUserRecipient.role === "signer" ||
      props.currentUserRecipient.role === "approver")
      ? props.currentUserRecipient
      : null;
  const pendingRecipients =
    (props.progress?.byStatus.pending ?? 0) +
    (props.progress?.byStatus.viewed ?? 0);
  const waitingDetail =
    pendingRecipients > 0
      ? `${pendingRecipients} recipient${pendingRecipients === 1 ? "" : "s"} still need to act.`
      : "Waiting on the next step in this envelope.";

  const nextAction = buildNextActionModel({
    isDraftBuilder,
    isCompleted: normalizedWorkflowStatus === "completed",
    signingRecipient,
    recipients: props.recipients,
    signatureFields: props.signatureFields,
    canSend: props.canSend,
    sendBlockedReason: props.sendBlockedReason,
    sendLabel: props.sendLabel,
    onSendDocument: props.onSendDocument,
    onDownloadPdf: props.onDownloadPdf,
    onAddRecipient: props.onAddRecipient,
    onEnsureSection: props.onEnsureSection,
    waitingDetail,
    workflowStatus: normalizedWorkflowStatus,
  });

  const derivedStep = resolveSendStep({
    recipientCount: props.recipients.length,
    fieldCount: props.signatureFields.length,
    canSend: props.canSend,
  });
  const [chosenStep, setChosenStep] = useState<SendStepId | null>(null);
  const sendStep = chosenStep ?? derivedStep;
  const placementSigners = props.recipients.flatMap((recipient) => {
    if (!("role" in recipient) || recipient.role !== "signer") return [];
    return [
      {
        _id: recipient._id,
        name: recipient.name,
        email: recipient.email,
      },
    ];
  });

  useEffect(() => {
    if (props.railStep) setChosenStep(props.railStep);
  }, [props.railStep]);

  const selectStep = (step: SendStepId): void => {
    if (!props.onDismissRail()) return;
    setChosenStep(step);
    if (step === 1) {
      props.onEnsureSection("recipients");
      return;
    }
    if (step === 2) {
      props.onPlaceFields();
      return;
    }
    props.onSendDocument();
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {isDraftBuilder ? (
        <div className="shrink-0">
          <DocumentSendSteps current={sendStep} onSelect={selectStep} />
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto [&>*]:shrink-0 sm:gap-4">
      {props.railOpen ? (
        props.railPanel
      ) : (
      <>
      {/* SendSteps already covers add_people / place_fields — keep NextAction for send/block/sign/wait. */}
      {nextAction.kind !== "add_people" &&
      nextAction.kind !== "place_fields" ? (
        <DocumentNextAction
          workflowStatus={normalizedWorkflowStatus}
          createdAt={props.createdAt}
          model={nextAction}
          onVoid={
            props.onVoidDocument &&
            (normalizedWorkflowStatus === "sent" ||
              normalizedWorkflowStatus === "in_progress")
              ? props.onVoidDocument
              : undefined
          }
        />
      ) : null}
      {visibleProgress && <DocumentProgressRing progress={visibleProgress} />}
      {signingRecipient && (
        <InAppSigningSection
          documentId={parseId("documents", props.documentId)}
          recipient={signingRecipient}
          fields={props.currentUserFields}
          isOpen={props.openSections.has("your-signature")}
          onOpenChange={() => props.toggleSection("your-signature")}
          onFieldsRefetch={props.onCurrentUserFieldsRefetch}
        />
      )}
      <RecipientsSection
        recipients={props.recipients}
        canEdit={props.canEdit}
        isUserAlreadyRecipient={props.isUserAlreadyRecipient}
        open={props.openSections.has("recipients")}
        onOpenChange={() => props.toggleSection("recipients")}
        onAddMyself={props.onAddMyself}
        onAddRecipient={props.onAddRecipient}
        onRecipientOptions={props.onRecipientOptions}
        workflowStatus={normalizedWorkflowStatus}
      />
      <SignatureFieldsSection
        recipients={props.recipients}
        signatureFields={props.signatureFields}
        canEdit={props.canEdit}
        selectedFieldId={props.selectedFieldId}
        open={props.openSections.has("fields")}
        onOpenChange={() => props.toggleSection("fields")}
        onFieldSelect={props.onFieldSelect}
        onFieldDelete={props.onFieldDelete}
        onFieldProperties={props.onFieldProperties}
        placementSigners={placementSigners}
        placementSignerId={props.placementSignerId}
        onPlacementSignerChange={props.onPlacementSignerChange}
      />
      <AIInsightsSection
        canEdit={props.canEdit}
        aiEnabled={props.aiEnabled}
        documentAnnotations={props.documentAnnotations}
        aiProcessingStatus={props.aiProcessingStatus}
        open={props.openSections.has("insights")}
        onOpenChange={() => props.toggleSection("insights")}
        onPageJump={props.onPageJump}
      />
      {isOversight && (
        <DocumentDetailsSection
          open={props.openSections.has("details")}
          onOpenChange={() => props.toggleSection("details")}
          fileSize={props.fileSize}
          pageCount={props.pageCount}
          numPages={props.numPages}
          createdAt={props.createdAt}
          signatureFields={props.signatureFields}
          description={props.description}
        />
      )}
      {isOversight && (
        <ActivitySection
          open={props.openSections.has("activity")}
          onOpenChange={() => props.toggleSection("activity")}
          activityEvents={props.activityEvents}
        />
      )}
      </>
      )}
      </div>
    </div>
  );
}
