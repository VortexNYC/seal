import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { Upload, X, FileIcon, CheckCircle2, AlertCircle } from "lucide-react";
import { useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { toast } from "sonner";
import {
	ALLOWED_FILE_EXTENSIONS,
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
}

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

	const onDrop = (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
		// Handle rejected files
		if (rejectedFiles.length > 0) {
			const errorMessages = rejectedFiles.map((rejection) => {
				const errors = rejection.errors
					.map((e) => e.message)
					.join(", ");
				return `${rejection.file.name}: ${errors}`;
			});
			toast.error(`Some files were rejected: ${errorMessages.join("; ")}`);
		}

		// Validate and add accepted files
		const validatedFiles: FileWithStatus[] = [];
		for (const file of acceptedFiles) {
			const validation = validateFileForUpload(file);
			if (validation.valid) {
				validatedFiles.push({
					file,
					status: "pending",
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
		multiple: true,
	});

	const removeFile = (index: number) => {
		setFiles((prev) => prev.filter((_, i) => i !== index));
	};

	const uploadSingleFile = async (
		fileWithStatus: FileWithStatus,
		index: number,
	): Promise<boolean> => {
		const { file } = fileWithStatus;

		try {
			// Update status to uploading
			setFiles((prev) =>
				prev.map((f, i) =>
					i === index ? { ...f, status: "uploading" as const } : f,
				),
			);

			// Step 1: Generate upload URL
			const uploadUrl = await generateUploadUrl({});

			// Step 2: Upload file to Convex Storage
			const result = await fetch(uploadUrl, {
				method: "POST",
				headers: { "Content-Type": file.type },
				body: file,
			});

			if (!result.ok) {
				throw new Error("Upload failed");
			}

			const { storageId } = await result.json();

			// Step 3: Create document record
			await createDocument({
				organizationId,
				name: file.name,
				description: description || undefined,
				fileSize: file.size,
				fileType: file.type,
				storageId,
			});

			// Update status to success
			setFiles((prev) =>
				prev.map((f, i) =>
					i === index ? { ...f, status: "success" as const } : f,
				),
			);

			return true;
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Upload failed";

			// Update status to error
			setFiles((prev) =>
				prev.map((f, i) =>
					i === index
						? { ...f, status: "error" as const, error: errorMessage }
						: f,
				),
			);

			return false;
		}
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
				return <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />;
			default:
				return <FileIcon className="h-4 w-4 text-muted-foreground" />;
		}
	};

	return (
		<>
			<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[625px] max-h-[80vh] flex flex-col">
				<form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
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
										Drag & drop files here, or click to select
									</p>
									<p className="text-xs text-muted-foreground">
										Supports multiple files
									</p>
								</>
							)}
						</div>

						{/* Description Field */}
						{files.length > 0 && (
							<div className="grid gap-2">
								<Label htmlFor="description">
									Description (optional, applies to all files)
								</Label>
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
								<Label>Selected Files ({files.length})</Label>
								<div className="space-y-2 max-h-[300px] overflow-y-auto border rounded-md p-2">
									{files.map((fileWithStatus, index) => (
										<div
											key={index}
											className="flex items-start gap-3 p-3 bg-muted/50 rounded-md"
										>
											{getStatusIcon(fileWithStatus.status)}
											<div className="flex-1 min-w-0">
												<p className="text-sm font-medium truncate">
													{fileWithStatus.file.name}
												</p>
												<p className="text-xs text-muted-foreground">
													{formatFileSize(fileWithStatus.file.size)}
												</p>
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
							{uploading
								? `Uploading ${files.filter((f) => f.status === "uploading").length}/${files.length}...`
								: `Upload ${files.length} ${files.length === 1 ? "File" : "Files"}`}
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
