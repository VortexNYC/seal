import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import {
  CalendarBlank,
  CaretDown,
  Check,
  CheckSquare,
  Dot,
  CreditCard,
  File,
  Hash,
  PenNib,
  Sparkle,
  TextT,
  X,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  applyFieldSuggestions as applyFieldSuggestionsApi,
  dismissFieldSuggestions as dismissFieldSuggestionsApi,
  getFieldSuggestions,
  type ApiFieldSuggestions,
} from "@/lib/api-client";
import { parseSelectValue } from "@/lib/select-values";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

import { FIELD_TYPES, type FieldType } from "./field-toolbar";

function getFieldIcon(fieldType: FieldType) {
  switch (fieldType) {
    case "signature":
      return <PenNib className="h-3 w-3" />;
    case "text":
      return <TextT className="h-3 w-3" />;
    case "number":
      return <Hash className="h-3 w-3" />;
    case "date":
      return <CalendarBlank className="h-3 w-3" />;
    case "checkbox":
      return <CheckSquare className="h-3 w-3" />;
    case "dropdown":
      return <CaretDown className="h-3 w-3" />;
    case "radio":
      return <Dot className="h-3 w-3" />;
    case "attachment":
      return <File className="h-3 w-3" />;
    case "payment":
      return <CreditCard className="h-3 w-3" />;
    default:
      return <TextT className="h-3 w-3" />;
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
      bg: "bg-kumo-success-tint/50",
      border: "border-kumo-success/40",
      text: "text-kumo-success",
      badge: "bg-kumo-success-tint text-kumo-success",
    };
  }
  if (confidence >= 0.5) {
    return {
      bg: "bg-kumo-warning-tint/50",
      border: "border-kumo-warning/40",
      text: "text-kumo-warning",
      badge: "bg-kumo-warning-tint text-kumo-warning",
    };
  }
  return {
    bg: "bg-kumo-elevated/50",
    border: "border-kumo-hairline/40",
    text: "text-kumo-secondary",
    badge: "bg-kumo-elevated text-kumo-secondary",
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
    <Button
      type="button"
      variant={isSelected ? "primary" : "outline"}
      onClick={onToggle}
      aria-label={`${isSelected ? "Deselect" : "Select"} ${field.label} ${field.fieldType} field`}
      aria-pressed={isSelected}
      className="absolute z-30 p-0"
      style={{
        left: absoluteX,
        top: absoluteY,
        width: absoluteWidth,
        height: absoluteHeight,
      }}
    >
      <div
        className={cn(
          "text-xs absolute -top-5 left-0 flex items-center gap-1 rounded-t-sm px-1.5 py-0.5 font-sans font-medium whitespace-nowrap",
          colors.badge
        )}
      >
        <Sparkle className="h-2.5 w-2.5" />
        {field.label}
        <span className="ml-0.5 opacity-75">
          {Math.round(field.confidence * 100)}%
        </span>
      </div>
      <div className="flex h-full w-full items-center justify-center">
        {getFieldIcon(field.fieldType)}
      </div>
      {isSelected && (
        <div className="bg-kumo-info text-kumo-inverse absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full shadow-sm">
          <Check className="h-2.5 w-2.5" />
        </div>
      )}
    </Button>
  );
}

/**
 * Shared hook for OCR/AI field suggestion state (SEA-85).
 * Overlays sit on DocumentCanvas; review bar docks above the canvas chrome.
 */
type FieldSuggestionItem = Omit<
  ApiFieldSuggestions["fields"][number],
  "fieldType"
> & {
  fieldType: FieldType;
};

type SuggestionsWithFieldTypes = Omit<ApiFieldSuggestions, "fields"> & {
  fields: FieldSuggestionItem[];
};

function toSuggestionWithFieldTypes(
  suggestion: ApiFieldSuggestions
): SuggestionsWithFieldTypes {
  return {
    ...suggestion,
    fields: suggestion.fields.map((field) => ({
      ...field,
      fieldType:
        parseSelectValue(field.fieldType, FIELD_TYPES) ??
        ("text" as const satisfies FieldType),
    })),
  };
}

export function useAIFieldSuggestions(
  documentPublicId: string,
  options: { enabled?: boolean; onApplied?: () => void } = {}
): {
  suggestions: SuggestionsWithFieldTypes | null;
  selectedIndices: Set<number>;
  isApplying: boolean;
  toggleField: (index: number) => void;
  selectAll: () => void;
  selectHighConfidence: () => void;
  handleApply: () => Promise<void>;
  handleDismiss: () => Promise<void>;
} {
  const queryClient = useQueryClient();
  const enabled = options.enabled ?? true;
  const onAppliedRef = useRef(options.onApplied);
  onAppliedRef.current = options.onApplied;

  const { data: apiSuggestions } = useQuery({
    queryKey: ["documents", documentPublicId, "ai", "field-suggestions"],
    queryFn: () => getFieldSuggestions(documentPublicId),
    enabled,
  });

  const applyMutation = useMutation({
    mutationFn: ({
      suggestionId,
      selectedFieldIndices,
    }: {
      suggestionId: string;
      selectedFieldIndices?: number[];
    }) =>
      applyFieldSuggestionsApi(
        documentPublicId,
        suggestionId,
        selectedFieldIndices
      ),
  });
  const dismissMutation = useMutation({
    mutationFn: () => dismissFieldSuggestionsApi(documentPublicId),
  });

  const suggestions = apiSuggestions
    ? toSuggestionWithFieldTypes(apiSuggestions)
    : null;

  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    new Set()
  );
  const [isApplying, setIsApplying] = useState(false);

  // One-tap path: pre-select every detected field so Accept all is a single click.
  useEffect(() => {
    if (!suggestions || suggestions.fields.length === 0) return;
    setSelectedIndices(new Set(suggestions.fields.map((_, i) => i)));
  }, [suggestions?.publicId, suggestions?.fields.length]);

  const invalidateSuggestions = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: ["documents", documentPublicId, "ai", "field-suggestions"],
    });
  }, [queryClient, documentPublicId]);

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
      const indices =
        selectedIndices.size > 0 ? [...selectedIndices] : undefined;
      const result = await applyMutation.mutateAsync({
        suggestionId: suggestions.publicId,
        selectedFieldIndices: indices,
      });
      toast.success(
        `Accepted ${result.count} field${result.count === 1 ? "" : "s"}`
      );
      await invalidateSuggestions();
      onAppliedRef.current?.();
    } catch {
      toast.error("Failed to apply suggestions");
    } finally {
      setIsApplying(false);
    }
  }, [suggestions, selectedIndices, applyMutation, invalidateSuggestions]);

  const handleDismiss = useCallback(async () => {
    if (!suggestions) return;
    try {
      await dismissMutation.mutateAsync();
      toast.info("Suggestions dismissed — place fields manually");
      await invalidateSuggestions();
    } catch {
      toast.error("Failed to dismiss suggestions");
    }
  }, [suggestions, dismissMutation, invalidateSuggestions]);

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
 * Renders detected-field suggestion overlays on the DocumentCanvas page box.
 */
export function AIFieldOverlays({
  suggestions,
  selectedIndices,
  toggleField,
  currentPage,
  pdfPageWidth,
  pdfPageHeight,
}: {
  suggestions: NonNullable<
    ReturnType<typeof useAIFieldSuggestions>["suggestions"]
  >;
  selectedIndices: Set<number>;
  toggleField: (index: number) => void;
  currentPage: number;
  pdfPageWidth: number;
  pdfPageHeight: number;
}) {
  const fieldsOnCurrentPage = suggestions.fields.filter(
    (f) => f.page === currentPage
  );

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
 * Review bar for field suggestions — apply, dismiss, select.
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
  suggestions: NonNullable<
    ReturnType<typeof useAIFieldSuggestions>["suggestions"]
  >;
  selectedIndices: Set<number>;
  isApplying: boolean;
  selectAll: () => void;
  selectHighConfidence: () => void;
  handleApply: () => void;
  handleDismiss: () => void;
}) {
  const highConfidenceCount = suggestions.fields.filter(
    (f) => f.confidence >= 0.8
  ).length;
  const [dismissOpen, setDismissOpen] = useState(false);

  return (
    <div
      role="toolbar"
      aria-label="Field suggestion actions"
      className="bg-kumo-elevated/95 border-kumo-hairline flex items-center justify-between gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-sm"
    >
      <div className="flex items-center gap-2">
        <div className="bg-kumo-info text-kumo-inverse flex h-7 w-7 items-center justify-center rounded-lg shadow-sm">
          <Sparkle className="h-3.5 w-3.5" />
        </div>
        <div className="font-sans text-sm">
          <span className="text-kumo-primary font-semibold">
            {suggestions.fields.length} field
            {suggestions.fields.length === 1 ? "" : "s"} detected
          </span>
          <span className="text-kumo-secondary ml-1.5 text-xs">
            {selectedIndices.size > 0 && `(${selectedIndices.size} selected)`}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {highConfidenceCount > 0 &&
          highConfidenceCount < suggestions.fields.length && (
            <Button
              variant="ghost"
              size="sm"
              onClick={selectHighConfidence}
            >
              High confidence ({highConfidenceCount})
            </Button>
          )}
        <Button
          variant="ghost"
          size="sm"
          onClick={selectAll}
        >
          Select all
        </Button>
        <Dialog.Root
          open={dismissOpen}
          onOpenChange={setDismissOpen}
          role="alertdialog"
        >
          <Button
            variant="ghost"
            size="sm"
            icon={X}
            onClick={() => setDismissOpen(true)}
          >
            Dismiss
          </Button>
          <Dialog size="sm" className="p-6">
            <Dialog.Title>Dismiss field suggestions?</Dialog.Title>
            <Dialog.Description>
              This will remove all {suggestions.fields.length} field
              suggestions. You can re-analyze the document later if needed.
            </Dialog.Description>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row">
              <Button
                variant="outline"
                className="sm:w-auto"
                onClick={() => setDismissOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                className="sm:ml-auto"
                onClick={() => {
                  handleDismiss();
                  setDismissOpen(false);
                }}
              >
                Dismiss
              </Button>
            </div>
          </Dialog>
        </Dialog.Root>
        <Button
          size="sm"
          variant="primary"
          onClick={handleApply}
          disabled={isApplying || suggestions.fields.length === 0}
        >
          <Check className="mr-1 h-3 w-3" />
          {isApplying
            ? "Placing..."
            : selectedIndices.size > 0 &&
                selectedIndices.size < suggestions.fields.length
              ? `Accept ${selectedIndices.size}`
              : `Accept all (${suggestions.fields.length})`}
        </Button>
      </div>
    </div>
  );
}
