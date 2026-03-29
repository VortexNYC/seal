import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import type { FieldType } from "@seal/backend/convex/schemas/signature_fields";
import { useQuery } from "convex/react";
import {
  CalendarIcon,
  CheckSquareIcon,
  ChevronDownIcon,
  CircleDotIcon,
  CreditCardIcon,
  FileIcon,
  HashIcon,
  PenToolIcon,
  SparklesIcon,
  TypeIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

interface AIReviewPanelProps {
  documentId: Id<"documents">;
  onPageNavigate?: (page: number) => void;
}

function getFieldIcon(fieldType: FieldType) {
  switch (fieldType) {
    case "signature":
      return <PenToolIcon className="h-3.5 w-3.5" />;
    case "text":
      return <TypeIcon className="h-3.5 w-3.5" />;
    case "number":
      return <HashIcon className="h-3.5 w-3.5" />;
    case "date":
      return <CalendarIcon className="h-3.5 w-3.5" />;
    case "checkbox":
      return <CheckSquareIcon className="h-3.5 w-3.5" />;
    case "dropdown":
      return <ChevronDownIcon className="h-3.5 w-3.5" />;
    case "radio":
      return <CircleDotIcon className="h-3.5 w-3.5" />;
    case "attachment":
      return <FileIcon className="h-3.5 w-3.5" />;
    case "payment":
      return <CreditCardIcon className="h-3.5 w-3.5" />;
    default:
      return <TypeIcon className="h-3.5 w-3.5" />;
  }
}

function getConfidenceBadge(confidence: number) {
  const percent = Math.round(confidence * 100);
  if (confidence >= 0.8) {
    return (
      <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400">
        {percent}%
      </span>
    );
  }
  if (confidence >= 0.5) {
    return (
      <span className="rounded-full bg-amber-100 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-amber-700 dark:bg-amber-900/50 dark:text-amber-400">
        {percent}%
      </span>
    );
  }
  return (
    <span className="rounded-full bg-slate-100 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
      {percent}%
    </span>
  );
}

export function AIReviewPanel({ documentId, onPageNavigate }: AIReviewPanelProps) {
  const suggestions = useQuery(api.ai.queries.getFieldSuggestions, { documentId });

  if (!suggestions) return null;

  // Group fields by page
  const fieldsByPage = new Map<number, typeof suggestions.fields>();
  for (const field of suggestions.fields) {
    const existing = fieldsByPage.get(field.page) ?? [];
    existing.push(field);
    fieldsByPage.set(field.page, existing);
  }

  const sortedPages = [...fieldsByPage.keys()].sort((a, b) => a - b);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:rounded-xl dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 sm:px-4 sm:py-3.5 dark:border-slate-800">
        <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-gradient-to-br from-violet-500 to-blue-500 text-white sm:h-8 sm:w-8 sm:rounded-lg">
          <SparklesIcon className="h-[18px] w-[18px] sm:h-4 sm:w-4" />
        </div>
        <div>
          <div className="font-sans text-[0.9375rem] font-semibold text-slate-800 sm:text-sm dark:text-slate-200">
            AI Suggestions
          </div>
          <div className="font-sans text-[0.6875rem] text-slate-500 dark:text-slate-400">
            {suggestions.fields.length} field{suggestions.fields.length === 1 ? "" : "s"} detected
            &middot; {suggestions.modelUsed}
            &middot; {(suggestions.processingTimeMs / 1000).toFixed(1)}s
          </div>
        </div>
      </div>

      <div className="max-h-[400px] overflow-y-auto px-5 py-3 sm:px-4 sm:py-2">
        {sortedPages.map((page) => {
          const fields = fieldsByPage.get(page) ?? [];
          return (
            <div key={page} className="mb-3 last:mb-0">
              <h4 className="mb-1.5 font-sans text-[0.6875rem] font-semibold tracking-wide text-slate-400 uppercase dark:text-slate-500">
                Page {page}
              </h4>
              <div className="space-y-1">
                {fields.map((field, i) => (
                  <button
                    key={`${page}-${i}`}
                    type="button"
                    onClick={() => onPageNavigate?.(field.page)}
                    aria-label={`Go to ${field.label} on page ${field.page}`}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50",
                    )}
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                      {getFieldIcon(field.fieldType)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-sans text-xs font-medium text-slate-700 dark:text-slate-300">
                        {field.label}
                      </div>
                      <div className="font-sans text-[10px] text-slate-500 dark:text-slate-400">
                        {field.fieldType}
                        {field.isRequired && " · required"}
                      </div>
                    </div>
                    {getConfidenceBadge(field.confidence)}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
