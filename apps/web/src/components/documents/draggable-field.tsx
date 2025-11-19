import type Konva from "konva";
import { useEffect, useRef } from "react";
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
	recipientId?: string; // Optional for newly placed fields
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
 * Friendly labels for each field type
 */
const FIELD_LABELS: Record<FieldType, string> = {
	signature: "Signature",
	text: "Text Input",
	date: "Date",
	checkbox: "Checkbox",
};

/**
 * Helper text inside each field to hint at its intent
 */
const FIELD_HINTS: Record<FieldType, string> = {
	signature: "",
	text: "Enter details",
	date: "",
	checkbox: "Tap to approve",
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
 * Convert a hex color (#RRGGBB) to rgba so we can control transparency
 */
const hexToRgba = (hex: string, alpha: number) => {
	const sanitized = hex.replace("#", "");
	const r = Number.parseInt(sanitized.slice(0, 2), 16);
	const g = Number.parseInt(sanitized.slice(2, 4), 16);
	const b = Number.parseInt(sanitized.slice(4, 6), 16);
	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
	const label = FIELD_LABELS[field.fieldType];
	const hint = FIELD_HINTS[field.fieldType];

	// Always show label for non-checkbox fields, but adjust styling based on size
	const isSmallField = field.width < 110;
	const showBadge = field.fieldType !== "checkbox";

	// Debug logging
	console.log('Field rendering:', {
		fieldType: field.fieldType,
		width: field.width,
		isSmallField,
		label
	});
	const badgeWidth = Math.max(
		0,
		Math.min(field.width - 24, 180),
	);
	const contentOffset = showBadge && !isSmallField ? 40 : 16;

	// Update transformer when selection changes
	useEffect(() => {
		if (isSelected && trRef.current && shapeRef.current) {
			// Attach transformer to the shape
			trRef.current.nodes([shapeRef.current]);
			trRef.current.getLayer()?.batchDraw();
		}
	}, [isSelected]);

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

	const renderFieldContents = () => {
		if (field.fieldType === "checkbox") {
			const boxSize = Math.min(field.width, field.height) - 10;
			const safeBoxSize = Math.max(18, boxSize);
			const boxX = (field.width - safeBoxSize) / 2;
			const boxY = (field.height - safeBoxSize) / 2;

			return (
				<>
					<Rect
						x={boxX}
						y={boxY}
						width={safeBoxSize}
						height={safeBoxSize}
						cornerRadius={6}
						stroke={color}
						strokeWidth={2}
						fill="#fff"
					/>
					<Text
						x={boxX}
						y={boxY - 2}
						width={safeBoxSize}
						height={safeBoxSize}
						align="center"
						verticalAlign="middle"
						text="✓"
						fontSize={safeBoxSize - 8}
						fontFamily="Inter, system-ui, -apple-system, sans-serif"
						fill={color}
						opacity={0.8}
						listening={false}
					/>
				</>
			);
		}

		// For non-checkbox fields with hints
		// Calculate the available space below the label for centering the hint
		const labelHeight = 30; // Approximate height taken by the label (y=10 + fontSize~13 + padding)
		const availableHeight = field.height - labelHeight;
		const hintY = labelHeight + (availableHeight / 2) - 7; // Center in available space, -7 to account for fontSize/2

		return (
			<>
				{hint && !isSmallField && (
					<Text
						x={16}
						y={hintY}
						width={field.width - 32}
						text={hint}
						fontSize={13}
						fontFamily="Inter, system-ui, -apple-system, sans-serif"
						fontStyle="500"
						fill="#0f172a"
						opacity={0.75}
						align="center"
						listening={false}
					/>
				)}
			</>
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
				draggable={isSelected}
				onClick={onSelect}
				onTap={onSelect}
				onDragEnd={handleDragEnd}
				onTransformEnd={handleTransformEnd}
			>
				{/* Field background */}
				<Rect
					width={field.width}
					height={field.height}
					fill={hexToRgba(color, isSelected ? 0.25 : 0.14)}
					stroke={color}
					strokeWidth={isSelected ? 3 : 2}
					cornerRadius={10}
					shadowColor={hexToRgba("#000000", 0.25)}
					shadowBlur={isSelected ? 10 : 6}
					shadowOpacity={0.15}
					shadowOffsetY={3}
				/>

				{/* Field label badge */}
					{showBadge && !isSmallField && (
						<Text
							x={0}
							y={0}
							width={field.width}
							height={field.height}
							text={label}
							fontSize={13}
							fontFamily="Inter, system-ui, -apple-system, sans-serif"
							fontStyle="600"
							fill="#0f172a"
							opacity={0.8}
							align="center"
							verticalAlign="middle"
							listening={false}
						/>
					)}
					{showBadge && isSmallField && (
						<Text
							x={0}
							y={0}
							width={field.width}
							height={field.height}
							text={label}
							fontSize={11}
							fontFamily="Inter, system-ui, -apple-system, sans-serif"
							fontStyle="600"
							fill="#0f172a"
							opacity={0.8}
							align="center"
							verticalAlign="middle"
							listening={false}
						/>
					)}

				{renderFieldContents()}
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
