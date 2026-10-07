import { Text } from "@cloudflare/kumo/components/text";
import { Button } from "@cloudflare/kumo/components/button";
import { UploadSimple as Upload } from "@phosphor-icons/react";
import type { JSX } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";

import {
  DROPZONE_ACCEPT_TYPES,
  validateFileForUpload,
} from "@/lib/upload-validation";
import { cn } from "@/lib/utils";

export type FileUploadItem = {
  id: string;
  file: File;
  url: string;
};

export type FileUploadProps = {
  className?: string;
  title?: string;
  description?: string;
  multiple?: boolean;
  accept?: Record<string, string[]>;
  disabled?: boolean;
  /** When false, parent owns the selected-file list. */
  showFileList?: boolean;
  onFilesAccepted?: (files: File[]) => void;
  onFilesRejected?: (rejections: FileRejection[]) => void;
  onFilesChange?: (items: FileUploadItem[]) => void;
};

/**
 * Dropzone upload surface — Extend file-upload, Seal accept rules, Kumo chrome.
 */
export function FileUpload({
  className,
  title = "Click to upload or drop files",
  description,
  multiple = true,
  accept = DROPZONE_ACCEPT_TYPES,
  disabled = false,
  showFileList = true,
  onFilesAccepted,
  onFilesRejected,
  onFilesChange,
}: FileUploadProps): JSX.Element {
  const [items, setItems] = useState<FileUploadItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    return () => {
      itemsRef.current.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, []);

  const commit = useCallback(
    (files: File[], rejections: FileRejection[]) => {
      if (rejections.length > 0) {
        onFilesRejected?.(rejections);
      }
      const accepted: File[] = [];
      for (const file of files) {
        const result = validateFileForUpload(file);
        if (!result.valid) {
          setError(result.errors[0] ?? "Unsupported file");
          continue;
        }
        accepted.push(file);
      }
      if (accepted.length === 0) return;
      setError(null);
      onFilesAccepted?.(accepted);
      setItems((prev) => {
        prev.forEach((item) => URL.revokeObjectURL(item.url));
        const next = (multiple ? accepted : accepted.slice(0, 1)).map(
          (file) => ({
            id: crypto.randomUUID(),
            file,
            url: URL.createObjectURL(file),
          })
        );
        onFilesChange?.(next);
        return next;
      });
    },
    [multiple, onFilesAccepted, onFilesChange, onFilesRejected]
  );

  const { getRootProps, getInputProps } = useDropzone({
    accept,
    multiple,
    disabled,
    onDrop: (files, rejections) => commit(files, rejections),
  });

  return (
    <div data-kumo-docs="file-upload" className={cn("space-y-3", className)}>
      <Button
        {...getRootProps()}
        type="button"
        variant="outline"
        className="h-auto w-full flex-col py-6"
        icon={Upload}
        disabled={disabled}
      >
        <input {...getInputProps()} />
        <span className="flex flex-col items-center">
          <span>{title}</span>
          {description ? <span>{description}</span> : null}
        </span>
      </Button>
      {error ? <Text as="p" variant="error" size="xs">{error}</Text> : null}
      {showFileList && items.length > 0 ? (
        <ul className="space-y-1">
          {items.map((item) => (
            <li
              key={item.id}
              className="border-kumo-line bg-kumo-base text-kumo-default flex items-center justify-between rounded-md border px-3 py-2 text-xs"
            >
              <span className="truncate">{item.file.name}</span>
              <span className="text-kumo-secondary tabular-nums">
                {(item.file.size / 1024).toFixed(0)} KB
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
