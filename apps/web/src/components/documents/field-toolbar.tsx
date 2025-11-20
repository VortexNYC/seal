import {
	CalendarIcon,
	CheckSquareIcon,
	PenToolIcon,
	TypeIcon,
} from "lucide-react";
import { useState } from "react";
import { Card } from "../ui/card";
import { FIELD_DIMENSIONS } from "./draggable-field";

export type FieldType =
	| "signature"
	| "text"
	| "date"
	| "checkbox"
	| "dropdown"
	| "radio"
	| "attachment";

interface FieldToolbarProps {
	onFieldDragStart?: (fieldType: FieldType) => void;
	onFieldDragEnd?: () => void;
}

interface FieldButtonProps {
	type: FieldType;
	icon: React.ReactNode;
	label: string;
	color: string;
	onDragStart: (fieldType: FieldType) => void;
	onDragEnd: () => void;
}

/**
 * Map field types to colors and labels
 */
const FIELD_CONFIG: Record<
	FieldType,
	{
		label: string;
		hint: string;
		color: string;
		bgColor: string;
		borderColor: string;
	}
> = {
	signature: {
		label: "Signature",
		hint: "",
		color: "#3b82f6",
		bgColor: "rgba(59, 130, 246, 0.14)",
		borderColor: "#3b82f6",
	},
	text: {
		label: "Text Input",
		hint: "Enter details",
		color: "#10b981",
		bgColor: "rgba(16, 185, 129, 0.14)",
		borderColor: "#10b981",
	},
	date: {
		label: "Date",
		hint: "",
		color: "#8b5cf6",
		bgColor: "rgba(139, 92, 246, 0.14)",
		borderColor: "#8b5cf6",
	},
	checkbox: {
		label: "Checkbox",
		hint: "Tap to approve",
		color: "#f97316",
		bgColor: "rgba(249, 115, 22, 0.14)",
		borderColor: "#f97316",
	},
	dropdown: {
		label: "Dropdown",
		hint: "Select option",
		color: "#06b6d4",
		bgColor: "rgba(6, 182, 212, 0.14)",
		borderColor: "#06b6d4",
	},
	radio: {
		label: "Radio",
		hint: "Select one",
		color: "#ec4899",
		bgColor: "rgba(236, 72, 153, 0.14)",
		borderColor: "#ec4899",
	},
	attachment: {
		label: "Attachment",
		hint: "Upload file",
		color: "#84cc16",
		bgColor: "rgba(132, 204, 22, 0.14)",
		borderColor: "#84cc16",
	},
};

/**
 * Field button component with drag-and-drop functionality
 */
function FieldButton({
	type,
	icon,
	label,
	color,
	onDragStart,
	onDragEnd,
}: FieldButtonProps) {
	const [isDragging, setIsDragging] = useState(false);

	const handleDragStart = (e: React.DragEvent) => {
		setIsDragging(true);
		e.dataTransfer.effectAllowed = "copy";
		e.dataTransfer.setData("fieldType", type);

		// Create a custom drag image that looks like the actual field
		const dimensions = FIELD_DIMENSIONS[type];
		const config = FIELD_CONFIG[type];

		const dragImage = document.createElement("div");
		dragImage.style.position = "absolute";
		dragImage.style.top = "-9999px";
		dragImage.style.width = `${dimensions.width}px`;
		dragImage.style.height = `${dimensions.height}px`;
		dragImage.style.backgroundColor = config.bgColor;
		dragImage.style.border = `2px solid ${config.borderColor}`;
		dragImage.style.borderRadius = "10px";
		dragImage.style.boxShadow = "0 3px 6px rgba(0, 0, 0, 0.15)";
		dragImage.style.display = "flex";
		dragImage.style.flexDirection = "column";
		dragImage.style.padding = type === "checkbox" ? "5px" : "10px";
		dragImage.style.fontFamily = "Inter, system-ui, -apple-system, sans-serif";

		// Add label for non-checkbox fields
		if (type !== "checkbox") {
			const labelEl = document.createElement("div");
			labelEl.textContent = config.label;
			labelEl.style.fontSize = "13px";
			labelEl.style.fontWeight = "600";
			labelEl.style.color = "#0f172a";
			labelEl.style.opacity = "0.8";
			labelEl.style.textAlign = "center";
			labelEl.style.width = "100%";
			labelEl.style.flex = "1";
			labelEl.style.display = "flex";
			labelEl.style.alignItems = "center";
			labelEl.style.justifyContent = "center";
			dragImage.appendChild(labelEl);
		} else {
			// Checkbox rendering
			const checkboxContainer = document.createElement("div");
			checkboxContainer.style.display = "flex";
			checkboxContainer.style.alignItems = "center";
			checkboxContainer.style.justifyContent = "center";
			checkboxContainer.style.width = "100%";
			checkboxContainer.style.height = "100%";

			const checkbox = document.createElement("div");
			const boxSize = Math.min(dimensions.width, dimensions.height) - 10;
			checkbox.style.width = `${boxSize}px`;
			checkbox.style.height = `${boxSize}px`;
			checkbox.style.border = `2px solid ${config.color}`;
			checkbox.style.borderRadius = "6px";
			checkbox.style.backgroundColor = "#fff";
			checkbox.style.display = "flex";
			checkbox.style.alignItems = "center";
			checkbox.style.justifyContent = "center";
			checkbox.style.fontSize = `${boxSize - 8}px`;
			checkbox.style.color = config.color;
			checkbox.style.opacity = "0.8";
			checkbox.textContent = "✓";

			checkboxContainer.appendChild(checkbox);
			dragImage.appendChild(checkboxContainer);
		}

		document.body.appendChild(dragImage);
		e.dataTransfer.setDragImage(
			dragImage,
			dimensions.width / 2,
			dimensions.height / 2,
		);

		// Clean up drag image after a short delay
		setTimeout(() => {
			document.body.removeChild(dragImage);
		}, 0);

		onDragStart(type);
	};

	const handleDragEnd = () => {
		setIsDragging(false);
		onDragEnd();
	};

	return (
		<button
			type="button"
			draggable
			onDragStart={handleDragStart}
			onDragEnd={handleDragEnd}
			className={`
				flex flex-col items-center gap-2 p-4 rounded-lg border-2
				transition-opacity cursor-grab active:cursor-grabbing
				hover:border-${color}-500 hover:bg-${color}-50
				${isDragging ? "opacity-50" : "opacity-100"}
			`}
			style={{
				borderColor: isDragging ? `var(--${color}-500)` : "var(--border)",
			}}
		>
			<div
				className={`
				p-2 rounded-md
				${isDragging ? `bg-${color}-100` : "bg-muted"}
			`}
			>
				{icon}
			</div>
			<span className="text-sm font-medium">{label}</span>
		</button>
	);
}

/**
 * Field toolbar component for signature field placement
 * Provides draggable field types: Signature, Text, Date, Checkbox
 *
 * SEA-89: Field toolbar with drag-and-drop functionality
 */
export function FieldToolbar({
	onFieldDragStart,
	onFieldDragEnd,
}: FieldToolbarProps) {
	const handleDragStart = (fieldType: FieldType) => {
		onFieldDragStart?.(fieldType);
	};

	const handleDragEnd = () => {
		onFieldDragEnd?.();
	};

	return (
		<Card className="p-4">
			<div className="space-y-3">
				<div>
					<h3 className="text-sm font-semibold mb-2">Signature Fields</h3>
					<p className="text-xs text-muted-foreground mb-3">
						Drag fields onto the document
					</p>
				</div>

				<div className="grid grid-cols-2 gap-3">
					<FieldButton
						type="signature"
						icon={<PenToolIcon className="h-5 w-5" />}
						label="Signature"
						color="blue"
						onDragStart={handleDragStart}
						onDragEnd={handleDragEnd}
					/>

					<FieldButton
						type="text"
						icon={<TypeIcon className="h-5 w-5" />}
						label="Text"
						color="green"
						onDragStart={handleDragStart}
						onDragEnd={handleDragEnd}
					/>

					<FieldButton
						type="date"
						icon={<CalendarIcon className="h-5 w-5" />}
						label="Date"
						color="purple"
						onDragStart={handleDragStart}
						onDragEnd={handleDragEnd}
					/>

					<FieldButton
						type="checkbox"
						icon={<CheckSquareIcon className="h-5 w-5" />}
						label="Checkbox"
						color="orange"
						onDragStart={handleDragStart}
						onDragEnd={handleDragEnd}
					/>
				</div>

				<div className="pt-2 border-t">
					<p className="text-xs text-muted-foreground">
						💡 Tip: Drag a field onto the PDF to place it
					</p>
				</div>
			</div>
		</Card>
	);
}
