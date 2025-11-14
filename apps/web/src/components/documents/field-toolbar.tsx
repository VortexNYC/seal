import {
	CalendarIcon,
	CheckSquareIcon,
	PenToolIcon,
	TypeIcon,
} from "lucide-react";
import { useState } from "react";
import { Card } from "../ui/card";

export type FieldType = "signature" | "text" | "date" | "checkbox";

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

		// Create a custom drag image to prevent layout shifts
		const dragImage = e.currentTarget.cloneNode(true) as HTMLElement;
		dragImage.style.position = "absolute";
		dragImage.style.top = "-9999px";
		document.body.appendChild(dragImage);
		e.dataTransfer.setDragImage(dragImage, 50, 25);

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
