import { FileIcon } from "lucide-react";
import type { JSX, ReactNode } from "react";

import { cn } from "@/lib/utils";

export type ThumbnailFile = {
  name: string;
  type: string;
};

export type FileThumbnailProps = {
  file: ThumbnailFile | File;
  className?: string;
  previewImageUrl?: string | null;
  previewContent?: ReactNode;
  isLoading?: boolean;
  hasError?: boolean;
  showLabel?: boolean;
};

export function FileThumbnailLoadingOverlay(): JSX.Element {
  return (
    <div aria-hidden className="bg-muted absolute inset-0 z-10 overflow-hidden">
      <div className="bg-background/55 absolute inset-0 animate-pulse" />
    </div>
  );
}

/**
 * File preview tile — Extend file-thumbnail, Kumo-owned.
 */
export function FileThumbnail({
  file,
  className,
  previewImageUrl,
  previewContent,
  isLoading = false,
  hasError = false,
  showLabel = true,
}: FileThumbnailProps): JSX.Element {
  const name = "name" in file ? file.name : "file";
  const showFallback = hasError || (!previewImageUrl && !previewContent);

  return (
    <div
      data-kumo-docs="file-thumbnail"
      className={cn(
        "border-border bg-background relative h-full w-full overflow-hidden",
        className
      )}
    >
      <div className="bg-muted relative h-full min-h-0 w-full">
        {isLoading ? <FileThumbnailLoadingOverlay /> : null}
        {previewImageUrl && !hasError ? (
          <img
            src={previewImageUrl}
            alt=""
            className="h-full w-full object-cover object-top"
          />
        ) : null}
        {previewContent && !previewImageUrl ? (
          <div className="absolute inset-0">{previewContent}</div>
        ) : null}
        {showFallback && !isLoading ? (
          <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 p-3">
            <FileIcon className="size-8 opacity-50" />
            <span className="text-3xs line-clamp-2 text-center">{name}</span>
          </div>
        ) : null}
      </div>
      {showLabel ? (
        <div className="text-2xs truncate px-2 py-1.5">{name}</div>
      ) : null}
    </div>
  );
}
