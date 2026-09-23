import type { JSX } from "react";
import { useState } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { Button } from "@cloudflare/kumo/components/button";

import { cn } from "@/lib/utils";

export type PptxSlide = {
  id: string;
  title?: string;
  notes?: string;
  imageUrl?: string | null;
  html?: string | null;
};

export type PptxViewerProps = {
  slides: PptxSlide[];
  className?: string;
  initialIndex?: number;
};

/**
 * PowerPoint slide viewer — Extend pptx-viewer capability.
 * Controlled slides (from convert/preview pipeline); no @extend.
 */
export function PptxViewer({
  slides,
  className,
  initialIndex = 0,
}: PptxViewerProps): JSX.Element {
  const [index, setIndex] = useState(
    Math.min(Math.max(initialIndex, 0), Math.max(slides.length - 1, 0))
  );
  const slide = slides[index];

  if (slides.length === 0) {
    return (
      <p
        data-kumo-docs="pptx-viewer"
        className={cn("text-muted-foreground p-4 text-sm", className)}
      >
        No slides loaded.
      </p>
    );
  }

  return (
    <div
      data-kumo-docs="pptx-viewer"
      className={cn("flex flex-col gap-3", className)}
    >
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={index <= 0}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          aria-label="Previous slide"
        >
          <CaretLeft className="size-4" />
        </Button>
        <span className="text-muted-foreground text-xs tabular-nums">
          {index + 1} / {slides.length}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={index >= slides.length - 1}
          onClick={() => setIndex((i) => Math.min(slides.length - 1, i + 1))}
          aria-label="Next slide"
        >
          <CaretRight className="size-4" />
        </Button>
      </div>
      <div className="border-border bg-card aspect-video overflow-hidden rounded-xl border">
        {slide?.imageUrl ? (
          <img
            src={slide.imageUrl}
            alt={slide.title ?? `Slide ${index + 1}`}
            className="h-full w-full object-contain"
          />
        ) : slide?.html ? (
          <div
            className="prose prose-sm dark:prose-invert h-full overflow-auto p-6"
            dangerouslySetInnerHTML={{ __html: slide.html }}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
            <p className="text-foreground text-lg font-medium">
              {slide?.title ?? `Slide ${index + 1}`}
            </p>
            {slide?.notes ? (
              <p className="text-muted-foreground text-sm text-pretty">
                {slide.notes}
              </p>
            ) : (
              <p className="text-muted-foreground text-sm">
                No preview image for this slide.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
