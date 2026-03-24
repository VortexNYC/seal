/**
 * Power Command Palette (Cmd+K) — full workspace search with filters.
 *
 * Uses fullSearch for filtered hybrid search with up to 15 results.
 * Inline filter bar for status and date range filtering.
 */

import { api } from "@seal/backend/convex/_generated/api";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useAction } from "convex/react";
import { CalendarIcon, FileTextIcon, Loader2Icon, XIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useDebounce } from "use-debounce";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SearchResult {
  documentId: string;
  documentName: string;
  pageNumber: number;
  excerpt: string;
  score: number;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "declined", label: "Declined" },
];

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const { slug } = useParams({ strict: false }) as { slug?: string };
  const navigate = useNavigate();
  const fullSearch = useAction(api.ai.search_queries.fullSearch);

  const [query, setQuery] = useState("");
  const [debouncedQuery] = useDebounce(query, 200);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Filters
  const [workflowStatus, setWorkflowStatus] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const hasActiveFilters = workflowStatus !== "all" || dateFrom !== "" || dateTo !== "";

  // Run search when debounced query or filters change
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setResults([]);
      return;
    }

    let cancelled = false;
    setIsSearching(true);

    fullSearch({
      query: debouncedQuery,
      workflowStatus: workflowStatus !== "all" ? workflowStatus : undefined,
      dateFrom: dateFrom ? new Date(dateFrom).getTime() : undefined,
      dateTo: dateTo ? new Date(dateTo).getTime() : undefined,
      limit: 15,
    })
      .then((res) => {
        if (!cancelled) setResults(res);
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setIsSearching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, fullSearch, workflowStatus, dateFrom, dateTo]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  const handleSelect = useCallback(
    (documentId: string) => {
      onOpenChange(false);
      if (slug) {
        navigate({ to: "/$slug/documents/$documentId", params: { slug, documentId } });
      }
    },
    [navigate, onOpenChange, slug],
  );

  const clearFilters = useCallback(() => {
    setWorkflowStatus("all");
    setDateFrom("");
    setDateTo("");
  }, []);

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search Documents"
      description="Search across all workspace documents"
    >
      <CommandInput placeholder="Search documents..." value={query} onValueChange={setQuery} />

      {/* Inline filter bar */}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Select value={workflowStatus} onValueChange={setWorkflowStatus}>
          <SelectTrigger className="h-7 w-[140px] text-xs">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
              <CalendarIcon className="h-3 w-3" />
              Date
              {(dateFrom || dateTo) && (
                <Badge variant="secondary" className="ml-1 px-1 py-0 text-[9px]">
                  set
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56" align="start">
            <div className="space-y-2">
              <div>
                <Label className="text-xs">From</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="mt-1 h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">To</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="mt-1 h-8 text-xs"
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-muted-foreground h-7 gap-1 text-xs"
          >
            <XIcon className="h-3 w-3" />
            Clear
          </Button>
        )}
      </div>

      <CommandList className="max-h-[400px]">
        {isSearching ? (
          <div className="flex items-center justify-center py-6">
            <Loader2Icon className="text-muted-foreground h-5 w-5 animate-spin" />
          </div>
        ) : query.length >= 2 && results.length === 0 ? (
          <CommandEmpty>No documents found.</CommandEmpty>
        ) : (
          results.length > 0 && (
            <CommandGroup heading={`${results.length} result${results.length !== 1 ? "s" : ""}`}>
              {results.map((result) => (
                <CommandItem
                  key={`${result.documentId}-${result.pageNumber}`}
                  value={`${result.documentName} ${result.excerpt}`}
                  onSelect={() => handleSelect(result.documentId)}
                  className="flex items-start gap-3 py-3"
                >
                  <FileTextIcon className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{result.documentName}</span>
                      {result.pageNumber > 0 && (
                        <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px]">
                          p.{result.pageNumber}
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
                      {result.excerpt}
                    </p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )
        )}
      </CommandList>
      <div className="text-muted-foreground border-t px-3 py-2 text-[10px]">
        <kbd className="bg-muted rounded border px-1">&uarr;&darr;</kbd> navigate
        <span className="mx-2">&middot;</span>
        <kbd className="bg-muted rounded border px-1">&crarr;</kbd> select
        <span className="mx-2">&middot;</span>
        <kbd className="bg-muted rounded border px-1">esc</kbd> close
      </div>
    </CommandDialog>
  );
}

/**
 * Hook to register the global Cmd+K keyboard shortcut.
 * Call this in the workspace layout to make the command palette accessible everywhere.
 */
export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return { open, setOpen };
}
