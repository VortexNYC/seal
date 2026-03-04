import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate, useRouteContext, useRouter } from "@tanstack/react-router";
import { useMutation } from "convex/react";
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
import { Suspense, useEffect, useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";

import { DocumentThumbnail } from "@/components/documents/document-thumbnail";
import { ShareDocumentDialog } from "@/components/documents/share-document-dialog";
import { TransferOwnershipDialog } from "@/components/documents/transfer-ownership-dialog";
import { UploadDialog } from "@/components/documents/upload-dialog";
import { WorkflowStatusBadge } from "@/components/documents/workflow-status-badge";
import { FolderBreadcrumbs } from "@/components/folders/folder-breadcrumbs";
import { FolderSidebar } from "@/components/folders/folder-sidebar";
import { MoveToFolderDialog } from "@/components/folders/move-to-folder-dialog";
import { PageWrapper } from "@/components/page-wrapper";
import { CardSkeleton } from "@/components/skeletons/card-skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAnalytics } from "@/hooks/use-analytics";
import { pageSEO } from "@/lib/seo";
import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/$slug/documents/")({
  component: DocumentsPage,
  validateSearch: (search: Record<string, unknown>) => ({
    folderId: (search.folderId as string) || undefined,
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
      <mark key={`${start}-${end}`} className="rounded bg-warning/30 px-0.5">
        {text.slice(start, end + 1)}
      </mark>,
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
  organizationId: Id<"organizations">;
  filter: FilterType;
  workflowStatusFilter: WorkflowStatusFilter;
  viewMode: ViewMode;
  sortField: SortField;
  sortDirection: SortDirection;
  searchQuery: string;
  /** SEA-74: Date range filter */
  dateRange: DateRange | undefined;
  /** Folder filter */
  folderId: Id<"folders"> | undefined;
  onShareClick: (documentId: Id<"documents">, documentName: string) => void;
  onSortChange: (field: SortField) => void;
  /** SEA-140: Callback to open upload dialog from empty state */
  onUploadClick: () => void;
  /** Open move-to-folder dialog for a document */
  onMoveToFolder: (documentId: Id<"documents">) => void;
  /** Whether the org has ownership transfer enabled */
  delegateOwnership: boolean;
  /** Open transfer ownership dialog for a document */
  onTransferOwnership: (doc: {
    _id: Id<"documents">;
    name: string;
    ownerId: Id<"users">;
    sharingMode: string;
  }) => void;
}

function DocumentsList({
  organizationId,
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
  delegateOwnership,
  onTransferOwnership,
}: DocumentsListProps) {
  const { slug } = Route.useParams();
  const router = useRouter();
  const { convexClient } = useRouteContext({ from: "__root__" });
  const { track } = useAnalytics();

  // Pagination state (SEA-68: 20 items per page)
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  const { data: allDocuments, refetch } = useSuspenseQuery(
    convexQuery(api.documents.queries.listDocuments, {
      organizationId,
      filter,
      folderId,
    }),
  );

  // Filter documents by workflow status on the client side
  const filteredByStatus = useMemo(() => {
    let filtered = allDocuments;

    // Apply workflow status filter
    if (workflowStatusFilter !== "all") {
      filtered = filtered.filter((doc) => {
        const docWorkflowStatus = doc.workflowStatus ?? "draft";
        return docWorkflowStatus === workflowStatusFilter;
      });
    }

    // SEA-74: Apply date range filter
    if (dateRange?.from) {
      const fromDate = new Date(dateRange.from);
      fromDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter((doc) => doc.createdAt >= fromDate.getTime());
    }
    if (dateRange?.to) {
      const toDate = new Date(dateRange.to);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter((doc) => doc.createdAt <= toDate.getTime());
    }

    return filtered;
  }, [allDocuments, workflowStatusFilter, dateRange]);

  // SEA-73: Fuzzy search with Fuse.js
  const fuse = useMemo(() => new Fuse(filteredByStatus, fuseOptions), [filteredByStatus]);

  // SEA-73: Apply fuzzy search and track matches for highlighting
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) {
      // No search - return all documents without matches
      return filteredByStatus.map((doc) => ({ item: doc, matches: undefined }));
    }
    // Return fuse results with match info
    return fuse.search(searchQuery);
  }, [fuse, searchQuery, filteredByStatus]);

  // Extract just the documents for sorting
  const filteredDocuments = useMemo(() => searchResults.map((r) => r.item), [searchResults]);

  // Create a map of document ID to matches for highlighting
  const matchesMap = useMemo(() => {
    const map = new Map<Id<"documents">, readonly FuseResultMatch[] | undefined>();
    for (const result of searchResults) {
      map.set(result.item._id, result.matches);
    }
    return map;
  }, [searchResults]);

  // Sort documents (SEA-68: sorting by name and date)
  const sortedDocuments = useMemo(() => {
    // If searching, keep search relevance order unless explicitly sorting
    if (searchQuery.trim() && sortField === "createdAt") {
      return filteredDocuments;
    }

    const docs = [...filteredDocuments];
    docs.sort((a, b) => {
      let comparison = 0;

      if (sortField === "name") {
        comparison = a.name.localeCompare(b.name);
      } else if (sortField === "createdAt") {
        comparison = a.createdAt - b.createdAt;
      } else if (sortField === "workflowStatus") {
        const aStatus = a.workflowStatus ?? "draft";
        const bStatus = b.workflowStatus ?? "draft";
        comparison = aStatus.localeCompare(bStatus);
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
    return docs;
  }, [filteredDocuments, sortField, sortDirection, searchQuery]);

  // Pagination logic (SEA-68)
  const totalPages = Math.ceil(sortedDocuments.length / ITEMS_PER_PAGE);
  const paginatedDocuments = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedDocuments.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [sortedDocuments, currentPage]);

  // Reset to page 1 when filters change
  // biome-ignore lint/correctness/useExhaustiveDependencies: We want to reset page when filters/search change
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, workflowStatusFilter, sortField, sortDirection, searchQuery, dateRange]);

  const deleteDocument = useMutation(api.documents.mutations.deleteDocument);
  const sendDocument = useMutation(api.documents.mutations.sendDocument);
  const cancelDocument = useMutation(api.documents.mutations.cancelDocument);

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: "delete" | "send" | "cancel";
    documentId: Id<"documents"> | null;
  }>({
    open: false,
    type: "delete",
    documentId: null,
  });

  const handleDelete = (documentId: Id<"documents">) => {
    setConfirmDialog({
      open: true,
      type: "delete",
      documentId,
    });
  };

  const handleSendDocument = (documentId: Id<"documents">) => {
    setConfirmDialog({
      open: true,
      type: "send",
      documentId,
    });
  };

  const handleCancelDocument = (documentId: Id<"documents">) => {
    setConfirmDialog({
      open: true,
      type: "cancel",
      documentId,
    });
  };

  const handleConfirmAction = async () => {
    if (!confirmDialog.documentId) return;

    try {
      if (confirmDialog.type === "delete") {
        await deleteDocument({ documentId: confirmDialog.documentId });
        track.documentDeleted({ documentId: confirmDialog.documentId });
        toast.success("Document deleted");
        refetch();
      } else if (confirmDialog.type === "send") {
        await sendDocument({ documentId: confirmDialog.documentId });
        track.documentSent({ documentId: confirmDialog.documentId });
        toast.success("Document sent successfully");
        refetch();
      } else if (confirmDialog.type === "cancel") {
        await cancelDocument({ documentId: confirmDialog.documentId });
        track.documentCancelled({ documentId: confirmDialog.documentId });
        toast.success("Document cancelled");
        refetch();
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : `Failed to ${confirmDialog.type} document`;
      toast.error(errorMessage);
    } finally {
      setConfirmDialog({ open: false, type: "delete", documentId: null });
    }
  };

  const handleDownload = async (documentId: Id<"documents">) => {
    try {
      const url = await convexClient.query(api.documents.queries.getDocumentUrl, {
        documentId,
      });
      track.documentDownloaded({ documentId });
      window.open(url, "_blank");
    } catch (_error) {
      toast.error("Failed to download document");
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Math.round((bytes / k ** i) * 100) / 100} ${sizes[i]}`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getConfirmDialogContent = () => {
    switch (confirmDialog.type) {
      case "delete":
        return {
          title: "Delete Document",
          description:
            "Are you sure you want to delete this document? This action cannot be undone.",
        };
      case "send":
        return {
          title: "Send Document",
          description: "Send this document? Once sent, recipients will be notified to take action.",
        };
      case "cancel":
        return {
          title: "Cancel Document",
          description:
            "Cancel this document? This action cannot be undone and recipients will be notified.",
        };
    }
  };

  const dialogContent = getConfirmDialogContent();

  // SEA-68: Sort header component
  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
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

  // SEA-140: Determine if we're showing filtered results vs truly empty
  const hasFiltersOrSearch =
    searchQuery.trim() ||
    filter !== "all" ||
    workflowStatusFilter !== "all" ||
    dateRange?.from ||
    dateRange?.to;

  return (
    <>
      {/* SEA-140: Enhanced empty state with helpful CTAs */}
      {sortedDocuments.length === 0 ? (
        hasFiltersOrSearch ? (
          <EmptyState
            icon={SearchIcon}
            title="No documents found"
            description="Try adjusting your search or filters to find what you're looking for."
          />
        ) : (
          <EmptyState
            icon={FileTextIcon}
            title="No documents yet"
            description="Upload your first document to get started. You can send documents for signature, share with your team, and track their status."
            action={{
              label: "Upload Document",
              onClick: onUploadClick,
              icon: UploadIcon,
            }}
          />
        )
      ) : (
        <div className="space-y-4">
          {/* Table View (SEA-68) */}
          {viewMode === "table" ? (
            <div className="overflow-x-auto rounded-lg border">
              <Table className="min-w-[600px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px] sm:w-[100px]">Thumbnail</TableHead>
                    <TableHead>
                      <SortHeader field="name" label="Title" />
                    </TableHead>
                    <TableHead className="hidden sm:table-cell">
                      <SortHeader field="createdAt" label="Upload Date" />
                    </TableHead>
                    <TableHead>
                      <SortHeader field="workflowStatus" label="Status" />
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedDocuments.map((doc) => (
                    <TableRow
                      key={doc._id}
                      className="hover:bg-muted/50 cursor-pointer"
                      onClick={() =>
                        router.navigate({
                          to: "/$slug/documents/$documentId",
                          params: { slug, documentId: doc._id },
                        })
                      }
                    >
                      <TableCell>
                        <DocumentThumbnail
                          documentId={doc._id}
                          storageId={doc.storageId}
                          thumbnailDataUrl={doc.thumbnailDataUrl}
                          name={doc.name}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            <HighlightedText
                              text={doc.name}
                              matches={matchesMap.get(doc._id)}
                              fieldKey="name"
                            />
                          </p>
                          {doc.description && (
                            <p className="text-muted-foreground line-clamp-1 text-sm">
                              <HighlightedText
                                text={doc.description}
                                matches={matchesMap.get(doc._id)}
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
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="text-sm">
                          <p>{formatDate(doc.createdAt)}</p>
                          <p className="text-muted-foreground">{formatBytes(doc.fileSize)}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <WorkflowStatusBadge status={doc.workflowStatus} />
                          {doc.aiProcessingStatus === "processing" && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Loader2Icon className="h-3 w-3 animate-spin text-ai-accent" />
                              </TooltipTrigger>
                              <TooltipContent>AI analyzing document</TooltipContent>
                            </Tooltip>
                          )}
                          {doc.aiProcessingStatus === "completed" && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <SparklesIcon className="h-3 w-3 text-ai-accent" />
                              </TooltipTrigger>
                              <TooltipContent>AI analysis complete</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVerticalIcon className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            {((doc.workflowStatus ?? "draft") === "draft" ||
                              (doc.workflowStatus ?? "draft") === "expired") && (
                              <DropdownMenuItem onClick={() => handleSendDocument(doc._id)}>
                                <SendIcon className="mr-2 h-4 w-4" />
                                {(doc.workflowStatus ?? "draft") === "expired"
                                  ? "Re-send Document"
                                  : "Send Document"}
                              </DropdownMenuItem>
                            )}
                            {((doc.workflowStatus ?? "draft") === "sent" ||
                              (doc.workflowStatus ?? "draft") === "in_progress") && (
                              <DropdownMenuItem
                                onClick={() => handleCancelDocument(doc._id)}
                                className="text-destructive"
                              >
                                <BanIcon className="mr-2 h-4 w-4" />
                                Cancel Document
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => handleDownload(doc._id)}>
                              <DownloadIcon className="mr-2 h-4 w-4" />
                              Download
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onShareClick(doc._id, doc.name)}>
                              <Share2Icon className="mr-2 h-4 w-4" />
                              Share
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onMoveToFolder(doc._id)}>
                              <FolderInputIcon className="mr-2 h-4 w-4" />
                              Move to Folder
                            </DropdownMenuItem>
                            {delegateOwnership && (
                              <DropdownMenuItem onClick={() => onTransferOwnership(doc)}>
                                <ArrowRightLeftIcon className="mr-2 h-4 w-4" />
                                Transfer Ownership
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => handleDelete(doc._id)}
                              className="text-destructive"
                            >
                              <TrashIcon className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            /* Grid View */
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {paginatedDocuments.map((doc) => (
                <Card
                  key={doc._id}
                  className="cursor-pointer transition-shadow hover:shadow-lg"
                  onClick={() =>
                    router.navigate({
                      to: "/$slug/documents/$documentId",
                      params: { slug, documentId: doc._id },
                    })
                  }
                >
                  <div className="bg-muted flex h-32 w-full items-center justify-center overflow-hidden border-b">
                    <DocumentThumbnail
                      documentId={doc._id}
                      storageId={doc.storageId}
                      thumbnailDataUrl={doc.thumbnailDataUrl}
                      name={doc.name}
                      className="h-full w-full"
                    />
                  </div>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex min-w-0 flex-1 items-start gap-2">
                        <FileIcon className="text-muted-foreground h-5 w-5" />
                        <CardTitle className="line-clamp-2 text-base leading-5 break-all">
                          <HighlightedText
                            text={doc.name}
                            matches={matchesMap.get(doc._id)}
                            fieldKey="name"
                          />
                        </CardTitle>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVerticalIcon className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          {(doc.workflowStatus ?? "draft") === "draft" && (
                            <DropdownMenuItem onClick={() => handleSendDocument(doc._id)}>
                              <SendIcon className="mr-2 h-4 w-4" />
                              Send Document
                            </DropdownMenuItem>
                          )}
                          {((doc.workflowStatus ?? "draft") === "sent" ||
                            (doc.workflowStatus ?? "draft") === "in_progress") && (
                            <DropdownMenuItem
                              onClick={() => handleCancelDocument(doc._id)}
                              className="text-destructive"
                            >
                              <BanIcon className="mr-2 h-4 w-4" />
                              Cancel Document
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handleDownload(doc._id)}>
                            <DownloadIcon className="mr-2 h-4 w-4" />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onShareClick(doc._id, doc.name)}>
                            <Share2Icon className="mr-2 h-4 w-4" />
                            Share
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onMoveToFolder(doc._id)}>
                            <FolderInputIcon className="mr-2 h-4 w-4" />
                            Move to Folder
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(doc._id)}
                            className="text-destructive"
                          >
                            <TrashIcon className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {doc.description && (
                      <CardDescription className="line-clamp-2">
                        <HighlightedText
                          text={doc.description}
                          matches={matchesMap.get(doc._id)}
                          fieldKey="description"
                        />
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Status</span>
                        <div className="flex items-center gap-1.5">
                          <WorkflowStatusBadge status={doc.workflowStatus} />
                          {doc.aiProcessingStatus === "processing" && (
                            <Loader2Icon className="h-3 w-3 animate-spin text-ai-accent" />
                          )}
                          {doc.aiProcessingStatus === "completed" && (
                            <SparklesIcon className="h-3 w-3 text-ai-accent" />
                          )}
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
                        <Badge variant={doc.sharingMode === "private" ? "secondary" : "default"}>
                          {doc.sharingMode === "private" && "Private"}
                          {doc.sharingMode === "workspace" && "Team"}
                          {doc.sharingMode === "specific" && "Specific"}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Pagination (SEA-68: 20 items per page) */}
          {totalPages > 1 && (
            <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
              <p className="text-muted-foreground text-center text-sm sm:text-left">
                Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
                {Math.min(currentPage * ITEMS_PER_PAGE, sortedDocuments.length)} of{" "}
                {sortedDocuments.length} documents
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">Previous</span>
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      variant={page === currentPage ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      className="min-h-[44px] min-w-[44px] p-0 sm:h-8 sm:min-h-0 sm:min-w-[32px]"
                    >
                      {page}
                    </Button>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRightIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog({ open, type: "delete", documentId: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialogContent.title}</AlertDialogTitle>
            <AlertDialogDescription>{dialogContent.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAction}
              variant={
                confirmDialog.type === "delete" || confirmDialog.type === "cancel"
                  ? "destructive"
                  : "default"
              }
            >
              {confirmDialog.type === "delete" && "Delete"}
              {confirmDialog.type === "send" && "Send"}
              {confirmDialog.type === "cancel" && "Cancel Document"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function DocumentsPage() {
  const { slug } = Route.useParams();
  const { folderId: folderIdParam } = Route.useSearch();
  const navigate = useNavigate();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState<Id<"documents"> | null>(null);
  const [selectedDocumentName, setSelectedDocumentName] = useState("");
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferDocument, setTransferDocument] = useState<{
    id: Id<"documents">;
    name: string;
    ownerId: Id<"users">;
    sharingMode: string;
  } | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");
  const [workflowStatusFilter, setWorkflowStatusFilter] = useState<WorkflowStatusFilter>("all");
  const [refreshKey, setRefreshKey] = useState(0);

  // SEA-68: View mode, sorting state
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // SEA-73: Fuzzy search state
  const [searchQuery, setSearchQuery] = useState("");

  // SEA-74: Date range filter state
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  // Folder: move-to-folder dialog state
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [moveDocumentId, setMoveDocumentId] = useState<Id<"documents"> | null>(null);
  const moveItemsToFolder = useMutation(api.folders.mutations.moveItemsToFolder);

  // Cast folderId string from URL to Id<"folders"> if present
  const folderId = folderIdParam ? (folderIdParam as Id<"folders">) : undefined;

  const handleFolderSelect = (selectedFolderId?: Id<"folders">) => {
    navigate({
      to: "/$slug/documents",
      params: { slug },
      search: { folderId: selectedFolderId },
    });
  };

  const handleMoveToFolder = (documentId: Id<"documents">) => {
    setMoveDocumentId(documentId);
    setMoveDialogOpen(true);
  };

  const handleMoveConfirm = async (targetFolderId?: Id<"folders">) => {
    if (!moveDocumentId) return;
    try {
      await moveItemsToFolder({
        itemIds: [moveDocumentId],
        itemType: "document",
        targetFolderId,
      });
      toast.success("Document moved successfully");
      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to move document";
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

  const { data: organization } = useSuspenseQuery(
    convexQuery(api.organizations.queries.getOrganization, { slug }),
  );

  const handleRefetch = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const handleShareClick = (documentId: Id<"documents">, documentName: string) => {
    setSelectedDocumentId(documentId);
    setSelectedDocumentName(documentName);
    setShareDialogOpen(true);
  };

  const handleTransferOwnership = (doc: {
    _id: Id<"documents">;
    name: string;
    ownerId: Id<"users">;
    sharingMode: string;
  }) => {
    setTransferDocument({
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
    >
      <ResizablePanelGroup orientation="horizontal" className="min-h-[600px]">
        <ResizablePanel defaultSize={20} minSize={15} maxSize={35} collapsible>
          <FolderSidebar
            organizationId={organization._id}
            type="document"
            activeFolderId={folderId}
            onFolderSelect={handleFolderSelect}
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={80}>
          <div className="space-y-6 pl-4">
            {/* Folder breadcrumbs when inside a folder */}
            {folderId && (
              <FolderBreadcrumbs
                folderId={folderId}
                type="document"
                onNavigate={handleFolderSelect}
              />
            )}

            {/* SEA-73: Search Input */}
            <div className="relative">
              <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                type="text"
                placeholder="Search documents by name or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-9 pl-9"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-1/2 right-1 h-7 w-7 -translate-y-1/2"
                  onClick={() => setSearchQuery("")}
                >
                  <XIcon className="h-4 w-4" />
                  <span className="sr-only">Clear search</span>
                </Button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={filter === "all" ? "default" : "outline"}
                    onClick={() => setFilter("all")}
                  >
                    All Documents
                  </Button>
                  <Button
                    variant={filter === "owned" ? "default" : "outline"}
                    onClick={() => setFilter("owned")}
                  >
                    My Documents
                  </Button>
                  <Button
                    variant={filter === "shared" ? "default" : "outline"}
                    onClick={() => setFilter("shared")}
                  >
                    Shared with Me
                  </Button>
                </div>
                {/* SEA-68: View mode toggle */}
                <div className="bg-background flex items-center gap-1 rounded-md border">
                  <Button
                    variant={viewMode === "table" ? "default" : "ghost"}
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => setViewMode("table")}
                  >
                    <LayoutListIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === "grid" ? "default" : "ghost"}
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => setViewMode("grid")}
                  >
                    <LayoutGridIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Workflow Status Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground self-center text-sm">Status:</span>
                <Button
                  size="sm"
                  variant={workflowStatusFilter === "all" ? "default" : "outline"}
                  onClick={() => setWorkflowStatusFilter("all")}
                >
                  All
                </Button>
                <Button
                  size="sm"
                  variant={workflowStatusFilter === "draft" ? "default" : "outline"}
                  onClick={() => setWorkflowStatusFilter("draft")}
                >
                  Drafts
                </Button>
                <Button
                  size="sm"
                  variant={workflowStatusFilter === "sent" ? "default" : "outline"}
                  onClick={() => setWorkflowStatusFilter("sent")}
                >
                  Sent
                </Button>
                <Button
                  size="sm"
                  variant={workflowStatusFilter === "in_progress" ? "default" : "outline"}
                  onClick={() => setWorkflowStatusFilter("in_progress")}
                >
                  In Progress
                </Button>
                <Button
                  size="sm"
                  variant={workflowStatusFilter === "completed" ? "default" : "outline"}
                  onClick={() => setWorkflowStatusFilter("completed")}
                >
                  Completed
                </Button>
                <Button
                  size="sm"
                  variant={workflowStatusFilter === "cancelled" ? "default" : "outline"}
                  onClick={() => setWorkflowStatusFilter("cancelled")}
                >
                  Cancelled
                </Button>
                <Button
                  size="sm"
                  variant={workflowStatusFilter === "expired" ? "default" : "outline"}
                  onClick={() => setWorkflowStatusFilter("expired")}
                >
                  Expired
                </Button>

                {/* SEA-74: Date Range Filter */}
                <div className="w-full sm:ml-2 sm:w-auto sm:border-l sm:pl-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={dateRange?.from ? "default" : "outline"}
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
                  <span className="text-muted-foreground text-sm">Active filters:</span>
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
                organizationId={organization._id}
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
                delegateOwnership={organization.delegateOwnership ?? false}
                onTransferOwnership={handleTransferOwnership}
              />
            </Suspense>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      <UploadDialog
        organizationId={organization._id}
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onSuccess={handleRefetch}
      />

      {selectedDocumentId && (
        <ShareDocumentDialog
          documentId={selectedDocumentId}
          documentName={selectedDocumentName}
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
        />
      )}

      <MoveToFolderDialog
        open={moveDialogOpen}
        onOpenChange={setMoveDialogOpen}
        organizationId={organization._id}
        type="document"
        onMove={handleMoveConfirm}
      />

      {transferDocument && (
        <TransferOwnershipDialog
          open={transferDialogOpen}
          onOpenChange={setTransferDialogOpen}
          documentId={transferDocument.id}
          documentName={transferDocument.name}
          currentOwnerId={transferDocument.ownerId}
          sharingMode={transferDocument.sharingMode}
          slug={slug}
        />
      )}
    </PageWrapper>
  );
}
