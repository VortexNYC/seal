import { Button } from "@cloudflare/kumo/components/button";
import { Label } from "@cloudflare/kumo/components/label";
import { FileText, UploadSimple, X } from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { type ChangeEvent, useState } from "react";

import { uploadAttachment } from "@/lib/api-client";

interface AttachmentFieldInputProps {
  label: string;
  value?: string; // storage key from R2
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

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadAttachment(signingToken!, file),
  });

  const validateValue = (
    val?: string
  ): { isValid: boolean; error?: string } => {
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
      const newStorageKey = await uploadMutation.mutateAsync(file);

      setStorageId(newStorageKey);
      onChange(newStorageKey);

      const validation = validateValue(newStorageKey);
      setError(validation.error);
      onValidationChange(validation.isValid, validation.error);
    } catch {
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
        {isRequired && <span className="text-kumo-danger ml-1">*</span>}
      </Label>

      {!storageId ? (
        <div className="border-kumo-hairline rounded-lg border-2 border-dashed p-6 text-center">
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
            <UploadSimple className="text-kumo-secondary h-8 w-8" />
            <div className="text-kumo-secondary text-sm">
              <span className="text-kumo-primary font-medium">
                Click to upload
              </span>{" "}
              or drag and drop
            </div>
            <div className="text-kumo-secondary text-xs">
              Maximum file size: 10MB
            </div>
          </label>
        </div>
      ) : (
        <div className="border-kumo-hairline flex items-center justify-between rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <FileText className="text-kumo-secondary h-5 w-5" />
            <div>
              <div className="text-sm font-medium">
                {fileName || "Uploaded file"}
              </div>
              <div className="text-kumo-secondary text-xs">File attached</div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            disabled={isUploading}
            title="Remove attachment"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {helpText && !error && (
        <p className="text-kumo-secondary text-xs">{helpText}</p>
      )}
      {error && <p className="text-kumo-danger text-xs">{error}</p>}
      {isUploading && (
        <p className="text-kumo-secondary text-xs">Uploading...</p>
      )}
    </div>
  );
}
