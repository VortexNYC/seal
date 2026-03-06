import { useMutation, useQuery } from "convex/react";
import {
  CalendarIcon,
  CheckIcon,
  CheckSquareIcon,
  ChevronDownIcon,
  CircleDotIcon,
  CreditCardIcon,
  FileIcon,
  HashIcon,
  PenToolIcon,
  SparklesIcon,
  TypeIcon,
  XIcon,
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
import { cn } from "@/lib/utils";
import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import type { FieldType } from "@seal/backend/convex/schemas/signature_fields";

import { Button } from "../ui/button";

function getFieldIcon(fieldType: FieldType) {
  switch (fieldType) {
    case "signature":
      return <PenToolIcon className="h-3 w-3" />;
    case "text":
      return <TypeIcon className="h-3 w-3" />;
    case "number":
      return <HashIcon className="h-3 w-3" />;
    case "date":
      return <CalendarIcon className="h-3 w-3" />;
    case "checkbox":
      return <CheckSquareIcon className="h-3 w-3" />;
    case "dropdown":
      return <ChevronDownIcon className="h-3 w-3" />;
    case "radio":
      return <CircleDotIcon className="h-3 w-3" />;
    case "attachment":
      return <FileIcon className="h-3 w-3" />;
    case "payment":
      return <CreditCardIcon className="h-3 w-3" />;
    default:
      return <TypeIcon className="h-3 w-3" />;
  }
}

function getConfidenceColor(confidence: number): {
  bg: string;
  border: string;
  text: string;
  badge: string;
} {
  if (confidence >= 0.8) {
    return {
      bg: "bg-success-surface/50",
      border: "border-success/40",
      text: "text-success",
      badge: "bg-success-surface text-success",
    };
  }
  if (confidence >= 0.5) {
    return {
      bg: "bg-warning-surface/50",
      border: "border-warning/40",
      text: "text-warning",
      badge: "bg-warning-surface text-warning",
    };
  }
  return {
    bg: "bg-muted/50",
    border: "border-border/40",
    text: "text-muted-foreground",
    badge: "bg-muted text-muted-foreground",
  };
}

interface FieldSuggestion {
  fieldType: FieldType;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  confidence: number;
  isRequired: boolean;
}

function SuggestionOverlay({
  field,
  currentPage,
  pdfPageWidth,
  pdfPageHeight,
  isSelected,
  onToggle,
}: {
  field: FieldSuggestion;
  currentPage: number;
  pdfPageWidth: number;
  pdfPageHeight: number;
  isSelected: boolean;
  onToggle: () => void;
}) {
  if (field.page !== currentPage) return null;

  const absoluteX = (field.x / 100) * pdfPageWidth;
  const absoluteY = (field.y / 100) * pdfPageHeight;
  const absoluteWidth = (field.width / 100) * pdfPageWidth;
  const absoluteHeight = (field.height / 100) * pdfPageHeight;

  const colors = getConfidenceColor(field.confidence);

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={`${isSelected ? "Deselect" : "Select"} ${field.label} ${field.fieldType} field`}
      aria-pressed={isSelected}
      className={cn(
        "absolute flex items-center gap-1 rounded-[3px] border-[1.5px] border-dashed transition-[color,background-color,border-color] duration-200",
        colors.bg,
        colors.border,
        isSelected ? "opacity-100 ring-2 ring-info/30" : "opacity-70 hover:opacity-100",
      )}
      style={{
        left: absoluteX,
        top: absoluteY,
        width: absoluteWidth,
        height: absoluteHeight,
      }}
    >
      <div
        className={cn(
          "absolute -top-5 left-0 flex items-center gap-1 rounded-t-sm px-1.5 py-0.5 font-sans text-[11px] font-medium whitespace-nowrap",
          colors.badge,
        )}
      >
        <SparklesIcon className="h-2.5 w-2.5" />
        {field.label}
        <span className="ml-0.5 opacity-75">{Math.round(field.confidence * 100)}%</span>
      </div>
      <div className="flex h-full w-full items-center justify-center">
        {getFieldIcon(field.fieldType)}
      </div>
      {isSelected && (
        <div className="bg-info absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full text-white shadow-sm">
          <CheckIcon className="h-2.5 w-2.5" />
        </div>
      )}
    </button>
  );
}

/**
 * Shared hook for AI field suggestion state.
 * Used by both AIFieldOverlays (inside TransformComponent) and AIFieldReviewBar (outside it).
 */
export function useAIFieldSuggestions(documentId: Id<"documents">) {
  const suggestions = useQuery(api.ai.queries.getFieldSuggestions, { documentId });
  const applyMutation = useMutation(api.ai.mutations.applyFieldSuggestions);
  const dismissMutation = useMutation(api.ai.mutations.dismissFieldSuggestions);

  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [isApplying, setIsApplying] = useState(false);

  const toggleField = useCallback((index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (!suggestions) return;
    setSelectedIndices(new Set(suggestions.fields.map((_, i) => i)));
  }, [suggestions]);

  const selectHighConfidence = useCallback(() => {
    if (!suggestions) return;
    const indices = suggestions.fields
      .map((f, i) => (f.confidence >= 0.8 ? i : -1))
      .filter((i) => i >= 0);
    setSelectedIndices(new Set(indices));
  }, [suggestions]);

  const handleApply = useCallback(async () => {
    if (!suggestions) return;
    setIsApplying(true);
    try {
      const indices = selectedIndices.size > 0 ? [...selectedIndices] : undefined;
      const result = await applyMutation({
        suggestionId: suggestions._id,
        selectedFieldIndices: indices,
      });
      toast.success(
        `Applied ${result.count} field${result.count === 1 ? "" : "s"} from AI suggestions`,
      );
    } catch {
      toast.error("Failed to apply suggestions");
    } finally {
      setIsApplying(false);
    }
  }, [suggestions, selectedIndices, applyMutation]);

  const handleDismiss = useCallback(async () => {
    if (!suggestions) return;
    try {
      await dismissMutation({ suggestionId: suggestions._id });
      toast.info("AI suggestions dismissed");
    } catch {
      toast.error("Failed to dismiss suggestions");
    }
  }, [suggestions, dismissMutation]);

  return {
    suggestions,
    selectedIndices,
    isApplying,
    toggleField,
    selectAll,
    selectHighConfidence,
    handleApply,
    handleDismiss,
  };
}

/**
 * Renders AI suggestion overlays on the PDF page.
 * Must be placed inside the TransformComponent container (position: relative parent).
 */
export function AIFieldOverlays({
  suggestions,
  selectedIndices,
  toggleField,
  currentPage,
  pdfPageWidth,
  pdfPageHeight,
}: {
  suggestions: NonNullable<ReturnType<typeof useAIFieldSuggestions>["suggestions"]>;
  selectedIndices: Set<number>;
  toggleField: (index: number) => void;
  currentPage: number;
  pdfPageWidth: number;
  pdfPageHeight: number;
}) {
  const fieldsOnCurrentPage = suggestions.fields.filter((f) => f.page === currentPage);

  return (
    <>
      {fieldsOnCurrentPage.map((field) => {
        const globalIndex = suggestions.fields.indexOf(field);
        return (
          <SuggestionOverlay
            key={`ai-suggestion-${globalIndex}`}
            field={field}
            currentPage={currentPage}
            pdfPageWidth={pdfPageWidth}
            pdfPageHeight={pdfPageHeight}
            isSelected={selectedIndices.has(globalIndex)}
            onToggle={() => toggleField(globalIndex)}
          />
        );
      })}
    </>
  );
}

/**
 * Review bar for AI suggestions — apply, dismiss, select.
 * Must be placed OUTSIDE TransformComponent so it doesn't zoom with the PDF.
 */
export function AIFieldReviewBar({
  suggestions,
  selectedIndices,
  isApplying,
  selectAll,
  selectHighConfidence,
  handleApply,
  handleDismiss,
}: {
  suggestions: NonNullable<ReturnType<typeof useAIFieldSuggestions>["suggestions"]>;
  selectedIndices: Set<number>;
  isApplying: boolean;
  selectAll: () => void;
  selectHighConfidence: () => void;
  handleApply: () => void;
  handleDismiss: () => void;
}) {
  const highConfidenceCount = suggestions.fields.filter((f) => f.confidence >= 0.8).length;

  return (
    <div
      role="toolbar"
      aria-label="AI suggestion actions"
      className="bg-card/95 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-sm"
    >
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-ai-accent to-primary text-white shadow-sm">
          <SparklesIcon className="h-3.5 w-3.5" />
        </div>
        <div className="font-sans text-sm">
          <span className="text-foreground font-semibold">
            {suggestions.fields.length} field{suggestions.fields.length === 1 ? "" : "s"} detected
          </span>
          <span className="text-muted-foreground ml-1.5 text-xs">
            {selectedIndices.size > 0 && `(${selectedIndices.size} selected)`}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {highConfidenceCount > 0 && highConfidenceCount < suggestions.fields.length && (
          <Button variant="ghost" size="sm" onClick={selectHighConfidence} className="h-7 text-xs">
            High confidence ({highConfidenceCount})
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={selectAll} className="h-7 text-xs">
          Select all
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="text-muted-foreground h-7 text-xs">
              <XIcon className="mr-1 h-3 w-3" />
              Dismiss
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Dismiss AI suggestions?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove all {suggestions.fields.length} field suggestions. You can
                re-analyze the document later if needed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDismiss}>Dismiss</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Button
          size="sm"
          onClick={handleApply}
          disabled={isApplying}
          className="h-7 bg-gradient-to-r from-ai-accent to-primary text-xs text-white shadow-sm hover:from-ai-accent/90 hover:to-primary/90"
        >
          <CheckIcon className="mr-1 h-3 w-3" />
          {isApplying
            ? "Applying..."
            : selectedIndices.size > 0
              ? `Apply ${selectedIndices.size}`
              : "Apply all"}
        </Button>
      </div>
    </div>
  );
}
