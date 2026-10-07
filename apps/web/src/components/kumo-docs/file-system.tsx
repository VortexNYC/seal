import { Text } from "@cloudflare/kumo/components/text";
import { Button } from "@cloudflare/kumo/components/button";
import { File as FileIcon, Folder as FolderIcon } from "@phosphor-icons/react";
import type { JSX } from "react";

import { cn } from "@/lib/utils";

import { FileThumbnail } from "./file-thumbnail";

export type FileSystemView = "icons" | "list" | "columns";

export type FileSystemFolderItem = {
  id: string;
  kind: "folder";
  name: string;
};

export type FileSystemFileItem = {
  id: string;
  kind: "file";
  name: string;
  mimeType?: string;
  size?: number;
  previewUrl?: string | null;
};

export type FileSystemItem = FileSystemFolderItem | FileSystemFileItem;

export type FileSystemProps = {
  items: FileSystemItem[];
  view?: FileSystemView;
  selectedId?: string | null;
  className?: string;
  onSelect?: (item: FileSystemItem) => void;
  onOpenFolder?: (folder: FileSystemFolderItem) => void;
  onOpenFile?: (file: FileSystemFileItem) => void;
};

function itemButtonVariant(selected: boolean): "secondary" | "ghost" {
  return selected ? "secondary" : "ghost";
}

/**
 * Finder surface — Extend file-system capability, Kumo-owned.
 * Icons / list / columns. Parent owns tree loading and navigation.
 */
export function FileSystem({
  items,
  view = "icons",
  selectedId,
  className,
  onSelect,
  onOpenFolder,
  onOpenFile,
}: FileSystemProps): JSX.Element {
  function activate(item: FileSystemItem): void {
    onSelect?.(item);
    if (item.kind === "folder") onOpenFolder?.(item);
    else onOpenFile?.(item);
  }

  return (
    <div
      data-kumo-docs="file-system"
      className={cn("min-h-48 p-3", className)}
      role="list"
    >
      {items.length === 0 ? (
        <Text as="p" variant="secondary" size="sm">This folder is empty.</Text>
      ) : view === "list" || view === "columns" ? (
        <ul
          className={cn(
            "divide-kumo-line divide-y",
            view === "columns" && "columns-2 gap-4 sm:columns-3"
          )}
        >
          {items.map((item) => {
            const selected = item.id === selectedId;
            return (
              <li
                key={item.id}
                className={
                  view === "columns" ? "break-inside-avoid" : undefined
                }
              >
                <Button
                  type="button"
                  variant={itemButtonVariant(selected)}
                  className="w-full justify-start"
                  icon={item.kind === "folder" ? FolderIcon : FileIcon}
                  onClick={() => activate(item)}
                  onDoubleClick={() => {
                    if (item.kind === "folder") onOpenFolder?.(item);
                    else onOpenFile?.(item);
                  }}
                >
                  <span className="truncate">{item.name}</span>
                  {item.kind === "file" && item.size != null ? (
                    <span className="text-kumo-secondary text-xs ml-auto tabular-nums">
                      {(item.size / 1024).toFixed(0)} KB
                    </span>
                  ) : null}
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {items.map((item) => {
            const selected = item.id === selectedId;
            return (
              <Button
                key={item.id}
                type="button"
                variant={itemButtonVariant(selected)}
                className="h-auto w-full flex-col"
                onClick={() => activate(item)}
              >
                {item.kind === "folder" ? (
                  <FolderIcon className="text-kumo-secondary size-10" />
                ) : (
                  <FileThumbnail
                    file={{
                      name: item.name,
                      type: item.mimeType ?? "application/octet-stream",
                    }}
                    previewImageUrl={item.previewUrl}
                    showLabel={false}
                    className="w-full border-0 shadow-none"
                  />
                )}
                <span className="text-xs line-clamp-2 w-full">
                  {item.name}
                </span>
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}
