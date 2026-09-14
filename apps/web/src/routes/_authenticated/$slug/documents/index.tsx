import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { Empty } from "@cloudflare/kumo/components/empty";
import { Input } from "@cloudflare/kumo/components/input";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Table } from "@cloudflare/kumo/components/table";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  createFileRoute,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import Fuse, { type FuseResultMatch } from "fuse.js";
import {
  ArrowDownIcon,
  ArrowRightLeftIcon,
  ArrowUpIcon,
  BanIcon,
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  FileIcon,
  FileTextIcon,
  FolderIcon,
  LayoutGridIcon,
  LayoutListIcon,
  Loader2Icon,
  FolderInputIcon,
  MoreVerticalIcon,
  SearchIcon,
  SendIcon,
  SparklesIcon,
  Share2Icon,
  TrashIcon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";

import { DocumentThumbnail } from "@/components/documents/document-thumbnail";
import { ShareDocumentDialog } from "@/components/documents/share-document-dialog";
import { TransferOwnershipDialog } from "@/components/documents/transfer-ownership-dialog";
import { UploadDialog } from "@/components/documents/upload-dialog";
import { WorkflowStatusBadge } from "@/components/documents/workflow-status-badge";
import { CreateFolderDialog } from "@/components/folders/create-folder-dialog";
import { FolderBreadcrumbs } from "@/components/folders/folder-breadcrumbs";
import { MoveToFolderDialog } from "@/components/folders/move-to-folder-dialog";
import { PageWrapper } from "@/components/page-wrapper";
import { CardSkeleton } from "@/components/skeletons/card-skeleton";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  toWorkflowStatus,
  type DocumentWorkflowStatus,
} from "@/lib/document-status";
import { pageSEO } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/$slug/documents/")({
  component: DocumentsPage,
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

type FilterType = "all" | "owned" | "shared";
type WorkflowStatusFilter =
  | "all"
  | "draft"
  | "sent"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "expired";

type ViewMode = "grid" | "table";
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
      <mark key={`${start}-${end}`} className="bg-warning/30 rounded px-0.5">
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
  if (sortField === "createdAt") return a.createdAt - b.createdAt;
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
      className="hover:bg-muted/50 cursor-pointer"
      onClick={() => onFolderNavigate(folder._id)}
    >
      <Table.Cell>
        <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-md sm:h-12 sm:w-[60px]">
          <FolderIcon className="text-muted-foreground h-5 w-5" />
        </div>
      </Table.Cell>
      <Table.Cell>
        <p className="font-medium">{folder.name}</p>
        <p className="text-muted-foreground text-xs">Folder</p>
      </Table.Cell>
      <Table.Cell className="hidden sm:table-cell">
        <div className="text-sm">
          <p>{formatDate(folder.createdAt)}</p>
        </div>
      </Table.Cell>
      <Table.Cell>
        <Badge variant="outline" className="text-xs">
          Folder
        </Badge>
      </Table.Cell>
      <Table.Cell className="text-right" />
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
      className="hover:bg-muted/50 cursor-pointer"
      onClick={() => actions.openDocument(doc._id)}
    >
      <Table.Cell>
        <DocumentThumbnail
          organizationSlug={slug}
          publicId={doc._id}
          thumbnailDataUrl={doc.thumbnailDataUrl}
          name={doc.name}
        />
      </Table.Cell>
      <Table.Cell>
        <DocumentSummary doc={doc} matches={matches} />
      </Table.Cell>
      <Table.Cell className="hidden sm:table-cell">
        <div className="text-sm">
          <p>{formatDate(doc.createdAt)}</p>
          <p className="text-muted-foreground">{formatBytes(doc.fileSize)}</p>
        </div>
      </Table.Cell>
      <Table.Cell>
        <div className="flex items-center gap-2">
          <WorkflowStatusBadge status={doc.workflowStatus} />
          <DocumentAiStatus status={doc.aiProcessingStatus} tooltip />
        </div>
      </Table.Cell>
      <Table.Cell className="text-right">
        <DocumentActionsMenu
          actions={actions}
          delegateOwnership={delegateOwnership}
          doc={doc}
          includeExpiredSend
          includeTransferOwnership
        />
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
  return (
    <div>
      <p className="font-medium">
        <HighlightedText text={doc.name} matches={matches} fieldKey="name" />
      </p>
      {doc.description && (
        <p className="text-muted-foreground line-clamp-1 text-sm">
          <HighlightedText
            text={doc.description}
            matches={matches}
            fieldKey="description"
          />
        </p>
      )}
      {doc.pageCount !== undefined && doc.pageCount > 0 && (
        <p className="text-muted-foreground mt-1 text-xs">
          {doc.pageCount} {doc.pageCount === 1 ? "page" : "pages"}
        </p>
      )}
    </div>
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
    <LayerCard
      key={folder._id}
      className="hover:bg-secondary cursor-pointer transition-colors duration-200"
      onClick={() => onFolderNavigate(folder._id)}
    >
      <div className="bg-muted/50 flex h-32 w-full items-center justify-center border-b">
        <FolderIcon className="text-muted-foreground h-12 w-12" />
      </div>
      <LayerCard.Primary>
        <h3 className="flex items-center gap-2 text-sm">
          <FolderIcon className="h-4 w-4 shrink-0" />
          <span className="line-clamp-2">{folder.name}</span>
        </h3>
        <p>Folder</p>
      </LayerCard.Primary>
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
    <LayerCard
      key={doc._id}
      className="cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
      onClick={() => actions.openDocument(doc._id)}
    >
      <div className="bg-muted flex h-32 w-full items-center justify-center overflow-hidden border-b">
        <DocumentThumbnail
          organizationSlug={slug}
          publicId={doc._id}
          thumbnailDataUrl={doc.thumbnailDataUrl}
          name={doc.name}
          className="h-full w-full"
        />
      </div>
      <LayerCard.Primary>
        <GridCardHeader actions={actions} doc={doc} matches={matches} />
        {doc.description && (
          <p className="line-clamp-2">
            <HighlightedText
              text={doc.description}
              matches={matches}
              fieldKey="description"
            />
          </p>
        )}
      </LayerCard.Primary>
      <div className="p-4 pt-0">
        <DocumentGridMetadata doc={doc} />
      </div>
    </LayerCard>
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
      <div className="flex min-w-0 flex-1 items-start gap-2">
        <FileIcon className="text-muted-foreground h-5 w-5" />
        <h3 className="line-clamp-2 text-base leading-5 break-all">
          <HighlightedText text={doc.name} matches={matches} fieldKey="name" />
        </h3>
      </div>
      <DocumentActionsMenu actions={actions} doc={doc} />
    </div>
  );
}

function DocumentGridMetadata({ doc }: { readonly doc: DocumentListItem }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Status</span>
        <div className="flex items-center gap-1.5">
          <WorkflowStatusBadge status={doc.workflowStatus} />
          <DocumentAiStatus status={doc.aiProcessingStatus} />
        </div>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Size</span>
        <span>{formatBytes(doc.fileSize)}</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Uploaded</span>
        <span>{formatDate(doc.createdAt)}</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Sharing</span>
        <SharingModeBadge sharingMode={doc.sharingMode} />
      </div>
    </div>
  );
}

function SharingModeBadge({ sharingMode }: { readonly sharingMode: string }) {
  return (
    <Badge variant={sharingMode === "private" ? "secondary" : "primary"}>
      {sharingMode === "private" && "Private"}
      {sharingMode === "workspace" && "Team"}
      {sharingMode === "specific" && "Specific"}
    </Badge>
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
      <Tooltip>
        <TooltipTrigger asChild>
          <Loader2Icon className="text-ai-accent h-3 w-3 animate-spin" />
        </TooltipTrigger>
        <TooltipContent>AI analyzing document</TooltipContent>
      </Tooltip>
    ) : (
      <Loader2Icon className="text-ai-accent h-3 w-3 animate-spin" />
    );
  }
  if (status !== "completed") return null;
  return tooltip ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <SparklesIcon className="text-ai-accent h-3 w-3" />
      </TooltipTrigger>
      <TooltipContent>AI analysis complete</TooltipContent>
    </Tooltip>
  ) : (
    <SparklesIcon className="text-ai-accent h-3 w-3" />
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
          className="h-8 w-8 shrink-0"
          onClick={(event) => event.stopPropagation()}
        >
          <MoreVerticalIcon className="h-4 w-4" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content
        align="end"
        onClick={(event) => event.stopPropagation()}
      >
        <DropdownMenu.Item onClick={() => actions.openDocument(doc._id)}>
          <FileTextIcon className="mr-2 h-4 w-4" />
          Open
        </DropdownMenu.Item>
        {canSend && (
          <DropdownMenu.Item onClick={() => actions.sendDocument(doc._id)}>
            <SendIcon className="mr-2 h-4 w-4" />
            {workflowStatus === "expired"
              ? "Re-send Document"
              : "Send Document"}
          </DropdownMenu.Item>
        )}
        {canCancel && (
          <DropdownMenu.Item
            onClick={() => actions.cancelDocument(doc._id)}
            variant="danger"
          >
            <BanIcon className="mr-2 h-4 w-4" />
            Cancel Document
          </DropdownMenu.Item>
        )}
        <DropdownMenu.Item onClick={() => actions.downloadDocument(doc._id)}>
          <DownloadIcon className="mr-2 h-4 w-4" />
          Download
        </DropdownMenu.Item>
        <DropdownMenu.Item
          onClick={() => actions.shareDocument(doc._id, doc.name)}
        >
          <Share2Icon className="mr-2 h-4 w-4" />
          Share
        </DropdownMenu.Item>
        <DropdownMenu.Item onClick={() => actions.moveToFolder(doc._id)}>
          <FolderInputIcon className="mr-2 h-4 w-4" />
          Move to Folder
        </DropdownMenu.Item>
        {includeTransferOwnership && delegateOwnership && (
          <DropdownMenu.Item onClick={() => actions.transferOwnership(doc)}>
            <ArrowRightLeftIcon className="mr-2 h-4 w-4" />
            Transfer Ownership
          </DropdownMenu.Item>
        )}
        <DropdownMenu.Item
          onClick={() => actions.deleteDocument(doc._id)}
          variant="danger"
        >
          <TrashIcon className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}

function toDocumentListItem(doc: ApiDocument): DocumentListItem {
  return {
    _id: doc.publicId,
    name: doc.name,
    description: doc.description ?? undefined,
    storageId: doc.storageKey ?? "",
    thumbnailDataUrl: doc.thumbnailDataUrl ?? undefined,
    pageCount: doc.pageCount ?? undefined,
    createdAt: doc.createdAt,
    fileSize: doc.fileSize ?? doc.size ?? 0,
    workflowStatus: toWorkflowStatus(doc.workflowStatus),
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
  return hasFiltersOrSearch ? (
    <Empty
      icon={<SearchIcon size={48} />}
      title="No documents found"
      description="Try adjusting your search or filters to find what you're looking for."
    />
  ) : (
    <Empty
      icon={<FileTextIcon size={48} />}
      title="No documents yet"
      description="Upload your first document to get started. You can send documents for signature, share with your team, and track their status."
      contents={
        <Button
          onClick={onUploadClick}
          variant="primary"
          icon={<UploadIcon className="h-4 w-4" />}
        >
          Upload Document
        </Button>
      }
    />
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
    <div className="overflow-x-auto rounded-lg border">
      <Table className="min-w-[600px]">
        <Table.Header>
          <Table.Row>
            <Table.Head className="w-[80px] sm:w-[100px]">Thumbnail</Table.Head>
            <Table.Head>
              <SortHeader
                field="name"
                label="Title"
                onSortChange={onSortChange}
                sortDirection={sortDirection}
                sortField={sortField}
              />
            </Table.Head>
            <Table.Head className="hidden sm:table-cell">
              <SortHeader
                field="createdAt"
                label="Upload Date"
                onSortChange={onSortChange}
                sortDirection={sortDirection}
                sortField={sortField}
              />
            </Table.Head>
            <Table.Head>
              <SortHeader
                field="workflowStatus"
                label="Status"
                onSortChange={onSortChange}
                sortDirection={sortDirection}
                sortField={sortField}
              />
            </Table.Head>
            <Table.Head className="text-right">Actions</Table.Head>
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
        className="text-muted-foreground text-center text-sm sm:text-left"
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
          className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
        >
          <ChevronLeftIcon className="h-4 w-4" />
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
                className="min-h-[44px] min-w-[44px] p-0 sm:h-8 sm:min-h-0 sm:min-w-[32px]"
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
          className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRightIcon className="h-4 w-4" />
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
      className="h-auto p-0 hover:bg-transparent"
    >
      <span className="font-medium">{label}</span>
      {sortField === field &&
        (sortDirection === "asc" ? (
          <ArrowUpIcon className="ml-2 h-4 w-4" />
        ) : (
          <ArrowDownIcon className="ml-2 h-4 w-4" />
        ))}
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
    return null;
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
          onNavigate={handleFolderSelect}
        />
      }
    >
      <div className="space-y-6">
        {/* SEA-73: Search Input */}
        <div className="bg-card/60 relative rounded-lg border px-2 py-2">
          <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            type="text"
            aria-label="Search documents by name or description"
            placeholder="Search documents by name or description..."
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
              className="absolute top-1/2 right-1 h-7 w-7 -translate-y-1/2"
              onClick={() => setSearchQuery("")}
            >
              <XIcon className="h-4 w-4" />
              <span className="sr-only">Clear search</span>
            </Button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="bg-card/50 space-y-4 rounded-lg border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <Button
                variant={filter === "all" ? "primary" : "outline"}
                onClick={() => setFilter("all")}
              >
                All Documents
              </Button>
              <Button
                variant={filter === "owned" ? "primary" : "outline"}
                onClick={() => setFilter("owned")}
              >
                My Documents
              </Button>
              <Button
                variant={filter === "shared" ? "primary" : "outline"}
                onClick={() => setFilter("shared")}
              >
                Shared with Me
              </Button>
            </div>
            {/* SEA-68: View mode toggle */}
            <div className="bg-background flex items-center gap-1 rounded-md border">
              <Button
                variant={viewMode === "table" ? "primary" : "ghost"}
                shape="square"
                size="sm"
                className="h-9 w-9"
                aria-label="Table view"
                onClick={() => setViewMode("table")}
              >
                <LayoutListIcon className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "grid" ? "primary" : "ghost"}
                shape="square"
                size="sm"
                className="h-9 w-9"
                aria-label="Grid view"
                onClick={() => setViewMode("grid")}
              >
                <LayoutGridIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Workflow Status Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground self-center text-sm">
              Status:
            </span>
            <Button
              size="sm"
              variant={workflowStatusFilter === "all" ? "primary" : "outline"}
              onClick={() => setWorkflowStatusFilter("all")}
            >
              All
            </Button>
            <Button
              size="sm"
              variant={workflowStatusFilter === "draft" ? "primary" : "outline"}
              onClick={() => setWorkflowStatusFilter("draft")}
            >
              Drafts
            </Button>
            <Button
              size="sm"
              variant={workflowStatusFilter === "sent" ? "primary" : "outline"}
              onClick={() => setWorkflowStatusFilter("sent")}
            >
              Sent
            </Button>
            <Button
              size="sm"
              variant={
                workflowStatusFilter === "in_progress" ? "primary" : "outline"
              }
              onClick={() => setWorkflowStatusFilter("in_progress")}
            >
              In Progress
            </Button>
            <Button
              size="sm"
              variant={
                workflowStatusFilter === "completed" ? "primary" : "outline"
              }
              onClick={() => setWorkflowStatusFilter("completed")}
            >
              Completed
            </Button>
            <Button
              size="sm"
              variant={
                workflowStatusFilter === "cancelled" ? "primary" : "outline"
              }
              onClick={() => setWorkflowStatusFilter("cancelled")}
            >
              Cancelled
            </Button>
            <Button
              size="sm"
              variant={
                workflowStatusFilter === "expired" ? "primary" : "outline"
              }
              onClick={() => setWorkflowStatusFilter("expired")}
            >
              Expired
            </Button>

            {/* SEA-74: Date Range Filter */}
            <div className="w-full sm:ml-2 sm:w-auto sm:border-l sm:pl-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={dateRange?.from ? "primary" : "outline"}
                    size="sm"
                    className="min-h-[44px] w-full gap-2 sm:min-h-0 sm:w-auto"
                  >
                    <CalendarIcon className="h-4 w-4" />
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
                      "Date Range"
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={1}
                    className="sm:hidden"
                  />
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={setDateRange}
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
                        Clear Date Range
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* SEA-75: Active Filter Chips */}
          {(searchQuery.trim() ||
            filter !== "all" ||
            workflowStatusFilter !== "all" ||
            dateRange?.from) && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground text-sm">
                Active filters:
              </span>
              {searchQuery.trim() && (
                <Badge variant="secondary" className="gap-1 pl-2">
                  Search: "{searchQuery}"
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="hover:bg-muted ml-1 rounded-full p-0.5"
                  >
                    <XIcon className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {filter !== "all" && (
                <Badge variant="secondary" className="gap-1 pl-2 capitalize">
                  {filter === "owned" ? "My Documents" : "Shared with Me"}
                  <button
                    type="button"
                    onClick={() => setFilter("all")}
                    className="hover:bg-muted ml-1 rounded-full p-0.5"
                  >
                    <XIcon className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {workflowStatusFilter !== "all" && (
                <Badge variant="secondary" className="gap-1 pl-2 capitalize">
                  Status:{" "}
                  {workflowStatusFilter === "in_progress"
                    ? "In Progress"
                    : workflowStatusFilter}
                  <button
                    type="button"
                    onClick={() => setWorkflowStatusFilter("all")}
                    className="hover:bg-muted ml-1 rounded-full p-0.5"
                  >
                    <XIcon className="h-3 w-3" />
                  </button>
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
                    ` - ${dateRange.to.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}`}
                  <button
                    type="button"
                    onClick={() => setDateRange(undefined)}
                    className="hover:bg-muted ml-1 rounded-full p-0.5"
                  >
                    <XIcon className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground h-6 px-2"
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
                <p className="text-muted-foreground">Loading documents...</p>
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
