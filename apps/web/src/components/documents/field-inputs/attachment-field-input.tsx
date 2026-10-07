import { Text } from "@cloudflare/kumo/components/text";
import { Button } from "@cloudflare/kumo/components/button";
import { Label } from "@cloudflare/kumo/components/label";
import { FileText, UploadSimple, X } from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { type ChangeEvent, useRef, useState } from "react";

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
  const fileInputRef = useRef<HTMLInputElement>(null);
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
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
            disabled={isUploading}
          />
          <Button
            type="button"
            variant="outline"
            className="h-auto w-full flex-col"
            icon={UploadSimple}
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {isUploading ? "Uploading…" : "Click to upload"}
          </Button>
          <Text as="p" variant="secondary" size="xs" className="mt-2">
            Maximum file size: 10MB
          </Text>
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
        <Text as="p" variant="secondary" size="xs">{helpText}</Text>
      )}
      {error && <Text as="p" variant="error" size="xs">{error}</Text>}
      {isUploading && (
        <Text as="p" variant="secondary" size="xs">Uploading...</Text>
      )}
    </div>
  );
}
