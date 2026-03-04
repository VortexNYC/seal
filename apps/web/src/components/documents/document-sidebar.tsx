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
      return "[&_.activity-dot]:border-emerald-300 [&_.activity-dot]:bg-emerald-50 [&_.activity-dot]:text-emerald-600 dark:[&_.activity-dot]:border-emerald-700 dark:[&_.activity-dot]:bg-emerald-950 dark:[&_.activity-dot]:text-emerald-400";
    case "viewed":
      return "[&_.activity-dot]:border-blue-300 [&_.activity-dot]:bg-blue-50 [&_.activity-dot]:text-blue-600 dark:[&_.activity-dot]:border-blue-700 dark:[&_.activity-dot]:bg-blue-950 dark:[&_.activity-dot]:text-blue-400";
    case "declined":
      return "[&_.activity-dot]:border-red-300 [&_.activity-dot]:bg-red-50 [&_.activity-dot]:text-red-600 dark:[&_.activity-dot]:border-red-700 dark:[&_.activity-dot]:bg-red-950 dark:[&_.activity-dot]:text-red-400";
    default:
      return "[&_.activity-dot]:border-slate-200 [&_.activity-dot]:bg-white [&_.activity-dot]:text-slate-500 dark:[&_.activity-dot]:border-slate-700 dark:[&_.activity-dot]:bg-slate-900 dark:[&_.activity-dot]:text-slate-400";
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
              className={cn(
                "h-4 w-4 text-slate-500 transition-transform dark:text-slate-400",
                openSections.has("recipients") && "rotate-180",
              )}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="border-t border-slate-100 px-5 pb-5 sm:px-4 sm:pb-4 dark:border-slate-800">
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
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                    : status === "signed" || status === "approved"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                      : status === "declined"
                        ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                        : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400";
                return (
                  <div
                    key={recipient._id}
                    className="flex items-center gap-3.5 rounded-xl border border-transparent bg-slate-50 p-3.5 transition-all hover:border-slate-200 hover:bg-slate-100 sm:flex-wrap sm:gap-2.5 sm:p-3 dark:bg-slate-800 dark:hover:border-slate-600 dark:hover:bg-slate-700"
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
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:rounded-xl dark:border-slate-700 dark:bg-slate-900"
        >
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full cursor-pointer items-center justify-between px-5 py-4 transition-colors select-none hover:bg-slate-50 sm:px-4 sm:py-3.5 dark:hover:bg-slate-800"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-slate-100 text-slate-600 sm:h-8 sm:w-8 sm:rounded-lg dark:bg-slate-800 dark:text-slate-400">
                  <SettingsIcon className="h-[18px] w-[18px] sm:h-4 sm:w-4" />
                </div>
                <span className="font-sans text-[0.9375rem] font-semibold text-slate-800 sm:text-sm dark:text-slate-200">
                  Document Settings
                </span>
              </div>
              <ChevronDownIcon
                className={cn(
                  "h-4 w-4 text-slate-500 transition-transform dark:text-slate-400",
                  openSections.has("doc-settings") && "rotate-180",
                )}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="border-t border-slate-100 px-5 pb-5 sm:px-4 sm:pb-4 dark:border-slate-800">
            <div className="mt-4 space-y-5">
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-slate-700 uppercase dark:text-slate-300">
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
                {redirectUrlError && <p className="text-xs text-red-500">{redirectUrlError}</p>}
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
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm sm:rounded-xl dark:border-slate-700 dark:bg-slate-900">
            <Loader2Icon className="h-5 w-5 animate-spin text-violet-500" />
            <p className="font-sans text-sm text-slate-500 dark:text-slate-400">
              Starting AI assistant...
            </p>
          </div>
        ))}

      {/* AI Insights loading state */}
      {canEdit &&
        aiEnabled &&
        !documentAnnotations.annotations &&
        aiProcessingStatus === "processing" && (
          <div className="flex items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-5 py-4 sm:rounded-xl dark:border-slate-700 dark:bg-slate-800/30">
            <Loader2Icon className="h-4 w-4 animate-spin text-slate-400" />
            <span className="font-sans text-xs text-slate-500 dark:text-slate-400">
              Scanning for insights...
            </span>
          </div>
        )}

      {/* AI Insights (Redlining) */}
      {canEdit && aiEnabled && documentAnnotations.annotations && (
        <Collapsible
          open={openSections.has("insights")}
          onOpenChange={() => toggleSection("insights")}
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:rounded-xl dark:border-slate-700 dark:bg-slate-900"
        >
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full cursor-pointer items-center justify-between px-5 py-4 transition-colors select-none hover:bg-slate-50 sm:px-4 sm:py-3.5 dark:hover:bg-slate-800"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-rose-100 text-rose-600 sm:h-8 sm:w-8 sm:rounded-lg dark:bg-rose-900 dark:text-rose-400">
                  <ScanSearchIcon className="h-[18px] w-[18px] sm:h-4 sm:w-4" />
                </div>
                <span className="font-sans text-[0.9375rem] font-semibold text-slate-800 sm:text-sm dark:text-slate-200">
                  Insights
                </span>
                <span className="ml-2 rounded-xl bg-slate-100 px-2 py-0.5 font-sans text-[0.6875rem] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  {documentAnnotations.annotations.annotations.length}
                </span>
              </div>
              <ChevronDownIcon
                className={cn(
                  "h-4 w-4 text-slate-500 transition-transform duration-200 dark:text-slate-400",
                  openSections.has("insights") && "rotate-180",
                )}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="border-t border-slate-100 px-5 pb-5 sm:px-4 sm:pb-4 dark:border-slate-800">
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
                className={cn(
                  "h-4 w-4 text-slate-500 transition-transform duration-200 dark:text-slate-400",
                  openSections.has("fields") && "rotate-180",
                )}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="border-t border-slate-100 px-5 pb-5 sm:px-4 sm:pb-4 dark:border-slate-800">
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
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500 sm:h-10 sm:w-10 sm:rounded-[10px] dark:bg-slate-800 dark:text-slate-400">
                  <FileSignatureIcon className="h-6 w-6" />
                </div>
                <div className="mb-1 font-sans text-sm font-semibold text-slate-700 sm:text-[0.8125rem] dark:text-slate-300">
                  No fields yet
                </div>
                <div className="font-sans text-xs leading-relaxed text-slate-500 sm:text-[0.6875rem] dark:text-slate-400">
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
              className={cn(
                "h-4 w-4 text-slate-500 transition-transform dark:text-slate-400",
                openSections.has("details") && "rotate-180",
              )}
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
                {formatFileSize(fileSize)}
              </div>
            </div>
            <div className="rounded-[10px] bg-slate-50 p-3.5 sm:rounded-lg sm:p-3 dark:bg-slate-800">
              <div className="mb-1 font-sans text-[0.625rem] font-semibold tracking-wide text-slate-500 uppercase sm:text-[0.5625rem] dark:text-slate-400">
                Pages
              </div>
              <div className="font-sans text-sm font-medium text-slate-800 sm:text-[0.8125rem] dark:text-slate-200">
                {pageCount || numPages || "—"}
              </div>
            </div>
            <div className="rounded-[10px] bg-slate-50 p-3.5 sm:rounded-lg sm:p-3 dark:bg-slate-800">
              <div className="mb-1 font-sans text-[0.625rem] font-semibold tracking-wide text-slate-500 uppercase sm:text-[0.5625rem] dark:text-slate-400">
                Uploaded
              </div>
              <div className="font-sans text-sm font-medium text-slate-800 sm:text-[0.8125rem] dark:text-slate-200">
                {formatDate(createdAt)}
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
          {description && (
            <div className="col-span-2 mt-4 rounded-[10px] bg-slate-50 p-3.5 sm:rounded-lg sm:p-3 dark:bg-slate-800">
              <div className="mb-1 font-sans text-[0.625rem] font-semibold tracking-wide text-slate-500 uppercase sm:text-[0.5625rem] dark:text-slate-400">
                Description
              </div>
              <div className="font-sans text-sm font-medium text-slate-800 sm:text-[0.8125rem] dark:text-slate-200">
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
              className={cn(
                "h-4 w-4 text-slate-500 transition-transform dark:text-slate-400",
                openSections.has("activity") && "rotate-180",
              )}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="border-t border-slate-100 px-5 pb-5 sm:px-4 sm:pb-4 dark:border-slate-800">
          {activityEvents.length > 0 ? (
            <div className="relative mt-4 before:absolute before:top-2 before:bottom-2 before:left-[15px] before:w-0.5 before:rounded-sm before:bg-slate-200 before:content-[''] sm:before:left-[13px] dark:before:bg-slate-700">
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
  );
}
