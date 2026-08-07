import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { AlertCircle, CheckCircle2, FileIcon, Upload, X } from "lucide-react";
import { useState } from "react";
import { type FileRejection, useDropzone } from "react-dropzone";
import { toast } from "sonner";

import { useAnalytics } from "../../hooks/use-analytics";
import { parseId } from "../../lib/convex-ids";
import { extractPdfMetadata } from "../../lib/pdf-utils";
import {
  DROPZONE_ACCEPT_TYPES,
  formatFileSize,
  getMaxFileSizeDisplay,
  getSupportedFileTypesDisplay,
  validateFileForUpload,
} from "../../lib/upload-validation";
import { cn } from "../../lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
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
import { Progress } from "../ui/progress";

interface UploadDialogProps {
  organizationId: Id<"organizations">;
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
  organizationId: Id<"organizations">;
  name: string;
  description?: string;
  fileSize: number;
  fileType: string;
  storageId: Id<"_storage">;
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
  readonly organizationId: Id<"organizations">;
  readonly description: string;
  readonly generateUploadUrl: () => Promise<string>;
  readonly createDocument: (input: CreateDocumentInput) => Promise<unknown>;
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
  open,
  onOpenChange,
  onSuccess,
}: UploadDialogProps) {
  const controller = useUploadController({
    organizationId,
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
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[80vh] flex-col sm:max-w-[625px]">
          <form
            onSubmit={controller.handleSubmit}
            className="flex min-h-0 flex-1 flex-col"
          >
            <UploadDialogHeader />
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
        </DialogContent>
      </Dialog>
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
  const usageStats = useQuery(api.user_profiles.queries.getUsageStatistics);
  const isTestDeployment = import.meta.env.VITE_CONVEX_URL?.includes(
    "coordinated-lemur"
  );
  const atDocumentLimit =
    !isTestDeployment &&
    usageStats !== undefined &&
    usageStats !== null &&
    usageStats.documentsThisMonth >= usageStats.documentsLimit;

  return { usageStats, atDocumentLimit };
}

function useUploadController({
  organizationId,
  onOpenChange,
  onSuccess,
}: Pick<
  UploadDialogProps,
  "organizationId" | "onOpenChange" | "onSuccess"
>): UploadController {
  const state = useUploadState();
  const { track } = useAnalytics();
  const { usageStats, atDocumentLimit } = useDocumentLimit();
  const generateUploadUrl = useMutation(
    api.documents.mutations.generateUploadUrl
  );
  const createDocument = useMutation(api.documents.mutations.createDocument);

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
      generateUploadUrl: () => generateUploadUrl({}),
      createDocument,
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
    <DialogHeader>
      <DialogTitle>Upload Documents</DialogTitle>
      <DialogDescription>
        Drag and drop files here or click to browse. Maximum file size:{" "}
        {getMaxFileSizeDisplay()}. Supported types:{" "}
        {getSupportedFileTypesDisplay()}.
      </DialogDescription>
    </DialogHeader>
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
            Drag & drop a PDF file here, or click to select
          </p>
          <p className="text-muted-foreground text-xs">
            PDF files only, one at a time
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
          size="icon"
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
        <UploadProgressText fileWithStatus={fileWithStatus} />
      </div>
      <FileMetadata fileWithStatus={fileWithStatus} />
      <UploadProgressBar fileWithStatus={fileWithStatus} />
      {fileWithStatus.status === "error" && fileWithStatus.error && (
        <p className="text-destructive mt-1 text-xs">{fileWithStatus.error}</p>
      )}
    </div>
  );
}

function UploadProgressText({
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
    <span className="text-primary text-xs font-medium">
      {fileWithStatus.progress}%
    </span>
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
  return <Progress value={fileWithStatus.progress} className="h-1.5" />;
}

function UploadDialogFooter({
  controller,
}: {
  readonly controller: UploadController;
}) {
  return (
    <DialogFooter>
      <Button type="button" variant="outline" onClick={controller.requestClose}>
        Cancel
      </Button>
      <Button
        type="submit"
        disabled={
          controller.uploading ||
          controller.files.length === 0 ||
          controller.atDocumentLimit
        }
      >
        {controller.uploading ? "Uploading..." : "Upload PDF"}
      </Button>
    </DialogFooter>
  );
}

function CancelUploadDialog({
  controller,
}: {
  readonly controller: UploadController;
}) {
  return (
    <AlertDialog
      open={controller.showCancelConfirm}
      onOpenChange={controller.setShowCancelConfirm}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel upload?</AlertDialogTitle>
          <AlertDialogDescription>
            Upload is in progress. Canceling will stop all ongoing uploads.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Continue uploading</AlertDialogCancel>
          <AlertDialogAction onClick={controller.confirmCancel}>
            Cancel upload
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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

  const metadata = await extractPdfMetadata(file);
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
  const uploadUrl = await input.generateUploadUrl();
  input.updateFile(input.index, { progress: 20 });

  const result = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!result.ok) {
    throw new Error(
      `Upload failed with status ${result.status}: ${result.statusText}`
    );
  }

  input.updateFile(input.index, { progress: 70 });
  const responseBody: unknown = await result.json();
  if (
    typeof responseBody !== "object" ||
    responseBody === null ||
    !("storageId" in responseBody) ||
    typeof responseBody.storageId !== "string"
  ) {
    throw new Error("Upload response did not include a storage id");
  }
  const storageId = parseId("_storage", responseBody.storageId);
  input.updateFile(input.index, { progress: 90 });
  await input.createDocument(buildCreateDocumentInput(input, storageId));
}

function buildCreateDocumentInput(
  input: UploadSingleFileInput,
  storageId: Id<"_storage">
): CreateDocumentInput {
  const { file, pageCount, thumbnail } = input.fileWithStatus;
  return {
    organizationId: input.organizationId,
    name: file.name,
    description: input.description || undefined,
    fileSize: file.size,
    fileType: file.type,
    storageId,
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
