/**
 * Move To Folder Dialog
 *
 * A modal dialog with a tree picker for moving documents/templates
 * between folders. Builds an in-memory tree from a flat folder list.
 * Supports excluding specific folders (e.g. when moving a folder,
 * exclude itself and its descendants).
 */

import { useQuery } from "@tanstack/react-query";
import { ChevronRight, FolderIcon, Home } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getAllFolders, type ApiFolder } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface MoveToFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId?: string;
  type: "document" | "template";
  excludeFolderIds?: string[];
  onMove: (targetFolderId?: string) => void;
  organizationSlug: string;
}

interface FlatFolder {
  _id: string;
  name: string;
  parentId?: string;
  pinned?: boolean;
}

interface TreeNode {
  folder: FlatFolder;
  children: TreeNode[];
}

function toFlatFolder(folder: ApiFolder): FlatFolder {
  return {
    _id: folder.publicId,
    name: folder.name,
    parentId: folder.parentId ?? undefined,
    pinned: folder.pinned,
  };
}

/**
 * Collect all descendant IDs of a set of folder IDs from a flat list.
 * Returns the union of excludeIds and all their transitive children.
 */
function getExcludedSet(
  folders: FlatFolder[],
  excludeIds: string[]
): Set<string> {
  const excluded = new Set<string>(excludeIds);
  let changed = true;

  while (changed) {
    changed = false;
    for (const f of folders) {
      if (!excluded.has(f._id) && f.parentId && excluded.has(f.parentId)) {
        excluded.add(f._id);
        changed = true;
      }
    }
  }

  return excluded;
}

/**
 * Build a tree structure from a flat folder list, excluding specified folders.
 */
function buildTree(
  folders: FlatFolder[],
  excludedSet: Set<string>
): TreeNode[] {
  const filtered = folders.filter((f) => !excludedSet.has(f._id));
  const childMap = new Map<string | undefined, FlatFolder[]>();

  for (const f of filtered) {
    const parentKey = f.parentId ?? "root";
    const existing = childMap.get(parentKey) ?? [];
    existing.push(f);
    childMap.set(parentKey, existing);
  }

  function buildChildren(parentId: string | undefined): TreeNode[] {
    const key = parentId ?? "root";
    const children = childMap.get(key) ?? [];

    return children
      .toSorted((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return a.name.localeCompare(b.name);
      })
      .map((folder) => ({
        folder,
        children: buildChildren(folder._id),
      }));
  }

  return buildChildren(undefined);
}

export function MoveToFolderDialog({
  open,
  onOpenChange,
  type,
  excludeFolderIds,
  onMove,
  organizationSlug,
}: MoveToFolderDialogProps) {
  const { data: apiFolders } = useQuery({
    queryKey: ["api", "folders", "all", type],
    queryFn: () => getAllFolders(organizationSlug, type),
    enabled: open,
  });

  const folders = useMemo(
    () => apiFolders?.map(toFlatFolder) ?? [],
    [apiFolders]
  );

  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(
    undefined
  );
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const excludedSet = useMemo(
    () =>
      folders.length > 0 && excludeFolderIds
        ? getExcludedSet(folders, excludeFolderIds)
        : new Set<string>(),
    [folders, excludeFolderIds]
  );

  const tree = useMemo(
    () => buildTree(folders, excludedSet),
    [folders, excludedSet]
  );

  const toggleExpanded = useCallback((folderId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    onMove(selectedFolderId);
    onOpenChange(false);
  }, [onMove, selectedFolderId, onOpenChange]);

  // Reset selection when dialog opens
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        setSelectedFolderId(undefined);
        setExpandedIds(new Set());
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Move to Folder</DialogTitle>
          <DialogDescription>
            Select a destination folder, or choose root to remove from all
            folders.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-64 overflow-y-auto rounded-md border p-1">
          {/* Root option */}
          <button
            type="button"
            className={cn(
              "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm",
              selectedFolderId === undefined
                ? "bg-accent text-accent-foreground"
                : "hover:bg-accent/50"
            )}
            onClick={() => setSelectedFolderId(undefined)}
          >
            <Home className="size-4 shrink-0" />
            <span>Root (No Folder)</span>
          </button>

          {/* Folder tree */}
          {apiFolders === undefined ? (
            <div className="text-muted-foreground px-2 py-4 text-center text-sm">
              Loading...
            </div>
          ) : tree.length === 0 ? (
            <div className="text-muted-foreground px-2 py-4 text-center text-sm">
              No folders available
            </div>
          ) : (
            tree.map((node) => (
              <TreeNodeItem
                key={node.folder._id}
                node={node}
                depth={0}
                selectedFolderId={selectedFolderId}
                expandedIds={expandedIds}
                onSelect={setSelectedFolderId}
                onToggleExpand={toggleExpanded}
              />
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>Move</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface TreeNodeItemProps {
  node: TreeNode;
  depth: number;
  selectedFolderId: string | undefined;
  expandedIds: Set<string>;
  onSelect: (folderId: string) => void;
  onToggleExpand: (folderId: string) => void;
}

function TreeNodeItem({
  node,
  depth,
  selectedFolderId,
  expandedIds,
  onSelect,
  onToggleExpand,
}: TreeNodeItemProps) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIds.has(node.folder._id);
  const isSelected = selectedFolderId === node.folder._id;

  return (
    <>
      <div
        className={cn(
          "flex w-full items-center gap-1 rounded-sm px-2 py-1.5 text-sm",
          isSelected ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
        )}
        style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}
      >
        {/* Expand/collapse chevron */}
        {hasChildren ? (
          <button
            type="button"
            className="hover:bg-accent shrink-0 rounded-sm p-0.5"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.folder._id);
            }}
            aria-label={isExpanded ? "Collapse folder" : "Expand folder"}
          >
            <ChevronRight
              className={cn(
                "size-3.5 transition-transform",
                isExpanded && "rotate-90"
              )}
            />
          </button>
        ) : (
          <span className="size-4.5 shrink-0" />
        )}
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1 text-left"
          onClick={() => onSelect(node.folder._id)}
        >
          <FolderIcon className="size-4 shrink-0" />
          <span className="truncate">{node.folder.name}</span>
        </button>
      </div>

      {/* Render children if expanded */}
      {hasChildren && isExpanded && (
        <>
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.folder._id}
              node={child}
              depth={depth + 1}
              selectedFolderId={selectedFolderId}
              expandedIds={expandedIds}
              onSelect={onSelect}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </>
      )}
    </>
  );
}
