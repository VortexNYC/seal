/**
 * Create Folder Dialog
 *
 * Simple dialog for creating a new folder in the current directory.
 * Used by Documents and Templates pages.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FolderPlusIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createFolder } from "@/lib/api-client";

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
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setName("");
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FolderPlusIcon className="h-4 w-4" />
          <span className="hidden sm:inline">New Folder</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Folder</DialogTitle>
          <DialogDescription>
            Create a new folder to organize your{" "}
            {type === "document" ? "documents" : "templates"}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="folder-name">Folder name</Label>
          <Input
            id="folder-name"
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. Contracts, HR Forms..."
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleCreate()}
            disabled={!name.trim() || isCreating}
          >
            {isCreating ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
