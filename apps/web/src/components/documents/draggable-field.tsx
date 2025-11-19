import type Konva from "konva";
import { useRef } from "react";
import { Group, Rect, Text, Transformer } from "react-konva";
import type { FieldType } from "./field-toolbar";

export interface PlacedField {
	id: string;
	fieldType: FieldType;
	x: number;
	y: number;
	width: number;
	height: number;
	pageNumber: number;
}

interface DraggableFieldProps {
	field: PlacedField;
	isSelected: boolean;
	onSelect: () => void;
	onDragEnd: (x: number, y: number) => void;
	onTransformEnd: (x: number, y: number, width: number, height: number) => void;
}

/**
 * Map field types to colors
 */
const FIELD_COLORS: Record<FieldType, string> = {
	signature: "#3b82f6", // blue
	text: "#10b981", // green
	date: "#8b5cf6", // purple
	checkbox: "#f97316", // orange
};

/**
 * Map field types to icons (as text for now, will render Lucide icons via HTML layer later)
 */
const FIELD_ICONS: Record<FieldType, string> = {
	signature: "✍️",
	text: "T",
	date: "📅",
	checkbox: "☑",
};

/**
 * Default field dimensions
 */
export const FIELD_DIMENSIONS: Record<
	FieldType,
	{ width: number; height: number }
> = {
	signature: { width: 200, height: 60 },
	text: { width: 200, height: 40 },
	date: { width: 150, height: 40 },
	checkbox: { width: 30, height: 30 },
};

/**
 * Draggable and resizable field component on the canvas
 * SEA-90: Field placement, repositioning, and resizing
 */
export function DraggableField({
	field,
	isSelected,
	onSelect,
	onDragEnd,
	onTransformEnd,
}: DraggableFieldProps) {
	const shapeRef = useRef<Konva.Group>(null);
	const trRef = useRef<Konva.Transformer>(null);

	const color = FIELD_COLORS[field.fieldType];
	const icon = FIELD_ICONS[field.fieldType];

	// Update transformer when selection changes
	if (isSelected && trRef.current && shapeRef.current) {
		trRef.current.nodes([shapeRef.current]);
		trRef.current.getLayer()?.batchDraw();
	}

	const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
		const node = e.target as Konva.Group;
		onDragEnd(node.x(), node.y());
	};

	const handleTransformEnd = () => {
		const node = shapeRef.current;
		if (!node) return;

		const scaleX = node.scaleX();
		const scaleY = node.scaleY();

		// Reset scale and apply to width/height instead
		node.scaleX(1);
		node.scaleY(1);

		onTransformEnd(
			node.x(),
			node.y(),
			Math.max(30, node.width() * scaleX),
			Math.max(20, node.height() * scaleY),
		);
	};

	return (
		<>
			<Group
				ref={shapeRef}
				x={field.x}
				y={field.y}
				width={field.width}
				height={field.height}
				draggable
				onClick={onSelect}
				onTap={onSelect}
				onDragEnd={handleDragEnd}
				onTransformEnd={handleTransformEnd}
			>
				{/* Field background */}
				<Rect
					width={field.width}
					height={field.height}
					fill={color}
					opacity={0.2}
					stroke={color}
					strokeWidth={2}
					cornerRadius={4}
				/>

				{/* Field icon */}
				<Text
					x={8}
					y={field.height / 2 - 10}
					text={icon}
					fontSize={16}
					fill={color}
				/>

				{/* Field type label */}
				<Text
					x={32}
					y={field.height / 2 - 8}
					text={field.fieldType.toUpperCase()}
					fontSize={12}
					fontStyle="bold"
					fill={color}
				/>
			</Group>

			{/* Transformer for resize handles - only shown when selected */}
			{isSelected && (
				<Transformer
					ref={trRef}
					boundBoxFunc={(oldBox, newBox) => {
						// Limit minimum size
						if (newBox.width < 30 || newBox.height < 20) {
							return oldBox;
						}
						return newBox;
					}}
					enabledAnchors={[
						"top-left",
						"top-right",
						"bottom-left",
						"bottom-right",
					]}
					rotateEnabled={false}
				/>
			)}
		</>
	);
}
