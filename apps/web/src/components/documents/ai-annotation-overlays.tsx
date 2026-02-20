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

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AnnotationCategory = "obligation" | "payment" | "risk" | "dates" | "terms";
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
    bgColor: "bg-blue-100/50 dark:bg-blue-900/20",
    textColor: "text-blue-700 dark:text-blue-300",
    dotColor: "bg-blue-500",
  },
  payment: {
    label: "Payment",
    icon: BanknoteIcon,
    bgColor: "bg-emerald-100/50 dark:bg-emerald-900/20",
    textColor: "text-emerald-700 dark:text-emerald-300",
    dotColor: "bg-emerald-500",
  },
  risk: {
    label: "Risk",
    icon: AlertTriangleIcon,
    bgColor: "bg-rose-100/50 dark:bg-rose-900/20",
    textColor: "text-rose-700 dark:text-rose-300",
    dotColor: "bg-rose-500",
  },
  dates: {
    label: "Date",
    icon: CalendarIcon,
    bgColor: "bg-violet-100/50 dark:bg-violet-900/20",
    textColor: "text-violet-700 dark:text-violet-300",
    dotColor: "bg-violet-500",
  },
  terms: {
    label: "Term",
    icon: ScaleIcon,
    bgColor: "bg-amber-100/50 dark:bg-amber-900/20",
    textColor: "text-amber-700 dark:text-amber-300",
    dotColor: "bg-amber-500",
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
  const annotations = useQuery(api.ai.queries.getDocumentAnnotations, { documentId });
  const dismissMutation = useMutation(api.ai.mutations.dismissDocumentAnnotations);
  const [enabledCategories, setEnabledCategories] = useState<Set<AnnotationCategory>>(
    new Set(["obligation", "payment", "risk", "dates", "terms"]),
  );

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
          className={cn("absolute cursor-default rounded-sm transition-opacity", config.bgColor)}
          style={{ left, top, width, height }}
        />
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={4}
        className="max-w-xs border border-slate-200 bg-white px-3 py-2 shadow-lg dark:border-slate-700 dark:bg-slate-800"
      >
        <div className="mb-0.5 flex items-center gap-1.5">
          <config.icon className={cn("h-3 w-3", config.textColor)} />
          <span
            className={cn(
              "text-[10px] font-semibold uppercase tracking-wide",
              config.textColor,
            )}
          >
            {config.label}
          </span>
        </div>
        <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
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
  annotations: NonNullable<ReturnType<typeof useDocumentAnnotations>["annotations"]>;
  enabledCategories: Set<AnnotationCategory>;
  currentPage: number;
  pdfPageWidth: number;
  pdfPageHeight: number;
}) {
  // Only show important + critical on PDF; filter by enabled categories and current page
  const visible = annotations.annotations.filter(
    (a) =>
      a.severity !== "informational" &&
      enabledCategories.has(a.category as AnnotationCategory) &&
      a.page === currentPage,
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
  annotations: NonNullable<ReturnType<typeof useDocumentAnnotations>["annotations"]>;
  enabledCategories: Set<AnnotationCategory>;
  toggleCategory: (category: AnnotationCategory) => void;
  onDismiss: () => void;
  onPageJump: (page: number) => void;
}) {
  const allAnnotations = annotations.annotations;
  const filtered = allAnnotations.filter((a) =>
    enabledCategories.has(a.category as AnnotationCategory),
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Category filter chips */}
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(CATEGORY_CONFIG) as AnnotationCategory[]).map((category) => {
          const config = CATEGORY_CONFIG[category];
          const count = allAnnotations.filter((a) => a.category === category).length;
          if (count === 0) return null;
          const isActive = enabledCategories.has(category);

          return (
            <button
              key={category}
              type="button"
              onClick={() => toggleCategory(category)}
              className={cn(
                "flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-all",
                isActive
                  ? cn(config.bgColor, config.textColor)
                  : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500",
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  isActive ? config.dotColor : "bg-slate-300 dark:bg-slate-600",
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
          const config = CATEGORY_CONFIG[annotation.category as AnnotationCategory];
          return (
            <button
              key={`insight-${annotation.page}-${i}`}
              type="button"
              onClick={() => onPageJump(annotation.page)}
              className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <span
                className={cn(
                  "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                  config.dotColor,
                  SEVERITY_DOT[annotation.severity as AnnotationSeverity],
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs leading-snug text-slate-700 dark:text-slate-300">
                  {annotation.summary}
                </p>
              </div>
              <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                p.{annotation.page}
              </span>
            </button>
          );
        })}
      </div>

      {/* Dismiss button */}
      <button
        type="button"
        onClick={onDismiss}
        className="text-[11px] text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-300"
      >
        Dismiss all insights
      </button>
    </div>
  );
}
