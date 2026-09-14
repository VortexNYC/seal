/**
 * Power Command Palette (Cmd+K) — workspace search placeholder.
 *
 * Full-text search is being migrated to the Cloudflare Worker backend. The
 * dialog still opens with Cmd+K and accepts input, but it returns no results
 * until the search endpoint is available.
 */

import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Input } from "@cloudflare/kumo/components/input";
import { Text } from "@cloudflare/kumo/components/text";
import { useEffect, useState } from "react";

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
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog size="lg" className="p-6">
        <Dialog.Title>Search Documents</Dialog.Title>
        <Dialog.Description>
          Search across all workspace documents
        </Dialog.Description>
        <Input
          id="command-palette-search"
          label="Search"
          placeholder="Search documents..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="max-h-[400px] min-h-[80px] overflow-y-auto">
          {query.length >= 2 && (
            <Text as="p" size="sm" variant="secondary">
              No documents found.
            </Text>
          )}
        </div>
        <div className="text-kumo-secondary border-kumo-hairline border-t px-3 py-2 text-[10px]">
          <kbd className="bg-kumo-elevated border-kumo-hairline rounded border px-1">
            &uarr;&darr;
          </kbd>{" "}
          navigate
          <span className="mx-2">&middot;</span>
          <kbd className="bg-kumo-elevated border-kumo-hairline rounded border px-1">
            &crarr;
          </kbd>{" "}
          select
          <span className="mx-2">&middot;</span>
          <kbd className="bg-kumo-elevated border-kumo-hairline rounded border px-1">
            esc
          </kbd>{" "}
          close
        </div>
      </Dialog>
    </Dialog.Root>
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
