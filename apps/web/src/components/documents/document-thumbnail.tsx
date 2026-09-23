/**
 * DocumentThumbnail — Seal FileThumbnail with lazy PDF generation.
 */

import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState, type JSX } from "react";

import { FileThumbnail } from "@/components/kumo-docs/file-thumbnail";
import { downloadDocument, updateDocumentThumbnail } from "@/lib/api-client";
import { generateThumbnailFromUrl } from "@/lib/pdf-utils";
import { cn } from "@/lib/utils";

interface DocumentThumbnailProps {
  publicId: string;
  thumbnailDataUrl?: string | null;
  name: string;
  className?: string;
  organizationSlug: string;
}

export function DocumentThumbnail({
  publicId,
  thumbnailDataUrl,
  name,
  className = "w-12 h-16 sm:w-16 sm:h-20",
  organizationSlug,
}: DocumentThumbnailProps): JSX.Element {
  const [isGenerating, setIsGenerating] = useState(false);
  const [localThumbnail, setLocalThumbnail] = useState<string | null>(
    thumbnailDataUrl ?? null
  );
  const [generationFailed, setGenerationFailed] = useState(false);
  const hasAttemptedGeneration = useRef(false);

  const updateThumbnail = useMutation({
    mutationFn: (variables: { publicId: string; thumbnailDataUrl: string }) =>
      updateDocumentThumbnail(
        organizationSlug,
        variables.publicId,
        variables.thumbnailDataUrl
      ),
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
        const blob = await downloadDocument(organizationSlug, publicId);
        objectUrl = window.URL.createObjectURL(blob);
        const thumbnail = await generateThumbnailFromUrl(objectUrl);

        if (thumbnail) {
          setLocalThumbnail(thumbnail);
          updateThumbnail.mutate({ publicId, thumbnailDataUrl: thumbnail });
        } else {
          setGenerationFailed(true);
        }
      } catch {
        setGenerationFailed(true);
      } finally {
        if (objectUrl) {
          window.URL.revokeObjectURL(objectUrl);
        }
        setIsGenerating(false);
      }
    };

    void generateThumbnail();
  }, [
    publicId,
    thumbnailDataUrl,
    localThumbnail,
    generationFailed,
    updateThumbnail,
    organizationSlug,
  ]);

  useEffect(() => {
    if (thumbnailDataUrl && !localThumbnail) {
      setLocalThumbnail(thumbnailDataUrl);
    }
  }, [thumbnailDataUrl, localThumbnail]);

  const thumbnail = localThumbnail || thumbnailDataUrl;

  return (
    <FileThumbnail
      file={{ name, type: "application/pdf" }}
      previewImageUrl={thumbnail}
      isLoading={isGenerating}
      hasError={generationFailed && !thumbnail}
      showLabel={false}
      className={cn("border-0 bg-transparent shadow-none", className)}
    />
  );
}
