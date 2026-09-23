import type { JSX } from "react";
import { FileIcon, FolderIcon } from "lucide-react";

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

function itemButtonClass(selected: boolean): string {
  return cn(
    "hover:bg-accent flex w-full items-center gap-2 px-2 py-2 text-left text-sm transition-colors",
    selected && "bg-accent"
  );
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
        <p className="text-muted-foreground text-sm">This folder is empty.</p>
      ) : view === "list" || view === "columns" ? (
        <ul
          className={cn(
            "divide-border divide-y",
            view === "columns" && "columns-2 gap-4 sm:columns-3"
          )}
        >
          {items.map((item) => {
            const selected = item.id === selectedId;
            return (
              <li key={item.id} className={view === "columns" ? "break-inside-avoid" : undefined}>
                <button
                  type="button"
                  role="listitem"
                  className={itemButtonClass(selected)}
                  onClick={() => activate(item)}
                  onDoubleClick={() => {
                    if (item.kind === "folder") onOpenFolder?.(item);
                    else onOpenFile?.(item);
                  }}
                >
                  {item.kind === "folder" ? (
                    <FolderIcon className="size-4 shrink-0" />
                  ) : (
                    <FileIcon className="size-4 shrink-0" />
                  )}
                  <span className="truncate">{item.name}</span>
                  {item.kind === "file" && item.size != null ? (
                    <span className="text-muted-foreground ml-auto text-[10px] tabular-nums">
                      {(item.size / 1024).toFixed(0)} KB
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {items.map((item) => {
            const selected = item.id === selectedId;
            return (
              <button
                key={item.id}
                type="button"
                role="listitem"
                className={cn(
                  "hover:bg-accent flex flex-col items-center gap-2 rounded-lg p-2 text-center transition-colors",
                  selected && "bg-accent ring-ring ring-2"
                )}
                onClick={() => activate(item)}
              >
                {item.kind === "folder" ? (
                  <FolderIcon className="text-muted-foreground size-10" />
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
                <span className="line-clamp-2 w-full text-[11px]">{item.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
