import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
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

export function UploadDialog({
	organizationId,
	open,
	onOpenChange,
	onSuccess,
}: UploadDialogProps) {
	const [file, setFile] = useState<File | null>(null);
	const [description, setDescription] = useState("");
	const [uploading, setUploading] = useState(false);

	const generateUploadUrl = useMutation(
		api.documents.mutations.generateUploadUrl,
	);
	const createDocument = useMutation(api.documents.mutations.createDocument);

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const selectedFile = e.target.files?.[0];
		if (selectedFile) {
			setFile(selectedFile);
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!file) {
			toast.error("Please select a file");
			return;
		}

		setUploading(true);

		try {
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

			toast.success("Document uploaded successfully");
			setFile(null);
			setDescription("");
			onOpenChange(false);
			onSuccess?.();
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Upload failed";
			toast.error(`Upload failed: ${errorMessage}`);
		} finally {
			setUploading(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[525px]">
				<form onSubmit={handleSubmit}>
					<DialogHeader>
						<DialogTitle>Upload Document</DialogTitle>
						<DialogDescription>
							Upload a document to your workspace. It will be private by
							default.
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
