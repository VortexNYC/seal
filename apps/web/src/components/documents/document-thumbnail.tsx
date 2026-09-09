/**
 * DocumentThumbnail component
 * Displays a document thumbnail with lazy generation for documents without thumbnails
 */

import { useMutation } from "@tanstack/react-query";
import { FileIcon, Loader2Icon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  downloadDocument,
  updateDocumentThumbnail,
} from "@/lib/api-client";
import { generateThumbnailFromUrl } from "@/lib/pdf-utils";
import { cn } from "@/lib/utils";

interface DocumentThumbnailProps {
  publicId: string;
  thumbnailDataUrl?: string | null;
  name: string;
  className?: string;
}

export function DocumentThumbnail({
  publicId,
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

  const updateThumbnail = useMutation({
    mutationFn: (variables: {
      publicId: string;
      thumbnailDataUrl: string;
    }) => updateDocumentThumbnail(variables.publicId, variables.thumbnailDataUrl),
  });

  useEffect(() => {
    if (thumbnailDataUrl || localThumbnail || generationFailed) {
      return;
    }
    if (hasAttemptedGeneration.current) {
      return;
    }

    const generateThumbnail = async () => {
      hasAttemptedGeneration.current = true;
      setIsGenerating(true);
      let objectUrl: string | undefined;

      try {
        const blob = await downloadDocument(publicId);
        objectUrl = window.URL.createObjectURL(blob);
        const thumbnail = await generateThumbnailFromUrl(objectUrl);

        if (thumbnail) {
          setLocalThumbnail(thumbnail);
          updateThumbnail.mutate({ publicId, thumbnailDataUrl: thumbnail });
        } else {
          setGenerationFailed(true);
        }
      } catch (error) {
        console.error("Failed to generate thumbnail:", error);
        setGenerationFailed(true);
      } finally {
        if (objectUrl) {
          window.URL.revokeObjectURL(objectUrl);
        }
        setIsGenerating(false);
      }
    };

    void generateThumbnail();
  }, [publicId, thumbnailDataUrl, localThumbnail, generationFailed, updateThumbnail]);

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
