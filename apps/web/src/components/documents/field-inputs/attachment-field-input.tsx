import { useConvexMutation } from "@convex-dev/react-query";
import { api } from "@seal/backend/convex/_generated/api";
import { useMutation } from "@tanstack/react-query";
import { FileIcon, UploadIcon, XIcon } from "lucide-react";
import { type ChangeEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface AttachmentFieldInputProps {
  label: string;
  value?: string; // storageId from Convex Storage
  isRequired: boolean;
  helpText?: string;
  signingToken?: string;
  onChange: (value: string) => void;
  onValidationChange: (isValid: boolean, error?: string) => void;
}

export function AttachmentFieldInput({
  label,
  value,
  isRequired,
  helpText,
  signingToken,
  onChange,
  onValidationChange,
}: AttachmentFieldInputProps) {
  const [storageId, setStorageId] = useState(value);
  const [fileName, setFileName] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [isUploading, setIsUploading] = useState(false);

  const generateUploadUrl = useMutation({
    mutationFn: useConvexMutation(api.signature_fields.mutations.generateAttachmentUploadUrl),
  });

  const validateValue = (val?: string): { isValid: boolean; error?: string } => {
    if (isRequired && !val) {
      return { isValid: false, error: "This field is required" };
    }
    return { isValid: true };
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError("File size must be less than 10MB");
      onValidationChange(false, "File size must be less than 10MB");
      return;
    }

    if (!signingToken) {
      setError("Missing signing token for upload");
      onValidationChange(false, "Missing signing token");
      return;
    }

    setIsUploading(true);
    setFileName(file.name);

    try {
      // Step 1: Get a presigned upload URL from Convex
      const uploadUrl = await generateUploadUrl.mutateAsync({
        signingToken,
      });

      // Step 2: Upload the file to Convex Storage
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!result.ok) {
        throw new Error(`Upload failed: ${result.statusText}`);
      }

      const { storageId: newStorageId } = await result.json();

      // Step 3: Store the storageId as the field value
      setStorageId(newStorageId);
      onChange(newStorageId);

      const validation = validateValue(newStorageId);
      setError(validation.error);
      onValidationChange(validation.isValid, validation.error);
    } catch (_err) {
      setError("Failed to upload file");
      onValidationChange(false, "Failed to upload file");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = () => {
    setStorageId(undefined);
    setFileName(undefined);
    onChange("");

    const validation = validateValue(undefined);
    setError(validation.error);
    onValidationChange(validation.isValid, validation.error);
  };

  return (
    <div className="space-y-2">
      <Label>
        {label}
        {isRequired && <span className="text-destructive ml-1">*</span>}
      </Label>

      {!storageId ? (
        <div className="rounded-lg border-2 border-dashed p-6 text-center">
          <input
            type="file"
            id="attachment-field"
            className="hidden"
            onChange={handleFileChange}
            disabled={isUploading}
          />
          <label
            htmlFor="attachment-field"
            className="flex cursor-pointer flex-col items-center gap-2"
          >
            <UploadIcon className="text-muted-foreground h-8 w-8" />
            <div className="text-muted-foreground text-sm">
              <span className="text-primary font-medium">Click to upload</span> or drag and drop
            </div>
            <div className="text-muted-foreground text-xs">Maximum file size: 10MB</div>
          </label>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <FileIcon className="text-muted-foreground h-5 w-5" />
            <div>
              <div className="text-sm font-medium">{fileName || "Uploaded file"}</div>
              <div className="text-muted-foreground text-xs">File attached</div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleRemove} disabled={isUploading}>
            <XIcon className="h-4 w-4" />
          </Button>
        </div>
      )}

      {helpText && !error && <p className="text-muted-foreground text-xs">{helpText}</p>}
      {error && <p className="text-destructive text-xs">{error}</p>}
      {isUploading && <p className="text-muted-foreground text-xs">Uploading...</p>}
    </div>
  );
}
