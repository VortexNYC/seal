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

function getSealIconSize(height: number, width: number): number {
	const baseDimension = Math.min(height, width);
	return Math.max(10, Math.min(20, baseDimension * 0.5));
}

function SealFieldIcon({
	size,
	containerHeight,
}: {
	size: number;
	containerHeight: number;
}) {
	const containerWidth = size + 6;
	return (
		<div
			className="flex items-center justify-center rounded-l-sm bg-white/95 shadow-sm border-r border-gray-200/50"
			style={{
				width: containerWidth,
				height: containerHeight,
			}}
		>
			<img
				src="/logo/seal-icon-color-no-background.svg"
				alt=""
				aria-hidden="true"
				style={{
					width: size,
					height: size,
				}}
			/>
		</div>
	);
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

	// Check if this is a filled field that should show the stamp
	const isFilledField = isFilled && signatureDetails;

	// Format signature date if available
	const formattedDate = signatureDetails
		? formatSignatureDate(signatureDetails.signedAt)
		: null;

	const sealIconSize = getSealIconSize(absoluteHeight, absoluteWidth);

	if (isFilledField && signatureDetails) {
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
				<div className="absolute left-0 top-0 z-20">
					<SealFieldIcon size={sealIconSize} containerHeight={absoluteHeight} />
				</div>
				{absoluteHeight >= 50 && (
					<div
						className="bg-white/90 py-2 pr-2 h-full flex flex-col justify-center"
						style={{ paddingLeft: sealIconSize + 12 }}
					>
						<div className="flex flex-col gap-0.5">
							{/* Field type */}
							<div className="flex items-baseline gap-1">
								<span className="text-[9px] text-gray-500">
									{getFieldTypeLabel(fieldType)}
								</span>
							</div>
							{/* Signer name */}
							<div className="flex items-baseline gap-1">
								<span className="text-[9px] text-gray-500">Signed by:</span>
								<span className="text-[10px] font-semibold text-gray-800 truncate">
									{signatureDetails.signerName || signatureDetails.signerEmail}
								</span>
							</div>
							{/* Date and time */}
							{formattedDate && (
								<div className="flex items-baseline gap-1">
									<span className="text-[9px] text-gray-500">Date:</span>
									<span className="text-[9px] text-gray-700">
										{formattedDate.date} at {formattedDate.time}
									</span>
								</div>
							)}
						</div>
					</div>
				)}

				{absoluteHeight < 50 && absoluteHeight >= 30 && (
					<div
						className="bg-white/90 py-0.5 pr-1 h-full flex flex-col justify-center"
						style={{ paddingLeft: sealIconSize + 10 }}
					>
						<div className="text-[7px] text-gray-600">
							<div className="truncate font-medium">
								{getFieldTypeLabel(fieldType)}
							</div>
							<div className="truncate text-[6px] mt-0.5">
								{signatureDetails.signerName || signatureDetails.signerEmail}
							</div>
							{formattedDate && (
								<div className="truncate text-[6px] mt-0.5">
									{formattedDate.date} at {formattedDate.time}
								</div>
							)}
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
			<div className="absolute left-0 top-0 z-20">
				<SealFieldIcon size={sealIconSize} containerHeight={absoluteHeight} />
			</div>
			<div
				className="flex flex-col items-center justify-center gap-0.5 p-1 w-full h-full"
				style={{ paddingLeft: sealIconSize + 10 }}
			>
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

				{validationError && (
					<div className="text-[10px] text-destructive mt-1 max-w-[200px]">
						⚠ {validationError}
					</div>
				)}
			</div>
		</button>
	);
});
