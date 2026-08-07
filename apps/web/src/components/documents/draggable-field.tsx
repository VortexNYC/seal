import { canvas } from "@seal/tokens/theme";
import { formatMoney, money } from "@vortexnyc/money";
import type Konva from "konva";
import { useEffect, useRef, useState } from "react";
import {
  Group,
  Image as KonvaImage,
  Rect,
  Text,
  Transformer,
} from "react-konva";

import type { FieldType } from "./field-toolbar";
import {
  getRecipientColorById,
  type RecipientColor,
  UNASSIGNED_COLOR,
} from "./recipient-colors";

function useSealIcon(): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new window.Image();
    img.src = "/logo/seal-icon-color-no-background.svg";
    img.addEventListener("load", () => setImage(img));
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
    case "number":
      return "Number";
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
    case "payment":
      return "Payment";
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
  /** Payment total in cents for display on canvas */
  paymentTotalCents?: number;
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

/** Canvas field color palette — sourced from @seal/tokens */
const FIELD_COLORS = canvas.fieldColors;

type FieldColors = {
  readonly ink: string;
  readonly accent: string;
  readonly glow: string;
};

type FieldRenderState = {
  readonly colors: FieldColors;
  readonly isUnassigned: boolean;
  readonly label: string;
};

type FieldRendererProps = {
  readonly field: PlacedField;
  readonly isSelected: boolean;
  readonly colors: FieldColors;
};

type StandardFieldProps = FieldRendererProps & {
  readonly isUnassigned: boolean;
  readonly label: string;
  readonly sealIcon: HTMLImageElement | null;
};

type SidebarMetrics = {
  readonly iconSize: number;
  readonly sidebarWidth: number;
  readonly textOffsetX: number;
};

type FormattedSignatureDate = {
  readonly date: string;
  readonly time: string;
};

/**
 * Field type labels
 */
const FIELD_LABELS: Record<FieldType, string> = {
  signature: "Signature",
  text: "Text",
  number: "Number",
  date: "Date",
  checkbox: "",
  dropdown: "Select",
  radio: "Choice",
  attachment: "File",
  payment: "Payment",
};

/**
 * Default field dimensions
 */
export const FIELD_DIMENSIONS: Record<
  FieldType,
  { width: number; height: number }
> = {
  signature: { width: 200, height: 50 },
  text: { width: 180, height: 36 },
  number: { width: 180, height: 36 },
  date: { width: 140, height: 36 },
  checkbox: { width: 28, height: 28 },
  dropdown: { width: 180, height: 36 },
  radio: { width: 140, height: 36 },
  attachment: { width: 180, height: 44 },
  payment: { width: 220, height: 60 },
};

/**
 * Convert RecipientColor to the color format used by field rendering
 */
function recipientColorToFieldColors(
  recipientColor: RecipientColor
): FieldColors {
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
  const renderState = getFieldRenderState(
    field,
    recipientIndexMap,
    useRecipientColors
  );

  // Update transformer when selection changes
  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
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
      Math.max(20, node.height() * scaleY)
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
        <FieldContent
          colors={renderState.colors}
          field={field}
          isSelected={isSelected}
          isUnassigned={renderState.isUnassigned}
          label={renderState.label}
          sealIcon={sealIcon}
        />
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
          borderStroke={renderState.colors.accent}
          borderStrokeWidth={1.5}
          anchorFill={canvas.chrome.anchorFill}
          anchorStroke={renderState.colors.accent}
          anchorStrokeWidth={1.5}
          anchorSize={8}
          anchorCornerRadius={2}
        />
      )}
    </>
  );
}

function getFieldRenderState(
  field: PlacedField,
  recipientIndexMap: Map<string, number> | undefined,
  useRecipientColors: boolean
): FieldRenderState {
  const recipientColor = useRecipientColors
    ? getRecipientColorById(field.recipientId, recipientIndexMap ?? new Map())
    : null;
  const colors = recipientColor
    ? recipientColorToFieldColors(recipientColor)
    : FIELD_COLORS[field.fieldType];
  return {
    colors,
    isUnassigned:
      useRecipientColors &&
      (!field.recipientId || recipientColor === UNASSIGNED_COLOR),
    label: field.label || FIELD_LABELS[field.fieldType],
  };
}

function FieldContent({
  colors,
  field,
  isSelected,
  isUnassigned,
  label,
  sealIcon,
}: StandardFieldProps) {
  if (field.signatureData?.signedAt) {
    return (
      <FilledFieldStamp
        colors={colors}
        field={field}
        isSelected={isSelected}
        sealIcon={sealIcon}
      />
    );
  }
  if (field.fieldType === "checkbox") {
    return (
      <CheckboxField colors={colors} field={field} isSelected={isSelected} />
    );
  }
  return (
    <StandardField
      colors={colors}
      field={field}
      isSelected={isSelected}
      isUnassigned={isUnassigned}
      label={label}
      sealIcon={sealIcon}
    />
  );
}

function CheckboxField({ colors, field, isSelected }: FieldRendererProps) {
  const options = field.properties?.options;
  return options && options.length > 0 ? (
    <CheckboxGroupField
      colors={colors}
      field={field}
      isSelected={isSelected}
      options={options}
    />
  ) : (
    <SingleCheckboxField
      colors={colors}
      field={field}
      isSelected={isSelected}
    />
  );
}

function SingleCheckboxField({
  colors,
  field,
  isSelected,
}: FieldRendererProps) {
  const safeSize = Math.max(16, Math.min(field.width, field.height) - 6);
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
        fill={canvas.chrome.background}
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

function CheckboxGroupField({
  colors,
  field,
  isSelected,
  options,
}: FieldRendererProps & {
  readonly options: readonly string[];
}) {
  return (
    <>
      <FieldBackground
        colors={colors}
        field={field}
        isSelected={isSelected}
        dashed
      />
      <AccentRail
        colors={colors}
        field={field}
        isSelected={isSelected}
        unselectedOpacity={0.7}
      />
      {field.label && <CheckboxGroupTitle colors={colors} field={field} />}
      {options.map((option, index) => (
        <CheckboxOption
          key={option}
          colors={colors}
          field={field}
          index={index}
          option={option}
        />
      ))}
    </>
  );
}

function CheckboxGroupTitle({
  colors,
  field,
}: Pick<FieldRendererProps, "colors" | "field">) {
  return (
    <Text
      x={12}
      y={8}
      text={field.label}
      fontSize={10}
      fontFamily="'DM Sans', system-ui, sans-serif"
      fontStyle="600"
      fill={colors.ink}
      opacity={0.7}
      listening={false}
    />
  );
}

function CheckboxOption({
  colors,
  field,
  index,
  option,
}: {
  readonly colors: FieldColors;
  readonly field: PlacedField;
  readonly index: number;
  readonly option: string;
}) {
  const checkboxSize = 14;
  const padding = 8;
  const yPos = (field.label ? padding + 16 : padding) + index * 22;
  return (
    <Group x={padding + 4} y={yPos}>
      <Rect
        width={checkboxSize}
        height={checkboxSize}
        cornerRadius={3}
        stroke={colors.accent}
        strokeWidth={1.5}
        fill={canvas.chrome.background}
      />
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
      <Text
        x={checkboxSize + 6}
        y={1}
        text={option}
        fontSize={11}
        fontFamily="'DM Sans', system-ui, sans-serif"
        fill={canvas.chrome.optionText}
        listening={false}
      />
    </Group>
  );
}

function StandardField({
  colors,
  field,
  isSelected,
  isUnassigned,
  label,
  sealIcon,
}: StandardFieldProps) {
  const metrics = sealSidebarMetrics(field, sealIcon, 12);
  return (
    <>
      <StandardFieldBackground
        colors={colors}
        field={field}
        isSelected={isSelected}
        isUnassigned={isUnassigned}
      />
      <AccentRail
        colors={colors}
        field={field}
        isSelected={isSelected}
        isUnassigned={isUnassigned}
      />
      <SealSidebar
        colors={colors}
        field={field}
        metrics={metrics}
        sealIcon={sealIcon}
      />
      <StandardFieldLabel
        colors={colors}
        field={field}
        isUnassigned={isUnassigned}
        label={label}
        textOffsetX={metrics.textOffsetX}
      />
    </>
  );
}

function StandardFieldBackground({
  colors,
  field,
  isSelected,
  isUnassigned,
}: FieldRendererProps & {
  readonly isUnassigned: boolean;
}) {
  return (
    <Rect
      width={field.width}
      height={field.height}
      fill={
        isUnassigned
          ? canvas.chrome.backgroundUnassigned
          : canvas.chrome.background
      }
      stroke={isSelected ? colors.accent : canvas.chrome.borderUnselected}
      strokeWidth={isSelected ? 2 : 1}
      cornerRadius={6}
      shadowColor={isSelected ? colors.glow : canvas.chrome.shadowUnselected}
      shadowBlur={isSelected ? 12 : 4}
      shadowOpacity={1}
      shadowOffsetY={isSelected ? 0 : 2}
      dash={isUnassigned ? [4, 4] : undefined}
      dashEnabled={isUnassigned}
    />
  );
}

function FieldBackground({
  colors,
  dashed,
  field,
  isSelected,
}: FieldRendererProps & {
  readonly dashed?: boolean;
}) {
  return (
    <Rect
      width={field.width}
      height={field.height}
      fill={canvas.chrome.background}
      stroke={isSelected ? colors.accent : colors.ink}
      strokeWidth={isSelected ? 2 : 1}
      cornerRadius={6}
      shadowColor={isSelected ? colors.glow : canvas.chrome.shadowCheckbox}
      shadowBlur={isSelected ? 12 : 4}
      shadowOpacity={1}
      shadowOffsetY={isSelected ? 0 : 2}
      dash={[6, 3]}
      dashEnabled={Boolean(dashed && !isSelected)}
    />
  );
}

function AccentRail({
  colors,
  field,
  isSelected,
  isUnassigned,
  unselectedOpacity = 0.9,
}: Pick<FieldRendererProps, "colors" | "field" | "isSelected"> & {
  readonly isUnassigned?: boolean;
  readonly unselectedOpacity?: number;
}) {
  return (
    <Rect
      x={0}
      y={0}
      width={4}
      height={field.height}
      fill={colors.accent}
      cornerRadius={[6, 0, 0, 6]}
      opacity={isSelected ? 1 : isUnassigned ? 0.5 : unselectedOpacity}
    />
  );
}

function SealSidebar({
  colors,
  field,
  metrics,
  sealIcon,
}: Pick<FieldRendererProps, "colors" | "field"> & {
  readonly metrics: SidebarMetrics;
  readonly sealIcon: HTMLImageElement | null;
}) {
  if (!sealIcon) return null;
  return (
    <Group x={4} y={0}>
      <Rect
        width={metrics.sidebarWidth}
        height={field.height}
        fill={colors.glow}
        opacity={0.3}
      />
      <Rect
        x={metrics.sidebarWidth}
        y={0}
        width={1}
        height={field.height}
        fill={colors.accent}
        opacity={0.15}
      />
      <KonvaImage
        image={sealIcon}
        x={(metrics.sidebarWidth - metrics.iconSize) / 2}
        y={(field.height - metrics.iconSize) / 2}
        width={metrics.iconSize}
        height={metrics.iconSize}
        opacity={0.85}
      />
    </Group>
  );
}

function StandardFieldLabel({
  colors,
  field,
  isUnassigned,
  label,
  textOffsetX,
}: Pick<FieldRendererProps, "colors" | "field"> & {
  readonly isUnassigned: boolean;
  readonly label: string;
  readonly textOffsetX: number;
}) {
  if (!label) return null;
  return field.fieldType === "payment" &&
    field.paymentTotalCents !== undefined ? (
    <PaymentFieldLabel
      colors={colors}
      field={field}
      isUnassigned={isUnassigned}
      label={label}
      textOffsetX={textOffsetX}
    />
  ) : (
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
  );
}

function PaymentFieldLabel({
  colors,
  field,
  isUnassigned,
  label,
  textOffsetX,
}: Pick<FieldRendererProps, "colors" | "field"> & {
  readonly isUnassigned: boolean;
  readonly label: string;
  readonly textOffsetX: number;
}) {
  return (
    <>
      <Text
        x={textOffsetX}
        y={8}
        width={field.width - textOffsetX - 4}
        height={field.height / 2 - 4}
        text={isUnassigned ? `${label} (unassigned)` : label}
        fontSize={10}
        fontFamily="'DM Sans', system-ui, sans-serif"
        fontStyle="600"
        fill={colors.ink}
        opacity={isUnassigned ? 0.6 : 0.7}
        align="left"
        verticalAlign="top"
        letterSpacing={0.3}
        listening={false}
      />
      <Text
        x={textOffsetX}
        y={field.height / 2 - 2}
        width={field.width - textOffsetX - 4}
        height={field.height / 2}
        text={formatPaymentTotal(field.paymentTotalCents)}
        fontSize={16}
        fontFamily="'DM Sans', system-ui, sans-serif"
        fontStyle="700"
        fill={colors.accent}
        opacity={0.9}
        align="left"
        verticalAlign="top"
        letterSpacing={0.3}
        listening={false}
      />
    </>
  );
}

function FilledFieldStamp({
  colors,
  field,
  isSelected,
  sealIcon,
}: FieldRendererProps & {
  readonly sealIcon: HTMLImageElement | null;
}) {
  const metrics = sealSidebarMetrics(field, sealIcon, 8);
  const availableWidth = field.width - metrics.textOffsetX - 4;
  const availableHeight = field.height - 8;
  const isSmallField = availableHeight < 40;
  const titleFontSize = isSmallField ? 8 : 10;
  const detailFontSize = isSmallField ? 7 : 9;
  const formattedDate = formatSignatureDate(field.signatureData?.signedAt);
  const signerName =
    field.signatureData?.signerName ||
    field.signatureData?.signerEmail ||
    "Unknown";

  return (
    <>
      <FilledStampBackground
        colors={colors}
        field={field}
        isSelected={isSelected}
      />
      <FilledStampSidebar field={field} metrics={metrics} sealIcon={sealIcon} />
      <Text
        x={metrics.textOffsetX}
        y={4}
        width={availableWidth}
        text={getFieldTypeLabel(field.fieldType)}
        fontSize={titleFontSize}
        fontStyle="bold"
        fill={canvas.filled.titleText}
        align="left"
      />
      <FilledStampDetails
        availableWidth={availableWidth}
        detailFontSize={detailFontSize}
        formattedDate={formattedDate}
        isSmallField={isSmallField}
        signerName={signerName}
        textOffsetX={metrics.textOffsetX}
        titleFontSize={titleFontSize}
      />
    </>
  );
}

function FilledStampBackground({
  colors,
  field,
  isSelected,
}: FieldRendererProps) {
  return (
    <>
      <Rect
        width={field.width}
        height={field.height}
        fill={canvas.chrome.background}
        stroke={isSelected ? colors.accent : canvas.filled.stroke}
        strokeWidth={isSelected ? 2 : 1}
        cornerRadius={6}
        shadowColor={isSelected ? colors.glow : canvas.filled.shadowColor}
        shadowBlur={isSelected ? 12 : 4}
        shadowOpacity={1}
        shadowOffsetY={isSelected ? 0 : 2}
      />
      <Rect
        x={0}
        y={0}
        width={4}
        height={field.height}
        fill={canvas.filled.accent}
        cornerRadius={[6, 0, 0, 6]}
      />
    </>
  );
}

function FilledStampSidebar({
  field,
  metrics,
  sealIcon,
}: Pick<FieldRendererProps, "field"> & {
  readonly metrics: SidebarMetrics;
  readonly sealIcon: HTMLImageElement | null;
}) {
  if (!sealIcon) return null;
  return (
    <Group x={4} y={0}>
      <Rect
        width={metrics.sidebarWidth}
        height={field.height}
        fill={canvas.filled.accentTint}
      />
      <Rect
        x={metrics.sidebarWidth}
        y={0}
        width={1}
        height={field.height}
        fill={canvas.filled.accent}
        opacity={0.2}
      />
      <KonvaImage
        image={sealIcon}
        x={(metrics.sidebarWidth - metrics.iconSize) / 2}
        y={(field.height - metrics.iconSize) / 2}
        width={metrics.iconSize}
        height={metrics.iconSize}
        opacity={0.85}
      />
    </Group>
  );
}

function FilledStampDetails({
  availableWidth,
  detailFontSize,
  formattedDate,
  isSmallField,
  signerName,
  textOffsetX,
  titleFontSize,
}: {
  readonly availableWidth: number;
  readonly detailFontSize: number;
  readonly formattedDate: FormattedSignatureDate;
  readonly isSmallField: boolean;
  readonly signerName: string;
  readonly textOffsetX: number;
  readonly titleFontSize: number;
}) {
  return isSmallField ? (
    <SmallFilledStampDetails
      availableWidth={availableWidth}
      detailFontSize={detailFontSize}
      formattedDate={formattedDate}
      signerName={signerName}
      textOffsetX={textOffsetX}
      titleFontSize={titleFontSize}
    />
  ) : (
    <LargeFilledStampDetails
      availableWidth={availableWidth}
      detailFontSize={detailFontSize}
      formattedDate={formattedDate}
      signerName={signerName}
      textOffsetX={textOffsetX}
      titleFontSize={titleFontSize}
    />
  );
}

function LargeFilledStampDetails({
  availableWidth,
  detailFontSize,
  formattedDate,
  signerName,
  textOffsetX,
  titleFontSize,
}: Omit<Parameters<typeof FilledStampDetails>[0], "isSmallField">) {
  return (
    <>
      <Text
        x={textOffsetX}
        y={4 + titleFontSize + 2}
        width={availableWidth}
        text={`Signed by: ${signerName}`}
        fontSize={detailFontSize}
        fill={canvas.filled.detailText}
        align="left"
      />
      {formattedDate.date && (
        <Text
          x={textOffsetX}
          y={4 + titleFontSize + detailFontSize + 4}
          width={availableWidth}
          text={`Date: ${formattedDate.date} at ${formattedDate.time}`}
          fontSize={detailFontSize}
          fill={canvas.filled.detailText}
          align="left"
        />
      )}
    </>
  );
}

function SmallFilledStampDetails({
  availableWidth,
  detailFontSize,
  formattedDate,
  signerName,
  textOffsetX,
  titleFontSize,
}: Omit<Parameters<typeof FilledStampDetails>[0], "isSmallField">) {
  if (!formattedDate.date) return null;
  return (
    <Text
      x={textOffsetX}
      y={4 + titleFontSize + 2}
      width={availableWidth}
      text={`${signerName} - ${formattedDate.date}`}
      fontSize={detailFontSize}
      fill={canvas.filled.detailText}
      align="left"
    />
  );
}

function sealSidebarMetrics(
  field: PlacedField,
  sealIcon: HTMLImageElement | null,
  noIconTextOffsetX: number
): SidebarMetrics {
  const iconSize = Math.max(10, Math.min(16, field.height * 0.35));
  const sidebarWidth = iconSize + 16;
  return {
    iconSize,
    sidebarWidth,
    textOffsetX: sealIcon ? 4 + sidebarWidth + 10 : noIconTextOffsetX,
  };
}

function formatPaymentTotal(paymentTotalCents: number | undefined): string {
  return formatMoney(money(paymentTotalCents ?? 0, "USD"));
}

function formatSignatureDate(
  timestamp: number | undefined
): FormattedSignatureDate {
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
}
