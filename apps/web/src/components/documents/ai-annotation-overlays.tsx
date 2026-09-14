import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Tooltip } from "@cloudflare/kumo/components/tooltip";
import {
  Bank,
  BookOpen,
  CalendarBlank,
  Scales,
  Warning,
} from "@phosphor-icons/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import {
  dismissDocumentAnnotations,
  getDocumentAnnotations,
} from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AnnotationCategory = "obligation" | "payment" | "risk" | "dates" | "terms";

const ANNOTATION_CATEGORIES = [
  "obligation",
  "payment",
  "risk",
  "dates",
  "terms",
] as const satisfies readonly AnnotationCategory[];
type AnnotationSeverity = "informational" | "important" | "critical";

interface Annotation {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  category: AnnotationCategory;
  severity: AnnotationSeverity;
  text: string;
  summary: string;
}

// ---------------------------------------------------------------------------
// Category config — soft pastels, clean and professional
// ---------------------------------------------------------------------------

const CATEGORY_CONFIG: Record<
  AnnotationCategory,
  {
    label: string;
    icon: typeof BookOpen;
    bgColor: string;
    textColor: string;
    dotColor: string;
  }
> = {
  obligation: {
    label: "Obligation",
    icon: BookOpen,
    bgColor: "bg-kumo-info-tint/50",
    textColor: "text-kumo-info",
    dotColor: "bg-kumo-info",
  },
  payment: {
    label: "Payment",
    icon: Bank,
    bgColor: "bg-kumo-success-tint/50",
    textColor: "text-kumo-success",
    dotColor: "bg-kumo-success",
  },
  risk: {
    label: "Risk",
    icon: Warning,
    bgColor: "bg-kumo-danger-tint/50",
    textColor: "text-kumo-danger",
    dotColor: "bg-kumo-danger",
  },
  dates: {
    label: "Date",
    icon: CalendarBlank,
    bgColor: "bg-kumo-warning-tint/50",
    textColor: "text-kumo-warning",
    dotColor: "bg-kumo-warning",
  },
  terms: {
    label: "Term",
    icon: Scales,
    bgColor: "bg-kumo-elevated/50",
    textColor: "text-kumo-secondary",
    dotColor: "bg-kumo-secondary",
  },
};

const SEVERITY_DOT: Record<AnnotationSeverity, string> = {
  informational: "opacity-40",
  important: "opacity-70",
  critical: "opacity-100",
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDocumentAnnotations(documentPublicId: string) {
  const { data: annotations } = useQuery({
    queryKey: ["documents", documentPublicId, "ai", "annotations"],
    queryFn: () => getDocumentAnnotations(documentPublicId),
  });

  const dismissMutation = useMutation({
    mutationFn: () => dismissDocumentAnnotations(documentPublicId),
  });

  const [enabledCategories, setEnabledCategories] = useState<
    Set<AnnotationCategory>
  >(new Set(["obligation", "payment", "risk", "dates", "terms"]));

  const toggleCategory = useCallback((category: AnnotationCategory) => {
    setEnabledCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  const handleDismiss = useCallback(async () => {
    try {
      await dismissMutation.mutateAsync();
      toast.info("Annotations dismissed");
    } catch {
      toast.error("Failed to dismiss annotations");
    }
  }, [dismissMutation]);

  return {
    annotations,
    enabledCategories,
    toggleCategory,
    handleDismiss,
  };
}

// ---------------------------------------------------------------------------
// PDF highlight overlay (rendered inside TransformComponent)
// ---------------------------------------------------------------------------

function HighlightOverlay({
  annotation,
  pdfPageWidth,
  pdfPageHeight,
}: {
  annotation: Annotation;
  pdfPageWidth: number;
  pdfPageHeight: number;
}) {
  const left = (annotation.x / 100) * pdfPageWidth;
  const top = (annotation.y / 100) * pdfPageHeight;
  const width = (annotation.width / 100) * pdfPageWidth;
  const height = (annotation.height / 100) * pdfPageHeight;

  const config = CATEGORY_CONFIG[annotation.category];

  return (
    <Tooltip
      side="top"
      content={
        <div className="border-kumo-hairline bg-kumo-elevated max-w-xs border px-3 py-2 shadow-lg">
          <div className="mb-0.5 flex items-center gap-1.5">
            <config.icon className={cn("h-3 w-3", config.textColor)} />
            <span
              className={cn(
                "text-[10px] font-semibold tracking-wide uppercase",
                config.textColor
              )}
            >
              {config.label}
            </span>
          </div>
          <p className="text-kumo-primary text-xs leading-relaxed">
            {annotation.summary}
          </p>
        </div>
      }
    >
      <div
        className={cn(
          "absolute cursor-default rounded-sm transition-opacity",
          config.bgColor
        )}
        style={{ left, top, width, height }}
      />
    </Tooltip>
  );
}

export function AIAnnotationOverlays({
  annotations,
  enabledCategories,
  currentPage,
  pdfPageWidth,
  pdfPageHeight,
}: {
  annotations: NonNullable<
    ReturnType<typeof useDocumentAnnotations>["annotations"]
  >;
  enabledCategories: Set<AnnotationCategory>;
  currentPage: number;
  pdfPageWidth: number;
  pdfPageHeight: number;
}) {
  // Only show important + critical on PDF; filter by enabled categories and current page
  const visible = annotations.annotations.filter(
    (a) =>
      a.severity !== "informational" &&
      enabledCategories.has(a.category) &&
      a.page === currentPage
  );

  return (
    <>
      {visible.map((annotation, i) => (
        <HighlightOverlay
          key={`annotation-${annotation.page}-${i}`}
          annotation={annotation}
          pdfPageWidth={pdfPageWidth}
          pdfPageHeight={pdfPageHeight}
        />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Sidebar insights panel
// ---------------------------------------------------------------------------

export function AIInsightsPanel({
  annotations,
  enabledCategories,
  toggleCategory,
  onDismiss,
  onPageJump,
}: {
  annotations: NonNullable<
    ReturnType<typeof useDocumentAnnotations>["annotations"]
  >;
  enabledCategories: Set<AnnotationCategory>;
  toggleCategory: (category: AnnotationCategory) => void;
  onDismiss: () => void;
  onPageJump: (page: number) => void;
}) {
  const allAnnotations = annotations.annotations;
  const filtered = allAnnotations.filter((a) =>
    enabledCategories.has(a.category)
  );
  const [dismissOpen, setDismissOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      {/* Category filter chips */}
      <div className="flex flex-wrap gap-1.5">
        {ANNOTATION_CATEGORIES.map((category) => {
          const config = CATEGORY_CONFIG[category];
          const count = allAnnotations.filter(
            (a) => a.category === category
          ).length;
          if (count === 0) return null;
          const isActive = enabledCategories.has(category);

          return (
            <button
              key={category}
              type="button"
              onClick={() => toggleCategory(category)}
              aria-pressed={isActive}
              aria-label={`${config.label} annotations (${count})`}
              className={cn(
                "flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors",
                isActive
                  ? cn(config.bgColor, config.textColor)
                  : "bg-kumo-elevated text-kumo-secondary/60"
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  isActive ? config.dotColor : "bg-kumo-hairline"
                )}
              />
              {config.label}
              <span className="opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Annotation list */}
      <div className="flex flex-col gap-1">
        {filtered.map((annotation, i) => {
          const config = CATEGORY_CONFIG[annotation.category];
          return (
            <button
              key={`insight-${annotation.page}-${i}`}
              type="button"
              onClick={() => onPageJump(annotation.page)}
              aria-label={`${config.label} insight on page ${annotation.page}: ${annotation.summary}`}
              className="hover:bg-kumo-elevated flex items-start gap-2 rounded-lg px-2 py-1.5 text-left transition-colors"
            >
              <span
                className={cn(
                  "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                  config.dotColor,
                  SEVERITY_DOT[annotation.severity]
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="text-kumo-primary text-xs leading-snug">
                  {annotation.summary}
                </p>
              </div>
              <span className="text-kumo-secondary bg-kumo-elevated shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium">
                p.{annotation.page}
              </span>
            </button>
          );
        })}
      </div>

      {/* Dismiss button */}
      <Dialog.Root
        open={dismissOpen}
        onOpenChange={setDismissOpen}
        role="alertdialog"
      >
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="text-kumo-secondary/60 hover:text-kumo-secondary text-[11px]"
          onClick={() => setDismissOpen(true)}
        >
          Dismiss all insights
        </Button>
        <Dialog size="sm" className="p-6">
          <Dialog.Title>Dismiss all insights?</Dialog.Title>
          <Dialog.Description>
            This will remove all {allAnnotations.length} document insights. They
            won&apos;t reappear unless the document is re-analyzed.
          </Dialog.Description>
          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setDismissOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              className="sm:ml-auto"
              onClick={() => {
                onDismiss();
                setDismissOpen(false);
              }}
            >
              Dismiss
            </Button>
          </div>
        </Dialog>
      </Dialog.Root>
    </div>
  );
}
