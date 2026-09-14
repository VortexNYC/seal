/**
 * Save as Template Dialog Component
 *
 * SEA-80/81: Document Templates
 *
 * Allows users to save a document as a reusable template
 */

import { Textarea } from "@cloudflare/kumo";
import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Input } from "@cloudflare/kumo/components/input";
import { Label } from "@cloudflare/kumo/components/label";
import { Text } from "@cloudflare/kumo/components/text";
import { FileText, FloppyDisk } from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { saveAsTemplate } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { getErrorMessage } from "@/lib/utils";

interface SaveAsTemplateDialogProps {
  documentPublicId: string;
  documentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  organizationSlug: string;
}

export function SaveAsTemplateDialog({
  documentPublicId,
  documentName,
  open,
  onOpenChange,
  onSuccess,
  organizationSlug,
}: SaveAsTemplateDialogProps) {
  const [name, setName] = useState(`${documentName} Template`);
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const saveAsTemplateMutation = useMutation({
    mutationFn: (input: { name: string; description?: string }) =>
      saveAsTemplate(organizationSlug, documentPublicId, input),
  });

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Please enter a template name");
      return;
    }

    setIsSaving(true);
    try {
      const result = await saveAsTemplateMutation.mutateAsync({
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
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => onOpenChange(nextOpen)}
    >
      <Dialog size="sm" className="p-6">
        <Dialog.Title>
          <span className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Save as Template
          </span>
        </Dialog.Title>
        <Dialog.Description>
          Create a reusable template from "{documentName}". All signature fields
          will be preserved and can be assigned to new recipients when you use
          the template.
        </Dialog.Description>

        <div className="space-y-4 py-4">
          <Input
            id="templateName"
            label="Template Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Enter template name..."
          />

          <div className="space-y-2">
            <Label htmlFor="templateDescription">
              Description{" "}
              <Text as="span" size="sm" variant="secondary">
                (optional)
              </Text>
            </Label>
            <Textarea
              id="templateDescription"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe what this template is for..."
              rows={3}
              maxLength={500}
            />
            <p className="text-kumo-secondary text-right text-xs">
              {description.length}/500
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={() => void handleSave()}
            disabled={!name.trim()}
            loading={isSaving}
            icon={FloppyDisk}
          >
            Save Template
          </Button>
        </div>
      </Dialog>
    </Dialog.Root>
  );
}
