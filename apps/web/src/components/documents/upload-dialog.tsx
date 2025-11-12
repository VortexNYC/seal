import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { AlertCircle, CheckCircle2, FileIcon, Upload, X } from "lucide-react";
import { useState } from "react";
import { type FileRejection, useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { extractPdfMetadata } from "../../lib/pdf-utils";
import {
	DROPZONE_ACCEPT_TYPES,
	formatFileSize,
	getMaxFileSizeDisplay,
	getSupportedFileTypesDisplay,
	validateFileForUpload,
} from "../../lib/upload-validation";
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
	progress?: number; // Upload progress percentage (0-100)
	retryCount?: number; // Number of retry attempts
	pageCount?: number; // Number of pages in PDF (SEA-64)
	thumbnail?: string | null; // PDF thumbnail data URL (SEA-64)
}

// Constants for retry logic (SEA-63)
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

// Helper: Sleep function for retry delays
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper: Calculate exponential backoff delay
const getRetryDelay = (retryCount: number): number => {
	return INITIAL_RETRY_DELAY * 2 ** retryCount; // 1s, 2s, 4s
};

export function UploadDialog({
	organizationId,
	open,
	onOpenChange,
	onSuccess,
}: UploadDialogProps) {
	const [files, setFiles] = useState<FileWithStatus[]>([]);
	const [description, setDescription] = useState("");
	const [uploading, setUploading] = useState(false);
	const [showCancelConfirm, setShowCancelConfirm] = useState(false);

	const generateUploadUrl = useMutation(
		api.documents.mutations.generateUploadUrl,
	);
	const createDocument = useMutation(api.documents.mutations.createDocument);

	const onDrop = async (
		acceptedFiles: File[],
		rejectedFiles: FileRejection[],
	) => {
		// Handle rejected files
		if (rejectedFiles.length > 0) {
			const errorMessages = rejectedFiles.map((rejection) => {
				const errors = rejection.errors.map((e) => e.message).join(", ");
				return `${rejection.file.name}: ${errors}`;
			});
			toast.error(`Some files were rejected: ${errorMessages.join("; ")}`);
		}

		// Validate and add accepted files
		const validatedFiles: FileWithStatus[] = [];
		for (const file of acceptedFiles) {
			const validation = validateFileForUpload(file);
			if (validation.valid) {
				// SEA-64: Extract PDF metadata (page count and thumbnail)
				const metadata = await extractPdfMetadata(file);

				validatedFiles.push({
					file,
					status: "pending",
					pageCount: metadata.pageCount,
					thumbnail: metadata.thumbnail,
				});
			} else {
				toast.error(`${file.name}: ${validation.errors.join(", ")}`);
			}
		}

		setFiles((prev) => [...prev, ...validatedFiles]);
	};

	const { getRootProps, getInputProps, isDragActive } = useDropzone({
		onDrop,
		accept: DROPZONE_ACCEPT_TYPES,
		disabled: uploading,
		multiple: false, // SEA-62: One file at a time
		maxFiles: 1, // SEA-62: One file at a time
	});

	const removeFile = (index: number) => {
		setFiles((prev) => prev.filter((_, i) => i !== index));
	};

	const uploadSingleFile = async (
		fileWithStatus: FileWithStatus,
		index: number,
	): Promise<boolean> => {
		const { file } = fileWithStatus;
		let retryCount = 0;

		while (retryCount <= MAX_RETRIES) {
			try {
				// Update status to uploading with progress
				setFiles((prev) =>
					prev.map((f, i) =>
						i === index
							? {
									...f,
									status: "uploading" as const,
									progress: 0,
									retryCount,
								}
							: f,
					),
				);

				// Step 1: Generate upload URL (10% progress)
				setFiles((prev) =>
					prev.map((f, i) => (i === index ? { ...f, progress: 10 } : f)),
				);
				const uploadUrl = await generateUploadUrl({});

				// Step 2: Upload file to Convex Storage with progress tracking (SEA-63)
				setFiles((prev) =>
					prev.map((f, i) => (i === index ? { ...f, progress: 20 } : f)),
				);

				const result = await fetch(uploadUrl, {
					method: "POST",
					headers: { "Content-Type": file.type },
					body: file,
				});

				if (!result.ok) {
					throw new Error(
						`Upload failed with status ${result.status}: ${result.statusText}`,
					);
				}

				// Update progress to 70% after successful upload
				setFiles((prev) =>
					prev.map((f, i) => (i === index ? { ...f, progress: 70 } : f)),
				);

				const { storageId } = await result.json();

				// Step 3: Create document record (90% progress)
				setFiles((prev) =>
					prev.map((f, i) => (i === index ? { ...f, progress: 90 } : f)),
				);

				await createDocument({
					organizationId,
					name: file.name,
					description: description || undefined,
					fileSize: file.size,
					fileType: file.type,
					storageId,
					pageCount: fileWithStatus.pageCount, // SEA-64: Include page count
				});

				// Update status to success (100% progress)
				setFiles((prev) =>
					prev.map((f, i) =>
						i === index
							? { ...f, status: "success" as const, progress: 100 }
							: f,
					),
				);

				return true;
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : "Upload failed";

				// Check if we should retry (SEA-63: Network interruptions trigger retry)
				const isNetworkError =
					error instanceof TypeError ||
					errorMessage.includes("fetch") ||
					errorMessage.includes("network") ||
					errorMessage.includes("Failed to fetch");

				if (isNetworkError && retryCount < MAX_RETRIES) {
					retryCount++;
					const delay = getRetryDelay(retryCount - 1);

					// Show retry notification
					toast.info(
						`Network error. Retrying upload (${retryCount}/${MAX_RETRIES})...`,
					);

					// Update file with retry count
					setFiles((prev) =>
						prev.map((f, i) =>
							i === index
								? {
										...f,
										status: "uploading" as const,
										progress: 0,
										retryCount,
									}
								: f,
						),
					);

					// Wait with exponential backoff
					await sleep(delay);
					continue; // Retry the upload
				}

				// No more retries or non-network error - mark as failed
				setFiles((prev) =>
					prev.map((f, i) =>
						i === index
							? {
									...f,
									status: "error" as const,
									error: errorMessage,
									progress: 0,
								}
							: f,
					),
				);

				return false;
			}
		}

		return false;
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (files.length === 0) {
			toast.error("Please select at least one file");
			return;
		}

		setUploading(true);

		try {
			// Upload all files
			const results = await Promise.allSettled(
				files.map((fileWithStatus, index) =>
					uploadSingleFile(fileWithStatus, index),
				),
			);

			// Count successes and failures
			const successCount = results.filter(
				(r) => r.status === "fulfilled" && r.value === true,
			).length;
			const failureCount = results.length - successCount;

			if (successCount > 0) {
				toast.success(
					`${successCount} ${successCount === 1 ? "document" : "documents"} uploaded successfully`,
				);
			}

			if (failureCount > 0) {
				toast.error(
					`${failureCount} ${failureCount === 1 ? "document" : "documents"} failed to upload`,
				);
			}

			// If all succeeded, close dialog
			if (failureCount === 0) {
				setFiles([]);
				setDescription("");
				onOpenChange(false);
				onSuccess?.();
			}
		} finally {
			setUploading(false);
		}
	};

	const getStatusIcon = (status: FileWithStatus["status"]) => {
		switch (status) {
			case "success":
				return <CheckCircle2 className="h-4 w-4 text-green-500" />;
			case "error":
				return <AlertCircle className="h-4 w-4 text-red-500" />;
			case "uploading":
				return (
					<div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
				);
			default:
				return <FileIcon className="h-4 w-4 text-muted-foreground" />;
		}
	};

	return (
		<>
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent className="sm:max-w-[625px] max-h-[80vh] flex flex-col">
					<form
						onSubmit={handleSubmit}
						className="flex flex-col flex-1 min-h-0"
					>
						<DialogHeader>
							<DialogTitle>Upload Documents</DialogTitle>
							<DialogDescription>
								Drag and drop files here or click to browse. Maximum file size:{" "}
								{getMaxFileSizeDisplay()}. Supported types:{" "}
								{getSupportedFileTypesDisplay()}.
							</DialogDescription>
						</DialogHeader>

						<div className="flex-1 overflow-y-auto py-4 space-y-4">
							{/* Dropzone Area */}
							<div
								{...getRootProps()}
								className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
									isDragActive
										? "border-primary bg-primary/5"
										: "border-muted-foreground/25 hover:border-primary/50"
								} ${uploading ? "opacity-50 cursor-not-allowed" : ""}`}
							>
								<input {...getInputProps()} />
								<Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
								{isDragActive ? (
									<p className="text-sm text-primary font-medium">
										Drop files here...
									</p>
								) : (
									<>
										<p className="text-sm font-medium mb-1">
											Drag & drop a PDF file here, or click to select
										</p>
										<p className="text-xs text-muted-foreground">
											PDF files only, one at a time
										</p>
									</>
								)}
							</div>

							{/* Description Field */}
							{files.length > 0 && (
								<div className="grid gap-2">
									<Label htmlFor="description">Description (optional)</Label>
									<Input
										id="description"
										type="text"
										placeholder="Add a description..."
										value={description}
										onChange={(e) => setDescription(e.target.value)}
										disabled={uploading}
									/>
								</div>
							)}

							{/* File List */}
							{files.length > 0 && (
								<div className="space-y-2">
									<Label>Selected File</Label>
									<div className="space-y-2 max-h-[300px] overflow-y-auto border rounded-md p-2">
										{files.map((fileWithStatus, index) => (
											<div
												key={index}
												className="flex items-start gap-3 p-3 bg-muted/50 rounded-md"
											>
												{/* SEA-64: PDF Thumbnail */}
												{fileWithStatus.thumbnail ? (
													<div className="flex-shrink-0">
														<img
															src={fileWithStatus.thumbnail}
															alt="PDF Preview"
															className="w-16 h-20 object-cover rounded border border-border"
														/>
													</div>
												) : (
													getStatusIcon(fileWithStatus.status)
												)}
												<div className="flex-1 min-w-0">
													<div className="flex items-center justify-between gap-2 mb-1">
														<p className="text-sm font-medium truncate">
															{fileWithStatus.file.name}
														</p>
														{fileWithStatus.status === "uploading" &&
															fileWithStatus.progress !== undefined && (
																<span className="text-xs font-medium text-primary">
																	{fileWithStatus.progress}%
																</span>
															)}
													</div>
													<p className="text-xs text-muted-foreground mb-2">
														{formatFileSize(fileWithStatus.file.size)}
														{fileWithStatus.pageCount !== undefined &&
															fileWithStatus.pageCount > 0 && (
																<span className="ml-2">
																	• {fileWithStatus.pageCount}{" "}
																	{fileWithStatus.pageCount === 1
																		? "page"
																		: "pages"}
																</span>
															)}
														{fileWithStatus.retryCount !== undefined &&
															fileWithStatus.retryCount > 0 && (
																<span className="ml-2 text-orange-500">
																	(Retry {fileWithStatus.retryCount}/
																	{MAX_RETRIES})
																</span>
															)}
													</p>
													{fileWithStatus.status === "uploading" &&
														fileWithStatus.progress !== undefined && (
															<Progress
																value={fileWithStatus.progress}
																className="h-1.5"
															/>
														)}
													{fileWithStatus.status === "error" &&
														fileWithStatus.error && (
															<p className="text-xs text-red-500 mt-1">
																{fileWithStatus.error}
															</p>
														)}
												</div>
												{fileWithStatus.status === "pending" && !uploading && (
													<Button
														type="button"
														variant="ghost"
														size="icon"
														className="h-8 w-8"
														onClick={() => removeFile(index)}
													>
														<X className="h-4 w-4" />
													</Button>
												)}
											</div>
										))}
									</div>
								</div>
							)}
						</div>

						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => {
									if (uploading) {
										setShowCancelConfirm(true);
									} else {
										setFiles([]);
										setDescription("");
										onOpenChange(false);
									}
								}}
							>
								Cancel
							</Button>
							<Button type="submit" disabled={uploading || files.length === 0}>
								{uploading ? "Uploading..." : "Upload PDF"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			<AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Cancel upload?</AlertDialogTitle>
						<AlertDialogDescription>
							Upload is in progress. Canceling will stop all ongoing uploads.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Continue uploading</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								setFiles([]);
								setDescription("");
								onOpenChange(false);
								setShowCancelConfirm(false);
							}}
						>
							Cancel upload
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
