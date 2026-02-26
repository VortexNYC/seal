/**
 * Folder Sidebar
 *
 * Collapsible tree sidebar for navigating document/template folders.
 * Supports:
 * - Lazy-loaded child folders on expand
 * - Right-click context menu (Rename, Move, Pin/Unpin, Visibility, Delete)
 * - Inline rename via double-click
 * - "New Folder" creation at root level
 * - Delete confirmation via AlertDialog
 */

import { useMutation, useQuery } from "convex/react";
import {
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  FolderIcon,
  FolderOpen,
  MoveRight,
  Pencil,
  Pin,
  Plus,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

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
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";

// ── Types ──────────────────────────────────────────────────────────────────

interface FolderSidebarProps {
  organizationId: Id<"organizations">;
  type: "document" | "template";
  activeFolderId?: Id<"folders">;
  onFolderSelect: (folderId?: Id<"folders">) => void;
}

interface FolderTreeNodeProps {
  folderId: Id<"folders">;
  name: string;
  pinned: boolean | undefined;
  visibility: "everyone" | "admin";
  organizationId: Id<"organizations">;
  type: "document" | "template";
  activeFolderId?: Id<"folders">;
  onFolderSelect: (folderId?: Id<"folders">) => void;
  depth: number;
  onRequestDelete: (folderId: Id<"folders">, folderName: string) => void;
}

// ── FolderSidebar (main component) ─────────────────────────────────────────

export function FolderSidebar({
  organizationId,
  type,
  activeFolderId,
  onFolderSelect,
}: FolderSidebarProps) {
  const rootFolders = useQuery(api.folders.queries.listFolders, {
    organizationId,
    type,
  });

  const createFolder = useMutation(api.folders.mutations.createFolder);

  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const newFolderInputRef = useRef<HTMLInputElement>(null);

  // Delete dialog state (lifted here so it can be shared by all tree nodes)
  const [deleteTarget, setDeleteTarget] = useState<{
    folderId: Id<"folders">;
    folderName: string;
  } | null>(null);
  const deleteFolderMutation = useMutation(api.folders.mutations.deleteFolder);

  const typeLabel = type === "document" ? "Documents" : "Templates";

  useEffect(() => {
    if (isCreating && newFolderInputRef.current) {
      newFolderInputRef.current.focus();
    }
  }, [isCreating]);

  const handleCreateFolder = useCallback(async () => {
    const name = newFolderName.trim();
    if (!name) {
      setIsCreating(false);
      setNewFolderName("");
      return;
    }

    try {
      await createFolder({ name, type, parentId: activeFolderId });
      toast.success(`Folder "${name}" created`);
      setNewFolderName("");
      setIsCreating(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create folder";
      toast.error(message);
    }
  }, [newFolderName, createFolder, type, activeFolderId]);

  const handleCreateKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void handleCreateFolder();
      } else if (e.key === "Escape") {
        setIsCreating(false);
        setNewFolderName("");
      }
    },
    [handleCreateFolder],
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await deleteFolderMutation({ folderId: deleteTarget.folderId });
      toast.success(`Folder "${deleteTarget.folderName}" deleted`);
      // If the deleted folder was active, go back to root
      if (activeFolderId === deleteTarget.folderId) {
        onFolderSelect(undefined);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete folder";
      toast.error(message);
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, deleteFolderMutation, activeFolderId, onFolderSelect]);

  const handleRequestDelete = useCallback(
    (folderId: Id<"folders">, folderName: string) => {
      setDeleteTarget({ folderId, folderName });
    },
    [],
  );

  return (
    <div className="flex flex-col gap-1">
      {/* "All Documents/Templates" root item */}
      <button
        type="button"
        onClick={() => onFolderSelect(undefined)}
        className={cn(
          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium",
          "hover:bg-accent hover:text-accent-foreground",
          !activeFolderId &&
            "bg-accent text-accent-foreground",
        )}
      >
        <FolderIcon className="size-4 shrink-0" />
        <span className="truncate">All {typeLabel}</span>
      </button>

      {/* Folder tree */}
      {rootFolders?.map((folder) => (
        <FolderTreeNode
          key={folder._id}
          folderId={folder._id}
          name={folder.name}
          pinned={folder.pinned}
          visibility={folder.visibility}
          organizationId={organizationId}
          type={type}
          activeFolderId={activeFolderId}
          onFolderSelect={onFolderSelect}
          depth={0}
          onRequestDelete={handleRequestDelete}
        />
      ))}

      {/* Loading state */}
      {rootFolders === undefined && (
        <div className="flex flex-col gap-1 px-2 py-1">
          <div className="bg-muted h-6 rounded animate-pulse" />
          <div className="bg-muted h-6 rounded animate-pulse" />
        </div>
      )}

      {/* New folder inline input */}
      {isCreating && (
        <div className="flex items-center gap-1 px-2 py-1">
          <FolderIcon className="text-muted-foreground size-4 shrink-0" />
          <Input
            ref={newFolderInputRef}
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={handleCreateKeyDown}
            onBlur={() => void handleCreateFolder()}
            placeholder="Folder name"
            className="h-7 text-sm"
          />
        </div>
      )}

      {/* New Folder button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsCreating(true)}
        className="mt-1 justify-start gap-2"
      >
        <Plus className="size-4" />
        New Folder
      </Button>

      {/* Delete confirmation dialog */}
      <DeleteFolderDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        folderName={deleteTarget?.folderName ?? ""}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}

// ── FolderTreeNode (recursive) ─────────────────────────────────────────────

function FolderTreeNode({
  folderId,
  name,
  pinned,
  visibility,
  organizationId,
  type,
  activeFolderId,
  onFolderSelect,
  depth,
  onRequestDelete,
}: FolderTreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(name);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Lazy-load children only when expanded
  const children = useQuery(
    api.folders.queries.listFolders,
    isExpanded ? { organizationId, type, parentId: folderId } : "skip",
  );

  const updateFolder = useMutation(api.folders.mutations.updateFolder);
  const togglePin = useMutation(api.folders.mutations.togglePinFolder);

  const isActive = activeFolderId === folderId;

  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  const handleRename = useCallback(async () => {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === name) {
      setIsRenaming(false);
      setRenameValue(name);
      return;
    }

    try {
      await updateFolder({ folderId, name: trimmed });
      toast.success(`Folder renamed to "${trimmed}"`);
      setIsRenaming(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to rename folder";
      toast.error(message);
      setRenameValue(name);
      setIsRenaming(false);
    }
  }, [renameValue, name, updateFolder, folderId]);

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void handleRename();
      } else if (e.key === "Escape") {
        setIsRenaming(false);
        setRenameValue(name);
      }
    },
    [handleRename, name],
  );

  const handleTogglePin = useCallback(async () => {
    try {
      const result = await togglePin({ folderId });
      toast.success(result.pinned ? "Folder pinned" : "Folder unpinned");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to toggle pin";
      toast.error(message);
    }
  }, [togglePin, folderId]);

  const handleToggleVisibility = useCallback(async () => {
    const newVisibility = visibility === "everyone" ? "admin" : "everyone";
    try {
      await updateFolder({ folderId, visibility: newVisibility });
      toast.success(
        newVisibility === "everyone"
          ? "Folder visible to everyone"
          : "Folder visible to admins only",
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to update visibility";
      toast.error(message);
    }
  }, [visibility, updateFolder, folderId]);

  const handleDoubleClick = useCallback(() => {
    setRenameValue(name);
    setIsRenaming(true);
  }, [name]);

  const handleClick = useCallback(() => {
    onFolderSelect(folderId);
    setIsExpanded(true);
  }, [onFolderSelect, folderId]);

  const handleToggleExpand = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onFolderSelect(folderId);
      setIsExpanded((prev) => !prev);
    },
    [onFolderSelect, folderId],
  );

  const paddingLeft = 8 + depth * 16;

  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <button
            type="button"
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            className={cn(
              "flex w-full items-center gap-1 rounded-md py-1.5 text-sm",
              "hover:bg-accent hover:text-accent-foreground",
              isActive && "bg-accent text-accent-foreground",
            )}
            style={{ paddingLeft: `${paddingLeft}px`, paddingRight: "8px" }}
          >
            {/* Expand/collapse chevron (always shown since children are lazy-loaded) */}
            <span
              role="button"
              tabIndex={-1}
              onClick={handleToggleExpand}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setIsExpanded((prev) => !prev);
                }
              }}
              className="text-muted-foreground hover:text-foreground flex shrink-0 items-center justify-center rounded p-0.5"
            >
              {isExpanded ? (
                <ChevronDown className="size-3.5" />
              ) : (
                <ChevronRight className="size-3.5" />
              )}
            </span>

            {/* Folder icon */}
            {isExpanded ? (
              <FolderOpen className="text-muted-foreground size-4 shrink-0" />
            ) : (
              <FolderIcon className="text-muted-foreground size-4 shrink-0" />
            )}

            {/* Name or inline rename input */}
            {isRenaming ? (
              <Input
                ref={renameInputRef}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={handleRenameKeyDown}
                onBlur={() => void handleRename()}
                onClick={(e) => e.stopPropagation()}
                className="h-6 text-sm"
              />
            ) : (
              <span className="truncate">{name}</span>
            )}

            {/* Pin indicator */}
            {pinned && (
              <Pin className="text-muted-foreground ml-auto size-3 shrink-0" />
            )}
          </button>
        </ContextMenuTrigger>

        <ContextMenuContent>
          <ContextMenuItem
            onClick={() => {
              setRenameValue(name);
              setIsRenaming(true);
            }}
          >
            <Pencil className="mr-2 size-4" />
            Rename
          </ContextMenuItem>
          <ContextMenuItem onClick={() => void handleTogglePin()}>
            <Pin className="mr-2 size-4" />
            {pinned ? "Unpin" : "Pin"}
          </ContextMenuItem>
          <ContextMenuItem onClick={() => void handleToggleVisibility()}>
            {visibility === "everyone" ? (
              <>
                <EyeOff className="mr-2 size-4" />
                Set Admin Only
              </>
            ) : (
              <>
                <Eye className="mr-2 size-4" />
                Set Visible to Everyone
              </>
            )}
          </ContextMenuItem>
          <ContextMenuItem disabled>
            <MoveRight className="mr-2 size-4" />
            Move
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            variant="destructive"
            onClick={() => onRequestDelete(folderId, name)}
          >
            <Trash2 className="mr-2 size-4" />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Children (lazy loaded) */}
      {isExpanded && children && (
        <div>
          {children.map((child) => (
            <FolderTreeNode
              key={child._id}
              folderId={child._id}
              name={child.name}
              pinned={child.pinned}
              visibility={child.visibility}
              organizationId={organizationId}
              type={type}
              activeFolderId={activeFolderId}
              onFolderSelect={onFolderSelect}
              depth={depth + 1}
              onRequestDelete={onRequestDelete}
            />
          ))}
          {children.length === 0 && (
            <div
              className="text-muted-foreground px-2 py-1 text-xs"
              style={{ paddingLeft: `${paddingLeft + 24}px` }}
            >
              No subfolders
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── DeleteFolderDialog ─────────────────────────────────────────────────────

interface DeleteFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderName: string;
  onConfirm: () => void;
}

function DeleteFolderDialog({
  open,
  onOpenChange,
  folderName,
  onConfirm,
}: DeleteFolderDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete folder</AlertDialogTitle>
          <AlertDialogDescription className="text-pretty">
            Are you sure you want to delete &ldquo;{folderName}&rdquo;? All
            subfolders will also be deleted. Documents and templates inside will
            be moved to the root level.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
