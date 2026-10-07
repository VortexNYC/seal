/**
 * Move To Folder Dialog
 *
 * A modal dialog with a tree picker for moving documents/templates
 * between folders. Builds an in-memory tree from a flat folder list.
 * Supports excluding specific folders (e.g. when moving a folder,
 * exclude itself and its descendants).
 */

import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { useQuery } from "@tanstack/react-query";
import { CaretRight as ChevronRight, Folder as FolderIcon, House as Home } from "@phosphor-icons/react";
import { useCallback, useMemo, useState } from "react";

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
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog size="sm" className="p-6">
        <Dialog.Title>Move to Folder</Dialog.Title>
        <Dialog.Description>
          Select a destination folder, or choose root to remove from all
          folders.
        </Dialog.Description>

        <div className="max-h-64 overflow-y-auto rounded-md border p-1">
          {/* Root option */}
          <Button
            type="button"
            variant={selectedFolderId === undefined ? "primary" : "ghost"}
            className="w-full justify-start"
            icon={Home}
            onClick={() => setSelectedFolderId(undefined)}
          >
            Root (No Folder)
          </Button>

          {/* Folder tree */}
          {apiFolders === undefined ? (
            <div className="text-kumo-secondary px-2 py-4 text-center text-sm">
              Loading...
            </div>
          ) : tree.length === 0 ? (
            <div className="text-kumo-secondary px-2 py-4 text-center text-sm">
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

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>Move</Button>
        </div>
      </Dialog>
    </Dialog.Root>
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
        className="flex w-full items-center gap-1"
        style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}
      >
        {/* Expand/collapse chevron */}
        {hasChildren ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            shape="square"
            icon={ChevronRight}
            className={cn(isExpanded && "[&_svg]:rotate-90")}
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.folder._id);
            }}
            aria-label={isExpanded ? "Collapse folder" : "Expand folder"}
          />
        ) : (
          <span className="size-4.5 shrink-0" />
        )}
        <Button
          type="button"
          variant={isSelected ? "primary" : "ghost"}
          size="sm"
          className="min-w-0 flex-1 justify-start"
          icon={FolderIcon}
          onClick={() => onSelect(node.folder._id)}
        >
          <span className="truncate">{node.folder.name}</span>
        </Button>
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
