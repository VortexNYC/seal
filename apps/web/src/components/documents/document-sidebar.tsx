import type { Id } from "@seal/backend/convex/_generated/dataModel";
import {
  ActivityIcon,
  ChevronDownIcon,
  FileSignatureIcon,
  InfoIcon,
  LinkIcon,
  Loader2Icon,
  PlusIcon,
  SaveIcon,
  ScanSearchIcon,
  SendIcon,
  SettingsIcon,
  UserIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import type { ActivityEvent, ActivityEventType } from "@/lib/document-activity";
import {
  formatDate,
  formatFileSize,
  formatRelativeTime,
  getInitials,
} from "@/lib/formatting";
import { cn } from "@/lib/utils";

import { Button } from "../ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { AIInsightsPanel } from "./ai-annotation-overlays";
import type { useDocumentAnnotations } from "./ai-annotation-overlays";
import { AIChatPanel } from "./ai-chat-panel";
import { DocumentProgressRing } from "./document-progress-ring";
import { DocumentStatusHero } from "./document-status-hero";
import { FieldList } from "./field-list";
import { FieldToolbar } from "./field-toolbar";
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
  slug: string;

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
  // Typed loosely since Convex adds computed fields not in the static interface
  currentUserFields: unknown[];
  onCurrentUserFieldsRefetch: () => void;

  // Permissions
  canEdit: boolean;
  isUserAlreadyRecipient: boolean;
  merchantPaymentsReady: boolean;

  // Collapsible section state
  openSections: Set<string>;
  toggleSection: (section: string) => void;

  // AI state
  aiEnabled: boolean;
  documentAnnotations: AIAnnotationsState;
  showAIChat: boolean;
  onCloseAIChat: () => void;
  threadId: string | null;
  aiProcessingStatus?: string | null;

  // Whether any recipient has the "signer" role (for FieldToolbar disabled state)
  hasSigners: boolean;

  // Field placement callbacks (from useFieldPlacement)
  selectedFieldId: string | null;
  onFieldSelect: (fieldId: string | null) => void;
  onFieldDelete: () => void;
  onFieldProperties: (fieldId: string) => void;
  onFieldDragStart: (fieldType: string) => void;
  onFieldDragEnd: () => void;

  // Redirect URL state (document settings)
  redirectUrlInput: string;
  redirectUrlError: string | null;
  isSavingRedirect: boolean;
  onRedirectUrlChange: (url: string) => void;
  onSaveRedirectUrl: () => void;

  // Recipient action callbacks
  onAddRecipient: () => void;
  onAddMyself: () => void;
  onRecipientOptions: (
    recipient: FieldListRecipient & { status: string; signingToken?: string }
  ) => void;

  // Activity
  activityEvents: ActivityEvent[];

  // Page navigation from insights panel
  onPageJump: (page: number) => void;
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
      return <ActivityIcon className="h-3.5 w-3.5" />;
  }
}

function activityDotClass(type: ActivityEventType): string {
  switch (type) {
    case "signed":
    case "approved":
    case "completed":
      return "[&_.activity-dot]:border-status-completed-border [&_.activity-dot]:bg-status-completed-surface [&_.activity-dot]:text-status-completed-text";
    case "viewed":
      return "[&_.activity-dot]:border-info-surface [&_.activity-dot]:bg-info-surface [&_.activity-dot]:text-info";
    case "declined":
      return "[&_.activity-dot]:border-destructive/30 [&_.activity-dot]:bg-destructive/10 [&_.activity-dot]:text-destructive";
    default:
      return "[&_.activity-dot]:border-border [&_.activity-dot]:bg-card [&_.activity-dot]:text-muted-foreground";
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
      <div className="bg-muted text-muted-foreground mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl sm:h-10 sm:w-10 sm:rounded-[10px]">
        {icon}
      </div>
      <div className="text-foreground mb-1 font-sans text-sm font-semibold sm:text-[0.8125rem]">
        {title}
      </div>
      <div className="text-muted-foreground font-sans text-xs leading-relaxed sm:text-[0.6875rem]">
        {description}
      </div>
    </div>
  );
}

function RecipientRow({
  recipient,
  onRecipientOptions,
}: {
  recipient: FieldListRecipient;
  onRecipientOptions: DocumentSidebarProps["onRecipientOptions"];
}) {
  const status =
    "status" in recipient ? (recipient.status as string) : "pending";
  const statusColorClass =
    status === "viewed"
      ? "bg-info-surface text-info"
      : status === "signed" || status === "approved"
        ? "bg-status-completed-surface text-status-completed-text"
        : status === "declined"
          ? "bg-destructive/10 text-destructive"
          : "bg-muted text-muted-foreground";

  return (
    <div className="bg-muted hover:border-border hover:bg-muted flex items-center gap-3.5 rounded-xl border border-transparent p-3.5 transition-colors sm:flex-wrap sm:gap-2.5 sm:p-3">
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-sans text-sm font-semibold sm:h-9 sm:w-9 sm:text-[0.8125rem]",
          statusColorClass
        )}
      >
        {getInitials(recipient.name ?? undefined, recipient.email)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-foreground truncate font-sans text-sm font-semibold sm:text-[0.8125rem]">
          {recipient.name || recipient.email}
        </div>
        {recipient.name && (
          <div className="text-muted-foreground truncate font-sans text-xs sm:text-[0.6875rem]">
            {recipient.email}
          </div>
        )}
      </div>
      <span
        className={cn(
          "rounded-full px-2.5 py-1 font-sans text-[0.6875rem] font-semibold whitespace-nowrap sm:px-2 sm:py-0.5 sm:text-[0.625rem]",
          statusColorClass
        )}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() =>
          onRecipientOptions(
            recipient as FieldListRecipient & {
              status: string;
              signingToken?: string;
            }
          )
        }
        title="Recipient options"
      >
        <SettingsIcon className="text-muted-foreground h-4 w-4" />
      </Button>
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
}: {
  recipients: FieldListRecipient[];
  canEdit: boolean;
  isUserAlreadyRecipient: boolean;
  open: boolean;
  onOpenChange: () => void;
  onAddMyself: () => void;
  onAddRecipient: () => void;
  onRecipientOptions: DocumentSidebarProps["onRecipientOptions"];
}) {
  return (
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      className="border-border bg-card overflow-hidden rounded-2xl border shadow-sm sm:rounded-xl"
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="hover:bg-muted flex w-full cursor-pointer items-center justify-between px-5 py-4 transition-colors select-none sm:px-4 sm:py-3.5"
        >
          <div className="flex items-center gap-3">
            <div className="bg-info-surface text-info flex h-9 w-9 items-center justify-center rounded-[10px] sm:h-8 sm:w-8 sm:rounded-lg">
              <UsersIcon className="h-[18px] w-[18px] sm:h-4 sm:w-4" />
            </div>
            <span className="text-foreground font-sans text-[0.9375rem] font-semibold sm:text-sm">
              Recipients
            </span>
            {recipients.length > 0 && (
              <span className="bg-muted text-muted-foreground ml-2 rounded-xl px-2 py-0.5 font-sans text-[0.6875rem] font-semibold">
                {recipients.length}
              </span>
            )}
          </div>
          <ChevronDownIcon
            className={cn(
              "text-muted-foreground h-4 w-4 transition-transform",
              open && "rotate-180"
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-border/50 border-t px-5 pb-5 sm:px-4 sm:pb-4">
        {canEdit && !isUserAlreadyRecipient && (
          <Button
            variant="outline"
            size="sm"
            className="mt-3 mb-3 w-full"
            onClick={onAddMyself}
          >
            <UserIcon className="mr-2 h-4 w-4" />
            Add myself as signer
          </Button>
        )}
        {recipients.length > 0 ? (
          <div className="mt-4 flex flex-col gap-2.5 sm:gap-2">
            {recipients.map((recipient) => (
              <RecipientRow
                key={recipient._id}
                recipient={recipient}
                onRecipientOptions={onRecipientOptions}
              />
            ))}
          </div>
        ) : (
          <EmptySection
            icon={<UsersIcon className="h-6 w-6" />}
            title="No recipients"
            description="Add recipients who need to sign or view this document."
          />
        )}
        {canEdit && (
          <button
            type="button"
            className="border-border text-muted-foreground hover:border-primary hover:bg-primary/5 hover:text-primary mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] border-2 border-dashed bg-transparent p-3 font-sans text-[0.8125rem] font-semibold transition-[color,border-color,background-color] sm:rounded-lg sm:p-2.5 sm:text-xs"
            onClick={onAddRecipient}
          >
            <PlusIcon className="h-4 w-4" />
            Add Recipient
          </button>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

function DocumentSettingsSection({
  open,
  onOpenChange,
  redirectUrlInput,
  redirectUrlError,
  isSavingRedirect,
  onRedirectUrlChange,
  onSaveRedirectUrl,
}: {
  open: boolean;
  onOpenChange: () => void;
  redirectUrlInput: string;
  redirectUrlError: string | null;
  isSavingRedirect: boolean;
  onRedirectUrlChange: (url: string) => void;
  onSaveRedirectUrl: () => void;
}) {
  return (
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      className="border-border bg-card overflow-hidden rounded-2xl border shadow-sm sm:rounded-xl"
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="hover:bg-muted flex w-full cursor-pointer items-center justify-between px-5 py-4 transition-colors select-none sm:px-4 sm:py-3.5"
        >
          <div className="flex items-center gap-3">
            <div className="bg-muted text-muted-foreground flex h-9 w-9 items-center justify-center rounded-[10px] sm:h-8 sm:w-8 sm:rounded-lg">
              <SettingsIcon className="h-[18px] w-[18px] sm:h-4 sm:w-4" />
            </div>
            <span className="text-foreground font-sans text-[0.9375rem] font-semibold sm:text-sm">
              Document Settings
            </span>
          </div>
          <ChevronDownIcon
            className={cn(
              "text-muted-foreground h-4 w-4 transition-transform",
              open && "rotate-180"
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-border/50 border-t px-5 pb-5 sm:px-4 sm:pb-4">
        <div className="mt-4 space-y-5">
          <div className="space-y-2">
            <Label className="text-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
              <LinkIcon className="h-3.5 w-3.5" />
              Redirect after signing
            </Label>
            <p className="text-muted-foreground text-xs">
              Recipients are sent to this URL after signing. Leave empty for the
              default thank-you page.
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="https://example.com/thank-you"
                value={redirectUrlInput}
                onChange={(event) => onRedirectUrlChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") onSaveRedirectUrl();
                }}
                className="text-sm"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={onSaveRedirectUrl}
                disabled={isSavingRedirect}
              >
                {isSavingRedirect ? (
                  <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <SaveIcon className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
            {redirectUrlError && (
              <p className="text-destructive text-xs">{redirectUrlError}</p>
            )}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function AIChatSection({
  canEdit,
  aiEnabled,
  showAIChat,
  threadId,
  slug,
  onCloseAIChat,
}: {
  canEdit: boolean;
  aiEnabled: boolean;
  showAIChat: boolean;
  threadId: string | null;
  slug: string;
  onCloseAIChat: () => void;
}) {
  if (!canEdit || !aiEnabled || !showAIChat) return null;
  if (threadId)
    return (
      <AIChatPanel threadId={threadId} slug={slug} onClose={onCloseAIChat} />
    );

  return (
    <div className="border-border bg-card flex flex-col items-center gap-3 rounded-2xl border p-8 shadow-sm sm:rounded-xl">
      <Loader2Icon className="text-ai-accent h-5 w-5 animate-spin" />
      <p className="text-muted-foreground font-sans text-sm">
        Starting AI assistant...
      </p>
    </div>
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
      <div className="border-border bg-muted/30 flex items-center gap-3 rounded-2xl border border-dashed px-5 py-4 sm:rounded-xl">
        <Loader2Icon className="text-muted-foreground/60 h-4 w-4 animate-spin" />
        <span className="text-muted-foreground font-sans text-xs">
          Scanning for insights...
        </span>
      </div>
    );
  }
  if (!documentAnnotations.annotations) return null;

  return (
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      className="border-border bg-card overflow-hidden rounded-2xl border shadow-sm sm:rounded-xl"
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="hover:bg-muted flex w-full cursor-pointer items-center justify-between px-5 py-4 transition-colors select-none sm:px-4 sm:py-3.5"
        >
          <div className="flex items-center gap-3">
            <div className="bg-ai-accent-surface text-ai-accent flex h-9 w-9 items-center justify-center rounded-[10px] sm:h-8 sm:w-8 sm:rounded-lg">
              <ScanSearchIcon className="h-[18px] w-[18px] sm:h-4 sm:w-4" />
            </div>
            <span className="text-foreground font-sans text-[0.9375rem] font-semibold sm:text-sm">
              Insights
            </span>
            <span className="bg-muted text-muted-foreground ml-2 rounded-xl px-2 py-0.5 font-sans text-[0.6875rem] font-semibold">
              {documentAnnotations.annotations.annotations.length}
            </span>
          </div>
          <ChevronDownIcon
            className={cn(
              "text-muted-foreground h-4 w-4 transition-transform duration-200",
              open && "rotate-180"
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-border/50 border-t px-5 pb-5 sm:px-4 sm:pb-4">
        <div className="mt-3">
          <AIInsightsPanel
            annotations={documentAnnotations.annotations}
            enabledCategories={documentAnnotations.enabledCategories}
            toggleCategory={documentAnnotations.toggleCategory}
            onDismiss={documentAnnotations.handleDismiss}
            onPageJump={onPageJump}
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function SignatureFieldsSection({
  documentId,
  recipients,
  signatureFields,
  canEdit,
  hasSigners,
  merchantPaymentsReady,
  selectedFieldId,
  open,
  onOpenChange,
  onFieldSelect,
  onFieldDelete,
  onFieldProperties,
  onFieldDragStart,
  onFieldDragEnd,
}: {
  documentId: string;
  recipients: FieldListRecipient[];
  signatureFields: FieldListField[];
  canEdit: boolean;
  hasSigners: boolean;
  merchantPaymentsReady: boolean;
  selectedFieldId: string | null;
  open: boolean;
  onOpenChange: () => void;
  onFieldSelect: (fieldId: string | null) => void;
  onFieldDelete: () => void;
  onFieldProperties: (fieldId: string) => void;
  onFieldDragStart: (fieldType: string) => void;
  onFieldDragEnd: () => void;
}) {
  if (signatureFields.length === 0 && !canEdit) return null;

  return (
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      className="border-border bg-card overflow-hidden rounded-2xl border shadow-sm sm:rounded-xl"
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="hover:bg-muted flex w-full cursor-pointer items-center justify-between px-5 py-4 transition-colors select-none sm:px-4 sm:py-3.5"
        >
          <div className="flex items-center gap-3">
            <div className="bg-ai-accent-surface text-ai-accent flex h-9 w-9 items-center justify-center rounded-[10px] sm:h-8 sm:w-8 sm:rounded-lg">
              <FileSignatureIcon className="h-[18px] w-[18px] sm:h-4 sm:w-4" />
            </div>
            <span className="text-foreground font-sans text-[0.9375rem] font-semibold sm:text-sm">
              Signature Fields
            </span>
            {signatureFields.length > 0 && (
              <span className="bg-muted text-muted-foreground ml-2 rounded-xl px-2 py-0.5 font-sans text-[0.6875rem] font-semibold">
                {signatureFields.length}
              </span>
            )}
          </div>
          <ChevronDownIcon
            className={cn(
              "text-muted-foreground h-4 w-4 transition-transform duration-200",
              open && "rotate-180"
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-border/50 border-t px-5 pb-5 sm:px-4 sm:pb-4">
        {canEdit && (
          <div className="mt-4 mb-4">
            <FieldToolbar
              onFieldDragStart={onFieldDragStart}
              onFieldDragEnd={onFieldDragEnd}
              disabled={!hasSigners}
              merchantPaymentsReady={merchantPaymentsReady}
              documentId={documentId as Id<"documents">}
            />
          </div>
        )}
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
            icon={<FileSignatureIcon className="h-6 w-6" />}
            title="No fields yet"
            description="Drag fields from above onto the document to mark where recipients should sign or fill in information."
          />
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

function DetailMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="bg-muted rounded-[10px] p-3.5 sm:rounded-lg sm:p-3">
      <div className="text-muted-foreground mb-1 font-sans text-[0.625rem] font-semibold tracking-wide uppercase sm:text-[0.5625rem]">
        {label}
      </div>
      <div className="text-foreground font-sans text-sm font-medium sm:text-[0.8125rem]">
        {value}
      </div>
    </div>
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
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      className="border-border bg-card overflow-hidden rounded-2xl border shadow-sm sm:rounded-xl"
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="hover:bg-muted flex w-full cursor-pointer items-center justify-between px-5 py-4 transition-colors select-none sm:px-4 sm:py-3.5"
        >
          <div className="flex items-center gap-3">
            <div className="bg-info-surface text-info flex h-9 w-9 items-center justify-center rounded-[10px] sm:h-8 sm:w-8 sm:rounded-lg">
              <InfoIcon className="h-[18px] w-[18px] sm:h-4 sm:w-4" />
            </div>
            <span className="text-foreground font-sans text-[0.9375rem] font-semibold sm:text-sm">
              Details
            </span>
          </div>
          <ChevronDownIcon
            className={cn(
              "text-muted-foreground h-4 w-4 transition-transform",
              open && "rotate-180"
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-border/50 border-t px-5 pb-5 sm:px-4 sm:pb-4">
        <div className="mt-4 grid grid-cols-2 gap-4 sm:gap-2.5">
          <DetailMetric label="File Size" value={formatFileSize(fileSize)} />
          <DetailMetric label="Pages" value={pageCount || numPages || "—"} />
          <DetailMetric label="Uploaded" value={formatDate(createdAt)} />
          <DetailMetric label="Fields" value={signatureFields.length} />
        </div>
        {description && (
          <div className="bg-muted col-span-2 mt-4 rounded-[10px] p-3.5 sm:rounded-lg sm:p-3">
            <div className="text-muted-foreground mb-1 font-sans text-[0.625rem] font-semibold tracking-wide uppercase sm:text-[0.5625rem]">
              Description
            </div>
            <div className="text-foreground font-sans text-sm font-medium sm:text-[0.8125rem]">
              {description}
            </div>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
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
        <div className="text-foreground font-sans text-[0.8125rem] leading-snug sm:text-xs">
          {event.description}
        </div>
        <div className="text-muted-foreground mt-1 font-sans text-[0.6875rem] sm:text-[0.625rem]">
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
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      className="border-border bg-card overflow-hidden rounded-2xl border shadow-sm sm:rounded-xl"
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="hover:bg-muted flex w-full cursor-pointer items-center justify-between px-5 py-4 transition-colors select-none sm:px-4 sm:py-3.5"
        >
          <div className="flex items-center gap-3">
            <div className="bg-warning-surface text-warning flex h-9 w-9 items-center justify-center rounded-[10px] sm:h-8 sm:w-8 sm:rounded-lg">
              <ActivityIcon className="h-[18px] w-[18px] sm:h-4 sm:w-4" />
            </div>
            <span className="text-foreground font-sans text-[0.9375rem] font-semibold sm:text-sm">
              Activity
            </span>
            {activityEvents.length > 0 && (
              <span className="bg-muted text-muted-foreground ml-2 rounded-xl px-2 py-0.5 font-sans text-[0.6875rem] font-semibold">
                {activityEvents.length}
              </span>
            )}
          </div>
          <ChevronDownIcon
            className={cn(
              "text-muted-foreground h-4 w-4 transition-transform",
              open && "rotate-180"
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-border/50 border-t px-5 pb-5 sm:px-4 sm:pb-4">
        {activityEvents.length > 0 ? (
          <div className="before:bg-border relative mt-4 before:absolute before:top-2 before:bottom-2 before:left-[15px] before:w-0.5 before:rounded-sm before:content-[''] sm:before:left-[13px]">
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
            icon={<ActivityIcon className="h-6 w-6" />}
            title="No activity yet"
            description="Activity will appear here as recipients interact with this document."
          />
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function DocumentSidebar(props: DocumentSidebarProps) {
  // Normalize null → undefined for components that don't accept null
  const normalizedWorkflowStatus = props.workflowStatus ?? undefined;
  const visibleProgress =
    normalizedWorkflowStatus !== "draft" ? props.progress : null;
  const signingRecipient =
    props.currentUserRecipient !== null &&
    normalizedWorkflowStatus !== "draft" &&
    normalizedWorkflowStatus !== "completed" &&
    (props.currentUserRecipient.role === "signer" ||
      props.currentUserRecipient.role === "approver")
      ? props.currentUserRecipient
      : null;

  return (
    <div className="flex flex-col gap-5 sm:gap-4">
      <DocumentStatusHero
        workflowStatus={normalizedWorkflowStatus}
        createdAt={props.createdAt}
      />
      {visibleProgress && <DocumentProgressRing progress={visibleProgress} />}
      {signingRecipient && (
        <InAppSigningSection
          documentId={props.documentId as Id<"documents">}
          recipient={signingRecipient}
          fields={props.currentUserFields as InAppFields}
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
      />
      {props.canEdit && normalizedWorkflowStatus === "draft" && (
        <DocumentSettingsSection
          open={props.openSections.has("doc-settings")}
          onOpenChange={() => props.toggleSection("doc-settings")}
          redirectUrlInput={props.redirectUrlInput}
          redirectUrlError={props.redirectUrlError}
          isSavingRedirect={props.isSavingRedirect}
          onRedirectUrlChange={props.onRedirectUrlChange}
          onSaveRedirectUrl={props.onSaveRedirectUrl}
        />
      )}
      <AIChatSection
        canEdit={props.canEdit}
        aiEnabled={props.aiEnabled}
        showAIChat={props.showAIChat}
        threadId={props.threadId}
        slug={props.slug}
        onCloseAIChat={props.onCloseAIChat}
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
      <SignatureFieldsSection
        documentId={props.documentId}
        recipients={props.recipients}
        signatureFields={props.signatureFields}
        canEdit={props.canEdit}
        hasSigners={props.hasSigners}
        merchantPaymentsReady={props.merchantPaymentsReady}
        selectedFieldId={props.selectedFieldId}
        open={props.openSections.has("fields")}
        onOpenChange={() => props.toggleSection("fields")}
        onFieldSelect={props.onFieldSelect}
        onFieldDelete={props.onFieldDelete}
        onFieldProperties={props.onFieldProperties}
        onFieldDragStart={props.onFieldDragStart}
        onFieldDragEnd={props.onFieldDragEnd}
      />
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
      <ActivitySection
        open={props.openSections.has("activity")}
        onOpenChange={() => props.toggleSection("activity")}
        activityEvents={props.activityEvents}
      />
    </div>
  );
}
