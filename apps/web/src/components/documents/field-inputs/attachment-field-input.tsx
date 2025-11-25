import { FileIcon, UploadIcon, XIcon } from "lucide-react";
import { type ChangeEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface AttachmentFieldInputProps {
	label: string;
	value?: string; // URL to uploaded file
	isRequired: boolean;
	helpText?: string;
	onChange: (value: string) => void;
	onValidationChange: (isValid: boolean, error?: string) => void;
}

export function AttachmentFieldInput({
	label,
	value,
	isRequired,
	helpText,
	onChange,
	onValidationChange,
}: AttachmentFieldInputProps) {
	const [fileUrl, setFileUrl] = useState(value);
	const [fileName, setFileName] = useState<string | undefined>();
	const [error, setError] = useState<string | undefined>();
	const [isUploading, setIsUploading] = useState(false);

	const validateValue = (
		val?: string,
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

		setIsUploading(true);
		setFileName(file.name);

		try {
			// TODO: Implement actual file upload to Convex Storage
			// For now, convert to base64 as a placeholder
			const reader = new FileReader();
			reader.onload = () => {
				const base64 = reader.result as string;
				setFileUrl(base64);
				onChange(base64);

				const validation = validateValue(base64);
				setError(validation.error);
				onValidationChange(validation.isValid, validation.error);
				setIsUploading(false);
			};
			reader.onerror = () => {
				setError("Failed to read file");
				onValidationChange(false, "Failed to read file");
				setIsUploading(false);
			};
			reader.readAsDataURL(file);
		} catch (_err) {
			setError("Failed to upload file");
			onValidationChange(false, "Failed to upload file");
			setIsUploading(false);
		}
	};

	const handleRemove = () => {
		setFileUrl(undefined);
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

			{!fileUrl ? (
				<div className="border-2 border-dashed rounded-lg p-6 text-center">
					<input
						type="file"
						id="attachment-field"
						className="hidden"
						onChange={handleFileChange}
						disabled={isUploading}
					/>
					<label
						htmlFor="attachment-field"
						className="cursor-pointer flex flex-col items-center gap-2"
					>
						<UploadIcon className="h-8 w-8 text-muted-foreground" />
						<div className="text-sm text-muted-foreground">
							<span className="font-medium text-primary">Click to upload</span>{" "}
							or drag and drop
						</div>
						<div className="text-xs text-muted-foreground">
							Maximum file size: 10MB
						</div>
					</label>
				</div>
			) : (
				<div className="border rounded-lg p-4 flex items-center justify-between">
					<div className="flex items-center gap-2">
						<FileIcon className="h-5 w-5 text-muted-foreground" />
						<div>
							<div className="text-sm font-medium">
								{fileName || "Uploaded file"}
							</div>
							<div className="text-xs text-muted-foreground">File attached</div>
						</div>
					</div>
					<Button
						variant="ghost"
						size="sm"
						onClick={handleRemove}
						disabled={isUploading}
					>
						<XIcon className="h-4 w-4" />
					</Button>
				</div>
			)}

			{helpText && !error && (
				<p className="text-xs text-muted-foreground">{helpText}</p>
			)}
			{error && <p className="text-xs text-destructive">{error}</p>}
			{isUploading && (
				<p className="text-xs text-muted-foreground">Uploading...</p>
			)}
		</div>
	);
}
