import {
	CalendarIcon,
	GripVerticalIcon,
	PenToolIcon,
	TypeIcon,
} from "lucide-react";
import { useState } from "react";
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
	onDragStart: (fieldType: FieldType) => void;
	onDragEnd: () => void;
}

/**
 * Field type configurations
 */
const FIELD_CONFIG: Record<
	FieldType,
	{
		label: string;
		accentColor: string;
	}
> = {
	signature: {
		label: "Signature",
		accentColor: "#3b82f6",
	},
	text: {
		label: "Text",
		accentColor: "#22c55e",
	},
	date: {
		label: "Date",
		accentColor: "#8b5cf6",
	},
	checkbox: {
		label: "Check",
		accentColor: "#f97316",
	},
	dropdown: {
		label: "Select",
		accentColor: "#06b6d4",
	},
	radio: {
		label: "Choice",
		accentColor: "#ec4899",
	},
	attachment: {
		label: "File",
		accentColor: "#84cc16",
	},
};

/**
 * Draggable field button
 */
function FieldButton({
	type,
	icon,
	label,
	onDragStart,
	onDragEnd,
}: FieldButtonProps) {
	const [isDragging, setIsDragging] = useState(false);
	const [isHovered, setIsHovered] = useState(false);
	const config = FIELD_CONFIG[type];

	const handleDragStart = (e: React.DragEvent) => {
		setIsDragging(true);
		e.dataTransfer.effectAllowed = "copy";
		e.dataTransfer.setData("fieldType", type);

		// Create drag image
		const dimensions = FIELD_DIMENSIONS[type];
		const dragImage = document.createElement("div");
		dragImage.style.cssText = `
			position: absolute;
			top: -9999px;
			width: ${dimensions.width}px;
			height: ${dimensions.height}px;
			background: ${config.accentColor}10;
			border: 2px dashed ${config.accentColor};
			border-radius: 6px;
			display: flex;
			align-items: center;
			justify-content: center;
			font-family: system-ui, sans-serif;
			font-size: 12px;
			font-weight: 600;
			color: #374151;
			letter-spacing: 0.5px;
			text-transform: uppercase;
		`;
		dragImage.textContent = config.label;

		document.body.appendChild(dragImage);
		e.dataTransfer.setDragImage(
			dragImage,
			dimensions.width / 2,
			dimensions.height / 2,
		);

		requestAnimationFrame(() => {
			document.body.removeChild(dragImage);
		});

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
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
			className={`group relative flex items-center gap-2 px-3 py-2.5 bg-white border border-gray-200 rounded-lg cursor-grab transition-colors hover:border-gray-300 active:cursor-grabbing ${
				isDragging ? "opacity-40 scale-95 border-dashed" : ""
			}`}
		>
			<div className="flex items-center text-gray-400 group-hover:text-gray-500 transition-colors">
				<GripVerticalIcon className="w-3 h-3" />
			</div>
			<div
				className="flex items-center justify-center w-7 h-7 border rounded-md transition-colors"
				style={{
					backgroundColor: isHovered ? config.accentColor : "white",
					borderColor: isHovered ? config.accentColor : "#e5e7eb",
					color: isHovered ? "white" : "#4b5563",
				}}
			>
				{icon}
			</div>
			<span className="text-sm font-medium text-gray-700">{label}</span>
		</button>
	);
}

/**
 * Field toolbar - Provides draggable field types for document annotation
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
		<div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
			<div className="flex items-baseline justify-between mb-3 pb-2.5 border-b border-dashed border-gray-300">
				<span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
					Fields
				</span>
				<span className="text-[9px] font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
					Drag to place
				</span>
			</div>

			<div className="grid grid-cols-2 gap-2">
				<FieldButton
					type="signature"
					icon={<PenToolIcon className="w-4 h-4" />}
					label="Signature"
					onDragStart={handleDragStart}
					onDragEnd={handleDragEnd}
				/>

				<FieldButton
					type="text"
					icon={<TypeIcon className="w-4 h-4" />}
					label="Text"
					onDragStart={handleDragStart}
					onDragEnd={handleDragEnd}
				/>

				<FieldButton
					type="date"
					icon={<CalendarIcon className="w-4 h-4" />}
					label="Date"
					onDragStart={handleDragStart}
					onDragEnd={handleDragEnd}
				/>

				{/* TODO: Re-enable checkbox field once multi-option rendering is complete
				<FieldButton
					type="checkbox"
					icon={<CheckSquareIcon className="w-4 h-4" />}
					label="Checkbox"
					onDragStart={handleDragStart}
					onDragEnd={handleDragEnd}
				/>
				*/}
			</div>
		</div>
	);
}
