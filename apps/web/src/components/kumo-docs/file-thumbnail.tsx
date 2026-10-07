import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Loader } from "@cloudflare/kumo/components/loader";
import { Text } from "@cloudflare/kumo/components/text";
import { File as FileIcon } from "@phosphor-icons/react";
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
    <div
      aria-hidden
      className="bg-kumo-elevated absolute inset-0 z-10 flex items-center justify-center"
    >
      <Loader size="sm" />
    </div>
  );
}

/**
 * File preview tile. Kumo has no thumbnail, so this is a LayerCard, the image,
 * and Text for the name.
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
    <LayerCard
      data-kumo-docs="file-thumbnail"
      className={cn("relative h-full w-full", className)}
    >
      <div className="bg-kumo-elevated relative h-full min-h-0 w-full">
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
          <div className="flex h-full flex-col items-center justify-center gap-2 p-3">
            <FileIcon className="text-kumo-secondary size-8" />
            <Text size="xs" DANGEROUS_className="line-clamp-2 text-center">
              {name}
            </Text>
          </div>
        ) : null}
      </div>
      {showLabel ? (
        <Text size="xs" truncate DANGEROUS_className="px-2 py-1.5">
          {name}
        </Text>
      ) : null}
    </LayerCard>
  );
}
