import type { Id } from "@seal/backend/convex/_generated/dataModel";
import type { FieldType } from "@seal/backend/convex/schemas/signature_fields";
import {
	CalendarIcon,
	CheckSquareIcon,
	ChevronDownIcon,
	CircleDotIcon,
	FileIcon,
	PenToolIcon,
	StarIcon,
	TypeIcon,
} from "lucide-react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface SignatureDetails {
	signedAt: number;
	signerName?: string;
	signerEmail?: string;
	signatureMethod?: string;
}

interface FillableFieldOverlayProps {
	fieldId: Id<"signature_fields">;
	fieldType: FieldType;
	label: string;
	isRequired: boolean;
	isMainSignature?: boolean;
	x: number; // Percentage
	y: number; // Percentage
	width: number; // Percentage
	height: number; // Percentage
	page: number;
	currentPage: number;
	pdfPageWidth: number;
	pdfPageHeight: number;
	value?: string;
	signatureImageUrl?: string;
	isFilled: boolean;
	isActive?: boolean;
	validationError?: string;
	signatureDetails?: SignatureDetails;
	onClick: (fieldId: Id<"signature_fields">) => void;
}

function getFieldIcon(fieldType: FieldType) {
	switch (fieldType) {
		case "signature":
			return <PenToolIcon className="h-3 w-3" />;
		case "text":
			return <TypeIcon className="h-3 w-3" />;
		case "date":
			return <CalendarIcon className="h-3 w-3" />;
		case "checkbox":
			return <CheckSquareIcon className="h-3 w-3" />;
		case "dropdown":
			return <ChevronDownIcon className="h-3 w-3" />;
		case "radio":
			return <CircleDotIcon className="h-3 w-3" />;
		case "attachment":
			return <FileIcon className="h-3 w-3" />;
		default:
			return <TypeIcon className="h-3 w-3" />;
	}
}

function getFieldTypeLabel(fieldType: FieldType): string {
	switch (fieldType) {
		case "signature":
			return "Signature";
		case "text":
			return "Text";
		case "date":
			return "Date";
		case "checkbox":
			return "Checkbox";
		case "dropdown":
			return "Dropdown";
		case "radio":
			return "Radio";
		case "attachment":
			return "Attachment";
		default:
			return fieldType;
	}
}

// Format date for signature stamp display
function formatSignatureDate(timestamp: number): {
	date: string;
	time: string;
} {
	const date = new Date(timestamp);
	return {
		date: date.toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
		}),
		time: date.toLocaleTimeString("en-US", {
			hour: "2-digit",
			minute: "2-digit",
			hour12: true,
		}),
	};
}

export const FillableFieldOverlay = forwardRef<
	HTMLButtonElement,
	FillableFieldOverlayProps
>(function FillableFieldOverlay(
	{
		fieldId,
		fieldType,
		label,
		isRequired,
		isMainSignature = false,
		x,
		y,
		width,
		height,
		page,
		currentPage,
		pdfPageWidth,
		pdfPageHeight,
		value,
		signatureImageUrl,
		isFilled,
		isActive = false,
		validationError,
		signatureDetails,
		onClick,
	},
	ref,
) {
	// Only render on the correct page
	if (page !== currentPage) {
		return null;
	}

	// Calculate absolute position from percentages
	const absoluteX = (x / 100) * pdfPageWidth;
	const absoluteY = (y / 100) * pdfPageHeight;
	const absoluteWidth = (width / 100) * pdfPageWidth;
	const absoluteHeight = (height / 100) * pdfPageHeight;

	// Check if this is a filled signature field that should show the stamp
	const isFilledSignature =
		isFilled && fieldType === "signature" && signatureDetails;

	// Format signature date if available
	const formattedDate = signatureDetails
		? formatSignatureDate(signatureDetails.signedAt)
		: null;

	// For filled signature fields, render a non-interactive display with signature stamp
	if (isFilledSignature && signatureDetails) {
		return (
			<div
				className="absolute rounded-sm overflow-hidden bg-gray-50/80 border border-gray-300"
				style={{
					left: `${absoluteX}px`,
					top: `${absoluteY}px`,
					width: `${absoluteWidth}px`,
					height: `${absoluteHeight}px`,
				}}
			>
				{/* Signature image area */}
				<div
					className="relative flex items-center justify-center"
					style={{ height: `${Math.max(absoluteHeight - 36, 20)}px` }}
				>
					{signatureImageUrl ? (
						<img
							src={signatureImageUrl}
							alt="Signature"
							className="max-w-full max-h-full object-contain p-1"
						/>
					) : value ? (
						<span className="text-lg font-semibold text-gray-800 italic">
							{value}
						</span>
					) : null}
				</div>

				{/* Signature stamp details - DocuSign style */}
				{absoluteHeight >= 50 && (
					<div className="border-t border-gray-300 bg-white/90 px-2 py-1">
						<div className="flex flex-col gap-0.5">
							{/* Signer name */}
							<div className="flex items-baseline gap-1">
								<span className="text-[8px] text-gray-500">Signed by:</span>
								<span className="text-[9px] font-semibold text-gray-800 truncate">
									{signatureDetails.signerName || signatureDetails.signerEmail}
								</span>
							</div>
							{/* Date and time */}
							{formattedDate && (
								<div className="flex items-baseline gap-1">
									<span className="text-[8px] text-gray-500">Date:</span>
									<span className="text-[8px] text-gray-700">
										{formattedDate.date} at {formattedDate.time}
									</span>
								</div>
							)}
						</div>
					</div>
				)}

				{/* Compact stamp for smaller fields */}
				{absoluteHeight < 50 && absoluteHeight >= 30 && (
					<div className="absolute bottom-0 left-0 right-0 bg-white/90 border-t border-gray-300 px-1 py-0.5">
						<div className="text-[7px] text-gray-600 truncate">
							{signatureDetails.signerName || signatureDetails.signerEmail} •{" "}
							{formattedDate?.date}
						</div>
					</div>
				)}
			</div>
		);
	}

	return (
		<button
			ref={ref}
			type="button"
			onClick={() => onClick(fieldId)}
			className={cn(
				"absolute border-2 rounded-sm transition-all cursor-pointer group",
				"hover:border-primary hover:bg-primary/5",
				"flex items-center justify-center text-xs",
				isFilled
					? "border-green-500 bg-green-50/50"
					: isRequired
						? "border-red-400 bg-red-50/30"
						: "border-blue-400 bg-blue-50/30",
				isActive &&
					"ring-2 ring-primary ring-offset-2 border-primary animate-pulse",
				isMainSignature && !isActive && "ring-2 ring-yellow-500",
			)}
			style={{
				left: `${absoluteX}px`,
				top: `${absoluteY}px`,
				width: `${absoluteWidth}px`,
				height: `${absoluteHeight}px`,
			}}
			title={`${label}${isRequired ? " (Required)" : ""}${isMainSignature ? " - Main Signature" : ""} - Click to fill`}
		>
			<div className="flex flex-col items-center justify-center gap-0.5 p-1">
				<div className="flex items-center gap-1">
					{isMainSignature && <StarIcon className="h-3 w-3 text-yellow-600" />}
					{getFieldIcon(fieldType)}
					{absoluteWidth > 80 && (
						<span className="text-[10px] font-medium truncate max-w-[60px]">
							{getFieldTypeLabel(fieldType)}
						</span>
					)}
				</div>
				{isFilled && absoluteHeight > 25 && (
					<div className="text-[9px] text-green-700 font-medium">✓ Filled</div>
				)}
				{!isFilled && isRequired && absoluteHeight > 25 && (
					<div className="text-[9px] text-red-700 font-medium">Required</div>
				)}
				{isMainSignature && absoluteHeight > 30 && (
					<div className="text-[8px] text-yellow-700 font-medium">
						Document Signature
					</div>
				)}
			</div>

			{/* Hover tooltip for smaller fields */}
			<div className="absolute left-0 top-full mt-1 hidden group-hover:block z-10 bg-popover text-popover-foreground border rounded-md shadow-md p-2 text-xs whitespace-nowrap">
				<div className="font-medium">{label}</div>
				<div className="text-muted-foreground text-[10px]">
					{getFieldTypeLabel(fieldType)}
					{isRequired && " • Required"}
				</div>
				{isFilled && value && fieldType !== "signature" && (
					<div className="text-[10px] text-green-700 mt-1 max-w-[200px] truncate">
						Value: {value}
					</div>
				)}
				{validationError && (
					<div className="text-[10px] text-destructive mt-1 max-w-[200px]">
						⚠ {validationError}
					</div>
				)}
			</div>
		</button>
	);
});
