import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Input } from "@cloudflare/kumo/components/input";
import { Label } from "@cloudflare/kumo/components/label";
import { Meter } from "@cloudflare/kumo/components/meter";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, FileIcon, Upload, X } from "lucide-react";
import { useState } from "react";
import { type FileRejection, useDropzone } from "react-dropzone";

import { toast } from "@/lib/toast";

import { useAnalytics } from "../../hooks/use-analytics";
import { createDocument, uploadDocument } from "../../lib/api-client";
import { extractPdfMetadata } from "../../lib/pdf-utils";
import {
  DROPZONE_ACCEPT_TYPES,
  formatFileSize,
  getMaxFileSizeDisplay,
  getSupportedFileTypesDisplay,
  validateFileForUpload,
} from "../../lib/upload-validation";
import { cn } from "../../lib/utils";

interface UploadDialogProps {
  organizationId: string;
  organizationSlug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface FileWithStatus {
  file: File;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
  progress?: number;
  retryCount?: number;
  pageCount?: number;
  thumbnail?: string | null;
}

type CreateDocumentInput = {
  name: string;
  description?: string;
  fileSize: number;
  contentType: string;
  pageCount?: number;
  thumbnailDataUrl?: string;
};

type UsageStats = {
  documentsThisMonth: number;
  documentsLimit: number;
  plan: string;
};

type UploadState = {
  readonly files: FileWithStatus[];
  readonly description: string;
  readonly uploading: boolean;
  readonly showCancelConfirm: boolean;
  readonly setFiles: React.Dispatch<React.SetStateAction<FileWithStatus[]>>;
  readonly setDescription: React.Dispatch<React.SetStateAction<string>>;
  readonly setUploading: React.Dispatch<React.SetStateAction<boolean>>;
  readonly setShowCancelConfirm: React.Dispatch<React.SetStateAction<boolean>>;
};

type UploadController = {
  readonly files: FileWithStatus[];
  readonly description: string;
  readonly uploading: boolean;
  readonly showCancelConfirm: boolean;
  readonly usageStats: UsageStats | null | undefined;
  readonly atDocumentLimit: boolean;
  readonly handleDrop: (
    acceptedFiles: File[],
    rejectedFiles: FileRejection[]
  ) => Promise<void>;
  readonly handleSubmit: (event: React.FormEvent) => Promise<void>;
  readonly removeFile: (index: number) => void;
  readonly requestClose: () => void;
  readonly confirmCancel: () => void;
  readonly setDescription: React.Dispatch<React.SetStateAction<string>>;
  readonly setShowCancelConfirm: React.Dispatch<React.SetStateAction<boolean>>;
};

type UploadSingleFileInput = {
  readonly fileWithStatus: FileWithStatus;
  readonly index: number;
  readonly organizationId: string;
  readonly description: string;
  readonly createDocument: (input: CreateDocumentInput) => Promise<{
    publicId: string;
  }>;
  readonly uploadDocument: (
    publicId: string,
    contentBase64: string,
    contentType: string
  ) => Promise<unknown>;
  readonly updateFile: (index: number, patch: Partial<FileWithStatus>) => void;
  readonly trackDocumentUploaded: (input: {
    readonly fileSize: number;
    readonly pageCount?: number;
    readonly fileType: string;
  }) => void;
};

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getRetryDelay = (retryCount: number): number =>
  INITIAL_RETRY_DELAY * 2 ** retryCount;

export function UploadDialog({
  organizationId,
  organizationSlug,
  open,
  onOpenChange,
  onSuccess,
}: UploadDialogProps) {
  const controller = useUploadController({
    organizationId,
    organizationSlug,
    onOpenChange,
    onSuccess,
  });
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: controller.handleDrop,
    accept: DROPZONE_ACCEPT_TYPES,
    disabled: controller.uploading,
    multiple: false,
    maxFiles: 1,
  });

  return (
    <>
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog className="flex max-h-[80vh] flex-col sm:max-w-[625px]">
          <UploadDialogHeader />
          <form
            onSubmit={controller.handleSubmit}
            className="flex min-h-0 flex-1 flex-col"
          >
            <UsageLimitNotice
              atDocumentLimit={controller.atDocumentLimit}
              usageStats={controller.usageStats}
            />
            <UploadDialogBody
              controller={controller}
              dropzone={{ getRootProps, getInputProps, isDragActive }}
            />
            <UploadDialogFooter controller={controller} />
          </form>
        </Dialog>
      </Dialog.Root>
      <CancelUploadDialog controller={controller} />
    </>
  );
}

function useUploadState(): UploadState {
  const [files, setFiles] = useState<FileWithStatus[]>([]);
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  return {
    files,
    description,
    uploading,
    showCancelConfirm,
    setFiles,
    setDescription,
    setUploading,
    setShowCancelConfirm,
  };
}

function useDocumentLimit(): {
  readonly usageStats: UsageStats | null | undefined;
  readonly atDocumentLimit: boolean;
} {
  return { usageStats: undefined, atDocumentLimit: false };
}

function useUploadController({
  organizationId,
  onOpenChange,
  onSuccess,
  organizationSlug,
}: Pick<
  UploadDialogProps,
  "organizationId" | "organizationSlug" | "onOpenChange" | "onSuccess"
>): UploadController {
  const state = useUploadState();
  const { track } = useAnalytics();
  const { usageStats, atDocumentLimit } = useDocumentLimit();
  const createDocumentMutation = useMutation({
    mutationFn: (input: CreateDocumentInput) =>
      createDocument(organizationSlug, input),
  });
  const uploadDocumentMutation = useMutation({
    mutationFn: (variables: {
      publicId: string;
      contentBase64: string;
      contentType: string;
    }) =>
      uploadDocument(
        organizationSlug,
        variables.publicId,
        variables.contentBase64,
        variables.contentType
      ),
  });

  const clearAndClose = () => {
    state.setFiles([]);
    state.setDescription("");
    onOpenChange(false);
  };

  const updateFile = (index: number, patch: Partial<FileWithStatus>) => {
    state.setFiles((prev) =>
      prev.map((fileWithStatus, fileIndex) =>
        fileIndex === index ? { ...fileWithStatus, ...patch } : fileWithStatus
      )
    );
  };

  const handleDrop = async (
    acceptedFiles: File[],
    rejectedFiles: FileRejection[]
  ) => {
    showRejectedFileErrors(rejectedFiles);
    const validatedFiles = await buildUploadFiles(acceptedFiles);
    state.setFiles((prev) => [...prev, ...validatedFiles]);
  };

  const uploadFile = (fileWithStatus: FileWithStatus, index: number) =>
    uploadSingleFileWithRetry({
      fileWithStatus,
      index,
      organizationId,
      description: state.description,
      createDocument: (input) => createDocumentMutation.mutateAsync(input),
      uploadDocument: (publicId, contentBase64, contentType) =>
        uploadDocumentMutation.mutateAsync({
          publicId,
          contentBase64,
          contentType,
        }),
      updateFile,
      trackDocumentUploaded: track.documentUploaded,
    });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (state.files.length === 0) {
      toast.error("Please select at least one file");
      return;
    }

    state.setUploading(true);
    try {
      const results = await Promise.allSettled(state.files.map(uploadFile));
      const summary = summarizeUploadResults(results);
      showUploadSummary(summary);
      if (summary.failureCount === 0) {
        clearAndClose();
        onSuccess?.();
      }
    } finally {
      state.setUploading(false);
    }
  };

  return {
    files: state.files,
    description: state.description,
    uploading: state.uploading,
    showCancelConfirm: state.showCancelConfirm,
    usageStats,
    atDocumentLimit,
    handleDrop,
    handleSubmit,
    removeFile: (index) =>
      state.setFiles((prev) =>
        prev.filter((_, fileIndex) => fileIndex !== index)
      ),
    requestClose: () =>
      state.uploading ? state.setShowCancelConfirm(true) : clearAndClose(),
    confirmCancel: () => {
      clearAndClose();
      state.setShowCancelConfirm(false);
    },
    setDescription: state.setDescription,
    setShowCancelConfirm: state.setShowCancelConfirm,
  };
}

function UploadDialogHeader() {
  return (
    <>
      <Dialog.Title>Upload Documents</Dialog.Title>
      <Dialog.Description>
        Drag and drop files here or click to browse. Maximum file size:{" "}
        {getMaxFileSizeDisplay()}. Supported types:{" "}
        {getSupportedFileTypesDisplay()}.
      </Dialog.Description>
    </>
  );
}

function UsageLimitNotice({
  atDocumentLimit,
  usageStats,
}: {
  readonly atDocumentLimit: boolean;
  readonly usageStats: UsageStats | null | undefined;
}) {
  return (
    <>
      {usageStats && <UsageCounter usageStats={usageStats} />}
      {atDocumentLimit && <DocumentLimitAlert usageStats={usageStats} />}
    </>
  );
}

function UsageCounter({ usageStats }: { readonly usageStats: UsageStats }) {
  const isOverLimit =
    usageStats.documentsThisMonth >= usageStats.documentsLimit;
  return (
    <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
      <span className="text-muted-foreground">Documents this month</span>
      <span
        className={isOverLimit ? "text-destructive font-medium" : "font-medium"}
      >
        {usageStats.documentsThisMonth} / {usageStats.documentsLimit}
      </span>
    </div>
  );
}

function DocumentLimitAlert({
  usageStats,
}: {
  readonly usageStats: UsageStats | null | undefined;
}) {
  return (
    <div className="border-destructive/50 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
      You've reached your monthly document limit.{" "}
      {usageStats?.plan === "free" && (
        <span>Upgrade to Professional for up to 500 documents per month.</span>
      )}
    </div>
  );
}

function UploadDialogBody({
  controller,
  dropzone,
}: {
  readonly controller: UploadController;
  readonly dropzone: {
    readonly getRootProps: ReturnType<typeof useDropzone>["getRootProps"];
    readonly getInputProps: ReturnType<typeof useDropzone>["getInputProps"];
    readonly isDragActive: boolean;
  };
}) {
  return (
    <div className="flex-1 space-y-4 overflow-y-auto py-4">
      <DropzoneArea
        getInputProps={dropzone.getInputProps}
        getRootProps={dropzone.getRootProps}
        isDragActive={dropzone.isDragActive}
        uploading={controller.uploading}
      />
      <DescriptionField controller={controller} />
      <SelectedFileList controller={controller} />
    </div>
  );
}

function DropzoneArea({
  getInputProps,
  getRootProps,
  isDragActive,
  uploading,
}: {
  readonly getInputProps: ReturnType<typeof useDropzone>["getInputProps"];
  readonly getRootProps: ReturnType<typeof useDropzone>["getRootProps"];
  readonly isDragActive: boolean;
  readonly uploading: boolean;
}) {
  return (
    <div
      {...getRootProps()}
      className={cn(
        "cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors",
        isDragActive
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-primary/50",
        uploading && "cursor-not-allowed opacity-50"
      )}
    >
      <input {...getInputProps()} />
      <Upload className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
      {isDragActive ? (
        <p className="text-primary text-sm font-medium">Drop files here...</p>
      ) : (
        <>
          <p className="mb-1 text-sm font-medium">
            Drag & drop a document here, or click to select
          </p>
          <p className="text-muted-foreground text-xs">
            PDF, DOCX, XLSX, PPTX, or CSV — one file at a time
          </p>
        </>
      )}
    </div>
  );
}

function DescriptionField({
  controller,
}: {
  readonly controller: UploadController;
}) {
  if (controller.files.length === 0) return null;

  return (
    <div className="grid gap-2">
      <Label htmlFor="description">Description (optional)</Label>
      <Input
        id="description"
        type="text"
        placeholder="Add a description..."
        value={controller.description}
        onChange={(event) => controller.setDescription(event.target.value)}
        disabled={controller.uploading}
      />
    </div>
  );
}

function SelectedFileList({
  controller,
}: {
  readonly controller: UploadController;
}) {
  if (controller.files.length === 0) return null;

  return (
    <div className="space-y-2">
      <Label>Selected File</Label>
      <div className="max-h-[300px] space-y-2 overflow-y-auto rounded-md border p-2">
        {controller.files.map((fileWithStatus, index) => (
          <SelectedFileRow
            key={`${fileWithStatus.file.name}-${index}`}
            fileWithStatus={fileWithStatus}
            index={index}
            removeFile={controller.removeFile}
            uploading={controller.uploading}
          />
        ))}
      </div>
    </div>
  );
}

function SelectedFileRow({
  fileWithStatus,
  index,
  removeFile,
  uploading,
}: {
  readonly fileWithStatus: FileWithStatus;
  readonly index: number;
  readonly removeFile: (index: number) => void;
  readonly uploading: boolean;
}) {
  return (
    <div className="bg-muted/50 flex items-start gap-3 rounded-md p-3">
      <FilePreview fileWithStatus={fileWithStatus} />
      <FileDetails fileWithStatus={fileWithStatus} />
      {fileWithStatus.status === "pending" && !uploading && (
        <Button
          type="button"
          variant="ghost"
          className="h-8 w-8"
          aria-label={`Remove ${fileWithStatus.file.name}`}
          onClick={() => removeFile(index)}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

function FilePreview({
  fileWithStatus,
}: {
  readonly fileWithStatus: FileWithStatus;
}) {
  if (!fileWithStatus.thumbnail) return getStatusIcon(fileWithStatus.status);

  return (
    <div className="flex-shrink-0">
      <img
        src={fileWithStatus.thumbnail}
        alt="PDF Preview"
        className="border-border h-20 w-16 rounded border object-cover"
      />
    </div>
  );
}

function FileDetails({
  fileWithStatus,
}: {
  readonly fileWithStatus: FileWithStatus;
}) {
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="truncate text-sm font-medium">
          {fileWithStatus.file.name}
        </p>
      </div>
      <FileMetadata fileWithStatus={fileWithStatus} />
      <UploadProgressBar fileWithStatus={fileWithStatus} />
      {fileWithStatus.status === "error" && fileWithStatus.error && (
        <p className="text-destructive mt-1 text-xs">{fileWithStatus.error}</p>
      )}
    </div>
  );
}

function FileMetadata({
  fileWithStatus,
}: {
  readonly fileWithStatus: FileWithStatus;
}) {
  return (
    <p className="text-muted-foreground mb-2 text-xs">
      {formatFileSize(fileWithStatus.file.size)}
      <PageCountText fileWithStatus={fileWithStatus} />
      <RetryCountText fileWithStatus={fileWithStatus} />
    </p>
  );
}

function PageCountText({
  fileWithStatus,
}: {
  readonly fileWithStatus: FileWithStatus;
}) {
  if (fileWithStatus.pageCount === undefined || fileWithStatus.pageCount <= 0)
    return null;
  return (
    <span className="ml-2">
      - {fileWithStatus.pageCount}{" "}
      {fileWithStatus.pageCount === 1 ? "page" : "pages"}
    </span>
  );
}

function RetryCountText({
  fileWithStatus,
}: {
  readonly fileWithStatus: FileWithStatus;
}) {
  if (fileWithStatus.retryCount === undefined || fileWithStatus.retryCount <= 0)
    return null;
  return (
    <span className="text-warning ml-2">
      (Retry {fileWithStatus.retryCount}/{MAX_RETRIES})
    </span>
  );
}

function UploadProgressBar({
  fileWithStatus,
}: {
  readonly fileWithStatus: FileWithStatus;
}) {
  if (
    fileWithStatus.status !== "uploading" ||
    fileWithStatus.progress === undefined
  )
    return null;
  return (
    <Meter
      label="Upload"
      value={fileWithStatus.progress}
      max={100}
      customValue={`${fileWithStatus.progress}%`}
      className="mt-2"
    />
  );
}

function UploadDialogFooter({
  controller,
}: {
  readonly controller: UploadController;
}) {
  return (
    <div className="mt-4 flex flex-col-reverse justify-end gap-2 sm:flex-row">
      <Button type="button" variant="outline" onClick={controller.requestClose}>
        Cancel
      </Button>
      <Button
        type="submit"
        variant="primary"
        disabled={
          controller.uploading ||
          controller.files.length === 0 ||
          controller.atDocumentLimit
        }
      >
        {controller.uploading ? "Uploading..." : "Upload Document"}
      </Button>
    </div>
  );
}

function CancelUploadDialog({
  controller,
}: {
  readonly controller: UploadController;
}) {
  return (
    <Dialog.Root
      open={controller.showCancelConfirm}
      onOpenChange={controller.setShowCancelConfirm}
    >
      <Dialog>
        <Dialog.Title>Cancel upload?</Dialog.Title>
        <Dialog.Description>
          Upload is in progress. Canceling will stop all ongoing uploads.
        </Dialog.Description>
        <div className="mt-4 flex flex-col-reverse justify-end gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={() => controller.setShowCancelConfirm(false)}
          >
            Continue uploading
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={controller.confirmCancel}
          >
            Cancel upload
          </Button>
        </div>
      </Dialog>
    </Dialog.Root>
  );
}

async function buildUploadFiles(
  files: readonly File[]
): Promise<FileWithStatus[]> {
  const uploadFiles = await Promise.all(
    files.map((file) => buildUploadFile(file))
  );
  return uploadFiles.flatMap((uploadFile) => (uploadFile ? [uploadFile] : []));
}

async function buildUploadFile(file: File): Promise<FileWithStatus | null> {
  const validation = validateFileForUpload(file);
  if (!validation.valid) {
    toast.error(`${file.name}: ${validation.errors.join(", ")}`);
    return null;
  }

  const metadata =
    file.type === "application/pdf"
      ? await extractPdfMetadata(file)
      : { pageCount: undefined, thumbnail: null };
  return {
    file,
    status: "pending",
    pageCount: metadata.pageCount,
    thumbnail: metadata.thumbnail,
  };
}

function showRejectedFileErrors(rejectedFiles: readonly FileRejection[]) {
  if (rejectedFiles.length === 0) return;
  const errorMessages = rejectedFiles.map((rejection) => {
    const errors = rejection.errors.map((error) => error.message).join(", ");
    return `${rejection.file.name}: ${errors}`;
  });
  toast.error(`Some files were rejected: ${errorMessages.join("; ")}`);
}

async function uploadSingleFileWithRetry(
  input: UploadSingleFileInput,
  retryCount = 0
): Promise<boolean> {
  if (retryCount > MAX_RETRIES) return false;
  const outcome = await uploadSingleFileAttempt(input, retryCount);
  if (outcome === "success") return true;
  if (outcome === "retry") {
    await sleep(getRetryDelay(retryCount));
    return uploadSingleFileWithRetry(input, retryCount + 1);
  }
  return false;
}

async function uploadSingleFileAttempt(
  input: UploadSingleFileInput,
  retryCount: number
): Promise<"success" | "retry" | "failure"> {
  try {
    await createUploadedDocument(input, retryCount);
    markUploadSuccess(input);
    return "success";
  } catch (error) {
    return handleUploadError(input, error, retryCount);
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Failed to read file as data URL"));
        return;
      }
      resolve(reader.result.split(",")[1] ?? "");
    });
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

async function createUploadedDocument(
  input: UploadSingleFileInput,
  retryCount: number
) {
  const { file } = input.fileWithStatus;
  input.updateFile(input.index, {
    status: "uploading",
    progress: 0,
    retryCount,
  });
  input.updateFile(input.index, { progress: 10 });

  const contentBase64 = await fileToBase64(file);
  input.updateFile(input.index, { progress: 40 });

  const created = await input.createDocument(buildCreateDocumentInput(input));
  input.updateFile(input.index, { progress: 60 });

  await input.uploadDocument(created.publicId, contentBase64, file.type);
  input.updateFile(input.index, { progress: 90 });
}

function buildCreateDocumentInput(
  input: UploadSingleFileInput
): CreateDocumentInput {
  const { file, pageCount, thumbnail } = input.fileWithStatus;
  return {
    name: file.name,
    description: input.description || undefined,
    fileSize: file.size,
    contentType: file.type,
    pageCount,
    thumbnailDataUrl: thumbnail || undefined,
  };
}

function markUploadSuccess(input: UploadSingleFileInput) {
  const { file, pageCount } = input.fileWithStatus;
  input.updateFile(input.index, { status: "success", progress: 100 });
  input.trackDocumentUploaded({
    fileSize: file.size,
    pageCount,
    fileType: file.type,
  });
}

function handleUploadError(
  input: UploadSingleFileInput,
  error: unknown,
  retryCount: number
): "retry" | "failure" {
  const errorMessage = error instanceof Error ? error.message : "Upload failed";
  if (isRetryableUploadError(error, errorMessage) && retryCount < MAX_RETRIES) {
    const nextRetryCount = retryCount + 1;
    toast.info(
      `Network error. Retrying upload (${nextRetryCount}/${MAX_RETRIES})...`
    );
    input.updateFile(input.index, {
      status: "uploading",
      progress: 0,
      retryCount: nextRetryCount,
    });
    return "retry";
  }

  input.updateFile(input.index, {
    status: "error",
    error: errorMessage,
    progress: 0,
  });
  return "failure";
}

function isRetryableUploadError(error: unknown, errorMessage: string): boolean {
  return (
    error instanceof TypeError ||
    errorMessage.includes("fetch") ||
    errorMessage.includes("network") ||
    errorMessage.includes("Failed to fetch")
  );
}

function summarizeUploadResults(
  results: readonly PromiseSettledResult<boolean>[]
): {
  readonly successCount: number;
  readonly failureCount: number;
} {
  const successCount = results.filter(
    (result) => result.status === "fulfilled" && result.value
  ).length;
  return { successCount, failureCount: results.length - successCount };
}

function showUploadSummary({
  failureCount,
  successCount,
}: {
  readonly failureCount: number;
  readonly successCount: number;
}) {
  if (successCount > 0) {
    toast.success(
      `${successCount} ${successCount === 1 ? "document" : "documents"} uploaded successfully`
    );
  }
  if (failureCount > 0) {
    toast.error(
      `${failureCount} ${failureCount === 1 ? "document" : "documents"} failed to upload`
    );
  }
}

function getStatusIcon(status: FileWithStatus["status"]) {
  switch (status) {
    case "success":
      return <CheckCircle2 className="text-success h-4 w-4" />;
    case "error":
      return <AlertCircle className="text-destructive h-4 w-4" />;
    case "uploading":
      return (
        <div className="border-primary h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
      );
    default:
      return <FileIcon className="text-muted-foreground h-4 w-4" />;
  }
}
