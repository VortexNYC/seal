/**
 * DocumentThumbnail component
 * Displays a document thumbnail with lazy generation for documents without thumbnails
 */

import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { FileIcon, Loader2Icon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { generateThumbnailFromUrl } from "@/lib/pdf-utils";
import { cn } from "@/lib/utils";

interface DocumentThumbnailProps {
  documentId: Id<"documents">;
  storageId: string;
  thumbnailDataUrl?: string | null;
  name: string;
  className?: string;
}

export function DocumentThumbnail({
  documentId,
  storageId,
  thumbnailDataUrl,
  name,
  className = "w-12 h-16 sm:w-16 sm:h-20",
}: DocumentThumbnailProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [localThumbnail, setLocalThumbnail] = useState<string | null>(
    thumbnailDataUrl ?? null
  );
  const [generationFailed, setGenerationFailed] = useState(false);
  const hasAttemptedGeneration = useRef(false);

  // Get the storage URL for fetching PDF - only query if we need to generate
  const shouldFetchUrl =
    !thumbnailDataUrl && !localThumbnail && !generationFailed;
  const storageUrl = useQuery(
    api.documents.queries.getStorageUrl,
    shouldFetchUrl ? { storageId } : "skip"
  );

  // Mutation to save the generated thumbnail
  const updateThumbnail = useMutation(api.documents.mutations.updateThumbnail);

  useEffect(() => {
    // If we already have a thumbnail, no need to generate
    if (thumbnailDataUrl || localThumbnail) {
      return;
    }

    // Don't attempt generation multiple times
    if (hasAttemptedGeneration.current) {
      return;
    }

    // Need storage URL to generate thumbnail
    if (!storageUrl) {
      return;
    }

    // Generate thumbnail
    const generateThumbnail = async () => {
      hasAttemptedGeneration.current = true;
      setIsGenerating(true);

      try {
        const thumbnail = await generateThumbnailFromUrl(storageUrl);

        if (thumbnail) {
          setLocalThumbnail(thumbnail);

          // Save to database (fire and forget)
          updateThumbnail({
            documentId,
            thumbnailDataUrl: thumbnail,
          }).catch((error) => {
            console.error("Failed to save thumbnail:", error);
          });
        } else {
          setGenerationFailed(true);
        }
      } catch (error) {
        console.error("Failed to generate thumbnail:", error);
        setGenerationFailed(true);
      } finally {
        setIsGenerating(false);
      }
    };

    generateThumbnail();
  }, [
    storageUrl,
    thumbnailDataUrl,
    localThumbnail,
    documentId,
    updateThumbnail,
  ]);

  // Update local thumbnail if prop changes (e.g., from refetch)
  useEffect(() => {
    if (thumbnailDataUrl && !localThumbnail) {
      setLocalThumbnail(thumbnailDataUrl);
    }
  }, [thumbnailDataUrl, localThumbnail]);

  const thumbnail = localThumbnail || thumbnailDataUrl;

  return (
    <div
      className={cn(
        "bg-muted border-border flex items-center justify-center overflow-hidden rounded border",
        className
      )}
    >
      {thumbnail ? (
        <img
          src={thumbnail}
          alt={`${name} thumbnail`}
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : isGenerating ? (
        <Loader2Icon className="text-muted-foreground h-6 w-6 animate-spin sm:h-8 sm:w-8" />
      ) : (
        <FileIcon className="text-muted-foreground h-6 w-6 sm:h-8 sm:w-8" />
      )}
    </div>
  );
}
