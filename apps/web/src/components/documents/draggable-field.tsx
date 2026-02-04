import type Konva from "konva";
import { useEffect, useRef, useState } from "react";
import { Group, Image as KonvaImage, Rect, Text, Transformer } from "react-konva";

import type { FieldType } from "./field-toolbar";
import { getRecipientColorById, type RecipientColor, UNASSIGNED_COLOR } from "./recipient-colors";

function useSealIcon(): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new window.Image();
    img.src = "/logo/seal-icon-color-no-background.svg";
    img.onload = () => setImage(img);
  }, []);

  return image;
}

// Helper to get field type label for display
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

export interface PlacedField {
  id: string;
  fieldType: FieldType;
  x: number;
  y: number;
  width: number;
  height: number;
  pageNumber: number;
  recipientId?: string;
  label?: string;
  properties?: {
    options?: string[];
    placeholder?: string;
    defaultValue?: string;
    helpText?: string;
  };
  /** Signature data if field has been filled */
  signatureData?: {
    signatureImageUrl?: string;
    value?: string;
    signedAt?: number;
    signerName?: string;
    signerEmail?: string;
    signatureMethod?: string;
  };
}

interface DraggableFieldProps {
  field: PlacedField;
  isSelected: boolean;
  onSelect: () => void;
  onDragEnd: (x: number, y: number) => void;
  onTransformEnd: (x: number, y: number, width: number, height: number) => void;
  /** Map of recipientId to index for color assignment */
  recipientIndexMap?: Map<string, number>;
  /** If true, use recipient colors instead of field type colors */
  useRecipientColors?: boolean;
}

/**
 * Craft-inspired field color palette
 * Deep ink colors with vibrant accents
 */
const FIELD_COLORS: Record<FieldType, { ink: string; accent: string; glow: string }> = {
  signature: {
    ink: "#1e3a5f",
    accent: "#3b82f6",
    glow: "rgba(59, 130, 246, 0.25)",
  },
  text: {
    ink: "#14532d",
    accent: "#22c55e",
    glow: "rgba(34, 197, 94, 0.25)",
  },
  date: {
    ink: "#4c1d95",
    accent: "#8b5cf6",
    glow: "rgba(139, 92, 246, 0.25)",
  },
  checkbox: {
    ink: "#7c2d12",
    accent: "#f97316",
    glow: "rgba(249, 115, 22, 0.25)",
  },
  dropdown: {
    ink: "#164e63",
    accent: "#06b6d4",
    glow: "rgba(6, 182, 212, 0.25)",
  },
  radio: {
    ink: "#831843",
    accent: "#ec4899",
    glow: "rgba(236, 72, 153, 0.25)",
  },
  attachment: {
    ink: "#3f6212",
    accent: "#84cc16",
    glow: "rgba(132, 204, 22, 0.25)",
  },
};

/**
 * Field type labels
 */
const FIELD_LABELS: Record<FieldType, string> = {
  signature: "Signature",
  text: "Text",
  date: "Date",
  checkbox: "",
  dropdown: "Select",
  radio: "Choice",
  attachment: "File",
};

/**
 * Default field dimensions
 */
export const FIELD_DIMENSIONS: Record<FieldType, { width: number; height: number }> = {
  signature: { width: 200, height: 50 },
  text: { width: 180, height: 36 },
  date: { width: 140, height: 36 },
  checkbox: { width: 28, height: 28 },
  dropdown: { width: 180, height: 36 },
  radio: { width: 140, height: 36 },
  attachment: { width: 180, height: 44 },
};

/**
 * Convert RecipientColor to the color format used by field rendering
 */
function recipientColorToFieldColors(recipientColor: RecipientColor): {
  ink: string;
  accent: string;
  glow: string;
} {
  // Create a darker version of the hex color for the ink
  const hex = recipientColor.hex;
  // Simple darkening - we'll use the hex color as accent and a darker version as ink
  return {
    ink: hex,
    accent: hex,
    glow: recipientColor.hexLight,
  };
}

/**
 * Draggable field component with craft-paper aesthetic
 * Renders on Konva canvas with transform handles
 */
export function DraggableField({
  field,
  isSelected,
  onSelect,
  onDragEnd,
  onTransformEnd,
  recipientIndexMap,
  useRecipientColors = false,
}: DraggableFieldProps) {
  const shapeRef = useRef<Konva.Group>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const sealIcon = useSealIcon();

  // Determine colors: use recipient colors if enabled, otherwise use field type colors
  const recipientColor = useRecipientColors
    ? getRecipientColorById(field.recipientId, recipientIndexMap ?? new Map())
    : null;

  const colors = recipientColor
    ? recipientColorToFieldColors(recipientColor)
    : FIELD_COLORS[field.fieldType];

  const isUnassigned =
    useRecipientColors && (!field.recipientId || recipientColor === UNASSIGNED_COLOR);

  const label = field.label || FIELD_LABELS[field.fieldType];
  const isCheckbox = field.fieldType === "checkbox";

  // Update transformer when selection changes
  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
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

    node.scaleX(1);
    node.scaleY(1);

    onTransformEnd(
      node.x(),
      node.y(),
      Math.max(30, node.width() * scaleX),
      Math.max(20, node.height() * scaleY),
    );
  };

  const renderCheckbox = () => {
    const options = field.properties?.options;

    // If no options, render single checkbox
    if (!options || options.length === 0) {
      const size = Math.min(field.width, field.height) - 6;
      const safeSize = Math.max(16, size);
      const x = (field.width - safeSize) / 2;
      const y = (field.height - safeSize) / 2;

      return (
        <>
          <Rect
            x={x}
            y={y}
            width={safeSize}
            height={safeSize}
            cornerRadius={4}
            stroke={colors.accent}
            strokeWidth={isSelected ? 2 : 1.5}
            fill="#ffffff"
          />
          <Text
            x={x}
            y={y}
            width={safeSize}
            height={safeSize}
            align="center"
            verticalAlign="middle"
            text="✓"
            fontSize={safeSize * 0.65}
            fontFamily="system-ui, sans-serif"
            fill={colors.accent}
            opacity={0.5}
            listening={false}
          />
        </>
      );
    }

    // Render checkbox group with options
    const checkboxSize = 14;
    const rowHeight = 22;
    const padding = 8;

    return (
      <>
        {/* Background */}
        <Rect
          width={field.width}
          height={field.height}
          fill="#ffffff"
          stroke={isSelected ? colors.accent : colors.ink}
          strokeWidth={isSelected ? 2 : 1}
          cornerRadius={6}
          shadowColor={isSelected ? colors.glow : "rgba(0,0,0,0.08)"}
          shadowBlur={isSelected ? 12 : 4}
          shadowOpacity={1}
          shadowOffsetY={isSelected ? 0 : 2}
          dash={[6, 3]}
          dashEnabled={!isSelected}
        />

        {/* Accent stripe */}
        <Rect
          x={0}
          y={0}
          width={4}
          height={field.height}
          fill={colors.accent}
          cornerRadius={[6, 0, 0, 6]}
          opacity={isSelected ? 1 : 0.7}
        />

        {/* Title */}
        {field.label && (
          <Text
            x={padding + 4}
            y={padding}
            text={field.label}
            fontSize={10}
            fontFamily="'DM Sans', system-ui, sans-serif"
            fontStyle="600"
            fill={colors.ink}
            opacity={0.7}
            listening={false}
          />
        )}

        {/* Options */}
        {options.map((option, index) => {
          const yPos = (field.label ? padding + 16 : padding) + index * rowHeight;
          return (
            <Group key={option} x={padding + 4} y={yPos}>
              {/* Checkbox box */}
              <Rect
                width={checkboxSize}
                height={checkboxSize}
                cornerRadius={3}
                stroke={colors.accent}
                strokeWidth={1.5}
                fill="#ffffff"
              />
              {/* Checkbox checkmark (faded) */}
              <Text
                width={checkboxSize}
                height={checkboxSize}
                align="center"
                verticalAlign="middle"
                text="✓"
                fontSize={10}
                fontFamily="system-ui, sans-serif"
                fill={colors.accent}
                opacity={0.3}
                listening={false}
              />
              {/* Option label */}
              <Text
                x={checkboxSize + 6}
                y={1}
                text={option}
                fontSize={11}
                fontFamily="'DM Sans', system-ui, sans-serif"
                fill="#374151"
                listening={false}
              />
            </Group>
          );
        })}
      </>
    );
  };

  const renderField = () => {
    const iconSize = Math.max(10, Math.min(16, field.height * 0.35));
    const sidebarWidth = iconSize + 16;
    const textOffsetX = sealIcon ? 4 + sidebarWidth + 10 : 12;

    return (
      <>
        <Rect
          width={field.width}
          height={field.height}
          fill={isUnassigned ? "#fafafa" : "#ffffff"}
          stroke={isSelected ? colors.accent : "#cbd5e1"}
          strokeWidth={isSelected ? 2 : 1}
          cornerRadius={6}
          shadowColor={isSelected ? colors.glow : "rgba(0,0,0,0.06)"}
          shadowBlur={isSelected ? 12 : 4}
          shadowOpacity={1}
          shadowOffsetY={isSelected ? 0 : 2}
          dash={isUnassigned ? [4, 4] : undefined}
          dashEnabled={isUnassigned}
        />

        <Rect
          x={0}
          y={0}
          width={4}
          height={field.height}
          fill={colors.accent}
          cornerRadius={[6, 0, 0, 6]}
          opacity={isSelected ? 1 : isUnassigned ? 0.5 : 0.9}
        />

        {sealIcon && (
          <Group x={4} y={0}>
            <Rect width={sidebarWidth} height={field.height} fill={colors.glow} opacity={0.3} />

            <Rect
              x={sidebarWidth}
              y={0}
              width={1}
              height={field.height}
              fill={colors.accent}
              opacity={0.15}
            />

            <KonvaImage
              image={sealIcon}
              x={(sidebarWidth - iconSize) / 2}
              y={(field.height - iconSize) / 2}
              width={iconSize}
              height={iconSize}
              opacity={0.85}
            />
          </Group>
        )}

        {label && (
          <Text
            x={textOffsetX}
            y={0}
            width={field.width - textOffsetX - 4}
            height={field.height}
            text={isUnassigned ? `${label} (unassigned)` : label}
            fontSize={11}
            fontFamily="'DM Sans', system-ui, sans-serif"
            fontStyle="600"
            fill={colors.ink}
            opacity={isUnassigned ? 0.6 : 0.85}
            align="left"
            verticalAlign="middle"
            letterSpacing={0.3}
            listening={false}
          />
        )}
      </>
    );
  };

  const renderFilledFieldStamp = () => {
    const iconSize = Math.max(10, Math.min(16, field.height * 0.35));
    const sidebarWidth = iconSize + 16;
    const textOffsetX = sealIcon ? 4 + sidebarWidth + 10 : 8;
    const availableWidth = field.width - textOffsetX - 4;
    const availableHeight = field.height - 8;

    const formatDate = (timestamp?: number) => {
      if (!timestamp) return { date: "", time: "" };
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
    };

    const formattedDate = formatDate(field.signatureData?.signedAt);
    const signerName =
      field.signatureData?.signerName || field.signatureData?.signerEmail || "Unknown";

    const isSmallField = availableHeight < 40;
    const titleFontSize = isSmallField ? 8 : 10;
    const detailFontSize = isSmallField ? 7 : 9;

    return (
      <>
        <Rect
          width={field.width}
          height={field.height}
          fill="#ffffff"
          stroke={isSelected ? colors.accent : "#22c55e"}
          strokeWidth={isSelected ? 2 : 1}
          cornerRadius={6}
          shadowColor={isSelected ? colors.glow : "rgba(34, 197, 94, 0.1)"}
          shadowBlur={isSelected ? 12 : 4}
          shadowOpacity={1}
          shadowOffsetY={isSelected ? 0 : 2}
        />

        <Rect
          x={0}
          y={0}
          width={4}
          height={field.height}
          fill="#22c55e"
          cornerRadius={[6, 0, 0, 6]}
        />

        {sealIcon && (
          <Group x={4} y={0}>
            <Rect width={sidebarWidth} height={field.height} fill="rgba(34, 197, 94, 0.08)" />
            <Rect
              x={sidebarWidth}
              y={0}
              width={1}
              height={field.height}
              fill="#22c55e"
              opacity={0.2}
            />
            <KonvaImage
              image={sealIcon}
              x={(sidebarWidth - iconSize) / 2}
              y={(field.height - iconSize) / 2}
              width={iconSize}
              height={iconSize}
              opacity={0.85}
            />
          </Group>
        )}

        <Text
          x={textOffsetX}
          y={4}
          width={availableWidth}
          text={getFieldTypeLabel(field.fieldType)}
          fontSize={titleFontSize}
          fontStyle="bold"
          fill="#166534"
          align="left"
        />

        {!isSmallField && (
          <>
            <Text
              x={textOffsetX}
              y={4 + titleFontSize + 2}
              width={availableWidth}
              text={`Signed by: ${signerName}`}
              fontSize={detailFontSize}
              fill="#6b7280"
              align="left"
            />

            {formattedDate.date && (
              <Text
                x={textOffsetX}
                y={4 + titleFontSize + detailFontSize + 4}
                width={availableWidth}
                text={`Date: ${formattedDate.date} at ${formattedDate.time}`}
                fontSize={detailFontSize}
                fill="#6b7280"
                align="left"
              />
            )}
          </>
        )}

        {isSmallField && formattedDate.date && (
          <Text
            x={textOffsetX}
            y={4 + titleFontSize + 2}
            width={availableWidth}
            text={`${signerName} • ${formattedDate.date}`}
            fontSize={detailFontSize}
            fill="#6b7280"
            align="left"
          />
        )}
      </>
    );
  };

  // Determine which renderer to use
  const shouldShowFilledFieldStamp = field.signatureData?.signedAt;

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
        {shouldShowFilledFieldStamp
          ? renderFilledFieldStamp()
          : isCheckbox
            ? renderCheckbox()
            : renderField()}
      </Group>

      {/* Transformer for resize handles */}
      {isSelected && (
        <Transformer
          ref={trRef}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 24 || newBox.height < 20) {
              return oldBox;
            }
            return newBox;
          }}
          enabledAnchors={[
            "top-left",
            "top-center",
            "top-right",
            "middle-left",
            "middle-right",
            "bottom-left",
            "bottom-center",
            "bottom-right",
          ]}
          rotateEnabled={false}
          borderStroke={colors.accent}
          borderStrokeWidth={1.5}
          anchorFill="#ffffff"
          anchorStroke={colors.accent}
          anchorStrokeWidth={1.5}
          anchorSize={8}
          anchorCornerRadius={2}
        />
      )}
    </>
  );
}
