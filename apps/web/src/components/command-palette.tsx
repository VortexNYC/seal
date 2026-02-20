/**
 * Command Palette (Cmd+K) — global document search.
 *
 * Uses the quickSearch action for fast, debounced hybrid search.
 * Click a result to navigate to the document page.
 */

import { useAction } from "convex/react";
import { FileTextIcon, Loader2Icon, SearchIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useDebounce } from "use-debounce";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { api } from "@seal/backend/convex/_generated/api";

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

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const { slug } = useParams({ strict: false }) as { slug?: string };
  const navigate = useNavigate();
  const quickSearch = useAction(api.ai.search_queries.quickSearch);

  const [query, setQuery] = useState("");
  const [debouncedQuery] = useDebounce(query, 150);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Run search when debounced query changes
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setResults([]);
      return;
    }

    let cancelled = false;
    setIsSearching(true);

    quickSearch({ query: debouncedQuery })
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
  }, [debouncedQuery, quickSearch]);

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

  const handleOpenFullSearch = useCallback(() => {
    onOpenChange(false);
    if (slug) {
      navigate({ to: "/$slug/search", params: { slug } });
    }
  }, [navigate, onOpenChange, slug]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search Documents"
      description="Search across all workspace documents"
    >
      <CommandInput placeholder="Search documents..." value={query} onValueChange={setQuery} />
      <CommandList>
        {isSearching ? (
          <div className="flex items-center justify-center py-6">
            <Loader2Icon className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : query.length >= 2 && results.length === 0 ? (
          <CommandEmpty>No documents found.</CommandEmpty>
        ) : (
          <>
            {results.length > 0 && (
              <CommandGroup heading="Documents">
                {results.map((result) => (
                  <CommandItem
                    key={`${result.documentId}-${result.pageNumber}`}
                    value={`${result.documentName} ${result.excerpt}`}
                    onSelect={() => handleSelect(result.documentId)}
                    className="flex items-start gap-3 py-3"
                  >
                    <FileTextIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{result.documentName}</span>
                        {result.pageNumber > 0 && (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            p.{result.pageNumber}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {result.excerpt}
                      </p>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {query.length >= 2 && (
              <CommandGroup>
                <CommandItem
                  onSelect={handleOpenFullSearch}
                  className="justify-center text-sm text-muted-foreground"
                >
                  <SearchIcon className="mr-2 h-4 w-4" />
                  Open full search
                </CommandItem>
              </CommandGroup>
            )}
          </>
        )}
      </CommandList>
      <div className="border-t px-3 py-2 text-[10px] text-muted-foreground">
        <kbd className="rounded border bg-muted px-1">↑↓</kbd> navigate
        <span className="mx-2">·</span>
        <kbd className="rounded border bg-muted px-1">↵</kbd> select
        <span className="mx-2">·</span>
        <kbd className="rounded border bg-muted px-1">esc</kbd> close
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
