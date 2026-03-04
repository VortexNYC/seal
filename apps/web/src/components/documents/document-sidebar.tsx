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

import type { ActivityEvent, ActivityEventType } from "@/lib/document-activity";
import { formatDate, formatFileSize, formatRelativeTime, getInitials } from "@/lib/formatting";
import { cn } from "@/lib/utils";
import type { Id } from "@seal/backend/convex/_generated/dataModel";

import { Button } from "../ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { AIInsightsPanel, useDocumentAnnotations } from "./ai-annotation-overlays";
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
  stripeConnected: boolean;

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
    recipient: FieldListRecipient & { status: string; signingToken?: string },
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

export function DocumentSidebar({
  documentId,
  slug,
  workflowStatus,
  createdAt,
  description,
  fileSize,
  pageCount,
  numPages,
  recipients,
  progress,
  signatureFields,
  currentUserRecipient,
  currentUserFields,
  onCurrentUserFieldsRefetch,
  canEdit,
  isUserAlreadyRecipient,
  stripeConnected,
  hasSigners,
  openSections,
  toggleSection,
  aiEnabled,
  documentAnnotations,
  showAIChat,
  onCloseAIChat,
  threadId,
  aiProcessingStatus,
  selectedFieldId,
  onFieldSelect,
  onFieldDelete,
  onFieldProperties,
  onFieldDragStart,
  onFieldDragEnd,
  redirectUrlInput,
  redirectUrlError,
  isSavingRedirect,
  onRedirectUrlChange,
  onSaveRedirectUrl,
  onAddRecipient,
  onAddMyself,
  onRecipientOptions,
  activityEvents,
  onPageJump,
}: DocumentSidebarProps) {
  // Normalize null → undefined for components that don't accept null
  const normalizedWorkflowStatus = workflowStatus ?? undefined;

  return (
    <div className="flex flex-col gap-5 sm:gap-4">
      {/* Status Hero */}
      <DocumentStatusHero workflowStatus={normalizedWorkflowStatus} createdAt={createdAt} />

      {/* Progress Ring - Only show when document is sent */}
      {progress && normalizedWorkflowStatus !== "draft" && (
        <DocumentProgressRing progress={progress} />
      )}

      {/* In-App Signing Section - Show when user is a recipient who needs to sign */}
      {currentUserRecipient &&
        normalizedWorkflowStatus !== "draft" &&
        normalizedWorkflowStatus !== "completed" &&
        (currentUserRecipient.role === "signer" || currentUserRecipient.role === "approver") && (
          <InAppSigningSection
            documentId={documentId as Id<"documents">}
            recipient={currentUserRecipient}
            fields={currentUserFields as InAppFields}
            isOpen={openSections.has("your-signature")}
            onOpenChange={() => toggleSection("your-signature")}
            onFieldsRefetch={onCurrentUserFieldsRefetch}
          />
        )}

      {/* Recipients Section */}
      <Collapsible
        open={openSections.has("recipients")}
        onOpenChange={() => toggleSection("recipients")}
        className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm sm:rounded-xl"
      >
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full cursor-pointer items-center justify-between px-5 py-4 transition-colors select-none hover:bg-muted sm:px-4 sm:py-3.5"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-info-surface text-info sm:h-8 sm:w-8 sm:rounded-lg">
                <UsersIcon className="h-[18px] w-[18px] sm:h-4 sm:w-4" />
              </div>
              <span className="font-sans text-[0.9375rem] font-semibold text-foreground sm:text-sm">
                Recipients
              </span>
              {recipients.length > 0 && (
                <span className="ml-2 rounded-xl bg-muted px-2 py-0.5 font-sans text-[0.6875rem] font-semibold text-muted-foreground">
                  {recipients.length}
                </span>
              )}
            </div>
            <ChevronDownIcon
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                openSections.has("recipients") && "rotate-180",
              )}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="border-t border-border/50 px-5 pb-5 sm:px-4 sm:pb-4">
          {canEdit && !isUserAlreadyRecipient && (
            <Button variant="outline" size="sm" className="mt-3 mb-3 w-full" onClick={onAddMyself}>
              <UserIcon className="mr-2 h-4 w-4" />
              Add myself as signer
            </Button>
          )}
          {recipients.length > 0 ? (
            <div className="mt-4 flex flex-col gap-2.5 sm:gap-2">
              {recipients.map((recipient) => {
                const status = "status" in recipient ? (recipient.status as string) : "pending";
                const statusColorClass =
                  status === "viewed"
                    ? "bg-info-surface text-info"
                    : status === "signed" || status === "approved"
                      ? "bg-status-completed-surface text-status-completed-text"
                      : status === "declined"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-muted text-muted-foreground";
                return (
                  <div
                    key={recipient._id}
                    className="flex items-center gap-3.5 rounded-xl border border-transparent bg-muted p-3.5 transition-all hover:border-border hover:bg-muted sm:flex-wrap sm:gap-2.5 sm:p-3"
                  >
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-sans text-sm font-semibold sm:h-9 sm:w-9 sm:text-[0.8125rem]",
                        statusColorClass,
                      )}
                    >
                      {getInitials(recipient.name ?? undefined, recipient.email)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-sans text-sm font-semibold text-foreground sm:text-[0.8125rem]">
                        {recipient.name || recipient.email}
                      </div>
                      {recipient.name && (
                        <div className="truncate font-sans text-xs text-muted-foreground sm:text-[0.6875rem]">
                          {recipient.email}
                        </div>
                      )}
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 font-sans text-[0.6875rem] font-semibold whitespace-nowrap sm:px-2 sm:py-0.5 sm:text-[0.625rem]",
                        statusColorClass,
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
                          },
                        )
                      }
                      title="Recipient options"
                    >
                      <SettingsIcon className="text-muted-foreground h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="px-4 py-8 text-center sm:px-3 sm:py-6">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground sm:h-10 sm:w-10 sm:rounded-[10px]">
                <UsersIcon className="h-6 w-6" />
              </div>
              <div className="mb-1 font-sans text-sm font-semibold text-foreground sm:text-[0.8125rem]">
                No recipients
              </div>
              <div className="font-sans text-xs leading-relaxed text-muted-foreground sm:text-[0.6875rem]">
                Add recipients who need to sign or view this document.
              </div>
            </div>
          )}
          {canEdit && (
            <button
              type="button"
              className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] border-2 border-dashed border-border bg-transparent p-3 font-sans text-[0.8125rem] font-semibold text-muted-foreground transition-all hover:border-primary hover:bg-primary/5 hover:text-primary sm:rounded-lg sm:p-2.5 sm:text-xs"
              onClick={onAddRecipient}
            >
              <PlusIcon className="h-4 w-4" />
              Add Recipient
            </button>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Document Settings — redirect URL (draft only) */}
      {canEdit && normalizedWorkflowStatus === "draft" && (
        <Collapsible
          open={openSections.has("doc-settings")}
          onOpenChange={() => toggleSection("doc-settings")}
          className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm sm:rounded-xl"
        >
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full cursor-pointer items-center justify-between px-5 py-4 transition-colors select-none hover:bg-muted sm:px-4 sm:py-3.5"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-muted text-muted-foreground sm:h-8 sm:w-8 sm:rounded-lg">
                  <SettingsIcon className="h-[18px] w-[18px] sm:h-4 sm:w-4" />
                </div>
                <span className="font-sans text-[0.9375rem] font-semibold text-foreground sm:text-sm">
                  Document Settings
                </span>
              </div>
              <ChevronDownIcon
                className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform",
                  openSections.has("doc-settings") && "rotate-180",
                )}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="border-t border-border/50 px-5 pb-5 sm:px-4 sm:pb-4">
            <div className="mt-4 space-y-5">
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-foreground uppercase">
                  <LinkIcon className="h-3.5 w-3.5" />
                  Redirect after signing
                </Label>
                <p className="text-muted-foreground text-xs">
                  Recipients are sent to this URL after signing. Leave empty for the default
                  thank-you page.
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="https://example.com/thank-you"
                    value={redirectUrlInput}
                    onChange={(e) => onRedirectUrlChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onSaveRedirectUrl();
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
                {redirectUrlError && <p className="text-xs text-destructive">{redirectUrlError}</p>}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* AI Chat Panel */}
      {canEdit &&
        aiEnabled &&
        showAIChat &&
        (threadId ? (
          <AIChatPanel threadId={threadId} slug={slug} onClose={onCloseAIChat} />
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-8 shadow-sm sm:rounded-xl">
            <Loader2Icon className="h-5 w-5 animate-spin text-ai-accent" />
            <p className="font-sans text-sm text-muted-foreground">
              Starting AI assistant...
            </p>
          </div>
        ))}

      {/* AI Insights loading state */}
      {canEdit &&
        aiEnabled &&
        !documentAnnotations.annotations &&
        aiProcessingStatus === "processing" && (
          <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border bg-muted/30 px-5 py-4 sm:rounded-xl">
            <Loader2Icon className="h-4 w-4 animate-spin text-muted-foreground/60" />
            <span className="font-sans text-xs text-muted-foreground">
              Scanning for insights...
            </span>
          </div>
        )}

      {/* AI Insights (Redlining) */}
      {canEdit && aiEnabled && documentAnnotations.annotations && (
        <Collapsible
          open={openSections.has("insights")}
          onOpenChange={() => toggleSection("insights")}
          className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm sm:rounded-xl"
        >
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full cursor-pointer items-center justify-between px-5 py-4 transition-colors select-none hover:bg-muted sm:px-4 sm:py-3.5"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-ai-accent-surface text-ai-accent sm:h-8 sm:w-8 sm:rounded-lg">
                  <ScanSearchIcon className="h-[18px] w-[18px] sm:h-4 sm:w-4" />
                </div>
                <span className="font-sans text-[0.9375rem] font-semibold text-foreground sm:text-sm">
                  Insights
                </span>
                <span className="ml-2 rounded-xl bg-muted px-2 py-0.5 font-sans text-[0.6875rem] font-semibold text-muted-foreground">
                  {documentAnnotations.annotations.annotations.length}
                </span>
              </div>
              <ChevronDownIcon
                className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform duration-200",
                  openSections.has("insights") && "rotate-180",
                )}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="border-t border-border/50 px-5 pb-5 sm:px-4 sm:pb-4">
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
      )}

      {/* Signature Fields Section */}
      {(signatureFields.length > 0 || canEdit) && (
        <Collapsible
          open={openSections.has("fields")}
          onOpenChange={() => toggleSection("fields")}
          className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm sm:rounded-xl"
        >
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full cursor-pointer items-center justify-between px-5 py-4 transition-colors select-none hover:bg-muted sm:px-4 sm:py-3.5"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-ai-accent-surface text-ai-accent sm:h-8 sm:w-8 sm:rounded-lg">
                  <FileSignatureIcon className="h-[18px] w-[18px] sm:h-4 sm:w-4" />
                </div>
                <span className="font-sans text-[0.9375rem] font-semibold text-foreground sm:text-sm">
                  Signature Fields
                </span>
                {signatureFields.length > 0 && (
                  <span className="ml-2 rounded-xl bg-muted px-2 py-0.5 font-sans text-[0.6875rem] font-semibold text-muted-foreground">
                    {signatureFields.length}
                  </span>
                )}
              </div>
              <ChevronDownIcon
                className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform duration-200",
                  openSections.has("fields") && "rotate-180",
                )}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="border-t border-border/50 px-5 pb-5 sm:px-4 sm:pb-4">
            {canEdit && (
              <div className="mt-4 mb-4">
                <FieldToolbar
                  onFieldDragStart={onFieldDragStart}
                  onFieldDragEnd={onFieldDragEnd}
                  disabled={!hasSigners}
                  stripeConnected={stripeConnected}
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
              <div className="px-4 py-8 text-center sm:px-3 sm:py-6">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground sm:h-10 sm:w-10 sm:rounded-[10px]">
                  <FileSignatureIcon className="h-6 w-6" />
                </div>
                <div className="mb-1 font-sans text-sm font-semibold text-foreground sm:text-[0.8125rem]">
                  No fields yet
                </div>
                <div className="font-sans text-xs leading-relaxed text-muted-foreground sm:text-[0.6875rem]">
                  Drag fields from above onto the document to mark where recipients should sign or
                  fill in information.
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
        className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm sm:rounded-xl"
      >
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full cursor-pointer items-center justify-between px-5 py-4 transition-colors select-none hover:bg-muted sm:px-4 sm:py-3.5"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-info-surface text-info sm:h-8 sm:w-8 sm:rounded-lg">
                <InfoIcon className="h-[18px] w-[18px] sm:h-4 sm:w-4" />
              </div>
              <span className="font-sans text-[0.9375rem] font-semibold text-foreground sm:text-sm">
                Details
              </span>
            </div>
            <ChevronDownIcon
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                openSections.has("details") && "rotate-180",
              )}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="border-t border-border/50 px-5 pb-5 sm:px-4 sm:pb-4">
          <div className="mt-4 grid grid-cols-2 gap-4 sm:gap-2.5">
            <div className="rounded-[10px] bg-muted p-3.5 sm:rounded-lg sm:p-3">
              <div className="mb-1 font-sans text-[0.625rem] font-semibold tracking-wide text-muted-foreground uppercase sm:text-[0.5625rem]">
                File Size
              </div>
              <div className="font-sans text-sm font-medium text-foreground sm:text-[0.8125rem]">
                {formatFileSize(fileSize)}
              </div>
            </div>
            <div className="rounded-[10px] bg-muted p-3.5 sm:rounded-lg sm:p-3">
              <div className="mb-1 font-sans text-[0.625rem] font-semibold tracking-wide text-muted-foreground uppercase sm:text-[0.5625rem]">
                Pages
              </div>
              <div className="font-sans text-sm font-medium text-foreground sm:text-[0.8125rem]">
                {pageCount || numPages || "—"}
              </div>
            </div>
            <div className="rounded-[10px] bg-muted p-3.5 sm:rounded-lg sm:p-3">
              <div className="mb-1 font-sans text-[0.625rem] font-semibold tracking-wide text-muted-foreground uppercase sm:text-[0.5625rem]">
                Uploaded
              </div>
              <div className="font-sans text-sm font-medium text-foreground sm:text-[0.8125rem]">
                {formatDate(createdAt)}
              </div>
            </div>
            <div className="rounded-[10px] bg-muted p-3.5 sm:rounded-lg sm:p-3">
              <div className="mb-1 font-sans text-[0.625rem] font-semibold tracking-wide text-muted-foreground uppercase sm:text-[0.5625rem]">
                Fields
              </div>
              <div className="font-sans text-sm font-medium text-foreground sm:text-[0.8125rem]">
                {signatureFields.length}
              </div>
            </div>
          </div>
          {description && (
            <div className="col-span-2 mt-4 rounded-[10px] bg-muted p-3.5 sm:rounded-lg sm:p-3">
              <div className="mb-1 font-sans text-[0.625rem] font-semibold tracking-wide text-muted-foreground uppercase sm:text-[0.5625rem]">
                Description
              </div>
              <div className="font-sans text-sm font-medium text-foreground sm:text-[0.8125rem]">
                {description}
              </div>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Activity Section */}
      <Collapsible
        open={openSections.has("activity")}
        onOpenChange={() => toggleSection("activity")}
        className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm sm:rounded-xl"
      >
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full cursor-pointer items-center justify-between px-5 py-4 transition-colors select-none hover:bg-muted sm:px-4 sm:py-3.5"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-warning-surface text-warning sm:h-8 sm:w-8 sm:rounded-lg">
                <ActivityIcon className="h-[18px] w-[18px] sm:h-4 sm:w-4" />
              </div>
              <span className="font-sans text-[0.9375rem] font-semibold text-foreground sm:text-sm">
                Activity
              </span>
              {activityEvents.length > 0 && (
                <span className="ml-2 rounded-xl bg-muted px-2 py-0.5 font-sans text-[0.6875rem] font-semibold text-muted-foreground">
                  {activityEvents.length}
                </span>
              )}
            </div>
            <ChevronDownIcon
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                openSections.has("activity") && "rotate-180",
              )}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="border-t border-border/50 px-5 pb-5 sm:px-4 sm:pb-4">
          {activityEvents.length > 0 ? (
            <div className="relative mt-4 before:absolute before:top-2 before:bottom-2 before:left-[15px] before:w-0.5 before:rounded-sm before:bg-border before:content-[''] sm:before:left-[13px]">
              {activityEvents.slice(0, 10).map((event, index) => (
                <div
                  key={`${event.type}-${event.timestamp}`}
                  className={cn(
                    "relative flex gap-4 py-3 first:pt-0 last:pb-0",
                    activityDotClass(event.type),
                  )}
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div className="activity-dot relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 sm:h-7 sm:w-7">
                    {getActivityIcon(event.type)}
                  </div>
                  <div className="min-w-0 flex-1 pt-1">
                    <div className="font-sans text-[0.8125rem] leading-snug text-foreground sm:text-xs">
                      {event.description}
                    </div>
                    <div className="mt-1 font-sans text-[0.6875rem] text-muted-foreground sm:text-[0.625rem]">
                      {formatRelativeTime(event.timestamp)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-8 text-center sm:px-3 sm:py-6">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground sm:h-10 sm:w-10 sm:rounded-[10px]">
                <ActivityIcon className="h-6 w-6" />
              </div>
              <div className="mb-1 font-sans text-sm font-semibold text-foreground sm:text-[0.8125rem]">
                No activity yet
              </div>
              <div className="font-sans text-xs leading-relaxed text-muted-foreground sm:text-[0.6875rem]">
                Activity will appear here as recipients interact with this document.
              </div>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
