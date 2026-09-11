/**
 * Templates Page
 *
 * SEA-80/82: Document Templates Library
 *
 * Manage document templates - view, create from documents, and use templates
 * Route: /{slug}/templates
 */

import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { Empty } from "@cloudflare/kumo/components/empty";
import { Input, Textarea } from "@cloudflare/kumo/components/input";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Table } from "@cloudflare/kumo/components/table";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { useSuspenseOrganization } from "@/hooks/use-organization";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  FileTextIcon,
  FolderIcon,
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

import { CreateFolderDialog } from "@/components/folders/create-folder-dialog";
import { FolderBreadcrumbs } from "@/components/folders/folder-breadcrumbs";
import { MoveToFolderDialog } from "@/components/folders/move-to-folder-dialog";
import { PageWrapper } from "@/components/page-wrapper";
import { TemplatesSkeleton } from "@/components/skeletons";
import { useAnalytics } from "@/hooks/use-analytics";
import { useSuspenseOrganization } from "@/hooks/use-organization";
import {
  deleteTemplate as deleteTemplateApi,
  getFolders,
  getOrganizationTemplates,
  moveTemplateToFolder,
  updateTemplate as updateTemplateApi,
  useTemplate as useTemplateApi,
  type ApiTemplateListItem,
} from "@/lib/api-client";
import { pageSEO } from "@/lib/seo";
import { toast } from "@/lib/toast";

export const Route = createFileRoute("/_authenticated/$slug/templates")({
  component: TemplatesPage,
  pendingComponent: TemplatesSkeleton,
  validateSearch: (search: Record<string, unknown>) => ({
    folderId:
      typeof search.folderId === "string" && search.folderId
        ? search.folderId
        : undefined,
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
  folderId: string | undefined;
  onSortChange: (field: SortField) => void;
  onUseTemplate: (template: ApiTemplateListItem) => void;
  onEditTemplate: (template: ApiTemplateListItem) => void;
  onDeleteTemplate: (template: ApiTemplateListItem) => void;
  onMoveToFolder: (templateId: string) => void;
  onFolderNavigate: (folderId?: string) => void;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round((bytes / k ** i) * 100) / 100} ${sizes[i]}`;
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
  onFolderNavigate,
}: TemplatesListProps) {
  const { slug } = Route.useParams();
  const router = useRouter();

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  const { data: templates } = useSuspenseQuery({
    queryKey: ["organization-templates", slug, folderId],
    queryFn: () => getOrganizationTemplates(slug, folderId),
  });

  // Query subfolders at the current level for inline folder rows
  const { data: subfolders } = useQuery({
    queryKey: ["api", "folders", "template", folderId, slug],
    queryFn: () => getFolders(slug, { type: "template", parentId: folderId }),
  });

  // Filter by search query
  const filteredTemplates = useMemo(() => {
    if (!searchQuery) return templates;
    const query = searchQuery.toLowerCase();
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query)
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

  // Sort header component
  const SortHeader = ({
    field,
    label,
  }: {
    field: SortField;
    label: string;
  }) => (
    <Button
      variant="ghost"
      onClick={() => onSortChange(field)}
      className="h-auto p-0"
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
      {sortedTemplates.length === 0 &&
      (!subfolders || subfolders.length === 0) ? (
        searchQuery ? (
          <Empty
            icon={<SearchIcon size={48} />}
            title="No templates found"
            description="No templates match your search. Try a different query."
          />
        ) : (
          <Empty
            icon={<FileTextIcon size={48} />}
            title="No templates yet"
            description="Create templates from your documents to save time. Templates preserve signature fields and can be reused for recurring documents."
            contents={
              <Button
                onClick={() => {
                  void router.navigate({
                    to: "/$slug/documents",
                    params: { slug },
                    search: { folderId: undefined },
                  });
                }}
                variant="primary"
                icon={<FolderOpenIcon className="h-4 w-4" />}
              >
                Go to Documents
              </Button>
            }
          />
        )
      ) : (
        <div className="space-y-4">
          {/* Table View */}
          {viewMode === "table" ? (
            <div className="rounded-lg border">
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.Head className="w-[100px]">Preview</Table.Head>
                    <Table.Head>
                      <SortHeader field="name" label="Name" />
                    </Table.Head>
                    <Table.Head>
                      <SortHeader field="createdAt" label="Created" />
                    </Table.Head>
                    <Table.Head>
                      <SortHeader field="useCount" label="Times Used" />
                    </Table.Head>
                    <Table.Head className="text-right">Actions</Table.Head>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {/* Folder rows (shown above templates, not paginated) */}
                  {!searchQuery.trim() &&
                    subfolders?.map((folder) => (
                      <Table.Row
                        key={folder.id}
                        className="hover:bg-kumo-elevated/50 cursor-pointer"
                        onClick={() => onFolderNavigate(folder.publicId)}
                      >
                        <Table.Cell>
                          <div className="bg-kumo-elevated border-kumo-line flex h-20 w-16 items-center justify-center rounded border">
                            <FolderIcon className="text-kumo-secondary h-5 w-5" />
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <p className="font-medium">{folder.name}</p>
                          <p className="text-kumo-secondary text-xs">Folder</p>
                        </Table.Cell>
                        <Table.Cell>
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
                    ))}
                  {paginatedTemplates.map((template) => (
                    <Table.Row
                      key={template._id}
                      className="hover:bg-kumo-elevated/50"
                    >
                      <Table.Cell>
                        <div className="bg-kumo-elevated border-kumo-line flex h-20 w-16 items-center justify-center overflow-hidden rounded border">
                          {template.thumbnailDataUrl ? (
                            <img
                              src={template.thumbnailDataUrl}
                              alt={`${template.name} thumbnail`}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <FileTextIcon className="text-kumo-secondary h-8 w-8" />
                          )}
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <div>
                          <p className="font-medium">{template.name}</p>
                          {template.description && (
                            <p className="text-kumo-secondary line-clamp-1 text-sm">
                              {template.description}
                            </p>
                          )}
                          {template.pageCount != null &&
                            template.pageCount > 0 && (
                              <p className="text-kumo-secondary mt-1 text-xs">
                                {template.pageCount}{" "}
                                {template.pageCount === 1 ? "page" : "pages"}
                              </p>
                            )}
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <div className="text-sm">
                          <p>{formatDate(template.createdAt)}</p>
                          <p className="text-kumo-secondary">
                            {formatBytes(template.fileSize)}
                          </p>
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <span className="text-sm font-medium">
                          {template.useCount}
                        </span>
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        <DropdownMenu>
                          <DropdownMenu.Trigger>
                            <Button
                              variant="ghost"
                              shape="square"
                              size="sm"
                              className="h-8 w-8"
                              aria-label={`Template actions for ${template.name}`}
                            >
                              <MoreVerticalIcon className="h-4 w-4" />
                            </Button>
                          </DropdownMenu.Trigger>
                          <DropdownMenu.Content align="end">
                            <DropdownMenu.Item
                              onClick={() => onUseTemplate(template)}
                            >
                              <CopyIcon className="mr-2 h-4 w-4" />
                              Use Template
                            </DropdownMenu.Item>
                            <DropdownMenu.Item
                              onClick={() => onEditTemplate(template)}
                            >
                              <PencilIcon className="mr-2 h-4 w-4" />
                              Edit Details
                            </DropdownMenu.Item>
                            <DropdownMenu.Item
                              onClick={() => onMoveToFolder(template._id)}
                            >
                              <FolderInputIcon className="mr-2 h-4 w-4" />
                              Move to Folder
                            </DropdownMenu.Item>
                            <DropdownMenu.Item
                              onClick={() => onDeleteTemplate(template)}
                              variant="danger"
                            >
                              <TrashIcon className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenu.Item>
                          </DropdownMenu.Content>
                        </DropdownMenu>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </div>
          ) : (
            /* Grid View */
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {/* Folder cards (shown above templates when not searching) */}
              {!searchQuery.trim() &&
                subfolders?.map((folder) => (
                  <LayerCard
                    key={folder.id}
                    className="hover:bg-kumo-elevated/50 cursor-pointer transition-colors duration-200"
                    onClick={() => onFolderNavigate(folder.publicId)}
                  >
                    <LayerCard.Primary className="p-0">
                      <div className="bg-kumo-elevated/50 flex h-32 w-full items-center justify-center border-b">
                        <FolderIcon className="text-kumo-secondary h-12 w-12" />
                      </div>
                      <div className="p-4">
                        <p className="flex items-center gap-2 text-sm font-medium">
                          <FolderIcon className="h-4 w-4 shrink-0" />
                          <span className="line-clamp-2">{folder.name}</span>
                        </p>
                        <p className="text-kumo-secondary text-sm">Folder</p>
                      </div>
                    </LayerCard.Primary>
                  </LayerCard>
                ))}
              {paginatedTemplates.map((template) => (
                <LayerCard
                  key={template._id}
                  className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <LayerCard.Primary className="p-0">
                    {template.thumbnailDataUrl && (
                      <div className="bg-kumo-elevated flex h-32 w-full items-center justify-center overflow-hidden border-b">
                        <img
                          src={template.thumbnailDataUrl}
                          alt={`${template.name} thumbnail`}
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                    )}
                    <div className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <FileTextIcon className="text-kumo-secondary h-5 w-5" />
                          <p className="truncate text-base font-medium">
                            {template.name}
                          </p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenu.Trigger>
                            <Button
                              variant="ghost"
                              shape="square"
                              size="sm"
                              className="h-8 w-8"
                              aria-label={`Template actions for ${template.name}`}
                            >
                              <MoreVerticalIcon className="h-4 w-4" />
                            </Button>
                          </DropdownMenu.Trigger>
                          <DropdownMenu.Content align="end">
                            <DropdownMenu.Item
                              onClick={() => onUseTemplate(template)}
                            >
                              <CopyIcon className="mr-2 h-4 w-4" />
                              Use Template
                            </DropdownMenu.Item>
                            <DropdownMenu.Item
                              onClick={() => onEditTemplate(template)}
                            >
                              <PencilIcon className="mr-2 h-4 w-4" />
                              Edit Details
                            </DropdownMenu.Item>
                            <DropdownMenu.Item
                              onClick={() => onMoveToFolder(template._id)}
                            >
                              <FolderInputIcon className="mr-2 h-4 w-4" />
                              Move to Folder
                            </DropdownMenu.Item>
                            <DropdownMenu.Item
                              onClick={() => onDeleteTemplate(template)}
                              variant="danger"
                            >
                              <TrashIcon className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenu.Item>
                          </DropdownMenu.Content>
                        </DropdownMenu>
                      </div>
                      {template.description && (
                        <p className="text-kumo-secondary line-clamp-2 text-sm">
                          {template.description}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2 p-4 pt-0">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-kumo-secondary">Created</span>
                        <span>{formatDate(template.createdAt)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-kumo-secondary">Times Used</span>
                        <span className="font-medium">{template.useCount}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-kumo-secondary">Pages</span>
                        <span>{template.pageCount ?? "-"}</span>
                      </div>
                    </div>
                    <div className="p-4 pt-0">
                      <Button
                        className="w-full"
                        onClick={() => onUseTemplate(template)}
                      >
                        <CopyIcon className="mr-2 h-4 w-4" />
                        Use Template
                      </Button>
                    </div>
                  </LayerCard.Primary>
                </LayerCard>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-kumo-secondary text-sm">
                Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
                {Math.min(currentPage * ITEMS_PER_PAGE, sortedTemplates.length)}{" "}
                of {sortedTemplates.length} templates
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(1, prev - 1))
                  }
                  disabled={currentPage === 1}
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (page) => (
                      <Button
                        key={page}
                        variant={page === currentPage ? "primary" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        className="h-8 w-8 p-0"
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
                    setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                  }
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
  const { folderId } = Route.useSearch();
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
  const [moveTemplateId, setMoveTemplateId] = useState<string | null>(null);

  // Dialog states
  const [useTemplateDialog, setUseTemplateDialog] = useState<{
    open: boolean;
    template: ApiTemplateListItem | null;
  }>({ open: false, template: null });
  const [editTemplateDialog, setEditTemplateDialog] = useState<{
    open: boolean;
    template: ApiTemplateListItem | null;
  }>({ open: false, template: null });
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{
    open: boolean;
    template: ApiTemplateListItem | null;
  }>({ open: false, template: null });

  // Form state for use template
  const [newDocumentName, setNewDocumentName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Form state for edit template
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  const handleSortChange = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const handleFolderSelect = (selectedFolderId?: string) => {
    void navigate({
      to: "/$slug/templates",
      params: { slug },
      search: { folderId: selectedFolderId },
    });
  };

  const handleMoveToFolder = (templateId: string) => {
    setMoveTemplateId(templateId);
    setMoveDialogOpen(true);
  };

  const handleMoveConfirm = async (targetFolderId?: string) => {
    if (!moveTemplateId) return;
    try {
      await moveTemplateToFolder(slug, moveTemplateId, targetFolderId);
      toast.success("Template moved successfully");
      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Failed to move template";
      toast.error(msg);
    } finally {
      setMoveDialogOpen(false);
      setMoveTemplateId(null);
    }
  };

  const handleUseTemplate = (template: ApiTemplateListItem) => {
    setNewDocumentName(`${template.name} - Copy`);
    setUseTemplateDialog({ open: true, template });
  };

  const handleEditTemplate = (template: ApiTemplateListItem) => {
    setEditName(template.name);
    setEditDescription(template.description ?? "");
    setEditTemplateDialog({ open: true, template });
  };

  const handleDeleteTemplate = (template: ApiTemplateListItem) => {
    setDeleteConfirmDialog({ open: true, template });
  };

  const handleConfirmUseTemplate = async () => {
    if (!useTemplateDialog.template) return;

    setIsCreating(true);
    try {
      const result = await useTemplateApi(
        slug,
        useTemplateDialog.template._id,
        {
          documentName: newDocumentName || undefined,
        }
      );

      track.templateUsed({
        templateId: useTemplateDialog.template._id,
        templateName: useTemplateDialog.template.name,
      });
      toast.success("Document created from template");
      setUseTemplateDialog({ open: false, template: null });

      // Navigate to the new document
      void router.navigate({
        to: "/$slug/documents/$documentId",
        params: { slug, documentId: result.documentId },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to create document from template";
      toast.error(errorMessage);
    } finally {
      setIsCreating(false);
    }
  };

  const handleConfirmEditTemplate = async () => {
    if (!editTemplateDialog.template) return;

    setIsEditing(true);
    try {
      await updateTemplateApi(slug, editTemplateDialog.template._id, {
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
      const errorMessage =
        error instanceof Error ? error.message : "Failed to update template";
      toast.error(errorMessage);
    } finally {
      setIsEditing(false);
    }
  };

  const handleConfirmDeleteTemplate = async () => {
    if (!deleteConfirmDialog.template) return;

    try {
      await deleteTemplateApi(slug, deleteConfirmDialog.template._id);

      track.templateDeleted({
        templateId: deleteConfirmDialog.template._id,
        templateName: deleteConfirmDialog.template.name,
      });
      toast.success("Template deleted");
      setDeleteConfirmDialog({ open: false, template: null });
      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to delete template";
      toast.error(errorMessage);
    }
  };

  const { data: organization } = useSuspenseOrganization(slug);

  if (!organization) {
    return null;
  }

  return (
    <PageWrapper
      title="Templates"
      headerActions={
        <CreateFolderDialog
          organizationSlug={slug}
          type="template"
          parentId={folderId}
        />
      }
      headerCenter={
        <FolderBreadcrumbs
          organizationSlug={slug}
          folderId={folderId}
          type="template"
        />
      }
    >
      <div className="space-y-6">
        {/* Search and View Controls */}
        <div className="bg-card/60 flex flex-wrap items-center justify-between gap-4 rounded-lg border p-3">
          {/* Search */}
          <div className="relative max-w-sm flex-1">
            <SearchIcon className="text-kumo-secondary absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              aria-label="Search templates"
            />
          </div>

          {/* View mode toggle */}
          <div className="bg-kumo-base flex items-center gap-1 rounded-md border">
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

        {/* Info card */}
        <LayerCard className="border-dashed">
          <LayerCard.Primary className="py-4">
            <div className="flex items-start gap-3">
              <FileTextIcon className="text-kumo-secondary mt-0.5 h-5 w-5" />
              <div>
                <p className="text-sm font-medium">
                  Templates save time on recurring documents
                </p>
                <p className="text-kumo-secondary text-sm">
                  To create a template, prepare a document with signature
                  fields, then click "Save as Template" from the document
                  actions menu.
                </p>
              </div>
            </div>
          </LayerCard.Primary>
        </LayerCard>

        {/* Templates List */}
        <Suspense
          key={`${refreshKey}-${folderId ?? "root"}`}
          fallback={
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <LayerCard key={i} className="animate-pulse">
                  <LayerCard.Primary className="p-0">
                    <div className="bg-kumo-elevated h-32" />
                    <div className="space-y-2 p-4">
                      <div className="bg-kumo-elevated h-4 w-3/4 rounded" />
                      <div className="bg-kumo-elevated mt-2 h-3 w-1/2 rounded" />
                    </div>
                    <div className="space-y-2 p-4 pt-0">
                      <div className="bg-kumo-elevated h-3 rounded" />
                      <div className="bg-kumo-elevated h-3 rounded" />
                    </div>
                  </LayerCard.Primary>
                </LayerCard>
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
            onFolderNavigate={handleFolderSelect}
          />
        </Suspense>
      </div>

      {/* Use Template Dialog */}
      <Dialog.Root
        open={useTemplateDialog.open}
        onOpenChange={(open) => setUseTemplateDialog({ open, template: null })}
      >
        <Dialog size="sm" className="p-6">
          <Dialog.Title>Create Document from Template</Dialog.Title>
          <Dialog.Description>
            Create a new document using "{useTemplateDialog.template?.name}
            ". The new document will have all the signature fields from the
            template.
          </Dialog.Description>
          <Input
            id="documentName"
            label="Document Name"
            value={newDocumentName}
            onChange={(e) => setNewDocumentName(e.target.value)}
            placeholder="Enter document name..."
          />
          <div className="mt-4 flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() =>
                setUseTemplateDialog({ open: false, template: null })
              }
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirmUseTemplate} disabled={isCreating}>
              {isCreating ? "Creating..." : "Create Document"}
            </Button>
          </div>
        </Dialog>
      </Dialog.Root>

      {/* Edit Template Dialog */}
      <Dialog.Root
        open={editTemplateDialog.open}
        onOpenChange={(open) => setEditTemplateDialog({ open, template: null })}
      >
        <Dialog size="sm" className="p-6">
          <Dialog.Title>Edit Template</Dialog.Title>
          <Dialog.Description>
            Update the template name and description.
          </Dialog.Description>
          <div className="space-y-4">
            <Input
              id="editName"
              label="Name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Template name..."
            />
            <Textarea
              id="editDescription"
              label="Description (optional)"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Describe this template..."
              rows={3}
            />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() =>
                setEditTemplateDialog({ open: false, template: null })
              }
              disabled={isEditing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmEditTemplate}
              disabled={isEditing || !editName.trim()}
            >
              {isEditing ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </Dialog>
      </Dialog.Root>

      {/* Delete Confirmation Dialog */}
      <Dialog.Root
        role="alertdialog"
        open={deleteConfirmDialog.open}
        onOpenChange={(open) =>
          setDeleteConfirmDialog({ open, template: null })
        }
      >
        <Dialog size="sm" className="p-6">
          <Dialog.Title>Delete Template</Dialog.Title>
          <Dialog.Description>
            Are you sure you want to delete "
            {deleteConfirmDialog.template?.name}"? This action cannot be undone.
            Documents created from this template will not be affected.
          </Dialog.Description>
          <div className="mt-4 flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() =>
                setDeleteConfirmDialog({ open: false, template: null })
              }
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDeleteTemplate}>
              Delete
            </Button>
          </div>
        </Dialog>
      </Dialog.Root>

      <MoveToFolderDialog
        organizationSlug={slug}
        open={moveDialogOpen}
        onOpenChange={setMoveDialogOpen}
        organizationId={organization.id}
        type="template"
        onMove={handleMoveConfirm}
      />
    </PageWrapper>
  );
}
