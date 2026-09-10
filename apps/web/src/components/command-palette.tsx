/**
 * Power Command Palette (Cmd+K) — workspace search placeholder.
 *
 * Full-text search is being migrated to the Cloudflare Worker backend. The
 * dialog still opens with Cmd+K and accepts input, but it returns no results
 * until the search endpoint is available.
 */

import { useEffect, useState } from "react";

import {
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandList,
} from "@/components/ui/command";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) {
      setQuery("");
    }
  }, [open]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search Documents"
      description="Search across all workspace documents"
    >
      <CommandInput
        placeholder="Search documents..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="max-h-[400px]">
        {query.length >= 2 && <CommandEmpty>No documents found.</CommandEmpty>}
      </CommandList>
      <div className="text-muted-foreground border-t px-3 py-2 text-[10px]">
        <kbd className="bg-muted rounded border px-1">&uarr;&darr;</kbd>{" "}
        navigate
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
