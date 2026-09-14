/**
 * Create Folder Dialog
 *
 * Simple dialog for creating a new folder in the current directory.
 * Used by Documents and Templates pages.
 */

import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Input } from "@cloudflare/kumo/components/input";
import { FolderPlus, X } from "@phosphor-icons/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

import { createFolder } from "@/lib/api-client";
import { toast } from "@/lib/toast";

interface CreateFolderDialogProps {
  type: "document" | "template";
  parentId?: string;
  organizationSlug: string;
}

export function CreateFolderDialog({
  type,
  parentId,
  organizationSlug,
}: CreateFolderDialogProps): React.ReactElement {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const createFolderMutation = useMutation({
    mutationFn: (input: {
      name: string;
      type: "document" | "template";
      parentId?: string;
    }) => createFolder(organizationSlug, input),
  });

  useEffect(() => {
    if (!open) return undefined;

    const focusTimer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
    };
  }, [open]);

  const handleCreate = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    setIsCreating(true);
    try {
      await createFolderMutation.mutateAsync({
        name: trimmed,
        type,
        parentId,
      });
      toast.success(`Folder "${trimmed}" created`);
      setName("");
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["api", "folders"] });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create folder";
      toast.error(message);
    } finally {
      setIsCreating(false);
    }
  }, [name, createFolderMutation, type, parentId, queryClient]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void handleCreate();
      }
    },
    [handleCreate]
  );

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setName("");
      }}
    >
      <Dialog.Trigger
        render={
          <Button variant="outline" size="sm" className="gap-2">
            <FolderPlus className="h-4 w-4" />
            <span className="hidden sm:inline">New Folder</span>
          </Button>
        }
      />
      <Dialog size="sm" className="p-6">
        <Dialog.Title>New Folder</Dialog.Title>
        <Dialog.Description>
          Create a new folder to organize your{" "}
          {type === "document" ? "documents" : "templates"}.
        </Dialog.Description>
        <Input
          ref={inputRef}
          id="folder-name"
          label="Folder name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. Contracts, HR Forms..."
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleCreate()}
            disabled={!name.trim() || isCreating}
          >
            {isCreating ? "Creating..." : "Create"}
          </Button>
        </div>
        <Dialog.Close
          className="ring-offset-background focus:ring-ring absolute top-4 right-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:pointer-events-none"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </Dialog.Close>
      </Dialog>
    </Dialog.Root>
  );
}
