import { Text } from "@cloudflare/kumo/components/text";
import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { DatePicker } from "@cloudflare/kumo/components/date-picker";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { Empty } from "@cloudflare/kumo/components/empty";
import { Input } from "@cloudflare/kumo/components/input";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Loader, SkeletonLine } from "@cloudflare/kumo/components/loader";
import { Popover } from "@cloudflare/kumo/components/popover";
import { Table } from "@cloudflare/kumo/components/table";
import { Tooltip } from "@cloudflare/kumo/components/tooltip";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  Link,
  createFileRoute,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import Fuse, { type FuseResultMatch } from "fuse.js";
import { ArrowDown as ArrowDownIcon, ArrowsLeftRight as ArrowRightLeftIcon, ArrowUp as ArrowUpIcon, Calendar as CalendarIcon, CaretLeft as ChevronLeftIcon, CaretRight as ChevronRightIcon, DotsThreeVertical as MoreVerticalIcon, DownloadSimple as DownloadIcon, File as FileIcon, FileText as FileTextIcon, Folder as FolderIcon, FolderSimple as FolderInputIcon, List as LayoutListIcon, MagnifyingGlass as SearchIcon, PaperPlaneTilt as SendIcon, Prohibit as BanIcon, ShareNetwork as Share2Icon, Sparkle as SparklesIcon, SquaresFour as LayoutGridIcon, Trash as TrashIcon, UploadSimple as UploadIcon, X as XIcon } from "@phosphor-icons/react";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type JSX,
} from "react";
import type { DateRange } from "react-day-picker";

import { DocumentThumbnail } from "@/components/documents/document-thumbnail";
import { ShareDocumentDialog } from "@/components/documents/share-document-dialog";
import { TransferOwnershipDialog } from "@/components/documents/transfer-ownership-dialog";
import { UploadDialog } from "@/components/documents/upload-dialog";
import { WorkflowStatusBadge } from "@/components/documents/workflow-status-badge";
import { CreateFolderDialog } from "@/components/folders/create-folder-dialog";
import { FolderBreadcrumbs } from "@/components/folders/folder-breadcrumbs";
import { MoveToFolderDialog } from "@/components/folders/move-to-folder-dialog";
import {
  FileSystem,
  type FileSystemItem,
} from "@/components/kumo-docs/file-system";
import { PageWrapper } from "@/components/page-wrapper";
import { CardSkeleton } from "@/components/skeletons/card-skeleton";
import { useAnalytics } from "@/hooks/use-analytics";
import { useSuspenseOrganization } from "@/hooks/use-organization";
import {
  cancelDocument as cancelDocumentApi,
  deleteDocument as deleteDocumentApi,
  downloadDocument,
  getDocuments,
  getFolders,
  moveDocumentsToFolder,
  sendDocument as sendDocumentApi,
  type ApiDocument,
  type ApiFolder,
} from "@/lib/api-client";
import {
  listRowDate,
  signerProgressLine,
  toWorkflowStatus,
  type DocumentWorkflowStatus,
  type SigningProgress,
} from "@/lib/document-status";
import { pageSEO } from "@/lib/seo";
import { toast } from "@/lib/toast";

export const Route = createFileRoute("/_authenticated/$slug/documents/")({
  component: DocumentsPage,
  pendingComponent: DocumentsSkeleton,
  validateSearch: (search: Record<string, unknown>) => ({
    folderId:
      typeof search.folderId === "string" && search.folderId
        ? search.folderId
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: pageSEO.documents.title },
      { name: "description", content: pageSEO.documents.description },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function DocumentsSkeleton(): JSX.Element {
  return (
    <PageWrapper title="Documents">
      <div className="flex w-full flex-col gap-4">
        <SkeletonLine className="h-10 w-full max-w-md" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <CardSkeleton showDescription showFooter={false} />
          <CardSkeleton showDescription showFooter={false} />
          <CardSkeleton showDescription showFooter={false} />
          <CardSkeleton showDescription showFooter={false} />
          <CardSkeleton showDescription showFooter={false} />
          <CardSkeleton showDescription showFooter={false} />
        </div>
      </div>
    </PageWrapper>
  );
}

type FilterType = "all" | "owned" | "shared";
type WorkflowStatusFilter =
  | "all"
  | "draft"
  | "sent"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "expired";

type ViewMode = "grid" | "table" | "finder";
type SortField = "name" | "createdAt" | "workflowStatus";
type SortDirection = "asc" | "desc";

// SEA-73: Fuse.js options for fuzzy search
const fuseOptions = {
  keys: ["name", "description"],
  threshold: 0.4, // 0 = exact match, 1 = match anything
  includeMatches: true,
  minMatchCharLength: 2,
};

const DOCUMENTS_PER_PAGE = 20;

// SEA-73: Highlight matching text component
function HighlightedText({
  text,
  matches,
  fieldKey,
}: {
  text: string;
  matches?: readonly FuseResultMatch[];
  fieldKey: string;
}) {
  if (!matches || !text) {
    return <>{text}</>;
  }

  const fieldMatch = matches.find((m) => m.key === fieldKey);
  if (!fieldMatch || !fieldMatch.indices || fieldMatch.indices.length === 0) {
    return <>{text}</>;
  }

  // Build highlighted string from indices
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  for (const [start, end] of fieldMatch.indices) {
    // Add non-matching text before this match
    if (start > lastIndex) {
      parts.push(text.slice(lastIndex, start));
    }
    // Add highlighted matching text
    parts.push(
      <mark key={`${start}-${end}`} className="bg-kumo-warning/30 rounded px-0.5">
        {text.slice(start, end + 1)}
      </mark>
    );
    lastIndex = end + 1;
  }

  // Add remaining text after last match
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <>{parts}</>;
}

interface DocumentsListProps {
  filter: FilterType;
  workflowStatusFilter: WorkflowStatusFilter;
  viewMode: ViewMode;
  sortField: SortField;
  sortDirection: SortDirection;
  searchQuery: string;
  /** SEA-74: Date range filter */
  dateRange: DateRange | undefined;
  /** Folder filter */
  folderId: string | undefined;
  onShareClick: (documentId: string, documentName: string) => void;
  onSortChange: (field: SortField) => void;
  /** SEA-140: Callback to open upload dialog from empty state */
  onUploadClick: () => void;
  /** Open move-to-folder dialog for a document */
  onMoveToFolder: (documentId: string) => void;
  /** Navigate into a folder */
  onFolderNavigate: (folderId?: string) => void;
  /** Whether the org has ownership transfer enabled */
  delegateOwnership: boolean;
  /** Open transfer ownership dialog for a document */
  onTransferOwnership: (doc: {
    _id: string;
    name: string;
    ownerId: string;
    sharingMode: string;
  }) => void;
}

type DocumentListItem = {
  readonly _id: string;
  readonly name: string;
  readonly description?: string;
  readonly storageId: string;
  readonly thumbnailDataUrl?: string;
  readonly pageCount?: number;
  readonly createdAt: number;
  readonly sentAt?: number | null;
  readonly deadline?: number | null;
  readonly progress?: SigningProgress | null;
  readonly activityAt: number;
  readonly fileSize: number;
  readonly workflowStatus?: DocumentWorkflowStatus;
  readonly aiProcessingStatus?: string;
  readonly sharingMode: string;
  readonly ownerId: string;
};

type FolderListItem = {
  readonly _id: string;
  readonly name: string;
  readonly createdAt: number;
};

type DocumentListActions = {
  readonly openDocument: (documentId: string) => void;
  readonly sendDocument: (documentId: string) => void;
  readonly cancelDocument: (documentId: string) => void;
  readonly downloadDocument: (documentId: string) => void;
  readonly shareDocument: (documentId: string, documentName: string) => void;
  readonly moveToFolder: (documentId: string) => void;
  readonly deleteDocument: (documentId: string) => void;
  readonly transferOwnership: (doc: {
    _id: string;
    name: string;
    ownerId: string;
    sharingMode: string;
  }) => void;
};

type ConfirmDialogState = {
  readonly open: boolean;
  readonly type: "delete" | "send" | "cancel";
  readonly documentId: string | null;
};

type ConfirmDialogContent = {
  readonly title: string;
  readonly description: string;
};

type DocumentsListData = {
  readonly currentPage: number;
  readonly hasFiltersOrSearch: boolean;
  readonly matchesMap: Map<string, readonly FuseResultMatch[] | undefined>;
  readonly paginatedDocuments: readonly DocumentListItem[];
  readonly setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  readonly sortedDocuments: readonly DocumentListItem[];
  readonly subfolders: readonly FolderListItem[] | undefined;
  readonly totalPages: number;
};

type SortHeaderProps = {
  readonly field: SortField;
  readonly label: string;
  readonly onSortChange: (field: SortField) => void;
  readonly sortDirection: SortDirection;
  readonly sortField: SortField;
};

function defaultConfirmDialog(): ConfirmDialogState {
  return { open: false, type: "delete", documentId: null };
}

function confirmDialogContent(
  type: ConfirmDialogState["type"]
): ConfirmDialogContent {
  switch (type) {
    case "delete":
      return {
        title: "Delete Document",
        description:
          "Are you sure you want to delete this document? This action cannot be undone.",
      };
    case "send":
      return {
        title: "Send Document",
        description:
          "Send this document? Once sent, recipients will be notified to take action.",
      };
    case "cancel":
    default:
      return {
        title: "Cancel Document",
        description:
          "Cancel this document? This action cannot be undone and recipients will be notified.",
      };
  }
}

function confirmDialogActionLabel(type: ConfirmDialogState["type"]): string {
  if (type === "delete") return "Delete";
  return type === "send" ? "Send" : "Cancel Document";
}

function confirmDialogActionVariant(
  type: ConfirmDialogState["type"]
): "primary" | "destructive" {
  return type === "delete" || type === "cancel" ? "destructive" : "primary";
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round((bytes / k ** i) * 100) / 100} ${sizes[i]}`;
}

function filterDocumentsByStatusAndDate(
  documents: readonly DocumentListItem[],
  workflowStatusFilter: WorkflowStatusFilter,
  dateRange: DateRange | undefined
): readonly DocumentListItem[] {
  return documents.filter((doc) => {
    const workflowStatusMatches =
      workflowStatusFilter === "all" ||
      (doc.workflowStatus ?? "draft") === workflowStatusFilter;
    return workflowStatusMatches && documentMatchesDateRange(doc, dateRange);
  });
}

function documentMatchesDateRange(
  doc: DocumentListItem,
  dateRange: DateRange | undefined
): boolean {
  const fromTime = dateRange?.from
    ? dayStart(dateRange.from).getTime()
    : undefined;
  const toTime = dateRange?.to ? dayEnd(dateRange.to).getTime() : undefined;
  return (
    (fromTime === undefined || doc.createdAt >= fromTime) &&
    (toTime === undefined || doc.createdAt <= toTime)
  );
}

function dayStart(date: Date): Date {
  const fromDate = new Date(date);
  fromDate.setHours(0, 0, 0, 0);
  return fromDate;
}

function dayEnd(date: Date): Date {
  const toDate = new Date(date);
  toDate.setHours(23, 59, 59, 999);
  return toDate;
}

function sortDocuments(
  documents: readonly DocumentListItem[],
  searchQuery: string,
  sortField: SortField,
  sortDirection: SortDirection
): readonly DocumentListItem[] {
  if (searchQuery.trim() && sortField === "createdAt") return documents;
  return [...documents].toSorted((a, b) =>
    documentSortComparison(a, b, sortField, sortDirection)
  );
}

function documentSortComparison(
  a: DocumentListItem,
  b: DocumentListItem,
  sortField: SortField,
  sortDirection: SortDirection
): number {
  const comparison = documentSortValue(a, b, sortField);
  return sortDirection === "asc" ? comparison : -comparison;
}

function documentSortValue(
  a: DocumentListItem,
  b: DocumentListItem,
  sortField: SortField
): number {
  if (sortField === "name") return a.name.localeCompare(b.name);
  if (sortField === "createdAt") return a.activityAt - b.activityAt;
  return (a.workflowStatus ?? "draft").localeCompare(
    b.workflowStatus ?? "draft"
  );
}

function paginatedDocuments(
  documents: readonly DocumentListItem[],
  currentPage: number
): readonly DocumentListItem[] {
  const startIndex = (currentPage - 1) * DOCUMENTS_PER_PAGE;
  return documents.slice(startIndex, startIndex + DOCUMENTS_PER_PAGE);
}

function buildMatchesMap(
  searchResults: readonly {
    readonly item: DocumentListItem;
    readonly matches?: readonly FuseResultMatch[];
  }[]
): Map<string, readonly FuseResultMatch[] | undefined> {
  const map = new Map<string, readonly FuseResultMatch[] | undefined>();
  for (const result of searchResults) map.set(result.item._id, result.matches);
  return map;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function FolderTableRow({
  folder,
  onFolderNavigate,
}: {
  readonly folder: FolderListItem;
  readonly onFolderNavigate: (folderId?: string) => void;
}) {
  return (
    <Table.Row
      key={folder._id}
      className="hover:bg-kumo-elevated/50 cursor-pointer"
      onClick={() => onFolderNavigate(folder._id)}
    >
      <Table.Cell className="max-w-sheet">
        <p className="flex items-center gap-2 truncate font-medium" title={folder.name}>
          <FolderIcon className="text-kumo-secondary h-4 w-4 shrink-0" />
          {folder.name}
        </p>
        <Text as="p" variant="secondary" size="xs">Folder</Text>
      </Table.Cell>
      <Table.Cell className="hidden whitespace-nowrap sm:table-cell">
        <p className="text-sm">{formatDate(folder.createdAt)}</p>
      </Table.Cell>
      <Table.Cell className="whitespace-nowrap">
        <Badge variant="outline" className="px-3.5 py-1.5 text-base">
          Folder
        </Badge>
      </Table.Cell>
      <Table.Cell className="w-14" />
    </Table.Row>
  );
}

function DocumentTableRow({
  actions,
  delegateOwnership,
  doc,
  matches,
}: {
  readonly actions: DocumentListActions;
  readonly delegateOwnership: boolean;
  readonly doc: DocumentListItem;
  readonly matches: readonly FuseResultMatch[] | undefined;
}) {
  const { slug } = Route.useParams();
  return (
    <Table.Row
      key={doc._id}
      data-testid="document-row"
      className="hover:bg-kumo-elevated/50 relative cursor-pointer"
    >
      <Table.Cell className="relative">
        <Link
          to="/$slug/documents/$documentId"
          params={{ slug, documentId: doc._id }}
          className="absolute inset-0 z-0"
          aria-label={`Open ${doc.name}`}
        />
        <div className="pointer-events-none relative z-1">
          <DocumentSummary doc={doc} matches={matches} />
        </div>
      </Table.Cell>
      <Table.Cell className="relative hidden whitespace-nowrap sm:table-cell">
        <Link
          to="/$slug/documents/$documentId"
          params={{ slug, documentId: doc._id }}
          className="absolute inset-0 z-0"
          tabIndex={-1}
          aria-hidden
        />
        <div className="pointer-events-none relative z-1 text-sm">
          <DocumentListDate doc={doc} />
        </div>
      </Table.Cell>
      <Table.Cell className="relative whitespace-nowrap">
        <Link
          to="/$slug/documents/$documentId"
          params={{ slug, documentId: doc._id }}
          className="absolute inset-0 z-0"
          tabIndex={-1}
          aria-hidden
        />
        <div className="pointer-events-none relative z-1 flex items-center gap-2">
          <WorkflowStatusBadge status={doc.workflowStatus} />
          <DocumentAiStatus status={doc.aiProcessingStatus} tooltip />
        </div>
      </Table.Cell>
      <Table.Cell className="relative z-1 w-14">
        <div className="flex justify-end">
          <DocumentActionsMenu
            actions={actions}
            delegateOwnership={delegateOwnership}
            doc={doc}
            includeExpiredSend
            includeTransferOwnership
          />
        </div>
      </Table.Cell>
    </Table.Row>
  );
}

function DocumentSummary({
  doc,
  matches,
}: {
  readonly doc: DocumentListItem;
  readonly matches: readonly FuseResultMatch[] | undefined;
}) {
  const progress = signerProgressLine(doc.workflowStatus, doc.progress);
  const pages =
    doc.pageCount !== undefined && doc.pageCount > 0
      ? `${doc.pageCount} ${doc.pageCount === 1 ? "page" : "pages"}`
      : null;
  return (
    <div className="min-w-0">
      <p className="truncate font-medium">
        <HighlightedText text={doc.name} matches={matches} fieldKey="name" />
        {pages ? (
          <Text as="span" variant="secondary" size="xs">
            {` · ${pages}`}
          </Text>
        ) : null}
      </p>
      {progress ? (
        <Text as="p" variant="secondary" size="sm" DANGEROUS_className="truncate">
          {progress}
        </Text>
      ) : null}
      {doc.description && (
        <p className="text-kumo-secondary line-clamp-1 text-sm">
          <HighlightedText
            text={doc.description}
            matches={matches}
            fieldKey="description"
          />
        </p>
      )}
    </div>
  );
}

function DocumentListDate({ doc }: { readonly doc: DocumentListItem }) {
  const date = listRowDate({
    status: doc.workflowStatus,
    createdAt: doc.createdAt,
    sentAt: doc.sentAt,
    deadline: doc.deadline,
    now: Date.now(),
  });
  return (
    <>
      <p>{date.sent ? `Sent ${formatDate(date.at)}` : formatDate(date.at)}</p>
      {date.dueAt ? (
        <Text
          as="p"
          variant={date.overdue ? "error" : "secondary"}
          size="xs"
        >
          {`Due ${formatDate(date.dueAt)}`}
        </Text>
      ) : date.sent ? null : (
        <Text as="p" variant="secondary" size="xs">
          {formatBytes(doc.fileSize)}
        </Text>
      )}
    </>
  );
}

function FolderGridCard({
  folder,
  onFolderNavigate,
}: {
  readonly folder: FolderListItem;
  readonly onFolderNavigate: (folderId?: string) => void;
}) {
  return (
    <LayerCard key={folder._id}>
      <Button
        type="button"
        variant="ghost"
        className="h-auto w-full justify-start"
        icon={FolderIcon}
        onClick={() => onFolderNavigate(folder._id)}
      >
        {folder.name}
      </Button>
    </LayerCard>
  );
}

function DocumentGridCard({
  actions,
  doc,
  matches,
}: {
  readonly actions: DocumentListActions;
  readonly doc: DocumentListItem;
  readonly matches: readonly FuseResultMatch[] | undefined;
}) {
  const { slug } = Route.useParams();
  return (
    <div
      key={doc._id}
      className="border-kumo-line bg-kumo-base relative flex flex-col overflow-hidden rounded-xl border transition-shadow hover:shadow-md"
    >
      <Link
        to="/$slug/documents/$documentId"
        params={{ slug, documentId: doc._id }}
        className="absolute inset-0 z-0"
        aria-label={`Open ${doc.name}`}
      />
      <div className="bg-kumo-elevated pointer-events-none relative z-1 h-36 w-full overflow-hidden border-b">
        <DocumentThumbnail
          organizationSlug={slug}
          publicId={doc._id}
          thumbnailDataUrl={doc.thumbnailDataUrl}
          name={doc.name}
          className="h-full w-full rounded-none border-0"
        />
      </div>
      <div className="relative z-1 flex flex-col gap-2 p-3">
        <GridCardHeader actions={actions} doc={doc} matches={matches} />
        {doc.description ? (
          <p className="text-kumo-secondary pointer-events-none line-clamp-2 text-xs">
            <HighlightedText
              text={doc.description}
              matches={matches}
              fieldKey="description"
            />
          </p>
        ) : null}
        <DocumentGridMetadata doc={doc} />
      </div>
    </div>
  );
}

function GridCardHeader({
  actions,
  doc,
  matches,
}: {
  readonly actions: DocumentListActions;
  readonly doc: DocumentListItem;
  readonly matches: readonly FuseResultMatch[] | undefined;
}) {
  return (
    <div className="flex items-start justify-between">
      <div className="pointer-events-none flex min-w-0 flex-1 items-start gap-2">
        <FileIcon className="text-kumo-secondary h-5 w-5" />
        <Text
          as="h3"
          size="sm"
          DANGEROUS_className="line-clamp-2 break-all"
        >
          <HighlightedText text={doc.name} matches={matches} fieldKey="name" />
        </Text>
      </div>
      <div className="relative z-2">
        <DocumentActionsMenu actions={actions} doc={doc} />
      </div>
    </div>
  );
}

function DocumentGridMetadata({ doc }: { readonly doc: DocumentListItem }) {
  const progress = signerProgressLine(doc.workflowStatus, doc.progress);
  const date = listRowDate({
    status: doc.workflowStatus,
    createdAt: doc.createdAt,
    sentAt: doc.sentAt,
    deadline: doc.deadline,
    now: Date.now(),
  });
  return (
    <div className="text-kumo-secondary flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      <WorkflowStatusBadge status={doc.workflowStatus} />
      <DocumentAiStatus status={doc.aiProcessingStatus} />
      {progress ? (
        <>
          <span aria-hidden>·</span>
          <span>{progress}</span>
        </>
      ) : null}
      <span aria-hidden>·</span>
      <span>{date.sent ? `Sent ${formatDate(date.at)}` : formatDate(date.at)}</span>
      {date.dueAt ? (
        <>
          <span aria-hidden>·</span>
          <span className={date.overdue ? "text-kumo-danger" : undefined}>
            {`Due ${formatDate(date.dueAt)}`}
          </span>
        </>
      ) : null}
      <span aria-hidden>·</span>
      <span>{formatBytes(doc.fileSize)}</span>
    </div>
  );
}

function DocumentAiStatus({
  status,
  tooltip = false,
}: {
  readonly status: string | undefined;
  readonly tooltip?: boolean;
}) {
  if (status === "processing") {
    return tooltip ? (
      <Tooltip
        content="Analyzing document"
        render={<span className="inline-flex" />}
      >
        <Loader size="sm" className="text-kumo-brand" />
      </Tooltip>
    ) : (
      <Loader size="sm" className="text-kumo-brand" />
    );
  }
  if (status !== "completed") return null;
  return tooltip ? (
    <Tooltip
      content="Analysis complete"
      render={<span className="inline-flex" />}
    >
      <SparklesIcon className="text-kumo-brand h-3 w-3" />
    </Tooltip>
  ) : (
    <SparklesIcon className="text-kumo-brand h-3 w-3" />
  );
}

function DocumentActionsMenu({
  actions,
  delegateOwnership = false,
  doc,
  includeExpiredSend = false,
  includeTransferOwnership = false,
}: {
  readonly actions: DocumentListActions;
  readonly delegateOwnership?: boolean;
  readonly doc: DocumentListItem;
  readonly includeExpiredSend?: boolean;
  readonly includeTransferOwnership?: boolean;
}) {
  const workflowStatus = doc.workflowStatus ?? "draft";
  const canSend =
    workflowStatus === "draft" ||
    (includeExpiredSend && workflowStatus === "expired");
  const canCancel =
    workflowStatus === "sent" || workflowStatus === "in_progress";
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger>
        <Button
          variant="ghost"
          shape="square"
          size="sm"
          aria-label={`Document actions for ${doc.name}`}
          className="shrink-0"
          onClick={(event) => event.stopPropagation()}
          icon={MoreVerticalIcon}
        />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content
        align="end"
        onClick={(event) => event.stopPropagation()}
      >
        <DropdownMenu.Item onClick={() => actions.openDocument(doc._id)} icon={FileTextIcon}>
          Open
        </DropdownMenu.Item>
        {canSend && (
          <DropdownMenu.Item onClick={() => actions.sendDocument(doc._id)} icon={SendIcon}>
            {workflowStatus === "expired"
              ? "Re-send Document"
              : "Send Document"}
          </DropdownMenu.Item>
        )}
        {canCancel && (
          <DropdownMenu.Item
            onClick={() => actions.cancelDocument(doc._id)}
            variant="danger"
           icon={BanIcon}>
            Cancel Document
          </DropdownMenu.Item>
        )}
        <DropdownMenu.Item onClick={() => actions.downloadDocument(doc._id)} icon={DownloadIcon}>
          Download
        </DropdownMenu.Item>
        <DropdownMenu.Item
          onClick={() => actions.shareDocument(doc._id, doc.name)}
         icon={Share2Icon}>
          Share
        </DropdownMenu.Item>
        <DropdownMenu.Item onClick={() => actions.moveToFolder(doc._id)} icon={FolderInputIcon}>
          Move to Folder
        </DropdownMenu.Item>
        {includeTransferOwnership && delegateOwnership && (
          <DropdownMenu.Item onClick={() => actions.transferOwnership(doc)} icon={ArrowRightLeftIcon}>
            Transfer Ownership
          </DropdownMenu.Item>
        )}
        <DropdownMenu.Item
          onClick={() => actions.deleteDocument(doc._id)}
          variant="danger"
         icon={TrashIcon}>
          Delete
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}

function toDocumentListItem(doc: ApiDocument): DocumentListItem {
  const workflowStatus = toWorkflowStatus(doc.workflowStatus);
  const date = listRowDate({
    status: workflowStatus,
    createdAt: doc.createdAt,
    sentAt: doc.sentAt,
    deadline: doc.deadline,
    now: Date.now(),
  });
  return {
    _id: doc.publicId,
    name: doc.name,
    description: doc.description ?? undefined,
    storageId: doc.storageKey ?? "",
    thumbnailDataUrl: doc.thumbnailDataUrl ?? undefined,
    pageCount: doc.pageCount ?? undefined,
    createdAt: doc.createdAt,
    sentAt: doc.sentAt,
    deadline: doc.deadline,
    progress: doc.progress,
    activityAt: date.at,
    fileSize: doc.fileSize ?? doc.size ?? 0,
    workflowStatus,
    aiProcessingStatus: doc.aiProcessingStatus ?? undefined,
    sharingMode: doc.sharingMode,
    ownerId: doc.ownerId,
  };
}

function toFolderListItem(folder: ApiFolder): FolderListItem {
  return {
    _id: folder.publicId,
    name: folder.name,
    createdAt: folder.createdAt,
  };
}

function useDocumentsListData({
  dateRange,
  filter,
  folderId,
  searchQuery,
  sortDirection,
  sortField,
  workflowStatusFilter,
}: Pick<
  DocumentsListProps,
  | "dateRange"
  | "filter"
  | "folderId"
  | "searchQuery"
  | "sortDirection"
  | "sortField"
  | "workflowStatusFilter"
>): DocumentsListData & { readonly refetch: () => void } {
  const [currentPage, setCurrentPage] = useState(1);
  const { slug } = Route.useParams();
  const { data: apiDocuments, refetch: refetchDocuments } = useSuspenseQuery({
    queryKey: [
      "api",
      "documents",
      filter,
      workflowStatusFilter,
      folderId,
      slug,
    ],
    queryFn: () =>
      getDocuments(slug, {
        filter,
        workflowStatus:
          workflowStatusFilter === "all" ? undefined : workflowStatusFilter,
        folderId,
        rootOnly: !folderId,
      }),
  });
  const { data: apiFolders, refetch: refetchFolders } = useSuspenseQuery({
    queryKey: ["api", "folders", "document", folderId, slug],
    queryFn: () => getFolders(slug, { type: "document", parentId: folderId }),
  });

  const allDocuments = useMemo(
    () => apiDocuments.map(toDocumentListItem),
    [apiDocuments]
  );
  const subfolders = useMemo(
    () => apiFolders?.map(toFolderListItem),
    [apiFolders]
  );

  const filteredByStatus = useMemo(
    () =>
      filterDocumentsByStatusAndDate(
        allDocuments,
        workflowStatusFilter,
        dateRange
      ),
    [allDocuments, workflowStatusFilter, dateRange]
  );
  const fuse = useMemo(
    () => new Fuse(filteredByStatus, fuseOptions),
    [filteredByStatus]
  );
  const searchResults = useMemo(
    () =>
      searchQuery.trim()
        ? fuse.search(searchQuery)
        : filteredByStatus.map((doc) => ({ item: doc, matches: undefined })),
    [fuse, searchQuery, filteredByStatus]
  );
  const filteredDocuments = useMemo(
    () => searchResults.map((result) => result.item),
    [searchResults]
  );
  const matchesMap = useMemo(
    () => buildMatchesMap(searchResults),
    [searchResults]
  );
  const sortedDocuments = useMemo(
    () =>
      sortDocuments(filteredDocuments, searchQuery, sortField, sortDirection),
    [filteredDocuments, sortField, sortDirection, searchQuery]
  );
  const totalPages = Math.ceil(sortedDocuments.length / DOCUMENTS_PER_PAGE);
  const visibleDocuments = useMemo(
    () => paginatedDocuments(sortedDocuments, currentPage),
    [sortedDocuments, currentPage]
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: We want to reset page when filters/search change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    filter,
    workflowStatusFilter,
    sortField,
    sortDirection,
    searchQuery,
    dateRange,
  ]);

  const refetch = useCallback(() => {
    void refetchDocuments();
    void refetchFolders();
  }, [refetchDocuments, refetchFolders]);

  return {
    currentPage,
    hasFiltersOrSearch: Boolean(
      searchQuery.trim() ||
      filter !== "all" ||
      workflowStatusFilter !== "all" ||
      dateRange?.from ||
      dateRange?.to
    ),
    matchesMap,
    paginatedDocuments: visibleDocuments,
    refetch,
    setCurrentPage,
    sortedDocuments,
    subfolders,
    totalPages,
  };
}

function DocumentsListContent({
  data,
  delegateOwnership,
  documentActions,
  onFolderNavigate,
  onSortChange,
  onUploadClick,
  searchQuery,
  sortDirection,
  sortField,
  viewMode,
}: {
  readonly data: DocumentsListData;
  readonly delegateOwnership: boolean;
  readonly documentActions: DocumentListActions;
  readonly onFolderNavigate: (folderId?: string) => void;
  readonly onSortChange: (field: SortField) => void;
  readonly onUploadClick: () => void;
  readonly searchQuery: string;
  readonly sortDirection: SortDirection;
  readonly sortField: SortField;
  readonly viewMode: ViewMode;
}) {
  if (
    data.sortedDocuments.length === 0 &&
    (!data.subfolders || data.subfolders.length === 0)
  ) {
    return (
      <DocumentsEmptyState
        hasFiltersOrSearch={data.hasFiltersOrSearch}
        onUploadClick={onUploadClick}
      />
    );
  }

  return (
    <div className="space-y-4">
      {viewMode === "table" ? (
        <DocumentsTable
          data={data}
          delegateOwnership={delegateOwnership}
          documentActions={documentActions}
          onFolderNavigate={onFolderNavigate}
          onSortChange={onSortChange}
          searchQuery={searchQuery}
          sortDirection={sortDirection}
          sortField={sortField}
        />
      ) : viewMode === "finder" ? (
        <DocumentsFinder
          data={data}
          documentActions={documentActions}
          onFolderNavigate={onFolderNavigate}
          searchQuery={searchQuery}
        />
      ) : (
        <DocumentsGrid
          data={data}
          documentActions={documentActions}
          onFolderNavigate={onFolderNavigate}
          searchQuery={searchQuery}
        />
      )}
      <DocumentsPagination data={data} />
    </div>
  );
}

function DocumentsEmptyState({
  hasFiltersOrSearch,
  onUploadClick,
}: {
  readonly hasFiltersOrSearch: boolean;
  readonly onUploadClick: () => void;
}) {
  return (
    <div
      className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300"
      data-testid="documents-empty"
    >
      {hasFiltersOrSearch ? (
        <Empty
          icon={<SearchIcon size={24} />}
          title="No documents found"
          description="Try adjusting your search or filters to find what you're looking for."
        />
      ) : (
        <Empty
          icon={<FileTextIcon size={24} />}
          title="Send your first document"
          description="Upload a PDF, add people, place fields, send. About a minute."
          contents={
            <Button
              onClick={onUploadClick}
              variant="primary"
              icon={UploadIcon}
            >
              Upload PDF
            </Button>
          }
        />
      )}
    </div>
  );
}

function DocumentsTable({
  data,
  delegateOwnership,
  documentActions,
  onFolderNavigate,
  onSortChange,
  searchQuery,
  sortDirection,
  sortField,
}: {
  readonly data: DocumentsListData;
  readonly delegateOwnership: boolean;
  readonly documentActions: DocumentListActions;
  readonly onFolderNavigate: (folderId?: string) => void;
  readonly onSortChange: (field: SortField) => void;
  readonly searchQuery: string;
  readonly sortDirection: SortDirection;
  readonly sortField: SortField;
}) {
  return (
    <div className="max-w-4xl overflow-x-auto rounded-lg border">
      <Table className="table-fixed">
        <Table.Header>
          <Table.Row>
            <Table.Head className="w-[28rem]">
              <SortHeader
                field="name"
                label="Title"
                onSortChange={onSortChange}
                sortDirection={sortDirection}
                sortField={sortField}
              />
            </Table.Head>
            <Table.Head className="hidden w-[16rem] sm:table-cell">
              <SortHeader
                field="createdAt"
                label="Date"
                onSortChange={onSortChange}
                sortDirection={sortDirection}
                sortField={sortField}
              />
            </Table.Head>
            <Table.Head className="w-40">
              <SortHeader
                field="workflowStatus"
                label="Status"
                onSortChange={onSortChange}
                sortDirection={sortDirection}
                sortField={sortField}
              />
            </Table.Head>
            <Table.Head className="w-14">
              <span className="sr-only">Menu</span>
            </Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {!searchQuery.trim() &&
            data.subfolders?.map((folder) => (
              <FolderTableRow
                key={folder._id}
                folder={folder}
                onFolderNavigate={onFolderNavigate}
              />
            ))}
          {data.paginatedDocuments.map((doc) => (
            <DocumentTableRow
              key={doc._id}
              actions={documentActions}
              delegateOwnership={delegateOwnership}
              doc={doc}
              matches={data.matchesMap.get(doc._id)}
            />
          ))}
        </Table.Body>
      </Table>
    </div>
  );
}

function DocumentsFinder({
  data,
  documentActions,
  onFolderNavigate,
  searchQuery,
}: {
  readonly data: DocumentsListData;
  readonly documentActions: DocumentListActions;
  readonly onFolderNavigate: (folderId?: string) => void;
  readonly searchQuery: string;
}): JSX.Element {
  const items: FileSystemItem[] = [
    ...(!searchQuery.trim()
      ? (data.subfolders ?? []).map((folder) => ({
          id: folder._id,
          kind: "folder" as const,
          name: folder.name,
        }))
      : []),
    ...data.paginatedDocuments.map((doc) => ({
      id: doc._id,
      kind: "file" as const,
      name: doc.name,
      mimeType: "application/pdf",
      size: doc.fileSize,
      previewUrl: doc.thumbnailDataUrl ?? null,
    })),
  ];

  return (
    <div className="border-kumo-line bg-kumo-base rounded-xl border">
      <FileSystem
        items={items}
        view="icons"
        onSelect={(item) => {
          if (item.kind === "file") documentActions.openDocument(item.id);
        }}
        onOpenFolder={(folder) => onFolderNavigate(folder.id)}
      />
    </div>
  );
}

function DocumentsGrid({
  data,
  documentActions,
  onFolderNavigate,
  searchQuery,
}: {
  readonly data: DocumentsListData;
  readonly documentActions: DocumentListActions;
  readonly onFolderNavigate: (folderId?: string) => void;
  readonly searchQuery: string;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {!searchQuery.trim() &&
        data.subfolders?.map((folder) => (
          <FolderGridCard
            key={folder._id}
            folder={folder}
            onFolderNavigate={onFolderNavigate}
          />
        ))}
      {data.paginatedDocuments.map((doc) => (
        <DocumentGridCard
          key={doc._id}
          actions={documentActions}
          doc={doc}
          matches={data.matchesMap.get(doc._id)}
        />
      ))}
    </div>
  );
}

function DocumentsPagination({ data }: { readonly data: DocumentsListData }) {
  if (data.totalPages <= 1) return null;
  return (
    <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
      <p
        className="text-kumo-secondary text-center text-sm sm:text-left"
        aria-live="polite"
      >
        Showing {(data.currentPage - 1) * DOCUMENTS_PER_PAGE + 1} to{" "}
        {Math.min(
          data.currentPage * DOCUMENTS_PER_PAGE,
          data.sortedDocuments.length
        )}{" "}
        of {data.sortedDocuments.length} documents
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => data.setCurrentPage((prev) => Math.max(1, prev - 1))}
          disabled={data.currentPage === 1}
          icon={ChevronLeftIcon}
        >
          <span className="hidden sm:inline">Previous</span>
        </Button>
        <div className="flex items-center gap-1">
          {Array.from({ length: data.totalPages }, (_, index) => index + 1).map(
            (page) => (
              <Button
                key={page}
                variant={page === data.currentPage ? "primary" : "outline"}
                size="sm"
                onClick={() => data.setCurrentPage(page)}
              >
                {page}
              </Button>
            )
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            data.setCurrentPage((prev) => Math.min(data.totalPages, prev + 1))
          }
          disabled={data.currentPage === data.totalPages}
          icon={ChevronRightIcon}
        >
          <span className="hidden sm:inline">Next</span>
        </Button>
      </div>
    </div>
  );
}

function SortHeader({
  field,
  label,
  onSortChange,
  sortDirection,
  sortField,
}: SortHeaderProps) {
  return (
    <Button
      variant="ghost"
      onClick={() => onSortChange(field)}
      size="sm"
      className="-ml-2"
      icon={
        sortField === field
          ? sortDirection === "asc"
            ? ArrowUpIcon
            : ArrowDownIcon
          : undefined
      }
    >
      {label}
    </Button>
  );
}

function DocumentConfirmationDialog({
  confirmDialog,
  onConfirm,
  setConfirmDialog,
}: {
  readonly confirmDialog: ConfirmDialogState;
  readonly onConfirm: () => Promise<void>;
  readonly setConfirmDialog: React.Dispatch<
    React.SetStateAction<ConfirmDialogState>
  >;
}) {
  const content = confirmDialogContent(confirmDialog.type);
  return (
    <Dialog.Root
      role="alertdialog"
      open={confirmDialog.open}
      onOpenChange={(open) =>
        setConfirmDialog({ ...defaultConfirmDialog(), open })
      }
    >
      <Dialog size="sm" className="p-6">
        <Dialog.Title>{content.title}</Dialog.Title>
        <Dialog.Description>{content.description}</Dialog.Description>
        <div className="mt-4 flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() =>
              setConfirmDialog({ ...defaultConfirmDialog(), open: false })
            }
          >
            Cancel
          </Button>
          <Button
            variant={confirmDialogActionVariant(confirmDialog.type)}
            onClick={onConfirm}
          >
            {confirmDialogActionLabel(confirmDialog.type)}
          </Button>
        </div>
      </Dialog>
    </Dialog.Root>
  );
}

function useDocumentListActions({
  onMoveToFolder,
  onShareClick,
  onTransferOwnership,
  refetch,
}: Pick<
  DocumentsListProps,
  "onMoveToFolder" | "onShareClick" | "onTransferOwnership"
> & {
  readonly refetch: () => void;
}): {
  readonly confirmDialog: ConfirmDialogState;
  readonly documentActions: DocumentListActions;
  readonly handleConfirmAction: () => Promise<void>;
  readonly setConfirmDialog: React.Dispatch<
    React.SetStateAction<ConfirmDialogState>
  >;
} {
  const { slug } = Route.useParams();
  const router = useRouter();
  const { track } = useAnalytics();
  const deleteDocument = useMutation({
    mutationFn: (publicId: string) => deleteDocumentApi(slug, publicId),
  });
  const sendDocument = useMutation({
    mutationFn: (publicId: string) => sendDocumentApi(slug, publicId),
  });
  const cancelDocument = useMutation({
    mutationFn: (publicId: string) => cancelDocumentApi(slug, publicId),
  });
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(
    defaultConfirmDialog()
  );

  const openConfirmDialog = (
    type: ConfirmDialogState["type"],
    documentId: string
  ) => {
    setConfirmDialog({ open: true, type, documentId });
  };
  const handleOpenDocument = (documentId: string) => {
    void router.navigate({
      to: "/$slug/documents/$documentId",
      params: { slug, documentId },
    });
  };
  const handleDownload = async (documentId: string) => {
    try {
      const blob = await downloadDocument(slug, documentId);
      const url = window.URL.createObjectURL(blob);
      track.documentDownloaded({ documentId });
      window.open(url, "_blank");
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch {
      toast.error("Failed to download document");
    }
  };
  const handleConfirmAction = async () => {
    if (!confirmDialog.documentId) return;
    try {
      const documentId = confirmDialog.documentId;
      if (confirmDialog.type === "delete") {
        await deleteDocument.mutateAsync(documentId);
        track.documentDeleted({ documentId });
        toast.success("Document deleted");
      } else if (confirmDialog.type === "send") {
        await sendDocument.mutateAsync(documentId);
        track.documentSent({ documentId });
        toast.success("Document sent successfully");
      } else {
        await cancelDocument.mutateAsync(documentId);
        track.documentCancelled({ documentId });
        toast.success("Document cancelled");
      }
      refetch();
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : `Failed to ${confirmDialog.type} document`;
      toast.error(errorMessage);
    } finally {
      setConfirmDialog(defaultConfirmDialog());
    }
  };

  return {
    confirmDialog,
    documentActions: {
      openDocument: handleOpenDocument,
      sendDocument: (documentId) => openConfirmDialog("send", documentId),
      cancelDocument: (documentId) => openConfirmDialog("cancel", documentId),
      downloadDocument: handleDownload,
      shareDocument: onShareClick,
      moveToFolder: onMoveToFolder,
      deleteDocument: (documentId) => openConfirmDialog("delete", documentId),
      transferOwnership: onTransferOwnership,
    },
    handleConfirmAction,
    setConfirmDialog,
  };
}

function DocumentsList({
  filter,
  workflowStatusFilter,
  viewMode,
  sortField,
  sortDirection,
  searchQuery,
  dateRange,
  folderId,
  onShareClick,
  onSortChange,
  onUploadClick,
  onMoveToFolder,
  onFolderNavigate,
  delegateOwnership,
  onTransferOwnership,
}: DocumentsListProps) {
  const data = useDocumentsListData({
    dateRange,
    filter,
    folderId,
    searchQuery,
    sortDirection,
    sortField,
    workflowStatusFilter,
  });
  const {
    confirmDialog,
    documentActions,
    handleConfirmAction,
    setConfirmDialog,
  } = useDocumentListActions({
    onMoveToFolder,
    onShareClick,
    onTransferOwnership,
    refetch: data.refetch,
  });

  return (
    <>
      <DocumentsListContent
        data={data}
        delegateOwnership={delegateOwnership}
        documentActions={documentActions}
        onFolderNavigate={onFolderNavigate}
        onSortChange={onSortChange}
        onUploadClick={onUploadClick}
        searchQuery={searchQuery}
        sortDirection={sortDirection}
        sortField={sortField}
        viewMode={viewMode}
      />
      <DocumentConfirmationDialog
        confirmDialog={confirmDialog}
        onConfirm={handleConfirmAction}
        setConfirmDialog={setConfirmDialog}
      />
    </>
  );
}

function DocumentsPage() {
  const { slug } = Route.useParams();
  const { folderId: folderIdParam } = Route.useSearch();
  const navigate = useNavigate();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(
    null
  );
  const [selectedDocumentName, setSelectedDocumentName] = useState("");
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [documentToTransfer, setDocumentToTransfer] = useState<{
    id: string;
    name: string;
    ownerId: string;
    sharingMode: string;
  } | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");
  const [workflowStatusFilter, setWorkflowStatusFilter] =
    useState<WorkflowStatusFilter>("all");
  const [refreshKey, setRefreshKey] = useState(0);

  // SEA-68: View mode, sorting state
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // SEA-73: Fuzzy search state
  const [searchQuery, setSearchQuery] = useState("");

  // SEA-74: Date range filter state
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  const queryClient = useQueryClient();

  // Folder: move-to-folder dialog state
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [moveDocumentId, setMoveDocumentId] = useState<string | null>(null);
  const moveDocumentsToFolderMutation = useMutation({
    mutationFn: (options: { documentIds: string[]; folderId?: string }) =>
      moveDocumentsToFolder(slug, options),
  });

  // folderIdParam is a public folder id from the URL
  const folderId = folderIdParam ?? undefined;

  const handleFolderSelect = (selectedFolderId?: string) => {
    void navigate({
      to: "/$slug/documents",
      params: { slug },
      search: { folderId: selectedFolderId },
    });
  };

  const handleMoveToFolder = (documentId: string) => {
    setMoveDocumentId(documentId);
    setMoveDialogOpen(true);
  };

  const handleMoveConfirm = async (targetFolderId?: string) => {
    if (!moveDocumentId) return;
    try {
      await moveDocumentsToFolderMutation.mutateAsync({
        documentIds: [moveDocumentId],
        folderId: targetFolderId,
      });
      toast.success("Document moved successfully");
      await queryClient.invalidateQueries({ queryKey: ["api"] });
      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Failed to move document";
      toast.error(msg);
    } finally {
      setMoveDialogOpen(false);
      setMoveDocumentId(null);
    }
  };

  const handleSortChange = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction if clicking same field
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      // Default to descending for new field
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const { data: organization } = useSuspenseOrganization(slug);

  if (!organization) {
    return <DocumentsSkeleton />;
  }

  const delegateOwnership = organization.delegateOwnership;

  const handleRefetch = () => {
    void queryClient.invalidateQueries({ queryKey: ["api"] });
    setRefreshKey((prev) => prev + 1);
  };

  const handleShareClick = (documentId: string, documentName: string) => {
    setSelectedDocumentId(documentId);
    setSelectedDocumentName(documentName);
    setShareDialogOpen(true);
  };

  const handleTransferOwnership = (doc: {
    _id: string;
    name: string;
    ownerId: string;
    sharingMode: string;
  }) => {
    setDocumentToTransfer({
      id: doc._id,
      name: doc.name,
      ownerId: doc.ownerId,
      sharingMode: doc.sharingMode,
    });
    setTransferDialogOpen(true);
  };

  return (
    <PageWrapper
      title="Documents"
      action={{
        label: "Upload Document",
        onClick: () => setUploadOpen(true),
        icon: UploadIcon,
        variant: "default",
      }}
      headerActions={
        <CreateFolderDialog
          organizationSlug={slug}
          type="document"
          parentId={folderId}
        />
      }
      headerCenter={
        <FolderBreadcrumbs
          organizationSlug={slug}
          folderId={folderId}
          type="document"
        />
      }
    >
      {/* Cap: intentional reading width — not a full-bleed ocean */}
      <div className="flex w-full flex-col gap-4">
        {/* SEA-99: flat toolbar — no nested filter cards */}
        <div className="flex flex-col gap-3">
          <div className="relative">
            <SearchIcon className="text-kumo-secondary absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              type="text"
              aria-label="Search documents by name or description"
              placeholder="Search documents…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-9 pl-9"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                shape="square"
                size="sm"
                title="Clear search"
                className="absolute top-1/2 right-1 size-7 -translate-y-1/2"
                onClick={() => setSearchQuery("")}
              >
                <XIcon className="size-4" />
                <span className="sr-only">Clear search</span>
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              <Button
                size="sm"
                variant={filter === "all" ? "primary" : "outline"}
                onClick={() => setFilter("all")}
              >
                All
              </Button>
              <Button
                size="sm"
                variant={filter === "owned" ? "primary" : "outline"}
                onClick={() => setFilter("owned")}
              >
                Mine
              </Button>
              <Button
                size="sm"
                variant={filter === "shared" ? "primary" : "outline"}
                onClick={() => setFilter("shared")}
              >
                Shared
              </Button>
            </div>
            <div className="bg-kumo-elevated/40 flex items-center gap-0.5 rounded-md p-0.5">
              <Button
                variant={viewMode === "table" ? "primary" : "ghost"}
                shape="square"
                size="sm"
                aria-label="Table view"
                icon={LayoutListIcon}
                onClick={() => setViewMode("table")}
              />
              <Button
                variant={viewMode === "grid" ? "primary" : "ghost"}
                shape="square"
                size="sm"
                aria-label="Grid view"
                icon={LayoutGridIcon}
                onClick={() => setViewMode("grid")}
              />
              <Button
                variant={viewMode === "finder" ? "primary" : "ghost"}
                shape="square"
                size="sm"
                aria-label="Finder view"
                icon={FolderIcon}
                onClick={() => setViewMode("finder")}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-kumo-secondary text-xs font-medium tracking-wide uppercase">
              Status
            </span>
            {(
              [
                ["all", "All"],
                ["draft", "Drafts"],
                ["sent", "Sent"],
                ["in_progress", "In Progress"],
                ["completed", "Completed"],
                ["cancelled", "Cancelled"],
                ["expired", "Expired"],
              ] as const
            ).map(([value, label]) => (
              <Button
                key={value}
                size="sm"
                variant={workflowStatusFilter === value ? "primary" : "outline"}
                onClick={() => setWorkflowStatusFilter(value)}
              >
                {label}
              </Button>
            ))}

            <div className="w-full sm:ml-1 sm:w-auto sm:border-l sm:pl-2">
              <Popover>
                <Popover.Trigger
                  render={
                    <Button
                      variant={dateRange?.from ? "primary" : "outline"}
                      size="sm"
                      className="w-full sm:w-auto"
                    >
                      <CalendarIcon className="size-4" />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>
                            {dateRange.from.toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}{" "}
                            -{" "}
                            {dateRange.to.toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </>
                        ) : (
                          dateRange.from.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        )
                      ) : (
                        "Date"
                      )}
                    </Button>
                  }
                />
                <Popover.Content className="w-auto p-0" align="start">
                  <DatePicker
                    mode="range"
                    selected={dateRange}
                    onChange={setDateRange}
                    numberOfMonths={1}
                    className="sm:hidden"
                  />
                  <DatePicker
                    mode="range"
                    selected={dateRange}
                    onChange={setDateRange}
                    numberOfMonths={2}
                    className="hidden sm:block"
                  />
                  {dateRange?.from && (
                    <div className="border-t p-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => setDateRange(undefined)}
                      >
                        Clear date
                      </Button>
                    </div>
                  )}
                </Popover.Content>
              </Popover>
            </div>
          </div>

          {(searchQuery.trim() ||
            filter !== "all" ||
            workflowStatusFilter !== "all" ||
            dateRange?.from) && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-kumo-secondary text-xs">Active</span>
              {searchQuery.trim() && (
                <Badge variant="secondary" className="gap-1 pl-2">
                  Search: "{searchQuery}"
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    shape="square"
                    icon={XIcon}
                    aria-label="Clear search"
                    onClick={() => setSearchQuery("")}
                  />
                </Badge>
              )}
              {filter !== "all" && (
                <Badge variant="secondary" className="gap-1 pl-2 capitalize">
                  {filter === "owned" ? "Mine" : "Shared"}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    shape="square"
                    icon={XIcon}
                    aria-label="Clear ownership filter"
                    onClick={() => setFilter("all")}
                  />
                </Badge>
              )}
              {workflowStatusFilter !== "all" && (
                <Badge variant="secondary" className="gap-1 pl-2 capitalize">
                  Status:{" "}
                  {workflowStatusFilter === "in_progress"
                    ? "In Progress"
                    : workflowStatusFilter}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    shape="square"
                    icon={XIcon}
                    aria-label="Clear status filter"
                    onClick={() => setWorkflowStatusFilter("all")}
                  />
                </Badge>
              )}
              {dateRange?.from && (
                <Badge variant="secondary" className="gap-1 pl-2">
                  Date:{" "}
                  {dateRange.from.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                  {dateRange.to &&
                    `- ${dateRange.to.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    shape="square"
                    icon={XIcon}
                    aria-label="Clear date filter"
                    onClick={() => setDateRange(undefined)}
                  />
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setFilter("all");
                  setWorkflowStatusFilter("all");
                  setDateRange(undefined);
                }}
              >
                Clear all
              </Button>
            </div>
          )}
        </div>

        {/* Documents List with Suspense */}
        <Suspense
          key={`${filter}-${workflowStatusFilter}-${refreshKey}-${folderId ?? "root"}`}
          fallback={
            viewMode === "table" ? (
              <div className="flex items-center justify-center rounded-lg border p-12">
                <Text as="p" variant="secondary">Loading documents...</Text>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <CardSkeleton showDescription showFooter={false} />
                <CardSkeleton showDescription showFooter={false} />
                <CardSkeleton showDescription showFooter={false} />
                <CardSkeleton showDescription showFooter={false} />
                <CardSkeleton showDescription showFooter={false} />
                <CardSkeleton showDescription showFooter={false} />
              </div>
            )
          }
        >
          <DocumentsList
            filter={filter}
            workflowStatusFilter={workflowStatusFilter}
            viewMode={viewMode}
            sortField={sortField}
            sortDirection={sortDirection}
            searchQuery={searchQuery}
            dateRange={dateRange}
            folderId={folderId}
            onShareClick={handleShareClick}
            onSortChange={handleSortChange}
            onUploadClick={() => setUploadOpen(true)}
            onMoveToFolder={handleMoveToFolder}
            onFolderNavigate={handleFolderSelect}
            delegateOwnership={delegateOwnership}
            onTransferOwnership={handleTransferOwnership}
          />
        </Suspense>
      </div>

      <UploadDialog
        organizationId={organization.id}
        organizationSlug={slug}
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onSuccess={handleRefetch}
      />

      {selectedDocumentId && (
        <ShareDocumentDialog
          organizationSlug={slug}
          documentId={selectedDocumentId}
          documentName={selectedDocumentName}
          slug={slug}
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
        />
      )}

      <MoveToFolderDialog
        open={moveDialogOpen}
        onOpenChange={setMoveDialogOpen}
        organizationSlug={slug}
        organizationId={organization.id}
        type="document"
        onMove={handleMoveConfirm}
      />

      {documentToTransfer && (
        <TransferOwnershipDialog
          open={transferDialogOpen}
          onOpenChange={setTransferDialogOpen}
          organizationSlug={slug}
          documentId={documentToTransfer.id}
          documentName={documentToTransfer.name}
          currentOwnerId={documentToTransfer.ownerId}
          sharingMode={documentToTransfer.sharingMode}
          slug={slug}
        />
      )}
    </PageWrapper>
  );
}
