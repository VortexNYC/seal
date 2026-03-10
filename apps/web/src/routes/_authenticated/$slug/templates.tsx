/**
 * Templates Page
 *
 * SEA-80/82: Document Templates Library
 *
 * Manage document templates - view, create from documents, and use templates
 * Route: /{slug}/templates
 */

import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  FileTextIcon,
  FolderInputIcon,
  FolderOpenIcon,
  LayoutGridIcon,
  LayoutListIcon,
  MoreVerticalIcon,
  PencilIcon,
  SearchIcon,
  TrashIcon,
} from "lucide-react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { FolderBreadcrumbs } from "@/components/folders/folder-breadcrumbs";
import { FolderSidebar } from "@/components/folders/folder-sidebar";
import { MoveToFolderDialog } from "@/components/folders/move-to-folder-dialog";
import { PageWrapper } from "@/components/page-wrapper";
import { TemplatesSkeleton } from "@/components/skeletons";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAnalytics } from "@/hooks/use-analytics";
import { pageSEO } from "@/lib/seo";
import { api } from "@seal/backend/convex/_generated/api";
import type { Doc, Id } from "@seal/backend/convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/$slug/templates")({
  component: TemplatesPage,
  pendingComponent: TemplatesSkeleton,
  validateSearch: (search: Record<string, unknown>) => ({
    folderId: (search.folderId as string) || undefined,
  }),
  head: () => ({
    meta: [
      { title: pageSEO.templates.title },
      { name: "description", content: pageSEO.templates.description },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

type ViewMode = "grid" | "table";
type SortField = "name" | "createdAt" | "useCount";
type SortDirection = "asc" | "desc";

interface TemplatesListProps {
  viewMode: ViewMode;
  sortField: SortField;
  sortDirection: SortDirection;
  searchQuery: string;
  folderId: Id<"folders"> | undefined;
  onSortChange: (field: SortField) => void;
  onUseTemplate: (template: Doc<"templates">) => void;
  onEditTemplate: (template: Doc<"templates">) => void;
  onDeleteTemplate: (template: Doc<"templates">) => void;
  onMoveToFolder: (templateId: Id<"templates">) => void;
}

function TemplatesList({
  viewMode,
  sortField,
  sortDirection,
  searchQuery,
  folderId,
  onSortChange,
  onUseTemplate,
  onEditTemplate,
  onDeleteTemplate,
  onMoveToFolder,
}: TemplatesListProps) {
  const { slug } = Route.useParams();
  const router = useRouter();

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  const { data: templates } = useSuspenseQuery(
    convexQuery(api.templates.queries.getOrganizationTemplates, {
      folderId,
      rootOnly: !folderId,
    }),
  );

  // Filter by search query
  const filteredTemplates = useMemo(() => {
    if (!searchQuery) return templates;
    const query = searchQuery.toLowerCase();
    return templates.filter(
      (t) => t.name.toLowerCase().includes(query) || t.description?.toLowerCase().includes(query),
    );
  }, [templates, searchQuery]);

  // Sort templates
  const sortedTemplates = useMemo(() => {
    const sorted = [...filteredTemplates];
    sorted.sort((a, b) => {
      let comparison = 0;
      if (sortField === "name") {
        comparison = a.name.localeCompare(b.name);
      } else if (sortField === "createdAt") {
        comparison = a.createdAt - b.createdAt;
      } else if (sortField === "useCount") {
        comparison = a.useCount - b.useCount;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
    return sorted;
  }, [filteredTemplates, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(sortedTemplates.length / ITEMS_PER_PAGE);
  const paginatedTemplates = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedTemplates.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [sortedTemplates, currentPage]);

  // Reset page when filters change
  // biome-ignore lint/correctness/useExhaustiveDependencies: We want to reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortField, sortDirection]);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Math.round((bytes / k ** i) * 100) / 100} ${sizes[i]}`;
  };

  // Sort header component
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

  return (
    <>
      {/* SEA-140: Enhanced empty state with helpful CTAs */}
      {sortedTemplates.length === 0 ? (
        searchQuery ? (
          <EmptyState
            icon={SearchIcon}
            title="No templates found"
            description="No templates match your search. Try a different query."
          />
        ) : (
          <EmptyState
            icon={FileTextIcon}
            title="No templates yet"
            description="Create templates from your documents to save time. Templates preserve signature fields and can be reused for recurring documents."
            action={{
              label: "Go to Documents",
              onClick: () => {
                router.navigate({
                  to: "/$slug/documents",
                  params: { slug },
                  search: { folderId: undefined },
                });
              },
              icon: FolderOpenIcon,
            }}
          />
        )
      ) : (
        <div className="space-y-4">
          {/* Table View */}
          {viewMode === "table" ? (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Preview</TableHead>
                    <TableHead>
                      <SortHeader field="name" label="Name" />
                    </TableHead>
                    <TableHead>
                      <SortHeader field="createdAt" label="Created" />
                    </TableHead>
                    <TableHead>
                      <SortHeader field="useCount" label="Times Used" />
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedTemplates.map((template) => (
                    <TableRow key={template._id} className="hover:bg-muted/50">
                      <TableCell>
                        <div className="bg-muted border-border flex h-20 w-16 items-center justify-center overflow-hidden rounded border">
                          {template.thumbnailDataUrl ? (
                            <img
                              src={template.thumbnailDataUrl}
                              alt={`${template.name} thumbnail`}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <FileTextIcon className="text-muted-foreground h-8 w-8" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{template.name}</p>
                          {template.description && (
                            <p className="text-muted-foreground line-clamp-1 text-sm">
                              {template.description}
                            </p>
                          )}
                          {template.pageCount !== undefined && template.pageCount > 0 && (
                            <p className="text-muted-foreground mt-1 text-xs">
                              {template.pageCount} {template.pageCount === 1 ? "page" : "pages"}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p>{formatDate(template.createdAt)}</p>
                          <p className="text-muted-foreground">{formatBytes(template.fileSize)}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium">{template.useCount}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              aria-label={`Template actions for ${template.name}`}
                            >
                              <MoreVerticalIcon className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onUseTemplate(template)}>
                              <CopyIcon className="mr-2 h-4 w-4" />
                              Use Template
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onEditTemplate(template)}>
                              <PencilIcon className="mr-2 h-4 w-4" />
                              Edit Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onMoveToFolder(template._id)}>
                              <FolderInputIcon className="mr-2 h-4 w-4" />
                              Move to Folder
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onDeleteTemplate(template)}
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
              {paginatedTemplates.map((template) => (
                <Card
                  key={template._id}
                  className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
                >
                  {template.thumbnailDataUrl && (
                    <div className="bg-muted flex h-32 w-full items-center justify-center overflow-hidden border-b">
                      <img
                        src={template.thumbnailDataUrl}
                        alt={`${template.name} thumbnail`}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                  )}
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <FileTextIcon className="text-muted-foreground h-5 w-5" />
                        <CardTitle className="truncate text-base">{template.name}</CardTitle>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label={`Template actions for ${template.name}`}
                          >
                            <MoreVerticalIcon className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onUseTemplate(template)}>
                            <CopyIcon className="mr-2 h-4 w-4" />
                            Use Template
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onEditTemplate(template)}>
                            <PencilIcon className="mr-2 h-4 w-4" />
                            Edit Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onMoveToFolder(template._id)}>
                            <FolderInputIcon className="mr-2 h-4 w-4" />
                            Move to Folder
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onDeleteTemplate(template)}
                            className="text-destructive"
                          >
                            <TrashIcon className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {template.description && (
                      <CardDescription className="line-clamp-2">
                        {template.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Created</span>
                        <span>{formatDate(template.createdAt)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Times Used</span>
                        <span className="font-medium">{template.useCount}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Pages</span>
                        <span>{template.pageCount ?? "-"}</span>
                      </div>
                    </div>
                    <Button className="mt-4 w-full" onClick={() => onUseTemplate(template)}>
                      <CopyIcon className="mr-2 h-4 w-4" />
                      Use Template
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-sm">
                Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
                {Math.min(currentPage * ITEMS_PER_PAGE, sortedTemplates.length)} of{" "}
                {sortedTemplates.length} templates
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      variant={page === currentPage ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      className="h-8 w-8 p-0"
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
                >
                  Next
                  <ChevronRightIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function TemplatesPage() {
  const { slug } = Route.useParams();
  const { folderId: folderIdParam } = Route.useSearch();
  const router = useRouter();
  const navigate = useNavigate();
  const { track } = useAnalytics();

  // State
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  // Folder: move-to-folder dialog state
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [moveTemplateId, setMoveTemplateId] = useState<Id<"templates"> | null>(null);
  const moveItemsToFolder = useMutation(api.folders.mutations.moveItemsToFolder);

  // Cast folderId string from URL to Id<"folders"> if present
  const folderId = folderIdParam ? (folderIdParam as Id<"folders">) : undefined;

  // Dialog states
  const [useTemplateDialog, setUseTemplateDialog] = useState<{
    open: boolean;
    template: Doc<"templates"> | null;
  }>({ open: false, template: null });
  const [editTemplateDialog, setEditTemplateDialog] = useState<{
    open: boolean;
    template: Doc<"templates"> | null;
  }>({ open: false, template: null });
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{
    open: boolean;
    template: Doc<"templates"> | null;
  }>({ open: false, template: null });

  // Form state for use template
  const [newDocumentName, setNewDocumentName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Form state for edit template
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  // Mutations
  const createFromTemplate = useMutation(api.templates.mutations.createFromTemplate);
  const updateTemplate = useMutation(api.templates.mutations.updateTemplate);
  const deleteTemplate = useMutation(api.templates.mutations.deleteTemplate);

  const handleSortChange = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const handleFolderSelect = (selectedFolderId?: Id<"folders">) => {
    navigate({
      to: "/$slug/templates",
      params: { slug },
      search: { folderId: selectedFolderId },
    });
  };

  const handleMoveToFolder = (templateId: Id<"templates">) => {
    setMoveTemplateId(templateId);
    setMoveDialogOpen(true);
  };

  const handleMoveConfirm = async (targetFolderId?: Id<"folders">) => {
    if (!moveTemplateId) return;
    try {
      await moveItemsToFolder({
        itemIds: [moveTemplateId],
        itemType: "template",
        targetFolderId,
      });
      toast.success("Template moved successfully");
      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to move template";
      toast.error(msg);
    } finally {
      setMoveDialogOpen(false);
      setMoveTemplateId(null);
    }
  };

  const handleUseTemplate = (template: Doc<"templates">) => {
    setNewDocumentName(`${template.name} - Copy`);
    setUseTemplateDialog({ open: true, template });
  };

  const handleEditTemplate = (template: Doc<"templates">) => {
    setEditName(template.name);
    setEditDescription(template.description ?? "");
    setEditTemplateDialog({ open: true, template });
  };

  const handleDeleteTemplate = (template: Doc<"templates">) => {
    setDeleteConfirmDialog({ open: true, template });
  };

  const handleConfirmUseTemplate = async () => {
    if (!useTemplateDialog.template) return;

    setIsCreating(true);
    try {
      const result = await createFromTemplate({
        templateId: useTemplateDialog.template._id,
        documentName: newDocumentName || undefined,
      });

      track.templateUsed({
        templateId: useTemplateDialog.template._id,
        templateName: useTemplateDialog.template.name,
      });
      toast.success("Document created from template");
      setUseTemplateDialog({ open: false, template: null });

      // Navigate to the new document
      router.navigate({
        to: "/$slug/documents/$documentId",
        params: { slug, documentId: result.documentId },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to create document from template";
      toast.error(errorMessage);
    } finally {
      setIsCreating(false);
    }
  };

  const handleConfirmEditTemplate = async () => {
    if (!editTemplateDialog.template) return;

    setIsEditing(true);
    try {
      await updateTemplate({
        templateId: editTemplateDialog.template._id,
        name: editName,
        description: editDescription || undefined,
      });

      track.templateEdited({
        templateId: editTemplateDialog.template._id,
        templateName: editName,
      });
      toast.success("Template updated");
      setEditTemplateDialog({ open: false, template: null });
      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update template";
      toast.error(errorMessage);
    } finally {
      setIsEditing(false);
    }
  };

  const handleConfirmDeleteTemplate = async () => {
    if (!deleteConfirmDialog.template) return;

    try {
      await deleteTemplate({
        templateId: deleteConfirmDialog.template._id,
      });

      track.templateDeleted({
        templateId: deleteConfirmDialog.template._id,
        templateName: deleteConfirmDialog.template.name,
      });
      toast.success("Template deleted");
      setDeleteConfirmDialog({ open: false, template: null });
      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete template";
      toast.error(errorMessage);
    }
  };

  const { data: organization } = useSuspenseQuery(
    convexQuery(api.organizations.queries.getOrganization, { slug }),
  );

  return (
    <PageWrapper title="Templates">
      <ResizablePanelGroup orientation="horizontal" className="min-h-[600px]">
        <ResizablePanel defaultSize={20} minSize={15} maxSize={35} collapsible>
          <FolderSidebar
            organizationId={organization._id}
            type="template"
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
                type="template"
                onNavigate={handleFolderSelect}
              />
            )}

            {/* Search and View Controls */}
            <div className="bg-card/60 flex flex-wrap items-center justify-between gap-4 rounded-lg border p-3">
              {/* Search */}
              <div className="relative max-w-sm flex-1">
                <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* View mode toggle */}
              <div className="bg-background flex items-center gap-1 rounded-md border">
                <Button
                  variant={viewMode === "table" ? "default" : "ghost"}
                  size="icon"
                  className="h-9 w-9"
                  aria-label="Table view"
                  onClick={() => setViewMode("table")}
                >
                  <LayoutListIcon className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  size="icon"
                  className="h-9 w-9"
                  aria-label="Grid view"
                  onClick={() => setViewMode("grid")}
                >
                  <LayoutGridIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Info card */}
            <Card className="border-dashed">
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <FileTextIcon className="text-muted-foreground mt-0.5 h-5 w-5" />
                  <div>
                    <p className="text-sm font-medium">
                      Templates save time on recurring documents
                    </p>
                    <p className="text-muted-foreground text-sm">
                      To create a template, prepare a document with signature fields, then click
                      "Save as Template" from the document actions menu.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Templates List */}
            <Suspense
              key={`${refreshKey}-${folderId ?? "root"}`}
              fallback={
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Card key={i} className="animate-pulse">
                      <div className="bg-muted h-32" />
                      <CardHeader>
                        <div className="bg-muted h-4 w-3/4 rounded" />
                        <div className="bg-muted mt-2 h-3 w-1/2 rounded" />
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="bg-muted h-3 rounded" />
                          <div className="bg-muted h-3 rounded" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              }
            >
              <TemplatesList
                viewMode={viewMode}
                sortField={sortField}
                sortDirection={sortDirection}
                searchQuery={searchQuery}
                folderId={folderId}
                onSortChange={handleSortChange}
                onUseTemplate={handleUseTemplate}
                onEditTemplate={handleEditTemplate}
                onDeleteTemplate={handleDeleteTemplate}
                onMoveToFolder={handleMoveToFolder}
              />
            </Suspense>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Use Template Dialog */}
      <Dialog
        open={useTemplateDialog.open}
        onOpenChange={(open) => setUseTemplateDialog({ open, template: null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Document from Template</DialogTitle>
            <DialogDescription>
              Create a new document using "{useTemplateDialog.template?.name}
              ". The new document will have all the signature fields from the template.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="documentName">Document Name</Label>
              <Input
                id="documentName"
                value={newDocumentName}
                onChange={(e) => setNewDocumentName(e.target.value)}
                placeholder="Enter document name..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUseTemplateDialog({ open: false, template: null })}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirmUseTemplate} disabled={isCreating}>
              {isCreating ? "Creating..." : "Create Document"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Template Dialog */}
      <Dialog
        open={editTemplateDialog.open}
        onOpenChange={(open) => setEditTemplateDialog({ open, template: null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
            <DialogDescription>Update the template name and description.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editName">Name</Label>
              <Input
                id="editName"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Template name..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editDescription">Description (optional)</Label>
              <Textarea
                id="editDescription"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Describe this template..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditTemplateDialog({ open: false, template: null })}
              disabled={isEditing}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirmEditTemplate} disabled={isEditing || !editName.trim()}>
              {isEditing ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteConfirmDialog.open}
        onOpenChange={(open) => setDeleteConfirmDialog({ open, template: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirmDialog.template?.name}"? This action
              cannot be undone. Documents created from this template will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteTemplate}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MoveToFolderDialog
        open={moveDialogOpen}
        onOpenChange={setMoveDialogOpen}
        organizationId={organization._id}
        type="template"
        onMove={handleMoveConfirm}
      />
    </PageWrapper>
  );
}
