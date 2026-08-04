/**
 * Save as Template Dialog Component
 *
 * SEA-80/81: Document Templates
 *
 * Allows users to save a document as a reusable template
 */

import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { FileTextIcon, Loader2Icon, SaveIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { getErrorMessage } from "@/lib/utils";

import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";

interface SaveAsTemplateDialogProps {
  documentId: Id<"documents">;
  documentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function SaveAsTemplateDialog({
  documentId,
  documentName,
  open,
  onOpenChange,
  onSuccess,
}: SaveAsTemplateDialogProps) {
  const [name, setName] = useState(`${documentName} Template`);
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const saveAsTemplate = useMutation(api.templates.mutations.saveAsTemplate);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Please enter a template name");
      return;
    }

    setIsSaving(true);
    try {
      const result = await saveAsTemplate({
        documentId,
        name: name.trim(),
        description: description.trim() || undefined,
      });

      toast.success(
        `Template saved with ${result.fieldCount} field${result.fieldCount !== 1 ? "s" : ""}`
      );
      onSuccess?.();
      onOpenChange(false);
      // Reset form
      setName(`${documentName} Template`);
      setDescription("");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileTextIcon className="h-5 w-5" />
            Save as Template
          </DialogTitle>
          <DialogDescription>
            Create a reusable template from "{documentName}". All signature
            fields will be preserved and can be assigned to new recipients when
            you use the template.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="templateName">Template Name</Label>
            <Input
              id="templateName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter template name..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="templateDescription">
              Description{" "}
              <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="templateDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this template is for..."
              rows={3}
              maxLength={500}
            />
            <p className="text-muted-foreground text-right text-xs">
              {description.length}/500
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !name.trim()}>
            {isSaving ? (
              <>
                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <SaveIcon className="mr-2 h-4 w-4" />
                Save Template
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
