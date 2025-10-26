import { useMutation } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@seal/backend/convex/_generated/api";
import { useState } from "react";
import { toast } from "sonner";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import type { Id } from "@seal/backend/convex/_generated/dataModel";

interface UploadDialogProps {
	organizationId: Id<"organizations">;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess?: () => void;
}

export function UploadDialog({
	organizationId,
	open,
	onOpenChange,
	onSuccess,
}: UploadDialogProps) {
	const [file, setFile] = useState<File | null>(null);
	const [description, setDescription] = useState("");
	const [uploading, setUploading] = useState(false);

	const uploadMutation = useMutation({
		mutationFn: async () => {
			if (!file) {
				throw new Error("No file selected");
			}

			setUploading(true);

			try {
				// Step 1: Generate upload URL
				const uploadUrl = await convexQuery(api.documents.mutations.generateUploadUrl, {});

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
				await convexQuery(api.documents.mutations.createDocument, {
					organizationId,
					name: file.name,
					description: description || undefined,
					fileSize: file.size,
					fileType: file.type,
					storageId,
				});

				return { success: true };
			} finally {
				setUploading(false);
			}
		},
		onSuccess: () => {
			toast.success("Document uploaded successfully");
			setFile(null);
			setDescription("");
			onOpenChange(false);
			onSuccess?.();
		},
		onError: (error: Error) => {
			toast.error(`Upload failed: ${error.message}`);
		},
	});

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const selectedFile = e.target.files?.[0];
		if (selectedFile) {
			setFile(selectedFile);
		}
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!file) {
			toast.error("Please select a file");
			return;
		}
		uploadMutation.mutate();
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[525px]">
				<form onSubmit={handleSubmit}>
					<DialogHeader>
						<DialogTitle>Upload Document</DialogTitle>
						<DialogDescription>
							Upload a document to your workspace. It will be private by default.
						</DialogDescription>
					</DialogHeader>

					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<Label htmlFor="file">File</Label>
							<Input
								id="file"
								type="file"
								onChange={handleFileChange}
								disabled={uploading}
								required
							/>
							{file && (
								<p className="text-sm text-muted-foreground">
									Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
								</p>
							)}
						</div>

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
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
							disabled={uploading}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={uploading || !file}>
							{uploading ? "Uploading..." : "Upload"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
