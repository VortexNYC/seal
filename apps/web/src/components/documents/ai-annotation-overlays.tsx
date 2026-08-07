import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangleIcon,
  BanknoteIcon,
  BookOpenIcon,
  CalendarIcon,
  ScaleIcon,
} from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
    icon: typeof BookOpenIcon;
    bgColor: string;
    textColor: string;
    dotColor: string;
  }
> = {
  obligation: {
    label: "Obligation",
    icon: BookOpenIcon,
    bgColor: "bg-ai-response-surface/50",
    textColor: "text-ai-response-text",
    dotColor: "bg-ai-accent",
  },
  payment: {
    label: "Payment",
    icon: BanknoteIcon,
    bgColor: "bg-ai-autofill-surface/50",
    textColor: "text-ai-autofill-text",
    dotColor: "bg-ai-autofill-text",
  },
  risk: {
    label: "Risk",
    icon: AlertTriangleIcon,
    bgColor: "bg-ai-error-surface/50",
    textColor: "text-ai-error-text",
    dotColor: "bg-ai-error-text",
  },
  dates: {
    label: "Date",
    icon: CalendarIcon,
    bgColor: "bg-ai-suggestion-surface/50",
    textColor: "text-ai-suggestion-text",
    dotColor: "bg-ai-accent",
  },
  terms: {
    label: "Term",
    icon: ScaleIcon,
    bgColor: "bg-ai-warning-surface/50",
    textColor: "text-ai-warning-text",
    dotColor: "bg-ai-warning-text",
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

export function useDocumentAnnotations(documentId: Id<"documents">) {
  const annotations = useQuery(api.ai.queries.getDocumentAnnotations, {
    documentId,
  });
  const dismissMutation = useMutation(
    api.ai.mutations.dismissDocumentAnnotations
  );
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
    if (!annotations) return;
    try {
      await dismissMutation({ annotationId: annotations._id });
      toast.info("Annotations dismissed");
    } catch {
      toast.error("Failed to dismiss annotations");
    }
  }, [annotations, dismissMutation]);

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
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "absolute cursor-default rounded-sm transition-opacity",
            config.bgColor
          )}
          style={{ left, top, width, height }}
        />
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={4}
        className="border-border bg-popover max-w-xs border px-3 py-2 shadow-lg"
      >
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
        <p className="text-popover-foreground text-xs leading-relaxed">
          {annotation.summary}
        </p>
      </TooltipContent>
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
                  : "bg-muted text-muted-foreground/60"
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  isActive ? config.dotColor : "bg-border"
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
              className="hover:bg-muted flex items-start gap-2 rounded-lg px-2 py-1.5 text-left transition-colors"
            >
              <span
                className={cn(
                  "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                  config.dotColor,
                  SEVERITY_DOT[annotation.severity]
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="text-foreground text-xs leading-snug">
                  {annotation.summary}
                </p>
              </div>
              <span className="text-muted-foreground bg-muted shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium">
                p.{annotation.page}
              </span>
            </button>
          );
        })}
      </div>

      {/* Dismiss button */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button
            type="button"
            className="text-muted-foreground/60 hover:text-muted-foreground text-[11px] transition-colors"
          >
            Dismiss all insights
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dismiss all insights?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all {allAnnotations.length} document insights.
              They won&apos;t reappear unless the document is re-analyzed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDismiss}>Dismiss</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
